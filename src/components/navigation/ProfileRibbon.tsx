import {useEffect,useState} from 'react';
import {ArrowUpRight} from 'lucide-react';
import '../../styles/profile-ribbon.css';

type Props={name:string;avatarUrl?:string|null;unreadCount?:number;lang?:string;onOpen:()=>void};
export default function ProfileRibbon({name,avatarUrl,unreadCount=0,lang='en',onOpen}:Props){
 const ar=lang==='ar';const [imageFailed,setImageFailed]=useState(false);
 useEffect(()=>setImageFailed(false),[avatarUrl]);
 const displayName=name.trim()||(ar?'حسابك':'Your account');
 const initials=displayName.replace(/([a-z])([A-Z])/g,'$1 $2').split(/\s+/).slice(0,2).map(part=>Array.from(part)[0]).join('').toLocaleUpperCase();
 const count=Number.isFinite(unreadCount)?Math.max(0,Math.floor(unreadCount)):0;
 return <button type="button" className="profile-ribbon" dir={ar?'rtl':'ltr'} onClick={onOpen} aria-label={`${ar?'افتح بروفايل':'Open profile for'} ${displayName}${count?`, ${count} ${ar?'إشعارات جديدة':'new notifications'}`:''}`}>
  <span className="pr-grain" aria-hidden="true"/>
  <span className="pr-portrait"><span className="pr-avatar">{avatarUrl&&!imageFailed?<img src={avatarUrl} alt="" referrerPolicy="no-referrer" onError={()=>setImageFailed(true)}/>:<span aria-hidden="true">{initials}</span>}</span><span className="pr-avatar-corner" aria-hidden="true"/></span>
  <span className="pr-identity"><strong>{displayName}</strong><span className="pr-meta">{ar?'عرض البروفايل':'View profile'}</span></span>
  <span className="pr-entry">{count>0&&<span className="pr-unread"><i/>{count>99?'99+':count} {ar?'جديد':'new'}</span>}<span className="pr-arrow"><ArrowUpRight size={21} strokeWidth={1.7}/></span></span>
  <span className="pr-trace" aria-hidden="true"/>
 </button>;
}
