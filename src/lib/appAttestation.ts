import {getToken} from 'firebase/app-check';
export async function appAttestationHeaders():Promise<Record<string,string>> {
 const {appCheck}=await import('./firebase');
 const result=await getToken(appCheck);
 return {'X-Firebase-AppCheck':result.token};
}
