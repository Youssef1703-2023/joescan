import React, {useEffect, useRef, useState} from 'react';
import {Users, UserPlus, ShieldCheck, Crown, Eye, Search, ArrowUpRight, Check, X, Trash2, Mail, Clock, Loader2, LockKeyhole} from 'lucide-react';
import {auth, db, logActivity, getUserTier} from '../lib/firebase';
import {collection, addDoc, getDocs, deleteDoc, doc, query, where, updateDoc} from 'firebase/firestore';
import {useLanguage} from '../contexts/LanguageContext';
import '../styles/focus-team.css';

type MemberRole = 'analyst' | 'viewer';
interface Member { id: string; memberEmail: string; role: string; status: string; invitedAt?: string; joinedAt?: string | null }
const activeMember = (member: Member) => member.status === 'joined' || member.status === 'active';

export default function TeamManagement() {
  const {t,lang,dir}=useLanguage();
  const copy=(en:string,ar:string)=>lang==='ar'?ar:en;
  const [members,setMembers]=useState<Member[]>([]);
  const [loading,setLoading]=useState(true);
  const [loadError,setLoadError]=useState(false);
  const [tier,setTier]=useState('free');
  const [showInvite,setShowInvite]=useState(false);
  const [inviteEmail,setInviteEmail]=useState('');
  const [inviteRole,setInviteRole]=useState<MemberRole>('analyst');
  const [busy,setBusy]=useState<string|null>(null);
  const busyRef=useRef(false);
  const [notice,setNotice]=useState('');
  const [error,setError]=useState('');
  const [search,setSearch]=useState('');
  const [filter,setFilter]=useState('all');
  const [removing,setRemoving]=useState<Member|null>(null);
  const inviteRef=useRef<HTMLInputElement>(null);
  const inviteButtonRef=useRef<HTMLButtonElement>(null);
  const requestVersion=useRef(0);
  const locked=tier!=='enterprise';
  const maxMembers=locked?0:5;
  const full=members.length>=maxMembers;

  const fetchTeam=async()=>{
    const version=++requestVersion.current;
    setLoading(true);setLoadError(false);
    const user=auth.currentUser;
    if(!user){setLoadError(true);setLoading(false);return;}
    try{
      const [snap,plan]=await Promise.all([
        getDocs(query(collection(db,'teams'),where('ownerId','==',user.uid))),
        getUserTier(user.uid)
      ]);
      if(version!==requestVersion.current||auth.currentUser?.uid!==user.uid)return;
      setMembers(snap.docs.map(d=>({id:d.id,...d.data()} as Member)));
      setTier(plan);
    }catch(err){if(version===requestVersion.current){setLoadError(true);console.error('Team load failed',err);}}
    finally{if(version===requestVersion.current)setLoading(false);}
  };
  useEffect(()=>{fetchTeam();return()=>{requestVersion.current++}},[]);
  useEffect(()=>{if(showInvite)inviteRef.current?.focus()},[showInvite]);
  const closeInvite=()=>{setShowInvite(false);inviteButtonRef.current?.focus()};
  const audit=(action: 'team_invite' | 'team_remove',details:string)=>{void logActivity(action,details).catch(err=>console.error('Team activity log failed',err))};
  const handleInvite=async(e:React.FormEvent)=>{
    e.preventDefault();
    if(busyRef.current||locked||full||!auth.currentUser)return;
    const email=inviteEmail.trim().toLowerCase();
    if(!email||!inviteRef.current?.checkValidity())return;
    setError('');setNotice('');
    if(email===auth.currentUser.email?.toLowerCase()||members.some(m=>m.memberEmail?.toLowerCase()===email)){
      setError(copy('This email is already part of your team.','البريد ده موجود في الفريق بالفعل.'));return;
    }
    busyRef.current=true;setBusy('invite');
    try{
      const record={ownerId:auth.currentUser.uid,ownerEmail:auth.currentUser.email,memberEmail:email,role:inviteRole,status:'invited',invitedAt:new Date().toISOString(),joinedAt:null};
      const result=await addDoc(collection(db,'teams'),record);
      setMembers(list=>[...list,{id:result.id,...record}]);
      audit('team_invite',`Invited team member: ${email} as ${inviteRole}`);
      setInviteEmail('');closeInvite();
      setNotice(copy('Invitation created. It is pending until the member joins.','تم إنشاء الدعوة. ستظل معلقة حتى انضمام العضو.'));
    }catch(err){setError(copy('Could not create the invitation. Please try again.','تعذر إنشاء الدعوة. حاول مرة أخرى.'));console.error(err)}
    finally{busyRef.current=false;setBusy(null)}
  };
  const handleRemove=async()=>{
    if(!removing||busyRef.current)return;
    const member=removing;busyRef.current=true;setBusy(member.id);setError('');setNotice('');
    try{
      await deleteDoc(doc(db,'teams',member.id));
      setMembers(list=>list.filter(m=>m.id!==member.id));setRemoving(null);
      audit('team_remove',`Removed team member: ${member.memberEmail}`);
      setNotice(copy('Team entry removed.','تم حذف العضو من الفريق.'));
    }catch(err){setError(copy('Could not remove this member. Try again.','تعذر حذف العضو. حاول مرة أخرى.'));console.error(err)}
    finally{busyRef.current=false;setBusy(null)}
  };
  const changeRole=async(member:Member,role:MemberRole)=>{
    if(busyRef.current||member.role==='owner'||!['analyst','viewer'].includes(role))return;
    busyRef.current=true;setBusy(member.id);setError('');setNotice('');
    try{
      await updateDoc(doc(db,'teams',member.id),{role});
      setMembers(list=>list.map(m=>m.id===member.id?{...m,role}:m));
      setNotice(copy('Role updated.','تم تحديث الدور.'));
    }catch(err){setError(copy('Could not update the role. The previous role is unchanged.','تعذر تحديث الدور. الدور السابق لم يتغير.'));console.error(err)}
    finally{busyRef.current=false;setBusy(null)}
  };
  const filtered=members.filter(m=>(filter==='all'||(filter==='invited'?m.status==='invited':m.role===filter))&&(m.memberEmail||'').toLowerCase().includes(search.trim().toLowerCase()));
  const pending=members.filter(m=>m.status==='invited').length;
  const joined=members.filter(activeMember).length;
  const roleName=(role:string)=>['owner','analyst','viewer'].includes(role)?t(`team_role_${role}` as any):copy('Unassigned','غير محدد');
  const dateLabel=(date?:string|null)=>date&&!Number.isNaN(new Date(date).getTime())?new Date(date).toLocaleDateString(lang==='ar'?'ar-EG':'en-US',{month:'short',day:'numeric',year:'numeric'}):'—';

  return <div className="focus-team" dir={dir}>
    <header className="ft-header"><div><span className="ft-eyebrow">JOESCAN / WORKSPACE</span><h1>{t('team_title')}</h1><p>{copy('Bring your people together. Keep every role in view.','اجمع فريقك في مكان واحد، وتابع دور كل عضو.')}</p></div>{!loading&&!loadError&&!locked&&<button className="ft-primary" ref={inviteButtonRef} disabled={full||!!busy} onClick={()=>{setError('');setShowInvite(!showInvite)}} aria-expanded={showInvite} aria-controls="team-invite"><UserPlus size={17}/>{t('team_invite')}</button>}</header>
    {loading?<div className="ft-loading" role="status"><Loader2 className="animate-spin" size={22}/>{copy('Loading your workspace…','جاري تحميل الفريق…')}</div>:loadError?<section className="ft-panel ft-load-error" role="alert"><h2>{copy('Your team could not be loaded.','تعذر تحميل فريقك.')}</h2><p>{copy('Check your connection and retry.','راجع الاتصال وحاول مرة أخرى.')}</p><button className="ft-primary" onClick={fetchTeam}>{copy('Try again','إعادة المحاولة')}</button></section>:locked?<section className="ft-locked ft-panel"><div><span className="ft-eyebrow">SOC ENTERPRISE</span><h2>{copy('Make room for','مساحة لفريقك،')}<br/><em>{copy('your team.','وشغلكم مع بعض.')}</em></h2><p>{t('team_enterprise_desc')}</p><a className="ft-primary" href="/pricing">{copy('Explore plans','استكشف الباقات')}<ArrowUpRight size={17}/></a></div><div className="ft-role-preview"><Users size={42}/>{(['owner','analyst','viewer'] as const).map(role=><div key={role}><span>{roleName(role)}</span><span>{role==='owner'?<Crown size={18}/>:role==='analyst'?<ShieldCheck size={18}/>:<Eye size={18}/>}</span></div>)}</div></section>:<>
      <div className="ft-summary"><div><Users size={19}/><span>{copy('Team seats','مقاعد الفريق')}</span><strong>{members.length}<small> / {maxMembers}</small></strong></div><div><ShieldCheck size={19}/><span>{copy('Joined members','أعضاء منضمّون')}</span><strong>{joined}</strong></div><div><Clock size={19}/><span>{copy('Pending invitations','دعوات معلقة')}</span><strong>{pending}</strong></div></div>
      {error&&<p role="alert" className="ft-feedback ft-error">{error}</p>}{notice&&<p role="status" className="ft-feedback"><Check size={16}/>{notice}</p>}
      {showInvite&&<form id="team-invite" className="ft-panel ft-invite" onSubmit={handleInvite}><div className="ft-section-title"><div><span className="ft-eyebrow">ADD A COLLABORATOR</span><h2>{t('team_invite')}</h2></div><button type="button" className="ft-icon-button" aria-label={copy('Close invitation','إغلاق الدعوة')} disabled={!!busy} onClick={closeInvite}><X size={19}/></button></div><div className="ft-invite-fields"><label htmlFor="team-email">{t('team_email_label')}<input ref={inviteRef} id="team-email" type="email" autoComplete="email" autoCapitalize="none" spellCheck={false} required disabled={!!busy} placeholder="name@company.com" value={inviteEmail} onChange={e=>setInviteEmail(e.target.value)}/></label><fieldset><legend>{t('team_role_label')}</legend><div className="ft-role-options">{(['analyst','viewer'] as const).map(role=><label key={role} data-selected={inviteRole===role}><input type="radio" name="invite-role" value={role} checked={inviteRole===role} disabled={!!busy} onChange={()=>setInviteRole(role)}/>{role==='analyst'?<ShieldCheck size={17}/>:<Eye size={17}/>}<span>{roleName(role)}</span></label>)}</div></fieldset></div><div className="ft-invite-footer"><p>{copy('Create a pending invitation for this workspace.','أنشئ دعوة معلقة لمساحة العمل دي.')}</p><button className="ft-primary" disabled={!!busy||full}>{busy==='invite'?<Loader2 size={16} className="animate-spin"/>:<Mail size={16}/>} {copy('Create invitation','إنشاء دعوة')}</button></div></form>}
      <div className="ft-layout"><section className="ft-panel ft-roster"><div className="ft-section-title"><h2>{copy('People in your workspace','الأعضاء في مساحة العمل')}</h2><span className="ft-badge">{members.length+1}</span></div><div className="ft-toolbar"><label className="ft-search"><Search size={17}/><input aria-label={copy('Search members','ابحث عن عضو')} placeholder={copy('Search by email…','ابحث بالبريد…')} value={search} onChange={e=>setSearch(e.target.value)}/></label><select aria-label={copy('Filter members','تصفية الأعضاء')} value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">{copy('All members','كل الأعضاء')}</option><option value="analyst">{roleName('analyst')}</option><option value="viewer">{roleName('viewer')}</option><option value="invited">{copy('Pending','معلق')}</option></select></div>
      <div className="ft-owner"><span className="ft-avatar ft-owner-avatar"><Crown size={20}/></span><div className="ft-identity"><strong>{auth.currentUser?.email||copy('Workspace owner','مالك مساحة العمل')}</strong><small>{t('team_owner')} · {copy('You','أنت')}</small></div><span className="ft-owner-label"><LockKeyhole size={13}/>{roleName('owner')}</span></div>
      {!!members.length&&<div className="ft-table-heading"><span>{copy('MEMBER','العضو')}</span><span>{copy('ROLE','الدور')}</span><span>{copy('ACTION','إجراء')}</span></div>}
      {filtered.map(member=><article className="ft-member" key={member.id}><div className="ft-member-info"><span className="ft-avatar">{(member.memberEmail||'?').slice(0,2).toUpperCase()}</span><div className="ft-identity"><strong>{member.memberEmail}</strong><small><span className="ft-state" data-pending={member.status==='invited'}>{member.status==='invited'?copy('Pending invitation','دعوة معلقة'):activeMember(member)?copy('Joined','منضم'):copy('Status unknown','الحالة غير متاحة')}</span><span>{dateLabel(member.joinedAt||member.invitedAt)}</span></small></div></div><select aria-label={copy('Role for ','دور ')+member.memberEmail} value={member.role} disabled={!!busy||member.role==='owner'} onChange={e=>changeRole(member,e.target.value as MemberRole)}>{!['analyst','viewer'].includes(member.role)&&<option value={member.role}>{roleName(member.role)}</option>}<option value="analyst">{roleName('analyst')}</option><option value="viewer">{roleName('viewer')}</option></select><button className="ft-icon-button ft-remove" disabled={!!busy||member.role==='owner'} aria-label={copy('Remove ','حذف ')+member.memberEmail} onClick={()=>{setError('');setRemoving(member)}}><Trash2 size={16}/></button></article>)}
      {!filtered.length&&<div className="ft-empty"><div className="ft-empty-icon"><Users size={27}/></div><h3>{!members.length?copy('Your next teammate starts here.','أول عضو في فريقك يبدأ من هنا.'):copy('No matching members','لا توجد نتائج')}</h3><p>{!members.length?copy('Create an invitation and choose a role to grow your workspace.','أنشئ دعوة وحدد الدور لإضافة عضو إلى الفريق.'):copy('Try a different email or reset your filters.','جرّب بريد مختلف أو امسح التصفية.')}</p>{!!members.length&&<button className="ft-text-button" onClick={()=>{setSearch('');setFilter('all')}}>{copy('Clear filters','مسح التصفية')}</button>}</div>}
      {removing&&<div className="ft-confirm" role="alertdialog" aria-labelledby="team-remove-title" aria-describedby="team-remove-detail"><h3 id="team-remove-title">{copy('Remove this team entry?','حذف العضو من الفريق؟')}</h3><p id="team-remove-detail">{removing.memberEmail}</p><div><button className="ft-danger" disabled={!!busy} onClick={handleRemove}>{busy===removing.id?copy('Removing…','جاري الحذف…'):copy('Confirm removal','تأكيد الحذف')}</button><button disabled={!!busy} onClick={()=>setRemoving(null)}>{t('team_cancel')}</button></div></div>}
      </section><aside className="ft-aside"><section className="ft-panel ft-seats"><div className="ft-section-title"><span className="ft-eyebrow">WORKSPACE PLAN</span><ShieldCheck size={19}/></div><h2>SOC Enterprise</h2><p>{copy('A focused space for your security team.','مساحة منظّمة لفريق الأمن الخاص بك.')}</p><div className="ft-seat-dots" aria-hidden="true">{Array.from({length:maxMembers},(_,i)=><span key={i} data-used={i<members.length}><Users size={16}/></span>)}</div><strong>{Math.max(0,maxMembers-members.length)} {copy('seats available','مقاعد متاحة')}</strong><small>{copy('Pending invitations count toward your 5 team seats. The owner is separate.','الدعوات المعلقة ضمن مقاعد الفريق الخمسة، بخلاف المالك.')}</small></section><section className="ft-role-guide"><span className="ft-eyebrow">{copy('ROLES AT A GLANCE','أدوار الفريق')}</span>{([{role:'owner',Icon:Crown,desc:copy('Manages the team and its invitations.','يدير الفريق ودعواته.')},{role:'analyst',Icon:ShieldCheck,desc:copy('Assigned as an analyst on this team.','مُعيّن كمحلل ضمن الفريق.')},{role:'viewer',Icon:Eye,desc:copy('Assigned as a viewer on this team.','مُعيّن كمشاهد ضمن الفريق.')}]).map(({role,Icon,desc})=><div key={role}><Icon size={18}/><div><h3>{roleName(role)}</h3><p>{desc}</p></div></div>)}</section></aside></div>
    </>}
  </div>;
}

