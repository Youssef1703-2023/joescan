import React, {useState} from 'react';
import {auth} from '../lib/firebase';
interface Result { source:string; matchedRecords:number; sources:{name:string;date:string}[]; fields:string[]; checkedAt:string }
export default function AdditionalEmailSource({email}:{email:string}) {
  const [result,setResult]=useState<Result|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const check=async()=>{
    setBusy(true);setError('');setResult(null);
    try {
      if (!auth.currentUser) throw Error('Please sign in first.');
      const base=import.meta.env.VITE_AI_PROXY_URL;
      if (!base) throw Error('Additional source is unavailable.');
      const response=await fetch(base.replace(/\/+$/,'')+'/email-exposure/extra',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+await auth.currentUser.getIdToken()},body:JSON.stringify({email,consent:true}),signal:AbortSignal.timeout(25000)});
      const data=await response.json();if(!response.ok)throw Error(data.error||'Provider unavailable');setResult(data);
    }catch(e){setError(e instanceof Error?e.message:'Check failed');}finally{setBusy(false);}
  };
  return <section className="my-6 rounded-2xl border border-accent/20 bg-bg-surface p-5 text-sm">
    <h3 className="text-lg font-bold text-text-main">Cross-check another free source</h3>
    <p className="mt-2 text-text-dim leading-relaxed">Compare coverage with LeakCheck Public. Clicking below sends <strong className="break-all">{email}</strong> to LeakCheck through JoeScan. It returns source names and exposed data categories, never passwords. Results below are kept in this page only and are separate from the saved report.</p>
    <button type="button" disabled={busy||!email} onClick={check} className="mt-4 rounded-xl bg-accent px-4 py-3 font-bold text-accent-fg disabled:opacity-50">{busy?'Checking…':'Send email to LeakCheck and compare'}</button>
    <a href="https://leakcheck.io" target="_blank" rel="noopener noreferrer" className="ml-4 inline-block mt-3 text-accent underline text-xs">Powered by LeakCheck</a>
    {error&&<p role="alert" className="mt-3 text-error">{error}</p>}
    {result&&<div className="mt-5 border-t border-border-subtle pt-4">
      <p className="font-bold text-text-main">{result.sources.length} reported source entries</p>
      <p className="mt-1 text-xs text-text-dim">{result.matchedRecords} matching records. Records and source entries are not a count of unique incidents. Source aliases and compilation lists can overlap with the main report. No match is not proof of safety.</p>
      <p className="mt-3 text-text-dim">Categories across these results (not attributed to each source): {result.fields.join(', ')||'None reported'}</p>
      <ul className="mt-4 grid gap-2 sm:grid-cols-2">{result.sources.map(s=><li key={s.name+'|'+s.date} className="min-w-0 rounded-lg border border-border-subtle p-3"><span className="break-words font-semibold text-text-main">{s.name}</span><span className="block text-xs text-text-dim mt-1">{s.date||'Date not provided'}</span></li>)}</ul>
      <p className="mt-3 text-xs text-text-dim">Checked: {new Date(result.checkedAt).toLocaleString()}</p>
    </div>}
  </section>;
}
