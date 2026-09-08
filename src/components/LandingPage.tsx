import {useEffect, useRef, useState, useCallback} from 'react';
import publicTools from '../data/publicTools.json';
import AuthModal from './AuthModal';
import '../styles/video-landing.css';
const cuts=[0,.24,.5,.76,1];
const chapters=[
  {label:'FOOTPRINT',eyebrow:'YOUR DIGITAL FOOTPRINT',title:'Your online life.',accent:'Look closer.',body:'Your email connects to a wider digital world. Take a closer look at the traces you leave behind.'},
  {label:'CONNECTIONS',eyebrow:'FOLLOW THE SIGNAL',title:'Follow the signal.',accent:'Ask the right question.',body:'Start with a question about your email, password or a suspicious link. JoeScan brings the right tools together.'},
  {label:'EVIDENCE',eyebrow:'LOOK AT THE EVIDENCE',title:'Bring the details',accent:'into focus.',body:'Look at the source, the data involved and the limits. No matches does not prove your data has never been exposed.'},
  {label:'ACTION',eyebrow:'KNOW YOUR NEXT MOVE',title:'See the path.',accent:'Take your next step.',body:'Replace reused passwords, enable two-factor authentication and review your accounts. An assessment is a starting point.'},
];
export default function LandingPage({loading}:{onLogin:()=>void;loading:boolean}){
 const [authOpen,setAuthOpen]=useState(new URLSearchParams(location.search).get('start')==='1');
 const closeAuth=useCallback(()=>setAuthOpen(false),[]);
 const [active,setActive]=useState(0),[failed,setFailed]=useState(false),[reduced,setReduced]=useState(false);
 const journey=useRef<HTMLElement>(null),video=useRef<HTMLVideoElement>(null),copy=useRef<HTMLDivElement>(null),progress=useRef<HTMLDivElement>(null);
 useEffect(()=>{const media=matchMedia('(prefers-reduced-motion: reduce)');let frame=0,target=0;const clamp=(n:number)=>Math.max(0,Math.min(1,n));const v=video.current!;
 const seek=()=>{if(v.readyState<1||!Number.isFinite(v.duration)||v.seeking||media.matches)return;if(Math.abs(v.currentTime-target)>.025)v.currentTime=target};
 const update=()=>{frame=0;if(!journey.current)return;const p=clamp(-journey.current.getBoundingClientRect().top/Math.max(1,journey.current.offsetHeight-innerHeight));const idx=Math.min(3,cuts.slice(1).findIndex(c=>p<c)<0?3:cuts.slice(1).findIndex(c=>p<c));setActive(idx);const local=(p-cuts[idx])/(cuts[idx+1]-cuts[idx]);const fi=idx===0?1:clamp(local/.14),fo=idx===3?1:clamp((1-local)/.14);copy.current?.style.setProperty('--scene-opacity',String(Math.min(fi,fo)));copy.current?.style.setProperty('--scene-y',((1-fi)*20-(1-fo)*12)+'px');progress.current?.querySelectorAll('button').forEach((b,i)=>b.style.setProperty('--fill',String(clamp((p-cuts[i])/(cuts[i+1]-cuts[i])))));target=Number.isFinite(v.duration)?p*Math.max(0,v.duration-.04):0;if(!media.matches)seek()};
 const schedule=()=>{if(!frame)frame=requestAnimationFrame(update)};const preference=()=>{setReduced(media.matches);schedule()};preference();v.addEventListener('loadedmetadata',schedule);v.addEventListener('seeked',seek);addEventListener('scroll',schedule,{passive:true});addEventListener('resize',schedule);media.addEventListener('change',preference);return()=>{cancelAnimationFrame(frame);v.removeEventListener('loadedmetadata',schedule);v.removeEventListener('seeked',seek);removeEventListener('scroll',schedule);removeEventListener('resize',schedule);media.removeEventListener('change',preference)};
 },[]);
 const jump=(i:number)=>{const el=journey.current;if(el)scrollTo({top:el.getBoundingClientRect().top+scrollY+(el.offsetHeight-innerHeight)*(cuts[i]+.04),behavior:'instant'})};
 return <div className={'video-landing'+(reduced||failed?' static':'')} lang="en" dir="ltr">
 <a className="skip" href="#tools">Skip the visual journey</a>
 <nav aria-label="Main navigation"><a className="landing-brand" href="/" aria-label="JoeScan home"><img src="/icon-192.png" alt="" width="34" height="34"/><b>JoeScan<small>A JOETECH PRODUCT</small></b></a><div className="nav-actions"><a href="#tools">Explore tools ↗</a><button className="login-button" disabled={loading} onClick={()=>setAuthOpen(true)}>Login ↗</button></div></nav>
 <main><section className="journey" ref={journey} aria-label="Discover JoeScan"><div className="stage">
 <video ref={video} id="journey-video" muted playsInline preload="auto" poster="/media/joescan-signal-poster.jpg" aria-hidden="true" src="/media/joescan-signal.mp4" onError={()=>setFailed(true)}/><div className="video-shade"/>
 <div className="copy" ref={copy}>{chapters.map((c,i)=><section className="scene" key={c.label} hidden={!reduced&&!failed&&active!==i}><span className="kicker">0{i+1} / {c.eyebrow}</span>{i===0?<h1>{c.title}<br/><em>{c.accent}</em></h1>:<h2>{c.title}<br/><em>{c.accent}</em></h2>}<p>{c.body}</p>{(i===0||i===3)&&<a href="#tools" className="cta">{i===0?'Find your first check':'Explore all tools'} ↗</a>}</section>)}</div>
 <p id="video-status">Scroll to continue ↓</p><div className="progress" ref={progress} aria-label="Journey chapters">{chapters.map((c,i)=><button key={c.label} onClick={()=>jump(i)} aria-current={active===i?'step':undefined}>0{i+1} / {c.label}</button>)}</div>
 </div></section>
 <section className="tools" id="tools"><span className="kicker">01 / CHOOSE YOUR FIRST CHECK</span><h2>A little insight.<br/><em>A clearer next step.</em></h2><p>Start with an email or password check, or explore the full toolkit. Every guide explains what the tool checks and where its limits are.</p><div className="links">{publicTools.slice(0,2).map((t,i)=><a key={t.slug} href={'/tools/'+t.slug+'/'}><div className={"tool-art tool-art-"+i} aria-hidden="true">{i===0?<><span className="art-orbit"/><span className="art-core">@</span><span className="art-dot"/></>:<><span className="art-orbit"/><span className="art-core">✳</span><span className="art-password">•••• ••••</span></>}</div><span className="tool-number">{String(i+1).padStart(2,'0')} / EXPLORE ↗</span><h3>{i===0?"Email exposure":"Password check"}</h3><small>{t.description}</small><span className="tool-open">Explore tool <span>↗</span></span></a>)}<a className="more-tools" href="/tools/"><div className="more-art" aria-hidden="true">{["↗","⌕","+","◎","#","⊞"].map(x=><span key={x}>{x}</span>)}</div><span className="tool-number">THE FULL TOOLKIT</span><h3>More ways<br/>to look closer.</h3><small>Discover all {publicTools.length} tools for cybersecurity and public-information research.</small><span className="more-tools-link">View all tools →</span></a></div></section>
 <section className="end"><div><span>BUILT BY JOETECH</span><h2>Your next step<br/>starts here.</h2><p>Clear information. Honest boundaries. Practical action.</p></div><button className="login-button" onClick={()=>setAuthOpen(true)}>Get started ↗</button></section></main>
 <footer>JOESCAN / A JOETECH PRODUCT · <a href="/about">About</a> · <a href="/privacy">Privacy & data</a> · <a href="/terms.en">Terms</a></footer><AuthModal isOpen={authOpen} onClose={closeAuth}/>
 </div>;
}
