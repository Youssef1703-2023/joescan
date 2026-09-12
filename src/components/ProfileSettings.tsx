import '../styles/account-space.css';
import {appAttestationHeaders} from '../lib/appAttestation';
import React, { useState, useRef, useEffect } from 'react';
import { updateProfile, deleteUser, updateEmail, updatePassword, reauthenticateWithCredential, EmailAuthProvider, sendPasswordResetEmail, multiFactor, TotpMultiFactorGenerator } from 'firebase/auth';
import { auth, db, getUserProfile, updateUserProfile } from '../lib/firebase';
import { doc, getDoc, setDoc, deleteField } from 'firebase/firestore';
import { useLanguage } from '../contexts/LanguageContext';
import { Shield, ShieldCheck, ShieldOff, X, User as UserIcon, Loader2, AlertTriangle, LogOut, Upload, Link as LinkIcon, Image as ImageIcon, Fingerprint, Lock, Trophy, Bell, RefreshCw, CheckCircle, Download, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import BadgeSystem from './BadgeSystem';
import PushNotifSettings from './PushNotifSettings';
import { useServiceWorker } from '../hooks/useServiceWorker';

interface ProfileSettingsProps {
  onClose: () => void;
  onLogout: () => void;
  toolbar?: React.ReactNode;
}

export default function ProfileSettings({ onClose, onLogout, toolbar }: ProfileSettingsProps) {
  const { dir, t } = useLanguage();
  const ar = dir === 'rtl';
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(()=>{const dialog=dialogRef.current;if(dialog&&!dialog.open)dialog.showModal();return()=>{dialog?.close()}},[]);
  const user = auth.currentUser;
  
  const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'achievements' | 'notifications' | 'updates'>('profile');
  const sw = useServiceWorker();
  
  // Profile State
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [email, setEmail] = useState(user?.email || '');
  const [photoURL, setPhotoURL] = useState(user?.photoURL || '');
  const [customAvatar, setCustomAvatar] = useState<string | null>(null);
  const [uploadMode, setUploadMode] = useState<'url' | 'file'>('file');

  // Load avatar from Firestore (cross-device sync)
  useEffect(() => {
    if (!user) return;
    getUserProfile(user.uid).then(profile => {
      if (profile?.avatarURL) {
        setCustomAvatar(profile.avatarURL);
        setPhotoURL(profile.avatarURL);
      }
    });
  }, [user]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Security State
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetSent, setResetSent] = useState(false);

  // Status State
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // MFA State (real Firebase Auth TOTP enrollment)
  const [mfaEnabled, setMfaEnabled] = useState<boolean | null>(null);
  const [mfaToggling, setMfaToggling] = useState(false);

  // Load MFA status from Firebase Auth (server-side truth)
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        await user.reload();
        const current = auth.currentUser;
        if (cancelled || !current) return;
        setMfaEnabled(multiFactor(current).enrolledFactors.length > 0);
      } catch {
        if (!cancelled) setMfaEnabled(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  const [deletingAccount, setDeletingAccount] = useState(false);
  if (!user) return null;

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);
    
    try {
      const promises = [];
      let successMessages = [];

      // Update display name in Firebase Auth
      if (displayName.trim() && displayName.trim() !== user.displayName) {
        promises.push(updateProfile(user, {
          displayName: displayName.trim() || null,
        }).then(() => {
          successMessages.push("Profile updated successfully.");
        }));
      }

      // Save avatar to Firestore (cross-device sync)
      if (photoURL.trim() && photoURL.trim() !== (customAvatar || user.photoURL || '')) {
        await updateUserProfile(user.uid, { avatarURL: photoURL.trim() });
        setCustomAvatar(photoURL.trim());
        // Notify App.tsx to update header avatar
        window.dispatchEvent(new CustomEvent('avatar_updated', { detail: photoURL.trim() }));
        successMessages.push("Avatar updated & synced across devices.");
      }

      // Update Email
      const targetEmail = email.trim();
      if (targetEmail && targetEmail !== user.email) {
        promises.push(updateEmail(user, targetEmail).then(() => {
          successMessages.push("Email address updated successfully.");
        }));
      }

      await Promise.all(promises);
      setSuccess(successMessages.length ? successMessages.join(" ") : "No changes were made.");
    } catch (err: any) {
      if (err.code === 'auth/requires-recent-login') {
        setError("Updating email requires a recent login to confirm your identity. Please log out and back in, then try again.");
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!oldPassword) {
      setError("Please enter your current password.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }

    setLoading(true);
    try {
      // Re-authenticate with old password first
      const credential = EmailAuthProvider.credential(user.email!, oldPassword);
      await reauthenticateWithCredential(user, credential);
      
      // Now update password
      await updatePassword(user, newPassword);
      setSuccess("Password updated successfully.");
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setError("The current password you entered is incorrect.");
      } else if (err.code === 'auth/requires-recent-login') {
        setError("Session expired. Please log out and back in, then try again.");
      } else if (err.code === 'auth/too-many-requests') {
        setError("Too many attempts. Please wait a moment and try again.");
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    setError(null);
    setSuccess(null);
    if (!user.email) return;
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, user.email);
      setResetSent(true);
      setSuccess(`Password reset email sent to ${user.email}. Check your inbox.`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setError("Image must be smaller than 5MB");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 256;
          const MAX_HEIGHT = 256;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }
          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.8);
            setPhotoURL(compressedDataUrl);
            setUploadMode('url');
          } else {
            setPhotoURL(dataUrl);
            setUploadMode('url');
          }
        };
        img.src = dataUrl;
      }
    };
    reader.readAsDataURL(file);
  };


  const handleDeleteAccount = async () => {
    if (deletingAccount) return;
    if (confirm("Are you entirely sure? This action is irreversible.")) {
      try {
        setDeletingAccount(true);
        const base=import.meta.env.VITE_AI_PROXY_URL;
        if(!base)throw Error('Account deletion service unavailable');
        let done=false;
        for(let batch=0;batch<100&&!done;batch++){
          const response=await fetch(base.replace(/\/+$/,'')+'/account/delete',{method:'POST',headers:{'Content-Type':'application/json',...(await appAttestationHeaders()), Authorization:'Bearer '+await user.getIdToken()},body:JSON.stringify({confirm:'DELETE'})});
          const result=await response.json();if(!response.ok)throw Error(result.error||'Deletion interrupted. Retry to resume.');done=result.done===true;
        }
        if(!done)throw Error('More data remains. Retry deletion to resume cleanup.');
        onClose();
        onLogout();
      } catch (err: any) {
        if (err.code === 'auth/requires-recent-login') {
          setError("Deleting account requires a recent login. Please log out and back in, then try again.");
        } else {
          setError(err.message);
        }
      } finally { setDeletingAccount(false); }
    }
  };

  const switchTab = (tab: 'profile' | 'security' | 'achievements' | 'notifications' | 'updates') => {
    setActiveTab(tab);
    setError(null);
    setSuccess(null);
  };

  return (
    <dialog ref={dialogRef} className="account-space" aria-label={ar?'مساحتك الشخصية':'Your personal space'} onCancel={e=>{e.preventDefault();closeRef.current()}} dir={dir}>
      <div className="as-topbar">
        <button className="as-brand" onClick={onClose} aria-label={ar?'العودة إلى JoeScan':'Back to JoeScan'}><img src="/icon-192.png" alt=""/>JoeScan<span>/</span><small>{ar?'الحساب':'Account'}</small></button>
        <div className="as-top-actions">{toolbar}<button className="as-close" onClick={onClose} aria-label={ar?'إغلاق الحساب':'Close account'}><X size={18}/></button></div>
      </div>
      <div className="as-scroll">
      <div className="as-layout">
        <aside className="as-identity">
          <div className="as-passport">
            <div className="as-passport-top"><span>{ar?'هويتك على JOESCAN':'JOESCAN / PERSONAL ID'}</span><Fingerprint size={20}/></div>
            <div className="as-portrait-stage"><i/><i/><div className="as-avatar">{(photoURL || user.photoURL)?<img src={photoURL || user.photoURL!} alt="" referrerPolicy="no-referrer" onLoad={e=>{e.currentTarget.style.display='block'}} onError={e=>{e.currentTarget.style.display='none'}}/>:null}<span>{(displayName || user.displayName || 'J').slice(0,2).toUpperCase()}</span></div><span className="as-corner"/></div>
            <div className="as-passport-name"><small>{ar?'مساحتك الشخصية':'YOUR PERSONAL SPACE'}</small><h2>{displayName || user.displayName || (ar?'حسابك':'Your account')}</h2><p dir="ltr">{user.email}</p></div>
            <div className="as-passport-foot"><span>01 / IDENTITY</span><div aria-hidden="true" className="as-barcode"/></div>
          </div>
          <nav className="as-sections" aria-label={ar?'أقسام الحساب':'Account sections'}>
            {([
              ['profile',ar?'البروفايل':'Identity',UserIcon],
              ['security',ar?'الأمان':'Security',Lock],
              ['notifications',ar?'الإشعارات':'Notifications',Bell],
              ['achievements',ar?'الإنجازات':'Achievements',Trophy],
              ['updates',ar?'التحديثات':'App updates',RefreshCw],
            ] as const).map(([id,label,Icon],index)=><button key={id} type="button" aria-current={activeTab===id?'page':undefined} onClick={()=>switchTab(id)}><span className="as-nav-number">0{index+1}</span><Icon size={16}/><span>{label}</span><span className="as-nav-dot"/>{id==='updates'&&sw.updateAvailable&&<span className="as-update-dot"/>}</button>)}
          </nav>
          <button className="as-signout" onClick={onLogout}><LogOut size={15}/>{t('logout')}</button>
        </aside>
        <section className="as-main">
          <header className="as-heading"><span className="as-eyebrow">{ar?'حسابك، على طريقتك':'YOUR ACCOUNT, YOUR WAY'}</span><h1>{activeTab==='profile'?(ar?'مساحة تشبهك.':'A space that’s yours.'):activeTab==='security'?(ar?'أمانك يبدأ هنا.':'Keep it yours.'):activeTab==='notifications'?(ar?'اختار اللي يوصلك.':'Your signal. Your choice.'):activeTab==='achievements'?(ar?'كل خطوة تفرق.':'Every step counts.'):(ar?'دايمًا على اطلاع.':'Stay up to date.')}</h1><p>{activeTab==='profile'?(ar?'التفاصيل الصغيرة اللي بتخلي JoeScan مساحتك.':'The little details that make JoeScan feel like you.'):activeTab==='security'?(ar?'كلمة المرور وطرق حماية الدخول لحسابك.':'Manage your password and how you protect access.'):activeTab==='notifications'?(ar?'تحكّم في التنبيهات اللي تهمك.':'Choose which updates deserve your attention.'):activeTab==='achievements'?(ar?'راجع إنجازاتك خلال رحلتك.':'A record of your progress along the way.'):(ar?'راجع إصدار التطبيق والتحديثات المتاحة.':'Keep your workspace running smoothly.')}</p></header>
          <div className="as-panel" key={activeTab}>
            <div className="as-panel-heading"><span>{activeTab==='profile'?(ar?'تفاصيل البروفايل':'Profile details'):activeTab==='security'?(ar?'حماية الحساب':'Account protection'):activeTab==='notifications'?(ar?'تفضيلات التنبيهات':'Notification preferences'):activeTab==='achievements'?(ar?'إنجازاتك':'Your achievements'):(ar?'تحديثات التطبيق':'Workspace updates')}</span><small>JOESCAN / {activeTab.toUpperCase()}</small></div>
            <div className="as-form-body">
          {error && (
            <div role="alert" className="bg-error/10 border border-error/20 text-error p-3 rounded-lg text-sm mb-4 flex gap-2 items-start text-left">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
          
          {success && (
            <div role="status" className="bg-accent/10 border border-accent/20 text-accent p-3 rounded-lg text-sm mb-4 text-left">
              {success}
            </div>
          )}

          {activeTab === 'profile' ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
              <form onSubmit={handleUpdateProfile} className="as-profile-form space-y-4">
                <div>
                  <label htmlFor="account-name" className="block text-xs font-mono uppercase tracking-wider text-text-dim mb-1.5 text-left">{t('display_name')}</label>
                  <input id="account-name" 
                    type="text" 
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full bg-bg-surface border border-border-subtle rounded-lg px-3 py-2 text-text-main focus:border-accent outline-none transition-colors"
                    placeholder="Security Operator"
                    dir="auto"
                  />
                </div>
                
                <div>
                  <label htmlFor="account-email" className="block text-xs font-mono uppercase tracking-wider text-text-dim mb-1.5 text-left">{t('account_email')}</label>
                  <input id="account-email" 
                    type="email" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-bg-surface border border-border-subtle rounded-lg px-3 py-2 text-text-main focus:border-accent outline-none transition-colors"
                    placeholder="operator@joescan.cloud"
                    dir="ltr"
                  />
                </div>
                
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-mono uppercase tracking-wider text-text-dim text-left">{t('avatar_label')}</label>
                    <div className="flex bg-bg-base border border-border-subtle rounded text-[10px] overflow-hidden">
                      <button 
                        type="button"
                        onClick={() => setUploadMode('file')}
                        className={`px-2 py-1 flex items-center gap-1 transition-colors ${uploadMode === 'file' ? 'bg-accent text-accent-fg' : 'text-text-dim hover:text-text-main'}`}
                      >
                        <Upload className="w-3 h-3" /> {t('upload_file')}
                      </button>
                      <button 
                        type="button"
                        onClick={() => setUploadMode('url')}
                        className={`px-2 py-1 flex items-center gap-1 transition-colors ${uploadMode === 'url' ? 'bg-accent text-accent-fg' : 'text-text-dim hover:text-text-main'}`}
                      >
                        <LinkIcon className="w-3 h-3" /> {t('upload_url')}
                      </button>
                    </div>
                  </div>

                  {uploadMode === 'url' ? (
                    <input 
                      type="text" 
                      value={photoURL}
                      onChange={(e) => setPhotoURL(e.target.value)}
                      className="w-full bg-bg-surface border border-border-subtle rounded-lg px-3 py-2 text-text-main focus:border-accent outline-none transition-colors"
                      aria-label={ar?'رابط الصورة':'Avatar image URL'} placeholder="https://example.com/avatar.png"
                      dir="ltr"
                    />
                  ) : (
                    <div 
                      role="button" tabIndex={0} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();fileInputRef.current?.click()}}}
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full border-2 border-dashed border-border-subtle hover:border-accent bg-bg-surface/50 hover:bg-bg-surface rounded-lg p-4 flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors text-text-dim hover:text-accent group"
                    >
                      <ImageIcon className="w-6 h-6 group-hover:scale-110 transition-transform" />
                      <span className="text-xs font-mono">{t('click_to_upload')}</span>
                      <input 
                        ref={fileInputRef}
                        type="file" 
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="hidden"
                      />
                    </div>
                  )}
                </div>
                
                <button 
                  type="submit" 
                  disabled={loading}
                  className="w-full bg-accent text-accent-fg font-bold tracking-wider uppercase py-2.5 rounded-lg flex justify-center items-center gap-2 hover:bg-opacity-90 transition-all disabled:opacity-50"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : t('save_profile')}
                </button>
              </form>
            </motion.div>
          ) : activeTab === 'security' ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
              <form onSubmit={handleUpdatePassword} className="space-y-4">
                <div>
                  <label htmlFor="account-old-password" className="block text-xs font-mono uppercase tracking-wider text-text-dim mb-1.5 text-left">{t('old_password') || 'Current Password'}</label>
                  <input id="account-old-password" 
                    type="password" 
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                    className="w-full bg-bg-surface border border-border-subtle rounded-lg px-3 py-2 text-text-main focus:border-accent outline-none transition-colors font-mono tracking-widest text-sm"
                    placeholder="••••••••"
                    dir="ltr"
                  />
                  <button 
                    type="button" 
                    onClick={handleForgotPassword}
                    disabled={loading || resetSent}
                    className="text-xs text-accent hover:text-accent/80 mt-1.5 font-mono tracking-wide transition-colors disabled:opacity-50 flex items-center gap-1"
                  >
                    {resetSent ? '✓ Reset email sent' : `🔑 ${t('forgot_password')}`}
                  </button>
                </div>
                <div>
                  <label htmlFor="account-password" className="block text-xs font-mono uppercase tracking-wider text-text-dim mb-1.5 text-left">{t('new_password')}</label>
                  <input id="account-password" 
                    type="password" 
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full bg-bg-surface border border-border-subtle rounded-lg px-3 py-2 text-text-main focus:border-accent outline-none transition-colors font-mono tracking-widest text-sm"
                    placeholder="••••••••"
                    dir="ltr"
                  />
                </div>
                <div>
                  <label htmlFor="account-confirm-password" className="block text-xs font-mono uppercase tracking-wider text-text-dim mb-1.5 text-left">{t('confirm_password')}</label>
                  <input id="account-confirm-password" 
                    type="password" 
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full bg-bg-surface border border-border-subtle rounded-lg px-3 py-2 text-text-main focus:border-accent outline-none transition-colors font-mono tracking-widest text-sm"
                    placeholder="••••••••"
                    dir="ltr"
                  />
                </div>
                <button 
                  type="submit" 
                  disabled={loading || !oldPassword || !newPassword || !confirmPassword}
                  className="w-full bg-accent text-accent-fg font-bold tracking-wider uppercase py-2.5 rounded-lg flex justify-center items-center gap-2 hover:bg-opacity-90 transition-all disabled:opacity-50 mt-2"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : t('update_password')}
                </button>
              </form>

              <hr className="border-border-subtle my-2" />

              {/* MFA Toggle */}
              <div className="bg-bg-surface/50 border border-border-subtle rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {mfaEnabled ? (
                      <div className="p-2 bg-accent/10 border border-accent/20 rounded-lg">
                        <ShieldCheck className="w-5 h-5 text-accent" />
                      </div>
                    ) : (
                      <div className="p-2 bg-bg-elevated border border-border-subtle rounded-lg">
                        <ShieldOff className="w-5 h-5 text-text-dim" />
                      </div>
                    )}
                    <div>
                      <h4 className="text-sm font-bold text-text-main">Two-Factor Authentication</h4>
                      <p className="text-[10px] text-text-dim font-mono uppercase tracking-wider">
                        {mfaEnabled ? 'Active — TOTP Authenticator' : 'Disabled — Not configured'}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={async () => {
                      if (!user) return;
                      setMfaToggling(true);
                      setError(null);
                      setSuccess(null);
                      try {
                        if (mfaEnabled) {
                          // Disable MFA: unenroll the TOTP factor in Firebase Auth
                          const current = auth.currentUser;
                          if (!current) throw new Error("Not signed in");
                          const factors = multiFactor(current).enrolledFactors;
                          const totpFactor = factors.find(f => f.factorId === TotpMultiFactorGenerator.FACTOR_ID);
                          if (!totpFactor) throw new Error("No authenticator factor found on this account.");
                          await multiFactor(current).unenroll(totpFactor);
                          setMfaEnabled(false);
                          setSuccess('Two-Factor Authentication has been disabled. You can re-enable it anytime.');
                        } else {
                          // Enable MFA: sign out and back in to run the enrollment flow
                          setSuccess('To protect your account, enrollment runs at sign-in. Please log out and log back in to set up your authenticator.');
                        }
                      } catch (err: any) {
                        setError(err.message || 'Failed to update MFA settings.');
                      } finally {
                        setMfaToggling(false);
                      }
                    }}
                    aria-label="Two-factor authentication" role="switch" aria-checked={mfaEnabled===true} disabled={mfaToggling || mfaEnabled === null}
                    className={`relative w-12 h-6 rounded-full transition-colors duration-300 ${mfaEnabled ? 'bg-accent' : 'bg-bg-elevated border border-border-subtle'} ${mfaToggling ? 'opacity-50' : ''}`}
                  >
                    <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all duration-300 ${mfaEnabled ? 'left-[26px]' : 'left-0.5'}`} />
                  </button>
                </div>
                {!mfaEnabled && (
                  <p className="text-[11px] text-text-dim mt-3 leading-relaxed border-t border-border-subtle/50 pt-3">
                    🔐 Enabling 2FA adds an extra layer of protection. Even if someone steals your password, they won't be able to access your account without your phone.
                  </p>
                )}
              </div>

              <hr className="border-border-subtle my-2" />

              {/* Danger Zone */}
              <div className="flex flex-col gap-3">
                <span className="text-xs font-mono uppercase text-error font-bold tracking-wider">{t('danger_zone')}</span>
                <button 
                  onClick={onLogout}
                  className="w-full bg-bg-surface border border-border-subtle hover:border-text-dim transition-colors text-text-main font-bold py-2.5 rounded-lg flex items-center justify-center gap-2"
                >
                  <LogOut className="w-4 h-4" /> {t('logout')}
                </button>
                <button 
                  onClick={handleDeleteAccount}
                  disabled={deletingAccount}
                  className="w-full text-error hover:text-white hover:bg-error transition-colors font-bold py-2.5 rounded-lg flex items-center justify-center gap-2 border border-error/50 hover:border-transparent"
                >
                  <AlertTriangle className="w-4 h-4" /> {t('delete_account')}
                </button>
              </div>
            </motion.div>
          ) : activeTab === 'notifications' ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <PushNotifSettings />
            </motion.div>
          ) : activeTab === 'updates' ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-5">
              {/* Update Status */}
              <div className={`p-5 rounded-xl border ${sw.updateAvailable ? 'border-accent/40 bg-accent/5' : 'border-border-subtle bg-bg-surface/50'} flex flex-col items-center text-center gap-3`}>
                {sw.updateAvailable ? (
                  <>
                    <div className="w-14 h-14 rounded-full bg-accent/10 flex items-center justify-center">
                      <Download className="w-7 h-7 text-accent animate-bounce" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-accent">{t('updates_available')}</h3>
                      <p className="text-xs text-text-dim mt-1">{t('updates_available_desc')}</p>
                    </div>
                    <button
                      onClick={() => sw.applyUpdate()}
                      className="w-full bg-accent text-accent-fg font-bold tracking-wider uppercase py-3 rounded-lg flex justify-center items-center gap-2 hover:brightness-110 transition-all mt-1"
                    >
                      <Download className="w-4 h-4" /> {t('updates_install')}
                    </button>
                  </>
                ) : (
                  <>
                    <div className="w-14 h-14 rounded-full bg-accent/10 flex items-center justify-center">
                      <CheckCircle className="w-7 h-7 text-accent" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-text-main">{t('updates_up_to_date')}</h3>
                      <p className="text-xs text-text-dim mt-1">{t('updates_up_to_date_desc')}</p>
                    </div>
                  </>
                )}
              </div>

              {/* Check for Updates Button */}
              <button
                onClick={() => sw.checkForUpdate()}
                disabled={sw.checking}
                className="w-full bg-bg-surface border border-border-subtle hover:border-accent/30 text-text-main font-bold tracking-wider uppercase py-2.5 rounded-lg flex justify-center items-center gap-2 transition-all disabled:opacity-50"
              >
                {sw.checking ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> {t('updates_checking')}</>
                ) : (
                  <><RefreshCw className="w-4 h-4" /> {t('updates_check')}</>
                )}
              </button>

              {sw.lastChecked && (
                <p className="text-center text-[10px] font-mono text-text-dim tracking-wider">
                  {t('updates_last_checked')}: {new Date(sw.lastChecked).toLocaleTimeString()}
                </p>
              )}

              {/* Force Clear Cache */}
              <div className="border-t border-border-subtle pt-4 mt-2">
                <p className="text-[10px] font-mono uppercase tracking-widest text-text-dim mb-2">{t('danger_zone')}</p>
                <p className="text-xs text-text-dim mb-3">{t('updates_clear_cache_desc')}</p>
                <button
                  onClick={async () => {
                    if ('caches' in window) {
                      const keys = await caches.keys();
                      await Promise.all(keys.map(k => caches.delete(k)));
                    }
                    if (sw.registration) {
                      await sw.registration.unregister();
                    }
                    window.location.reload();
                  }}
                  className="w-full text-error hover:text-white hover:bg-error transition-colors font-bold py-2.5 rounded-lg flex items-center justify-center gap-2 border border-error/50 hover:border-transparent"
                >
                  <Trash2 className="w-4 h-4" /> {t('updates_clear_cache')}
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <BadgeSystem />
            </motion.div>
          )}
            </div>
          </div>
          <footer className="as-footer"><Shield size={13}/><span>{ar?'مساحتك لإدارة حسابك وتفضيلاتك.':'One place for your identity, security and preferences.'}</span><span>JOESCAN</span></footer>
        </section>
      </div>
      </div>
    </dialog>
  );
}
