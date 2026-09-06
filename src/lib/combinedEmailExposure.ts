import {fetchEmailExposure,assessEmailBreaches,EmailSourceError} from './emailExposure';
import {groupEmailEvidence,parseExtraExposure} from './emailEvidence';
export async function fetchCombinedEmailExposure(email:string,language:string,extraRequest:()=>Promise<unknown>) {
 const [main,extra]=await Promise.allSettled([fetchEmailExposure(email,language),extraRequest().then(parseExtraExposure)]);
 if(main.status==='rejected'&&extra.status==='rejected')throw new EmailSourceError();
 const primary=main.status==='fulfilled'?main.value.breaches:[];
 const additional=extra.status==='fulfilled'?extra.value:null;
 const groups=groupEmailEvidence(primary,additional);
 const breaches=groups.map(g=>({name:g.name,date:g.evidence.map(e=>e.date||'Not supplied').filter((v,i,a)=>a.indexOf(v)===i).join(' / '),dataExposed:g.evidence.map(e=>e.categories).filter(Boolean).join(', ')||'Not supplied per incident',description:g.evidence.map(e=>e.provider+': '+(e.description||'Source entry reported.')+' Reported date: '+(e.date||'Not supplied')+(e.recordCount?' Dataset size: '+e.recordCount+' records (not a personal exposure count).':'')).join('\n')}));
 const incomplete=main.status==='rejected'||extra.status==='rejected';
 const statuses={xposedornot:main.status==='fulfilled'?'complete':'failed',leakcheck:extra.status==='fulfilled'?'complete':'failed'};
 const steps=['Change exposed or reused passwords.','Enable two-factor authentication and use a password manager.','If stealer logs are reported, check your device for malware and revoke suspicious sessions.'];
 const overview=(breaches.length?breaches.length+' grouped exposure entries reported.':'No matches returned by available sources.')+(incomplete?' Coverage incomplete: one source failed. This is not a clean result.':' Coverage is limited; no match is not a security guarantee.');
 const provenance='XposedOrNot: '+statuses.xposedornot+'. LeakCheck Public: '+statuses.leakcheck+'. Entries may overlap; grouped entries are not a guaranteed count of unique incidents.';
 const extraInfo=additional?'LeakCheck: '+additional.matchedRecords+' matching records (not unique breaches). Categories across the full response, not individual incidents: '+(additional.fields.join(', ')||'None reported')+'. Powered by LeakCheck: https://leakcheck.io':'';
 const assessment=assessEmailBreaches(breaches);
 if(additional?.fields.some(f=>/password|credential/i.test(f))&&breaches.length) {assessment.riskLevel='High';assessment.securityScore=Math.min(assessment.securityScore,43);}
 return {...assessment,...(incomplete&&!breaches.length?{riskLevel:'Medium' as const,securityScore:0}:{}),breaches,source:'XposedOrNot + LeakCheck Public',checkedAt:new Date().toISOString(),assessmentVersion:3,
 evidenceGroups:groups,sourceStatuses:statuses,coverageIncomplete:incomplete,
 reportText:[overview,provenance,extraInfo,...breaches.map(b=>b.name+' — '+b.date+'\n'+b.dataExposed+'\n'+b.description)].filter(Boolean).join('\n\n'),
 actionPlan:steps.map((s,i)=>(i+1)+'. '+s).join('\n'),scoreFactors:[overview,'Score is a local priority estimate, not a security guarantee.',...(incomplete?['One provider failed; coverage is incomplete.']:[])],scoreImprovement:steps,language:'en'};
}
