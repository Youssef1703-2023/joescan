import { auth, db, ADMIN_EMAIL, calculateEntitlementGrant, logActivity, type ActivityType } from './firebase';
import { collection, doc, getDoc, getDocs, query, where, orderBy, limit, documentId, startAfter, runTransaction, writeBatch, serverTimestamp, type DocumentData } from 'firebase/firestore';

export type AdminRecord = DocumentData & { id: string };
export type AdminSection = 'users' | 'bans' | 'requests' | 'claims' | 'tickets' | 'promos' | 'activity' | 'settings' | 'announcements';
export type AdminSettings = { maintenanceMode: boolean; aiMaintenanceMode: boolean };
export const SETTING_DEFAULTS: AdminSettings = { maintenanceMode: false, aiMaintenanceMode: false };
export const SECTION_NAMES: Record<AdminSection, string> = { users: 'People', bans: 'Access records', requests: 'Subscription requests', claims: 'Referral claims', tickets: 'Support', promos: 'Promotions', activity: 'Activity', settings: 'Settings', announcements: 'Announcements' };
export const dateMs = (value: any): number => {
  const time = value?.toDate ? value.toDate().getTime() : value?.seconds ? value.seconds * 1000 : value ? new Date(value).getTime() : 0;
  return Number.isFinite(time) ? time : 0;
};
export const newest = (rows: AdminRecord[], field = 'createdAt') => [...rows].sort((a, b) => dateMs(b[field]) - dateMs(a[field]));
export const identity = (row: AdminRecord) => row.email || row.name || row.displayName || row.id;
export const effectiveTier = (row: AdminRecord): 'free' | 'pro' | 'enterprise' => {
  const expiry = dateMs(row.subscriptionValidUntil || row.subscriptionExpiry);
  return ['pro', 'enterprise'].includes(row.tier) && expiry > Date.now() ? row.tier as 'pro' | 'enterprise' : 'free';
};
export async function requireAdministrator() {
  await auth.authStateReady();
  const user = auth.currentUser;
  if (!user) throw Error('Sign in with your administrator account.');
  const token = await user.getIdTokenResult(true);
  if (auth.currentUser?.uid !== user.uid || !(token.claims.admin === true || (token.claims.email === ADMIN_EMAIL && token.claims.email_verified === true))) {
    throw Error('A verified administrator session is required.');
  }
  return user;
}
const rows = (snap: any): AdminRecord[] => snap.docs.map((d: any) => ({ ...d.data(), id: d.id }));
async function queueRows(name: string) {
  // Never bury an old pending request behind a limit on recent decisions.
  const [pending, recent] = await Promise.all([
    getDocs(query(collection(db, name), where('status', '==', 'pending'))),
    getDocs(query(collection(db, name), orderBy('createdAt', 'desc'), limit(50))),
  ]);
  return newest(Array.from(new Map([...rows(recent), ...rows(pending)].map(r => [r.id, r])).values()));
}
export async function loadAdminSection(section: AdminSection): Promise<any> {
  if (section === 'settings') {
    const data = (await getDoc(doc(db, 'adminConfig', 'platformSettings'))).data() || {};
    return { maintenanceMode: data.maintenanceMode === true, aiMaintenanceMode: data.aiMaintenanceMode === true };
  }
  if (section === 'requests') return queueRows('tierRequests');
  if (section === 'claims') return queueRows('referralClaims');
  const names = { users: 'users', bans: 'bannedUsers', tickets: 'supportTickets', promos: 'promoCodes', activity: 'activityLog', announcements: 'broadcasts' };
  const source = collection(db, names[section]);
  return rows(await getDocs(section === 'activity' ? query(source, orderBy('timestamp', 'desc'), limit(100)) : section === 'announcements' ? query(source, orderBy('createdAt', 'desc'), limit(20)) : source));
}
const validId = (id: string) => { if (!id || id.includes('/') || id.length > 1500) throw Error('Invalid record. Refresh and try again.'); };
const text = (value: string, max = 1000) => { const v = value.trim(); if (!v || v.length > max) throw Error(`Enter between 1 and ${max} characters.`); return v; };
const audit = async (action: ActivityType, details: string, uid?: string) => ({ auditRecorded: await logActivity(action, details, uid) });
export function requestGrant(request: AdminRecord) {
  if (request.kind === 'subscription' && ['pro', 'enterprise'].includes(request.tier)) return { tier: request.tier as 'pro' | 'enterprise', days: 30 };
  if (request.kind === 'soc_trial') return { tier: 'enterprise' as const, days: 3 };
  const rewards: Record<number, { tier: 'pro' | 'enterprise'; days: number }> = { 1: { tier: 'pro', days: 7 }, 3: { tier: 'pro', days: 30 }, 5: { tier: 'pro', days: 90 }, 10: { tier: 'enterprise', days: 3650 } };
  if (request.kind === 'referral_reward' && typeof request.rewardTier === 'number' && rewards[request.rewardTier]) return rewards[request.rewardTier];
  throw Error('This request has an unsupported plan or reward.');
}
export async function decideRequest(id: string, approve: boolean, reason: string) {
  validId(id); const actor = await requireAdministrator(); const note = text(reason);
  await runTransaction(db, async tx => {
    const ref = doc(db, 'tierRequests', id); const snap = await tx.get(ref);
    if (!snap.exists() || snap.data().status !== 'pending') throw Error('This request has already been decided. Refresh the queue.');
    const r = { ...snap.data(), id } as AdminRecord;
    if (approve) {
      validId(r.userId); const userRef = doc(db, 'users', r.userId); const user = await tx.get(userRef);
      if (!user.exists()) throw Error('The user profile no longer exists.');
      const u = user.data(); const grant = requestGrant(r);
      if (r.kind === 'soc_trial' && u.socTrialUsed) throw Error('This trial has already been used.');
      if (r.kind === 'referral_reward') {
        const rewardRef = doc(db, 'referrals', r.userId); const reward = await tx.get(rewardRef); const data = reward.data() || {};
        if ((data.referralCount || 0) < r.rewardTier || (data.claimedTiers || []).includes(r.rewardTier)) throw Error('Referral reward is not eligible or has already been claimed.');
        tx.set(rewardRef, { claimedTiers: [...(data.claimedTiers || []), r.rewardTier], updatedAt: serverTimestamp() }, { merge: true });
      }
      tx.update(userRef, { ...calculateEntitlementGrant(effectiveTier(u as AdminRecord), u.subscriptionValidUntil || u.subscriptionExpiry, grant.tier, grant.days, r.kind === 'soc_trial'), updatedAt: serverTimestamp() });
    }
    tx.update(ref, { status: approve ? 'approved' : 'rejected', decidedBy: actor.email, decidedAt: new Date().toISOString(), decisionNote: note, ...(!approve ? { rejectionReason: note } : {}) });
  });
  return audit(approve ? 'upgrade' : 'config_update', `${approve ? 'Approved' : 'Rejected'} subscription request ${id}: ${note}`.slice(0, 1000));
}
export async function decideClaim(id: string, approve: boolean, reason: string) {
  validId(id); const actor = await requireAdministrator(); const note = text(reason); const ref = doc(db, 'referralClaims', id);
  const initial = await getDoc(ref); if (!initial.exists()) throw Error('Claim no longer exists.'); const original = initial.data();
  let owner = '';
  if (approve) {
    const found = await getDocs(query(collection(db, 'referrals'), where('code', '==', original.code)));
    if (found.docs.length !== 1) throw Error('This referral code is missing or ambiguous.'); owner = found.docs[0].id;
  }
  await runTransaction(db, async tx => {
    const current = await tx.get(ref); const c = current.data();
    if (!c || c.status !== 'pending') throw Error('This claim has already been decided.');
    if (approve) {
      if (c.code !== original.code || c.newUid !== original.newUid) throw Error('The claim changed. Refresh and review it again.');
      validId(c.newUid); if (c.newUid === owner) throw Error('Self-referrals cannot be approved.');
      const marker = doc(db, 'referralSignups', c.newUid); const rewardRef = doc(db, 'referrals', owner);
      const [used, reward, user] = await Promise.all([tx.get(marker), tx.get(rewardRef), tx.get(doc(db, 'users', c.newUid))]);
      if (used.exists()) throw Error('This account has already redeemed a referral.');
      if (!user.exists() || !reward.exists() || reward.data().code !== c.code) throw Error('Referral details are no longer valid.');
      tx.set(marker, { newUid: c.newUid, referrerUid: owner, code: c.code, createdAt: new Date().toISOString() });
      tx.update(rewardRef, { referralCount: (Number(reward.data().referralCount) || 0) + 1, updatedAt: serverTimestamp() });
    }
    tx.update(ref, { status: approve ? 'approved' : 'rejected', decidedBy: actor.email, decidedAt: new Date().toISOString(), decisionNote: note, ...(approve ? { referrerUid: owner } : { rejectionReason: note }) });
  });
  return audit('config_update', `${approve ? 'Approved' : 'Rejected'} referral claim ${id}: ${note}`.slice(0, 1000));
}
export async function updatePerson(uid: string, mode: 'grant' | 'suspend' | 'restore', data: { tier?: string; days?: number; reason: string }) {
  validId(uid); const actor = await requireAdministrator(); const reason = text(data.reason);
  if (uid === actor.uid) throw Error('Your own administrator account cannot be changed here.');
  if (mode === 'grant' && (!['free', 'pro', 'enterprise'].includes(data.tier || '') || !Number.isInteger(data.days) || data.days! < 1 || data.days! > 3650)) throw Error('Select a valid plan and 1–3650 days.');
  await runTransaction(db, async tx => {
    const ref = doc(db, 'users', uid); const snap = await tx.get(ref);
    if (!snap.exists()) throw Error('User profile no longer exists.');
    if (snap.data().email?.toLowerCase() === ADMIN_EMAIL.toLowerCase()) throw Error('This administrator account is protected.');
    if (mode === 'grant') {
      const user = snap.data();
      tx.update(ref, { ...(data.tier === 'free' ? { tier: 'free', subscriptionExpiry: new Date().toISOString(), subscriptionValidUntil: new Date() } : calculateEntitlementGrant(effectiveTier(user as AdminRecord), user.subscriptionValidUntil || user.subscriptionExpiry, data.tier as 'pro' | 'enterprise', data.days!)), updatedAt: serverTimestamp(), adminNote: reason });
    } else tx.set(doc(db, 'bannedUsers', uid), { uid, active: mode === 'suspend', reason, bannedBy: actor.email, ...(mode === 'suspend' ? { bannedAt: new Date().toISOString() } : { restoredAt: new Date().toISOString() }) }, { merge: true });
  });
  return audit(mode === 'grant' ? 'upgrade' : mode === 'suspend' ? 'ban' : 'unban', `${mode}: ${reason}`, uid);
}
export async function savePromo(code: string, discount: number, tier: string) {
  await requireAdministrator(); const id = code.trim().toUpperCase();
  if (!/^[A-Z0-9_-]{1,32}$/.test(id) || !Number.isFinite(discount) || discount <= 0 || discount > 100 || !['all', 'pro', 'enterprise'].includes(tier)) throw Error('Use a valid code, discount from 1–100%, and eligible plan.');
  await runTransaction(db, async tx => {
    const ref = doc(db, 'promoCodes', id); if ((await tx.get(ref)).exists()) throw Error('That code already exists. Choose another code.');
    tx.set(ref, { code: id, discount, targetTier: tier, active: true, createdAt: new Date().toISOString() });
  });
  return audit('promo_create', `Created ${id}: ${discount}% for ${tier}`);
}
export async function setPromoActive(id: string, active: boolean) {
  await requireAdministrator(); validId(id);
  await runTransaction(db, async tx => { const ref = doc(db, 'promoCodes', id); if (!(await tx.get(ref)).exists()) throw Error('Code no longer exists.'); tx.update(ref, { active }); });
  return audit('config_update', `${active ? 'Enabled' : 'Paused'} promotion ${id}`);
}
export async function updateTicket(id: string, reply: string, close = false) {
  await requireAdministrator(); validId(id); const message = close ? '' : text(reply, 4000);
  await runTransaction(db, async tx => {
    const ref = doc(db, 'supportTickets', id); const snap = await tx.get(ref);
    if (!snap.exists()) throw Error('Ticket no longer exists.');
    if (!close && snap.data().status === 'closed') throw Error('This ticket is already closed. Refresh to see its current status.');
    tx.update(ref, close ? { status: 'closed' } : { replies: [...(snap.data().replies || []), { message, from: 'admin', timestamp: new Date().toISOString() }], status: 'replied' });
  });
  return audit(close ? 'config_update' : 'ticket_reply', `${close ? 'Closed' : 'Replied to'} ticket ${id}`);
}
export async function saveSettings(settings: AdminSettings, previous: AdminSettings) {
  await requireAdministrator();
  await runTransaction(db, async tx => {
    const ref = doc(db, 'adminConfig', 'platformSettings'); const data = (await tx.get(ref)).data() || {};
    if (Object.keys(SETTING_DEFAULTS).some(key => (data[key] === true) !== previous[key as keyof AdminSettings])) throw Error('Another administrator changed these settings. Refresh before saving.');
    tx.set(ref, { maintenanceMode: !!settings.maintenanceMode, aiMaintenanceMode: !!settings.aiMaintenanceMode, updatedAt: serverTimestamp() }, { merge: true });
  });
  return audit('config_update', `Maintenance ${settings.maintenanceMode ? 'on' : 'off'}; AI maintenance ${settings.aiMaintenanceMode ? 'on' : 'off'}`);
}
export async function sendAnnouncement(message: string, existingId?: string) {
  const actor = await requireAdministrator(); const body = text(message);
  if (existingId) validId(existingId);
  const ref = existingId ? doc(db, 'broadcasts', existingId) : doc(collection(db, 'broadcasts'));
  if (!existingId) {
    const batch = writeBatch(db);
    batch.set(ref, { message: body, createdAt: serverTimestamp(), sentBy: actor.email, status: 'sending', recipientCount: 0, deliveryCursor: null });
    await batch.commit();
  }
  try {
    // Each cursor and notification batch commit atomically. Resume starts after
    // the last delivered account without reading or overwriting private notifications.
    for (;;) {
      const latest = await getDoc(ref); const state = latest.data();
      if (!state || state.message !== body) throw Error('Announcement changed.');
      if (state.status === 'sent') break;
      const cursor = state.deliveryCursor || null;
      const source = collection(db, 'users');
      const audience = await getDocs(query(source, orderBy(documentId()), ...(cursor ? [startAfter(cursor)] : []), limit(100)));
      await runTransaction(db, async tx => {
        const current = (await tx.get(ref)).data();
        if (!current || current.message !== body || current.status !== 'sending' || (current.deliveryCursor || null) !== cursor) throw Error('Delivery moved forward. Refresh and resume.');
        audience.docs.forEach(user => tx.set(doc(db, 'notifications', ref.id + '_' + user.id), { userId: user.id, title: 'JoeScan announcement', message: body, type: 'broadcast', read: false, createdAt: serverTimestamp() }));
        tx.update(ref, { recipientCount: (Number(current.recipientCount) || 0) + audience.docs.length, ...(audience.docs.length ? { deliveryCursor: audience.docs[audience.docs.length - 1].id } : { status: 'sent', completedAt: serverTimestamp() }) });
      });
      if (!audience.docs.length) break;
    }
  } catch {
    throw Error('Delivery is incomplete. Close this window, refresh, then use Resume on this announcement. Delivered notifications will not be duplicated.');
  }
  return audit('broadcast', 'Announcement ' + ref.id + ' delivered');
}
