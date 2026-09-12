import { beforeEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ records: {} as Record<string, any>, writes: [] as {kind: string; path: string; data: any}[], reads: [] as string[], claims: {admin: true} as any, actor: 'admin', failWrite: false, audit: vi.fn(async (...args: any[]) => true), generated: 0 }));
vi.mock('./firebase', () => ({
 db: {}, ADMIN_EMAIL: 'owner@example.com',
 auth: { authStateReady: async () => {}, get currentUser() { return { uid: state.actor, email: 'owner@example.com', getIdTokenResult: async () => ({claims: state.claims}) }; } },
 logActivity: (...args: any[]) => state.audit(...args),
 calculateEntitlementGrant: (current: string, expiry: string, tier: string, days: number, trial: boolean) => ({tier: current === 'enterprise' && tier === 'pro' ? current : tier, subscriptionExpiry: '2030-01-01', subscriptionValidUntil: new Date('2030-01-01'), ...(trial ? {socTrialUsed: true} : {}), grantedDays: days}),
}));
vi.mock('firebase/firestore', () => {
 const snapshot = (ref: any) => { state.reads.push(ref.path); const data = state.records[ref.path]; return {id: ref.id, exists: () => data !== undefined, data: () => data}; };
 const commit = (ops: any[]) => { if (state.failWrite) throw Error('write rejected'); for (const op of ops) { state.writes.push(op); state.records[op.path] = op.kind === 'set' && !op.merge ? op.data : {...state.records[op.path], ...op.data}; } };
 const writer = (ops: any[]) => ({set: (ref: any, data: any, options?: any) => ops.push({kind: 'set', path: ref.path, data, merge: options?.merge}), update: (ref: any, data: any) => ops.push({kind: 'update', path: ref.path, data})});
 return {
  doc: (a: any, b?: string, c?: string) => {const path = c ? b + '/' + c : a.path + '/' + (b || 'generated' + ++state.generated); return {path, id: path.split('/').at(-1)};},
  collection: (_: any, name: string) => ({path: name}), serverTimestamp: () => 'SERVER_TIME', documentId: () => '__name__',
  where: (field: string, operator: string, value: any) => ({type: 'where', field, value}), orderBy: (field: string, direction = 'asc') => ({type: 'order', field, direction}), limit: (count: number) => ({type: 'limit', count}), startAfter: (id: string) => ({type: 'cursor', id}), query: (ref: any, ...constraints: any[]) => ({...ref, constraints}),
  getDoc: async (ref: any) => snapshot(ref),
  getDocs: async (ref: any) => {
   let rows = Object.entries(state.records).filter(([p]) => p.startsWith(ref.path + '/') && p.split('/').length === 2).map(([path, data]) => ({id: path.split('/')[1], data: () => data}));
   for (const q of ref.constraints || []) {
    if(q.type === 'where') rows=rows.filter(r=>r.data()[q.field]===q.value);
    if(q.type === 'order') rows.sort((a,b)=>String(q.field==='__name__'?a.id:a.data()[q.field]||'').localeCompare(String(q.field==='__name__'?b.id:b.data()[q.field]||''))*(q.direction==='desc'?-1:1));
    if(q.type === 'cursor') rows=rows.filter(r=>r.id>q.id); if(q.type === 'limit') rows=rows.slice(0,q.count);
   } return {docs:rows,empty:!rows.length};
  },
  runTransaction: async (_: any, run: any) => {const ops: any[]=[]; const result=await run({get: async (ref: any)=>{if(ops.length)throw Error('Read after write');return snapshot(ref);},...writer(ops)});commit(ops);return result;},
  writeBatch: () => {const ops: any[]=[];return {...writer(ops),commit:async()=>commit(ops)};},
 };
});
import { decideRequest, decideClaim, loadAdminSection, requestGrant, savePromo, saveSettings, sendAnnouncement, updatePerson, updateTicket } from './adminControl';
beforeEach(() => {state.records={};state.writes=[];state.reads=[];state.claims={admin:true};state.actor='admin';state.failWrite=false;state.generated=0;state.audit.mockClear();});
it('approves a request atomically without writing to the server-only activity collection, and rejects repeats', async () => {
 state.records['users/alex']={email:'alex@example.com',tier:'free'}; state.records['tierRequests/r1']={userId:'alex',status:'pending',kind:'subscription',tier:'pro'};
 await decideRequest('r1',true,'Payment checked');
 expect(state.records['users/alex'].tier).toBe('pro');expect(state.records['tierRequests/r1'].status).toBe('approved');expect(state.writes.some(w=>w.path.startsWith('activityLog/'))).toBe(false);expect(state.audit).toHaveBeenCalledOnce();
 await expect(decideRequest('r1',true,'Payment checked')).rejects.toThrow('already been decided');expect(state.audit).toHaveBeenCalledOnce();
});
it('rejects unverified administrator emails and unsupported rewards before committing changes', async () => {
 state.claims={email:'owner@example.com',email_verified:false}; await expect(savePromo('HELLO',20,'pro')).rejects.toThrow('verified administrator');expect(state.writes).toEqual([]);
 expect(()=>requestGrant({id:'bad',kind:'referral_reward',rewardTier:2})).toThrow('unsupported'); expect(()=>requestGrant({id:'bad',kind:'subscription',tier:'owner'})).toThrow('unsupported');
});
it('blocks a missing profile and duplicate referral eligibility without partial writes', async () => {
 state.records['tierRequests/r']={userId:'missing',status:'pending',kind:'subscription',tier:'pro'};await expect(decideRequest('r',true,'Checked')).rejects.toThrow('no longer exists');
 state.records['referralClaims/c']={status:'pending',newUid:'friend',code:'ABC'};state.records['referrals/owner']={code:'ABC',referralCount:3};state.records['referralSignups/friend']={newUid:'friend'};state.records['users/friend']={};
 await expect(decideClaim('c',true,'Checked')).rejects.toThrow('already redeemed');expect(state.writes).toEqual([]);
});
it('protects the administrator account and validates membership duration', async () => {
 await expect(updatePerson('admin','suspend',{reason:'test'})).rejects.toThrow('own administrator');
 await expect(updatePerson('someone','grant',{tier:'pro',days:0,reason:'test'})).rejects.toThrow('1–3650');expect(state.writes).toEqual([]);
});
it('preserves concurrent ticket replies by reading them inside the transaction', async () => {
 state.records['supportTickets/t']={status:'open',replies:[{from:'user',message:'latest message'}]};await updateTicket('t','Answer');
 expect(state.records['supportTickets/t'].replies.map((r:any)=>r.message)).toEqual(['latest message','Answer']);expect(state.records['supportTickets/t'].status).toBe('replied');
});
it('does not overwrite an existing promo or unrelated configuration and detects stale settings', async () => {
 state.records['promoCodes/HELLO']={discount:10};await expect(savePromo('HELLO',30,'pro')).rejects.toThrow('already exists');
 state.records['adminConfig/platformSettings']={maintenanceMode:false,aiMaintenanceMode:false,otherSetting:123};await saveSettings({maintenanceMode:true,aiMaintenanceMode:false},{maintenanceMode:false,aiMaintenanceMode:false});
 expect(state.records['adminConfig/platformSettings'].otherSetting).toBe(123);await expect(saveSettings({maintenanceMode:false,aiMaintenanceMode:false},{maintenanceMode:false,aiMaintenanceMode:false})).rejects.toThrow('Another administrator');
});
it('keeps old pending requests visible outside the latest fifty decisions', async () => {
 for(let i=1;i<=60;i++)state.records['tierRequests/r'+i]={status:'approved',createdAt:'2026-09-'+String(i).padStart(2,'0')};state.records['tierRequests/old']={status:'pending',createdAt:'2025-01-01'};
 const rows=await loadAdminSection('requests');expect(rows.some((r:any)=>r.id==='old')).toBe(true);expect(rows).toHaveLength(51);
});
it('propagates failed writes without claiming success or logging a completed action', async () => {
 state.failWrite=true;await expect(savePromo('SAVE20',20,'pro')).rejects.toThrow('write rejected');expect(state.audit).not.toHaveBeenCalled();expect(state.writes).toEqual([]);
});
it('delivers in-app announcements in atomic pages and resumes without overwriting notifications', async () => {
 for(let i=0;i<105;i++)state.records['users/u'+String(i).padStart(3,'0')]={};
 await sendAnnouncement('Maintenance tonight');expect(Object.keys(state.records).filter(p=>p.startsWith('notifications/'))).toHaveLength(105);expect(state.reads.some(p=>p.startsWith('notifications/'))).toBe(false);
 const announcement=Object.entries(state.records).find(([p])=>p.startsWith('broadcasts/'))!;expect(announcement[1].status).toBe('sent');expect(announcement[1].recipientCount).toBe(105);
 state.writes=[];await sendAnnouncement('Maintenance tonight',announcement[0].split('/')[1]);expect(state.writes).toEqual([]);
 // Simulate a committed first page followed by a lost connection.
 state.records['broadcasts/partial']={message:'A second update',status:'sending',recipientCount:100,deliveryCursor:'u099'};
 state.records['notifications/partial_u000']={read:true};state.writes=[];await sendAnnouncement('A second update','partial');expect(state.writes.filter(w=>w.path.startsWith('notifications/'))).toHaveLength(5);expect(state.records['notifications/partial_u000'].read).toBe(true);
});
