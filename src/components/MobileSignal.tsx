import {useEffect,useRef} from 'react';
/** Scroll imagery avoids mobile media-playback and low-power restrictions. */
export default function MobileSignal(){
 const canvas=useRef<HTMLCanvasElement>(null);
 useEffect(()=>{const c=canvas.current!,ctx=c.getContext('2d');if(!ctx)return;let disposed=false,target=0,raf=0;const images=new Map<number,HTMLImageElement>();const mq=matchMedia('(prefers-reduced-motion: reduce)');
 const draw=()=>{raf=0;if(disposed||mq.matches)return;const section=c.closest('section')!;const p=Math.max(0,Math.min(1,-section.getBoundingClientRect().top/Math.max(1,section.clientHeight-innerHeight)));target=Math.round(p*79);const available=[...images.keys()].sort((a,b)=>Math.abs(a-target)-Math.abs(b-target))[0];if(available===undefined)return;const img=images.get(available)!;const w=c.clientWidth,h=c.clientHeight,dpr=Math.min(devicePixelRatio,2);if(c.width!==Math.round(w*dpr)||c.height!==Math.round(h*dpr)){c.width=Math.round(w*dpr);c.height=Math.round(h*dpr)}const scale=Math.max(c.width/img.width,c.height/img.height);ctx.drawImage(img,(c.width-img.width*scale)*.68,(c.height-img.height*scale)*.5,img.width*scale,img.height*scale)};
 const schedule=()=>{if(!raf)raf=requestAnimationFrame(draw)};
 const load=async(i:number)=>{await new Promise<void>(resolve=>{const img=new Image();img.onload=()=>{if(!disposed){images.set(i,img);schedule()}resolve()};img.onerror=()=>resolve();img.src='/media/signal-frames/'+String(i).padStart(3,'0')+'.webp'})};
 // First load anchors across the whole film, then fill the gaps with bounded concurrency.
 const queue=[0,20,40,60,79,...Array.from({length:80},(_,i)=>i).filter(i=>![0,20,40,60,79].includes(i))];
 const worker=async()=>{while(queue.length&&!disposed&&!mq.matches){await load(queue.shift()!)}};const start=()=>{if(!mq.matches){void worker();void worker();void worker()}schedule()};start();addEventListener('scroll',schedule,{passive:true});addEventListener('resize',schedule);mq.addEventListener('change',start);return()=>{disposed=true;cancelAnimationFrame(raf);images.clear();removeEventListener('scroll',schedule);removeEventListener('resize',schedule);mq.removeEventListener('change',start)};
 },[]);
 return <canvas ref={canvas} className="mobile-signal" aria-hidden="true"/>;
}
