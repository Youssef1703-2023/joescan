import {useEffect,useRef} from 'react';
export default function SignalCinema({paused}:{paused:boolean}) {
 const ref=useRef<HTMLCanvasElement>(null);
 useEffect(()=>{
  const canvas=ref.current,ctx=canvas?.getContext('2d');if(!canvas||!ctx)return;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');let frame=0;
  const clamp=(x:number)=>Math.max(0,Math.min(1,x));
  const draw=()=>{frame=0;const w=innerWidth,h=innerHeight,d=Math.min(devicePixelRatio,1.5);canvas.width=w*d;canvas.height=h*d;ctx.setTransform(d,0,0,d,0,0);ctx.clearRect(0,0,w,h);
   const story=document.querySelector('#signal-experience');const rect=story?.getBoundingClientRect();const progress=rect?clamp((h*.6-rect.top)/Math.max(h,(story as HTMLElement).offsetHeight-h*.4)):0;
   const p=paused||reduced.matches?0:progress;const spread=Math.sin(p*Math.PI);const morph=clamp((p-.45)*2);const radius=Math.min(w*.29,h*.36);const cx=w*(w<760?.52:.72),cy=h*.5;const turn=scrollY*.0015;
   const halo=ctx.createRadialGradient(cx,cy,0,cx,cy,radius*1.6);halo.addColorStop(0,'#b6f66a0a');halo.addColorStop(1,'#b6f66a00');ctx.fillStyle=halo;ctx.fillRect(0,0,w,h);
   for(let i=0;i<650;i++){const y=1-2*i/649,a=i*Math.PI*(3-Math.sqrt(5));const x=Math.cos(a)*Math.sqrt(1-y*y),z=Math.sin(a)*Math.sqrt(1-y*y);const xx=x*Math.cos(turn)-z*Math.sin(turn),zz=x*Math.sin(turn)+z*Math.cos(turn);const angle=i/650*Math.PI*2;const shieldX=Math.sin(angle)*(.78-.22*Math.max(0,Math.cos(angle)));const shieldY=-Math.cos(angle)*.9;const sx=(xx*(1-morph)+shieldX*morph)*radius,sy=(y*(1-morph)+shieldY*morph)*radius;const burst=spread*radius*.65;const px=cx+sx+Math.sin(a)*burst,py=cy+sy+Math.cos(a)*burst;
    ctx.globalAlpha=(.25+(zz+1)*.3)*(w<760?.55:1);ctx.fillStyle=i%7===0?'#f0f5eb':'#b6f66a';ctx.beginPath();ctx.arc(px,py,i%7===0?1.8:1,0,Math.PI*2);ctx.fill();if(i%17===0){ctx.strokeStyle='#b6f66a';ctx.globalAlpha=.12;ctx.beginPath();ctx.moveTo(px,py);ctx.lineTo(cx+sx*.8,cy+sy*.8);ctx.stroke();}
   }ctx.globalAlpha=.22;ctx.strokeStyle='#b6f66a';for(let j=0;j<3;j++){ctx.beginPath();ctx.ellipse(cx,cy,radius*(1.2+j*.12),radius*(.3+j*.1),-.5+p*2+j*.45,0,Math.PI*2);ctx.stroke();}ctx.globalAlpha=1;
   document.querySelectorAll<HTMLElement>('.signal-cinematic-chapter').forEach(el=>{const r=el.getBoundingClientRect();const q=clamp((h-r.top)/(h+r.height));el.style.setProperty('--chapter-shift',((q-.5)*-65)+'px');});
  };
  const schedule=()=>{if(!frame&&!document.hidden)frame=requestAnimationFrame(draw);};window.addEventListener('scroll',schedule,{passive:true});window.addEventListener('resize',schedule);document.addEventListener('visibilitychange',schedule);reduced.addEventListener('change',schedule);draw();return()=>{cancelAnimationFrame(frame);window.removeEventListener('scroll',schedule);window.removeEventListener('resize',schedule);document.removeEventListener('visibilitychange',schedule);reduced.removeEventListener('change',schedule);};
 },[paused]);
 return <canvas className="signal-cinema" ref={ref} aria-hidden="true"/>;
}
