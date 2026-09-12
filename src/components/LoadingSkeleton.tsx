import '../styles/signal-splash.css';

export default function LoadingSkeleton({lang='en'}:{lang?:string}) {
 const ar=lang==='ar';
 return <section className="signal-splash" dir={ar?'rtl':'ltr'} aria-label={ar?'جاري تحميل JoeScan':'Loading JoeScan'} aria-busy="true">
  <div className="ss-atmosphere" aria-hidden="true"/>
  <header className="ss-header"><span>JOETECH / JOESCAN</span><span className="ss-edition">{ar?'مساحتك الرقمية':'YOUR DIGITAL SPACE'}</span></header>
  <div className="ss-experience">
   <div className="ss-optics" aria-hidden="true">
    <svg className="ss-paths" viewBox="0 0 600 350" fill="none">
     <defs><linearGradient id="splash-line" x1="0" y1="0" x2="600" y2="350" gradientUnits="userSpaceOnUse"><stop stopColor="#b7ff72" stopOpacity="0"/><stop offset=".5" stopColor="#b7ff72"/><stop offset="1" stopColor="#b7ff72" stopOpacity="0"/></linearGradient></defs>
     <g stroke="url(#splash-line)" strokeWidth=".8"><path d="M0 110H170L235 175H300"/><path d="M600 240H430L365 175H300"/><path d="M65 300H155L280 175H300"/><path d="M535 50H445L320 175H300"/></g>
     <g className="ss-currents" stroke="#c4ff8c" strokeWidth="1.5"><path pathLength="100" d="M0 110H170L235 175H300"/><path pathLength="100" d="M600 240H430L365 175H300"/><path pathLength="100" d="M65 300H155L280 175H300"/><path pathLength="100" d="M535 50H445L320 175H300"/></g>
     <g fill="#9bb67f"><circle cx="170" cy="110" r="2"/><circle cx="430" cy="240" r="2"/><circle cx="155" cy="300" r="2"/><circle cx="445" cy="50" r="2"/></g>
     <g stroke="#91b564" strokeOpacity=".35"><path d="M190 76h-12v12M410 76h12v12M190 274h-12v-12M410 274h12v-12"/></g>
    </svg>
    <div className="ss-orbit ss-orbit-outer"/><div className="ss-orbit ss-orbit-inner"/>
    <div className="ss-glass ss-glass-back"/><div className="ss-glass ss-glass-front"/>
    <div className="ss-core"><img src="/icon-192.png" alt=""/><span className="ss-core-shine"/></div>
    <span className="ss-coordinate ss-coordinate-left">01 / SIGNAL</span><span className="ss-coordinate ss-coordinate-right">JS / IDENTITY</span>
   </div>
   <div className="ss-wordmark" aria-hidden="true"><span>Joe</span><span>Scan</span><i/></div>
   <p className="ss-tagline">{ar?'وضوح أكتر. كل خطوة.':'Clarity, at every step.'}</p>
   <div className="ss-loading" role="status" aria-live="polite"><span className="ss-loader" aria-hidden="true"><i/><i/><i/></span><span>{ar?'جاري فتح مساحتك':'Opening your workspace'}</span></div>
  </div>
  <footer className="ss-footer"><span>JOESCAN <i/> {ar?'من JOETECH':'BY JOETECH'}</span><span>{ar?'اعرف أكتر. تحرّك بوعي.':'LOOK CLOSER. MOVE FORWARD.'}</span></footer>
 </section>;
}
