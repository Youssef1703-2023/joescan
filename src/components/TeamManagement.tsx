import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Users, Plus, Trash2, Zap, UserPlus, Shield, Crown, Eye, Mail, Clock, ShieldCheck } from 'lucide-react';
import { auth, db, logActivity, getUserTier, ADMIN_EMAIL } from '../lib/firebase';
import { collection, addDoc, getDocs, deleteDoc, doc, query, where, setDoc } from 'firebase/firestore';
import { useLanguage } from '../contexts/LanguageContext';

type TeamRole = 'owner' | 'analyst' | 'viewer';

const ROLE_ICONS: Record<TeamRole, { color: string; icon: any }> = {
  owner: { color: 'text-error', icon: Crown },
  analyst: { color: 'text-accent', icon: ShieldCheck },
  viewer: { color: 'text-blue-400', icon: Eye },
};

export default function TeamManagement() {
  const { t } = useLanguage();
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tier, setTier] = useState('free');
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<TeamRole>('analyst');
  const [sending, setSending] = useState(false);

  const fetchTeam = async () => {
    if (!auth.currentUser) return;
    try {
      const q = query(collection(db, 'teams'), where('ownerId', '==', auth.currentUser.uid));
      const snap = await getDocs(q);
      setMembers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      const t = await getUserTier(auth.currentUser.uid);
      setTier(t);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchTeam(); }, []);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim() || !auth.currentUser) return;
    setSending(true);
    try {
      await addDoc(collection(db, 'teams'), {
        ownerId: auth.currentUser.uid,
        ownerEmail: auth.currentUser.email,
        memberEmail: inviteEmail.toLowerCase().trim(),
        role: inviteRole,
        status: 'invited',
        invitedAt: new Date().toISOString(),
        joinedAt: null,
      });
      await logActivity('promo_create', `Invited team member: ${inviteEmail} as ${inviteRole}`);
      setInviteEmail('');
      setShowInvite(false);
      fetchTeam();
    } catch (err) { console.error(err); }
    finally { setSending(false); }
  };

  const handleRemove = async (id: string, email: string) => {
    await deleteDoc(doc(db, 'teams', id));
    await logActivity('promo_delete', `Removed team member: ${email}`);
    fetchTeam();
  };

  const handleRoleChange = async (id: string, newRole: TeamRole) => {
    await setDoc(doc(db, 'teams', id), { role: newRole }, { merge: true });
    fetchTeam();
  };

  const maxMembers = tier === 'enterprise' ? 5 : 0;
  const locked = tier !== 'enterprise' && !auth.currentUser?.email?.includes(ADMIN_EMAIL);

  if (loading) return <div className="flex justify-center items-center h-full"><Zap className="w-8 h-8 animate-pulse text-accent" /></div>;

  if (locked) {
    return (
      <div className="max-w-2xl mx-auto flex flex-col items-center justify-center text-center py-20 gap-6">
        <div className="w-20 h-20 rounded-full bg-purple-500/10 border-2 border-purple-500/30 flex items-center justify-center">
          <Users className="w-10 h-10 text-purple-400" />
        </div>
        <h1 className="text-2xl font-black uppercase tracking-tight">{t('team_enterprise_feature')}</h1>
        <p className="text-text-dim text-sm font-mono max-w-md">{t('team_enterprise_desc')}</p>
        <div className="grid grid-cols-3 gap-3 w-full max-w-sm">
          {(['owner', 'analyst', 'viewer'] as TeamRole[]).map((key) => {
            const cfg = ROLE_ICONS[key];
            const Icon = cfg.icon;
            const labelKey = `team_role_${key}` as any;
            const descKey = `team_role_${key}_desc` as any;
            return (
              <div key={key} className="glass-card p-3 rounded-xl text-center">
                <Icon className={`w-5 h-5 ${cfg.color} mx-auto mb-1`} />
                <div className="text-[10px] font-bold uppercase tracking-widest">{t(labelKey)}</div>
                <div className="text-[9px] text-text-dim mt-0.5">{t(descKey)}</div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12 w-full">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tight flex items-center gap-3">
            <Users className="w-8 h-8 text-purple-400" /> {t('team_title')}
          </h1>
          <p className="text-text-dim text-sm mt-1 font-mono">{t('team_desc')}</p>
        </div>
        <button onClick={() => setShowInvite(!showInvite)} disabled={members.length >= maxMembers}
          className="flex items-center gap-2 px-4 py-2.5 bg-purple-500/10 border border-purple-500/20 rounded-xl text-purple-400 text-xs font-bold uppercase tracking-widest hover:bg-purple-500/20 transition-all disabled:opacity-40">
          <UserPlus className="w-4 h-4" /> {t('team_invite')}
        </button>
      </div>

      {/* Quota + Owner Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="glass-card p-4 rounded-xl flex items-center justify-between">
          <span className="text-sm font-bold">{members.length} / {maxMembers} {t('team_slots')}</span>
          <span className="text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded bg-error/20 text-error">ENTERPRISE</span>
        </div>
        <div className="glass-card p-4 rounded-xl flex items-center gap-3">
          <Crown className="w-5 h-5 text-error" />
          <div>
            <div className="text-xs font-bold text-text-main">{auth.currentUser?.email}</div>
            <div className="text-[10px] text-text-dim font-mono uppercase">{t('team_owner')} • {t('team_full_access')}</div>
          </div>
        </div>
      </div>

      {/* Invite Form */}
      <AnimatePresence>
        {showInvite && (
          <motion.form onSubmit={handleInvite} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="glass-card p-6 rounded-xl space-y-4 overflow-hidden">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-mono uppercase text-text-dim">{t('team_email_label')}</label>
                <input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="analyst@company.com" className="w-full bg-bg-base border border-border-subtle rounded-lg px-4 py-3 text-sm mt-1" required />
              </div>
              <div>
                <label className="text-[10px] font-mono uppercase text-text-dim">{t('team_role_label')}</label>
                <div className="flex gap-2 mt-1">
                  {(['analyst', 'viewer'] as TeamRole[]).map(role => {
                    const cfg = ROLE_ICONS[role];
                    const Icon = cfg.icon;
                    return (
                      <button key={role} type="button" onClick={() => setInviteRole(role)}
                        className={`flex-1 p-3 rounded-lg text-xs font-bold border transition-all flex items-center gap-2 justify-center ${inviteRole === role ? `bg-bg-elevated ${cfg.color} border-current` : 'border-border-subtle text-text-dim'}`}>
                        <Icon className="w-4 h-4" /> {t(`team_role_${role}` as any)}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              <button type="submit" disabled={sending} className="flex-1 py-3 bg-purple-500/10 border border-purple-500/20 text-purple-400 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-purple-500/20 flex items-center justify-center gap-2">
                {sending ? <Zap className="w-4 h-4 animate-pulse" /> : <><Mail className="w-4 h-4" /> {t('team_send_invite')}</>}
              </button>
              <button type="button" onClick={() => setShowInvite(false)} className="px-6 py-3 bg-bg-elevated border border-border-subtle rounded-xl text-xs font-bold uppercase text-text-dim">{t('team_cancel')}</button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {/* Team Members */}
      <div className="space-y-3">
        {members.map((m, i) => {
          const cfg = ROLE_ICONS[m.role as TeamRole] || ROLE_ICONS.viewer;
          const RIcon = cfg.icon;
          return (
            <motion.div key={m.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              className="glass-card p-5 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-full bg-bg-elevated border-2 border-border-subtle flex items-center justify-center`}>
                  <RIcon className={`w-5 h-5 ${cfg.color}`} />
                </div>
                <div>
                  <div className="font-bold text-text-main text-sm">{m.memberEmail}</div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`text-[10px] uppercase font-bold tracking-widest ${cfg.color}`}>{t(`team_role_${m.role}` as any)}</span>
                    <span className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded ${m.status === 'invited' ? 'bg-orange-500/10 text-orange-400' : 'bg-accent/10 text-accent'}`}>
                      {m.status === 'invited' ? `⏳ ${t('team_pending')}` : `✓ ${t('team_joined')}`}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <select value={m.role} onChange={e => handleRoleChange(m.id, e.target.value as TeamRole)}
                  className="bg-bg-base border border-border-subtle rounded-lg px-2 py-1 text-[10px] font-mono uppercase">
                  <option value="analyst">{t('team_role_analyst')}</option>
                  <option value="viewer">{t('team_role_viewer')}</option>
                </select>
                <button onClick={() => handleRemove(m.id, m.memberEmail)} className="p-2 text-text-dim hover:text-error transition-colors rounded-lg hover:bg-error/10">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          );
        })}
        {members.length === 0 && !showInvite && (
          <div className="text-center py-12 glass-card rounded-xl">
            <Users className="w-12 h-12 text-text-dim/30 mx-auto mb-3" />
            <p className="text-text-dim font-mono text-sm">{t('team_no_members')}</p>
          </div>
        )}
      </div>
    </div>
  );
}
