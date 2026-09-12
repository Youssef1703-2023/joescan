import type {ThreatIndicator} from './threatFeed';
export function projectGlobe(lat:number,lng:number,yaw:number,pitch:number,radius:number,cx:number,cy:number){
 const rad=Math.PI/180,phi=lat*rad,theta=(lng+yaw)*rad,p=pitch*rad;
 const x=Math.cos(phi)*Math.sin(theta),y=Math.sin(phi),z=Math.cos(phi)*Math.cos(theta);
 const ry=y*Math.cos(p)-z*Math.sin(p),rz=y*Math.sin(p)+z*Math.cos(p);
 return {x:cx+x*radius,y:cy-ry*radius,depth:rz,visible:rz>=0};
}
export function canMapIndicator(i:ThreatIndicator){
 return /^[A-Z]{2}$/i.test(i.country||'')&&i.country!=='XX'&&Array.isArray(i.coordinates)&&i.coordinates.length===2&&i.coordinates.every(Number.isFinite)&&Math.abs(i.coordinates[0])<=90&&Math.abs(i.coordinates[1])<=180&&!(i.countryName===i.country&&i.coordinates[0]===20&&i.coordinates[1]===0);
}
