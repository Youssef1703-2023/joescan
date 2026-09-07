import * as jose from 'jose';
import {boundedJson} from './leakcheck';
interface SecurityEnv {FIREBASE_ADMIN_CREDENTIALS?:string;PROJECT_ID?:string;FIRESTORE_DATABASE_ID?:string;WATCHLIST_MONITOR?:DurableObjectNamespace;QUOTA_COUNTER?:DurableObjectNamespace}
export async function adminToken(env:SecurityEnv):Promise<string>{
 if(!env.FIREBASE_ADMIN_CREDENTIALS)throw Error('SECURITY_SERVICE_UNAVAILABLE');
 const key=JSON.parse(env.FIREBASE_ADMIN_CREDENTIALS);if(key.project_id!==env.PROJECT_ID)throw Error('WRONG_PROJECT');
 const jwt=await new jose.SignJWT({scope:'https://www.googleapis.com/auth/datastore https://www.googleapis.com/auth/identitytoolkit'}).setProtectedHeader({alg:'RS256'}).setIssuer(key.client_email).setAudience('https://oauth2.googleapis.com/token').setIssuedAt().setExpirationTime('5m').sign(await jose.importPKCS8(key.private_key,'RS256'));
 const r=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion:jwt}),signal:AbortSignal.timeout(10000)});
 if(!r.ok)throw Error('SECURITY_SERVICE_UNAVAILABLE');const d:any=await r.json();if(typeof d.access_token!=='string')throw Error('SECURITY_SERVICE_UNAVAILABLE');return d.access_token;
}
export function recentAuthentication(payload:jose.JWTPayload,now=Date.now()):boolean{return typeof payload.auth_time==='number'&&payload.auth_time<=now/1000+10&&now/1000-payload.auth_time<=300;}
async function eraseStore(stub:any){if(!stub)throw Error('STORE_UNAVAILABLE');if(typeof stub.fetch!=='function'&&typeof stub.eraseAccount==='function'){await stub.eraseAccount();return;}const r=await stub.fetch(new Request('https://internal/erase-account',{method:'POST'}));if(!r.ok)throw Error('STORE_UNAVAILABLE');}
const baseFor=(env:SecurityEnv)=>'https://firestore.googleapis.com/v1/projects/'+encodeURIComponent(env.PROJECT_ID!)+'/databases/'+encodeURIComponent(env.FIRESTORE_DATABASE_ID!)+'/documents';
async function jsonRequest(url:string,token:string,method='GET',body?:unknown){const r=await fetch(url,{method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(15000)});if(!r.ok&&r.status!==404)throw Error('SECURITY_STORE_UNAVAILABLE');return r;}
export const DELETE_QUERIES=[['scans','userId'],['watchlist','userId'],['webhooks','ownerId'],['teams','ownerId'],['supportTickets','userId'],['notifications','userId'],['apiKeys','userId'],['activityLog','userId'],['activityLog','targetUser'],['tierRequests','userId'],['usernames','uid'],['referralClaims','newUid'],['referralSignups','newUid'],['referralSignups','referrerUid'],['pendingOrders','userId']] as const;
export async function deleteAccountData(env:SecurityEnv,uid:string,token:string,email?:string){
 if(!uid||uid.length>128||/[\/]/.test(uid)||uid==='.'||uid==='..')throw Error('INVALID_UID');
 const base=baseFor(env),job=base+'/accountDeletionJobs/'+encodeURIComponent(uid);
 const snapshot=await jsonRequest(job,token);const state:any=snapshot.status===404?{}:await snapshot.json();if(state.fields?.done?.booleanValue)return {done:true};
 let phase=Number(state.fields?.phase?.integerValue||0);if(!Number.isInteger(phase)||phase<0||phase>DELETE_QUERIES.length)throw Error('INVALID_DELETE_STATE');
 const checkpoint=async(done=false)=>{const r=await jsonRequest(job,token,'PATCH',{fields:{phase:{integerValue:String(phase)},done:{booleanValue:done},updatedAt:{timestampValue:new Date().toISOString()}}});if(!r.ok)throw Error('DELETE_CHECKPOINT_FAILED');};
 // Tombstone first: Firestore and Worker deny new product work during cleanup.
 await checkpoint();
 const monitor:any=env.WATCHLIST_MONITOR?.get(env.WATCHLIST_MONITOR.idFromName(uid));await eraseStore(monitor);
 const root=base.replace('https://firestore.googleapis.com/v1/','');
 for(let batch=0;batch<5&&phase<DELETE_QUERIES.length;batch++){
  const [collection,field]=DELETE_QUERIES[phase];const r=await jsonRequest(base+':runQuery',token,'POST',{structuredQuery:{from:[{collectionId:collection}],where:{fieldFilter:{field:{fieldPath:field},op:'EQUAL',value:{stringValue:uid}}},limit:100}});if(!r.ok)throw Error('DELETE_QUERY_FAILED');
  const rows:any=await r.json();if(!Array.isArray(rows))throw Error('DELETE_QUERY_INVALID');const names=rows.filter(x=>x.document).map(x=>x.document.name);
  if(names.some((n:unknown)=>typeof n!=='string'||!n.startsWith(root+'/'+collection+'/')))throw Error('INVALID_DOCUMENT_PATH');
  if(names.length){const commit=await jsonRequest(base+':commit',token,'POST',{writes:names.map((name:string)=>({delete:name}))});if(!commit.ok)throw Error('DELETE_BATCH_FAILED');}
  if(names.length<100)phase++;await checkpoint();
 }
 if(phase<DELETE_QUERIES.length)return {done:false};
 // Delete documents addressed directly by UID only after the paginated owned data is gone.
 if(email){const r=await jsonRequest(base+':runQuery',token,'POST',{structuredQuery:{from:[{collectionId:'teams'}],where:{fieldFilter:{field:{fieldPath:'memberEmail'},op:'EQUAL',value:{stringValue:email.toLowerCase()}}},limit:100}});if(!r.ok)throw Error('DELETE_QUERY_FAILED');const rows:any=await r.json();const names=rows.filter((x:any)=>x.document).map((x:any)=>x.document.name);if(names.some((n:any)=>typeof n!=='string'||!n.startsWith(root+'/teams/')))throw Error('INVALID_PATH');if(names.length){await jsonRequest(base+':commit',token,'POST',{writes:names.map((n:string)=>({delete:n}))});if(names.length===100)return {done:false};}}
 const direct=['users','notifPrefs','referrals','referralClaims','mfaSecrets','aiUsage','rateLimits','bannedUsers'];
 const commit=await jsonRequest(base+':commit',token,'POST',{writes:direct.map(c=>({delete:root+'/'+c+'/'+uid}))});if(!commit.ok)throw Error('DELETE_PROFILE_FAILED');
 for(const key of [uid,'activity:'+uid,'email-extra:'+uid,'webhook:acct:'+uid]){const quota:any=env.QUOTA_COUNTER?.get(env.QUOTA_COUNTER.idFromName(key));await eraseStore(quota);}
 const r=await fetch('https://identitytoolkit.googleapis.com/v1/projects/'+encodeURIComponent(env.PROJECT_ID!)+'/accounts:delete',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({localId:uid}),signal:AbortSignal.timeout(15000)});
 if(!r.ok){const d:any=await r.json();if(d.error?.message!=='USER_NOT_FOUND')throw Error('AUTH_DELETE_FAILED');}
 await checkpoint(true);return {done:true};
}
export async function securityRoute(request:Request,env:SecurityEnv,payload:jose.JWTPayload,isAdmin:boolean,headers:Record<string,string>):Promise<Response>{
 const reply=(status:number,body:unknown)=>new Response(JSON.stringify(body),{status,headers:{...headers,'Content-Type':'application/json','Cache-Control':'no-store'}});
 if(request.method!=='POST')return reply(405,{error:'Use POST'});
 const uid=payload.sub!;
 try{
  const body:any=await boundedJson(request.body,4096);
  if(new URL(request.url).pathname==='/account/delete'){
   if(body.confirm!=='DELETE'||Object.keys(body).some(k=>k!=='confirm'))return reply(400,{error:'Confirm account deletion'});
   if(!recentAuthentication(payload))return reply(401,{error:'Please sign in again before deleting your account.',code:'RECENT_LOGIN_REQUIRED'});
   const result=await deleteAccountData(env,uid,await adminToken(env),typeof payload.email==='string'?payload.email:undefined);return reply(result.done?200:202,result);
  }
  const regular=['login','scan','ticket_create','ticket_reply','apikey_create','apikey_delete','profile_update','webhook_create','webhook_delete','team_invite','team_remove'];
  const privileged=['upgrade','ban','unban','promo_create','promo_delete','config_update','flag_update','broadcast','user_deleted'];
  if(!regular.includes(body.action)&&!(isAdmin&&privileged.includes(body.action)))return reply(403,{error:'Event not permitted'});
  if(typeof body.details!=='string'||body.details.length>1000||(!isAdmin&&body.targetUser&&body.targetUser!==uid))return reply(400,{error:'Invalid event'});
  const fields:any={userId:{stringValue:uid},email:{stringValue:String(payload.email||'')},action:{stringValue:body.action},details:{stringValue:'[Client-reported] '+body.details},timestamp:{stringValue:new Date().toISOString()},provenance:{stringValue:'authenticated-client-report'}};
  if(body.targetUser)fields.targetUser={stringValue:String(body.targetUser).slice(0,128)};
  const r=await jsonRequest(baseFor(env)+'/activityLog?documentId='+crypto.randomUUID(),await adminToken(env),'POST',{fields});if(!r.ok)throw Error('LOG_FAILED');return reply(201,{ok:true});
 }catch{return reply(503,{error:'Security service unavailable. Please retry; incomplete deletion remains blocked and can be resumed.'});}
}
