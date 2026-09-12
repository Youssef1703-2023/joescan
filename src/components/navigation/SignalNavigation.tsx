import {useEffect,useId,useRef,useState,type KeyboardEvent as ReactKeyboardEvent} from 'react';
import {ArrowUpRight, ArrowRight, Search, X, MoveUpRight, CornerDownLeft} from 'lucide-react';
import type {TabId} from '../../lib/workspaceRoutes';
import {SIGNAL_GROUPS,SIGNAL_PAGES,type SignalGroup} from './signalPages';
import '../../styles/signal-navigation.css';

type Props={activeTab:TabId;allowedTabs:readonly TabId[];onNavigate:(tab:TabId)=>void;lang?:string;initialOpen?:boolean;disabled?:boolean};
function SignalMark(){return <span className="sn-mark" aria-hidden="true"><i/><i/><i/><i/></span>}
export default function SignalNavigation({activeTab,allowedTabs,onNavigate,lang='en',initialOpen=false,disabled=false}:Props){
 const ar=lang==='ar',label=(en:string,arabic:string)=>ar?arabic:en;
 const pages=SIGNAL_PAGES.filter(p=>allowedTabs.includes(p.id));
 const groups=SIGNAL_GROUPS.filter(g=>pages.some(p=>p.group===g.id));
 const current=pages.find(p=>p.id===activeTab);
 const [open,setOpen]=useState(initialOpen),[query,setQuery]=useState(''),[group,setGroup]=useState<SignalGroup>(current?.group||'workspace'),[point,setPoint]=useState(0);
 const dialog=useRef<HTMLDialogElement>(null),trigger=useRef<HTMLButtonElement>(null),search=useRef<HTMLInputElement>(null),returnFocus=useRef<HTMLElement|null>(null);
 const lastRoute=useRef(activeTab);
 useEffect(()=>{if(lastRoute.current!==activeTab||disabled)setOpen(false);lastRoute.current=activeTab},[activeTab,disabled]);
 const id=useId(),q=query.trim().toLocaleLowerCase();
 const activeGroup=groups.find(g=>g.id===group)||groups[0];
 const results=pages.filter(p=>q?`${p.label} ${p.ar} ${p.keywords}`.toLocaleLowerCase().includes(q):p.group===activeGroup?.id);
 const pointIndex=Math.min(point,Math.max(0,results.length-1));
 const highlighted=results[pointIndex];
 const start=()=>{if(disabled)return;returnFocus.current=document.activeElement as HTMLElement;setGroup(current?.group||'workspace');setPoint(0);setQuery('');setOpen(true)};
 const close=()=>setOpen(false);
 const navigate=(tab:TabId)=>{if(!allowedTabs.includes(tab))return;onNavigate(tab);close()};
 useEffect(()=>{
  const shortcut=(e:KeyboardEvent)=>{if(disabled)return;if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){
   // Do not open over another modal, such as checkout or an account dialog.
   if(!open&&document.querySelector('[role="dialog"],dialog[open]'))return;
   e.preventDefault();e.stopImmediatePropagation();if(open)close();else start();
  }};
  window.addEventListener('keydown',shortcut);return()=>window.removeEventListener('keydown',shortcut);
 },[open,activeTab,disabled,allowedTabs]);
 useEffect(()=>{
  const node=dialog.current;if(!node)return;
  if(open){node.showModal();if(window.matchMedia?.('(pointer: coarse)').matches)node.querySelector<HTMLButtonElement>('.sn-close')?.focus();else search.current?.focus()}
  else if(node.open){node.close();const target=returnFocus.current; if(target?.isConnected)target.focus();else trigger.current?.focus()}
 },[open]);
 const chooseGroup=(next:SignalGroup)=>{setGroup(next);setQuery('');setPoint(0)};
 const searchKeys=(e:ReactKeyboardEvent<HTMLInputElement>)=>{
  if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();const next=e.key==='ArrowDown'?0:results.length-1;document.getElementById(`${id}-item-${next}`)?.focus()}
  if(e.key==='Enter'&&highlighted){e.preventDefault();navigate(highlighted.id)}
 };
 useEffect(()=>{if(open&&q)document.getElementById(`${id}-item-${pointIndex}`)?.scrollIntoView?.({block:'nearest'})},[pointIndex,open,q,id]);
 return <>
  <nav className="sn-dock" style={disabled?{display:'none'}:undefined} aria-label={label('Quick navigation','التنقل السريع')} dir={ar?'rtl':'ltr'}>
   <button className="sn-launch" ref={trigger} onClick={start} aria-haspopup="dialog" aria-expanded={open} aria-controls={id}><SignalMark/><span>{label('Navigate','تنقّل')}</span><kbd>⌘ / Ctrl K</kbd></button>
  </nav>
  <dialog ref={dialog} className="sn-dialog" id={id} aria-labelledby={`${id}-title`} dir={ar?'rtl':'ltr'} onCancel={e=>{e.preventDefault();close()}} onClick={e=>{if(e.target===dialog.current)close()}}>
   <div className="sn-surface">
    <header className="sn-top"><div className="sn-brand"><img src="/icon-192.png" alt=""/><strong>JoeScan</strong><span>SIGNAL / NAVIGATION</span></div><button className="sn-close" onClick={close} aria-label={label('Close navigation','إغلاق التنقل')}><span>{label('Back to workspace','ارجع لمساحتك')}</span><X size={19}/></button></header>
    <div className="sn-body">
     <section className="sn-intent"><span className="sn-eyebrow"><span/> {label('EVERY NEXT STEP, CONNECTED','كل خطوة توصلك للي بعدها')}</span><h2 id={`${id}-title`}>{label('Where would','تحب تروح')}<br/>{' '}{label('you like to go?','فين دلوقتي؟')}</h2><p className="sn-intro">{label('Choose your direction. We’ll clear the path.','اختار هدفك، وخلّي الطريق أوضح.')}</p>
      <div className="sn-groups" aria-label={label('Navigation categories','أقسام التنقل')}>{groups.map((g,i)=><button key={g.id} aria-pressed={!q&&activeGroup?.id===g.id} onClick={()=>chooseGroup(g.id)}><span className="sn-group-number">0{i+1}</span><span>{ar?g.ar:g.label}</span><ArrowRight size={17}/></button>)}</div>
      <div className="sn-origin"><span className="sn-origin-dot"/><div><span className="sn-eyebrow">{label('YOU ARE HERE','إنت هنا')}</span><strong>{current?(ar?current.ar:current.label):label('Your workspace','مساحتك')}</strong></div></div>
     </section>
     <section className="sn-destinations" aria-label={label('Destinations','الصفحات')}>
      <div className="sn-search"><Search size={18}/><input ref={search} value={query} onChange={e=>{setQuery(e.target.value);setPoint(0)}} onKeyDown={searchKeys} type="search" autoComplete="off" aria-label={label('Find a page or tool','ابحث عن صفحة أو أداة')} placeholder={label('Find a page or tool…','ابحث عن صفحة أو أداة…')} aria-controls={`${id}-results`}/><kbd>↵</kbd></div>
      <div className="sn-route-heading"><div><span className="sn-eyebrow">{q?label('SEARCH RESULTS','نتائج البحث'):label('CHOOSE YOUR NEXT STOP','اختار خطوتك الجاية')}</span><h3>{q?label('A shortcut to your next step.','طريق أسرع لخطوتك الجاية.'):(ar?activeGroup?.verbAr:activeGroup?.verb)}</h3></div><span className="sn-route-total" aria-hidden="true">{String(results.length).padStart(2,'0')}</span></div>
      <div className={`sn-map ${q?'sn-is-search':''}`}>
       <div className="sn-connector" aria-hidden="true"><span className="sn-source-node"><SignalMark/></span><svg viewBox="0 0 140 450" preserveAspectRatio="none">{results.map((p,i)=><path key={p.id} className={i===pointIndex?'sn-path-active':''} pathLength="1" d={`M 0 225 C 82 225 40 ${((i+.5)/results.length)*450} 140 ${((i+.5)/results.length)*450}`}/>)}</svg></div>
       <div className="sn-results" id={`${id}-results`} onKeyDown={e=>{if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)){e.preventDefault();const next=e.key==='Home'?0:e.key==='End'?results.length-1:(pointIndex+(e.key==='ArrowDown'?1:-1)+results.length)%results.length;document.getElementById(`${id}-item-${next}`)?.focus()}}}>{results.map((p,i)=>{const Icon=p.icon;return <button className={`sn-destination ${i===pointIndex?'sn-highlighted':''}`} key={p.id} id={`${id}-item-${i}`} onPointerEnter={()=>setPoint(i)} onFocus={()=>setPoint(i)} onClick={()=>navigate(p.id)} aria-current={p.id===activeTab?'page':undefined}><span className="sn-terminal" aria-hidden="true"/><span className="sn-page-icon"><Icon size={24} strokeWidth={1.5}/></span><span className="sn-page-copy"><strong>{ar?p.ar:p.label}</strong><small>{ar?p.descriptionAr:p.description}</small></span><span className="sn-go"><ArrowUpRight size={20}/></span></button>})}
        {!results.length&&<div className="sn-empty"><Search size={28}/><h3>{label('No paths found.','مفيش نتائج.')}</h3><p>{label('Try a tool name, like email or password.','جرّب اسم أداة زي البريد أو كلمة المرور.')}</p><button onClick={()=>{setQuery('');search.current?.focus()}}>{label('Clear search','امسح البحث')} <ArrowRight size={16}/></button></div>}
       </div>
      </div>
      <p className="sn-route-caption" aria-live="polite">{q?`${results.length} ${label('destinations found','نتيجة')}`:ar?activeGroup?.captionAr:activeGroup?.caption}</p>
     </section>
    </div>
    <footer className="sn-footer"><span><MoveUpRight size={16}/> {label('Less searching. More moving.','وقت أقل في البحث. خطوة أسرع لقدّام.')}</span><span><kbd>↑ ↓</kbd> {label('Choose','اختار')} <kbd><CornerDownLeft size={12}/></kbd> {label('Open','افتح')} <kbd>esc</kbd> {label('Close','اقفل')}</span></footer>
   </div>
  </dialog>
 </>;
}
