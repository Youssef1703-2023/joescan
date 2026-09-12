import {useEffect, useRef} from 'react';

/** Decorative perspective projection; no user data or network activity. */
export default function SignalGlobe({paused}: {paused: boolean}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const points = Array.from({length: 420}, (_, i) => {
      const y = 1 - 2 * i / 419, angle = i * Math.PI * (3 - Math.sqrt(5));
      return [Math.cos(angle) * Math.sqrt(1-y*y), y, Math.sin(angle) * Math.sqrt(1-y*y)];
    });
    let frame = 0, rotation = .3, visible = false, previous = 0;
    const draw = () => {
      const w = canvas.clientWidth, h = canvas.clientHeight, dpr = Math.min(devicePixelRatio || 1, 1.5);
      if (!w || !h) return;
      if (canvas.width !== Math.round(w*dpr) || canvas.height !== Math.round(h*dpr)) {
        canvas.width = Math.round(w*dpr); canvas.height = Math.round(h*dpr);
      }
      ctx.setTransform(dpr,0,0,dpr,0,0); ctx.clearRect(0,0,w,h);
      const radius = Math.min(w,h)*.31;
      ctx.fillStyle = '#b6f66a';
      for (const [x,y,z] of points) {
        const xx=x*Math.cos(rotation)-z*Math.sin(rotation), zz=x*Math.sin(rotation)+z*Math.cos(rotation), scale=3/(3-zz);
        ctx.globalAlpha=.16+(zz+1)*.4;ctx.beginPath();
        ctx.arc(w/2+xx*radius*scale,h/2+y*radius*scale,Math.max(.8,scale*1.5),0,Math.PI*2);ctx.fill();
      }
      ctx.globalAlpha=.35;ctx.strokeStyle='#b6f66a';ctx.lineWidth=1;
      ctx.beginPath();ctx.ellipse(w/2,h/2,radius*1.5,radius*.4,-.45,0,Math.PI*2);ctx.stroke();ctx.globalAlpha=1;
    };
    const tick = (time: number) => {
      frame = 0;
      if (!visible || paused || media.matches || document.hidden) return;
      if (time-previous > 33) { rotation += .003; draw(); previous = time; }
      frame = requestAnimationFrame(tick);
    };
    const sync = () => {
      cancelAnimationFrame(frame); frame=0; draw();
      if (visible && !paused && !media.matches && !document.hidden) frame=requestAnimationFrame(tick);
    };
    const observer = new IntersectionObserver(([entry]) => {visible=entry.isIntersecting;sync();});
    observer.observe(canvas);
    const resize = new ResizeObserver(sync);resize.observe(canvas);
    media.addEventListener('change',sync);document.addEventListener('visibilitychange',sync);draw();
    return () => {cancelAnimationFrame(frame);observer.disconnect();resize.disconnect();media.removeEventListener('change',sync);document.removeEventListener('visibilitychange',sync);};
  },[paused]);
  return <canvas ref={ref} aria-hidden="true" />;
}
