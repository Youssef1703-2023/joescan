import React,{useEffect,useRef,useState} from 'react';
import {useReducedMotion} from 'motion/react';
import type {ThreatIndicator} from '../lib/threatFeed';
import {projectGlobe,canMapIndicator} from '../lib/globeProjection';
interface Props{indicators:ThreatIndicator[];paused:boolean;zoom:number;resetKey:number;selected:ThreatIndicator|null;onSelect:(i:ThreatIndicator)=>void;label:string}
export default function ThreatGlobe(props:Props){
 const canvas=useRef<HTMLCanvasElement>(null),current=useRef(props),rotation=useRef({yaw:0,pitch:12}),drag=useRef<{x:number;y:number;distance:number}|null>(null),hits=useRef<{x:number;y:number;items:ThreatIndicator[]}[]>([]);
 const [unavailable,setUnavailable]=useState(false);const reduced=useReducedMotion();current.current=props;
 useEffect(()=>{rotation.current={yaw:0,pitch:12}},[props.resetKey]);
 useEffect(()=>{if(props.selected&&canMapIndicator(props.selected))rotation.current={yaw:-props.selected.coordinates[1],pitch:props.selected.coordinates[0]}},[props.selected?.id]);
 useEffect(()=>{
  const el=canvas.current;if(!el)return;let ctx:CanvasRenderingContext2D|null=null;try{ctx=el.getContext('2d')}catch{}if(!ctx){setUnavailable(true);return;}
  const context=ctx;let frame=0,last=0,width=0,height=0;
  const resize=()=>{const rect=el.getBoundingClientRect();width=rect.width;height=rect.height;const dpr=Math.min(devicePixelRatio||1,2);el.width=Math.round(width*dpr);el.height=Math.round(height*dpr);context.setTransform(dpr,0,0,dpr,0,0)};
  resize();const observer=new ResizeObserver(resize);observer.observe(el);
  const draw=(now:number)=>{frame=requestAnimationFrame(draw);if(document.hidden||width===0||height===0){last=now;return}const dt=Math.min((now-last)/1000,.05);last=now;
   const {paused,zoom,indicators,selected}=current.current;if(!paused&&!drag.current&&!reduced)rotation.current.yaw=(rotation.current.yaw+dt*5)%360;
   const r=Math.min(width*.39,height*.39)*zoom,cx=width/2,cy=height/2;const {yaw,pitch}=rotation.current;
   context.clearRect(0,0,width,height);const project=(lat:number,lng:number)=>projectGlobe(lat,lng,yaw,pitch,r,cx,cy);
   const glow=context.createRadialGradient(cx-r*.25,cy-r*.3,r*.06,cx,cy,r*1.1);glow.addColorStop(0,'#223b24');glow.addColorStop(.8,'#101e14');glow.addColorStop(1,'#0b150e');context.fillStyle=glow;context.beginPath();context.arc(cx,cy,r,0,Math.PI*2);context.fill();context.strokeStyle='#517249';context.lineWidth=1;context.stroke();
   context.strokeStyle='#80b47728';context.lineWidth=.7;
   function curve(points:{x:number;y:number;visible:boolean}[]){context.beginPath();let pen=false;for(const p of points){if(!p.visible){pen=false;continue}if(pen)context.lineTo(p.x,p.y);else context.moveTo(p.x,p.y);pen=true}context.stroke()}
   for(let lat=-75;lat<=75;lat+=15)curve(Array.from({length:121},(_,i)=>project(lat,i*3-180)));
   for(let lng=-180;lng<180;lng+=15)curve(Array.from({length:61},(_,i)=>project(i*3-90,lng)));
   const groups=new Map<string,ThreatIndicator[]>();indicators.filter(canMapIndicator).forEach(i=>{const key=i.coordinates.join(',');groups.set(key,[...(groups.get(key)||[]),i])});hits.current=[];
   for(const items of groups.values()){const i=items[0],p=project(...i.coordinates);if(!p.visible)continue;const chosen=items.some(i=>i.id===selected?.id),online=items.some(i=>i.status==='online');const color=chosen?'#d4ffa6':online?'#ff936b':'#a4bd7e';context.fillStyle=color;context.shadowColor=color;context.shadowBlur=chosen?15:8;context.beginPath();context.arc(p.x,p.y,chosen?6:4,0,Math.PI*2);context.fill();context.shadowBlur=0;context.strokeStyle=color+'66';context.beginPath();context.arc(p.x,p.y,chosen?13:9,0,Math.PI*2);context.stroke();context.font='10px monospace';context.fillStyle='#d2dfc6';context.fillText(i.country+(items.length>1?' · '+items.length:''),p.x+13,p.y+3);hits.current.push({x:p.x,y:p.y,items})}
  };frame=requestAnimationFrame(draw);return()=>{cancelAnimationFrame(frame);observer.disconnect()};
 },[reduced]);
 return <div className="tv-globe-wrap">{unavailable?<p className="tv-canvas-fallback">Globe rendering is unavailable. All indicators remain available in the list.</p>:<canvas ref={canvas} aria-label={props.label} tabIndex={0} onKeyDown={e=>{const step=e.shiftKey?15:5;if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();rotation.current.yaw+=e.key==='ArrowLeft'?-step:e.key==='ArrowRight'?step:0;rotation.current.pitch=Math.max(-85,Math.min(85,rotation.current.pitch+(e.key==='ArrowUp'?step:e.key==='ArrowDown'?-step:0)))}}} onPointerDown={e=>{if(e.button!==0)return;elCapture(e);drag.current={x:e.clientX,y:e.clientY,distance:0}}} onPointerMove={e=>{if(!drag.current)return;const dx=e.clientX-drag.current.x,dy=e.clientY-drag.current.y;drag.current.distance+=Math.abs(dx)+Math.abs(dy);rotation.current.yaw+=dx*.35;rotation.current.pitch=Math.max(-85,Math.min(85,rotation.current.pitch+dy*.3));drag.current.x=e.clientX;drag.current.y=e.clientY}} onPointerUp={e=>{if(drag.current&&drag.current.distance<6){const rect=e.currentTarget.getBoundingClientRect();const hit=hits.current.find(p=>Math.hypot(p.x-(e.clientX-rect.left),p.y-(e.clientY-rect.top))<18);if(hit){const index=hit.items.findIndex(i=>i.id===props.selected?.id);props.onSelect(hit.items[(index+1)%hit.items.length])}}drag.current=null;if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId)}} onPointerCancel={()=>{drag.current=null}} onLostPointerCapture={()=>{drag.current=null}}/>}</div>;
}
function elCapture(e:React.PointerEvent<HTMLCanvasElement>){e.currentTarget.setPointerCapture(e.pointerId)}
