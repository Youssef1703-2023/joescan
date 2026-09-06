import React from 'react';
import type {EvidenceGroup} from '../lib/emailEvidence';
export default function AdditionalEmailSource({email,groups,statuses}:{email:string;groups:EvidenceGroup[];statuses?:{xposedornot:string;leakcheck:string}}) {
 if(!statuses)return null;
 return <section className="my-6 rounded-2xl border border-accent/20 bg-bg-surface p-5 sm:p-7 text-sm text-text-main" aria-label="Combined exposure report">
 <h2 className="text-2xl font-bold">Exposure evidence</h2><p className="mt-2 break-all text-text-dim">{email}</p>
 <p role="status" className="mt-3 text-text-dim">XposedOrNot: {statuses.xposedornot} · LeakCheck Public: {statuses.leakcheck}</p>
 {(statuses.xposedornot==='failed'||statuses.leakcheck==='failed')&&<p role="alert" className="mt-3 text-warning">Coverage incomplete. A source failed; this is not a clean result. Run Analyze again to retry both sources.</p>}
 <p className="mt-3 text-text-dim">Matching names with compatible dates are grouped. Aliases and compilation lists can still overlap; this is not a guaranteed count of unique incidents.</p>
 <div className="mt-5 space-y-3">{groups.map((g,i)=><article key={i} className="rounded-xl border border-border-subtle p-4"><h3 className="text-lg font-bold break-words">{g.name}</h3>{g.evidence.map((e,j)=><div key={j} className="mt-3 border-t border-border-subtle pt-3"><p className="text-accent">{e.provider} · {e.date||'Date not supplied'}</p><p className="mt-2 text-text-dim">{e.categories||'Categories not supplied for this individual entry.'}</p>{e.description&&<p className="mt-2 text-text-dim whitespace-pre-wrap break-words">{e.description}</p>}{e.recordCount&&<p className="mt-2 text-xs text-text-dim">Dataset size reported by this provider: {e.recordCount} records. Not your personal exposure count.</p>}</div>)}</article>)}</div>
 <a href="https://leakcheck.io" target="_blank" rel="noopener noreferrer" className="mt-4 inline-block text-accent underline text-xs">Powered by LeakCheck</a>
 </section>;
}
