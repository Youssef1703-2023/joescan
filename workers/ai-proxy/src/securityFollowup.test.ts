import {it,expect,vi,afterEach} from 'vitest';import {validateQuotaResult} from './quotaValidation';import {recentAuthentication,securityRoute,deleteAccountData,DELETE_QUERIES} from './accountSecurity';
afterEach(()=>vi.unstubAllGlobals());
it.each([null,{}, {ok:'yes'},{ok:true,used:0,limit:10},{ok:true,used:11,limit:10},{ok:true,used:1,limit:999}])('rejects malformed quota replies %j',v=>{expect(()=>validateQuotaResult(v,'reserve',10)).toThrow();});
it('accepts a verified reservation',()=>expect(validateQuotaResult({ok:true,used:1,limit:10},'reserve',10).ok).toBe(true));
it('requires recent authentication',()=>{expect(recentAuthentication({auth_time:Date.now()/1000-301})).toBe(false);expect(recentAuthentication({})).toBe(false);expect(recentAuthentication({auth_time:Date.now()/1000})).toBe(true);});
it('rejects a caller-supplied foreign uid before any privileged request',async()=>{const f=vi.fn();vi.stubGlobal('fetch',f);const r=await securityRoute(new Request('https://x/account/delete',{method:'POST',body:JSON.stringify({confirm:'DELETE',uid:'victim'})}),{}, {sub:'self',auth_time:Date.now()/1000},false,{});expect(r.status).toBe(400);expect(f).not.toHaveBeenCalled();});
it('requires recent login before starting deletion',async()=>{const r=await securityRoute(new Request('https://x/account/delete',{method:'POST',body:JSON.stringify({confirm:'DELETE'})}),{}, {sub:'self',auth_time:1},false,{});expect(r.status).toBe(401);});
it('resumes bounded deletion and deletes Auth only after all owned queries',async()=>{
 let job:any=null;let queries=0,authCalls=0;const commits:any[]=[];const eraseAccount=vi.fn();
 vi.stubGlobal('fetch',vi.fn(async(url:string,init:any={})=>{if(url.includes('/accountDeletionJobs/')){if(init.method==='PATCH'){job=JSON.parse(init.body);return Response.json(job);}return job?Response.json(job):new Response('',{status:404});}if(url.endsWith(':runQuery')){queries++;expect(JSON.parse(init.body).structuredQuery.where.fieldFilter.value.stringValue).toBe('self');return Response.json([]);}if(url.endsWith(':commit')){commits.push(JSON.parse(init.body));return Response.json({});}if(url.includes('accounts:delete')){expect(queries).toBe(DELETE_QUERIES.length);expect(JSON.parse(init.body)).toEqual({localId:'self'});authCalls++;return Response.json({});}throw Error('unexpected request');}));
 const ns:any={idFromName:(id:string)=>id,get:()=>({eraseAccount})};const env={PROJECT_ID:'test',FIRESTORE_DATABASE_ID:'test',WATCHLIST_MONITOR:ns,QUOTA_COUNTER:ns};
 expect((await deleteAccountData(env,'self','token')).done).toBe(false);expect(authCalls).toBe(0);
 await deleteAccountData(env,'self','token');expect((await deleteAccountData(env,'self','token')).done).toBe(true);expect(authCalls).toBe(1);
 expect(commits.flatMap(c=>c.writes).every((w:any)=>w.delete.endsWith('/self'))).toBe(true);
 expect((await deleteAccountData(env,'self','token')).done).toBe(true);expect(authCalls).toBe(1);
});
