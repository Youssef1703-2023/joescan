export function validateQuotaResult(value:any,kind:'burst'|'reserve'|'window'|'peek',expectedLimit?:number):any{
 const integer=(n:unknown)=>Number.isSafeInteger(n)&&Number(n)>=0;
 if(!value||typeof value!=='object')throw Error('QUOTA_STORE_UNAVAILABLE');
 if(kind==='peek'){if(!integer(value.used)||typeof value.day!=='string')throw Error('QUOTA_STORE_UNAVAILABLE');return value;}
 if(typeof value.ok!=='boolean')throw Error('QUOTA_STORE_UNAVAILABLE');
 if(kind==='reserve'||kind==='window'){
  const count=kind==='reserve'?value.used:value.count;
  if(!integer(count)||!integer(value.limit)||value.limit!==expectedLimit||(value.ok&&(count<1||count>value.limit)))throw Error('QUOTA_STORE_UNAVAILABLE');
 }
 if(value.retryAfter!==undefined&&(!integer(value.retryAfter)||value.retryAfter>86400))throw Error('QUOTA_STORE_UNAVAILABLE');
 return value;
}
