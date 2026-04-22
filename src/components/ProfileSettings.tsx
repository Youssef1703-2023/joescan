import React, { useState, useRef, useEffect } from 'react';
import { updateProfile, deleteUser, updateEmail, updatePassword, reauthenticateWithCredential, EmailAuthProvider, sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { useLanguage } from '../contexts/LanguageContext';
import { Shield, X, User as UserIcon, Loader2, AlertTriangle, LogOut, Upload, Link as LinkIcon, Image as ImageIcon, Fingerprint, Lock, Trophy, Bell } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import BadgeSystem from './BadgeSystem';
import PushNotifSettings from './PushNotifSettings';

interface ProfileSettingsProps {
  onClose: () => void;
  onLogout: () => void;
}

export default function ProfileSettings({ onClose, onLogout }: ProfileSettingsProps) {
  const { dir, t } = useLanguage();
  const user = auth.currentUser;
  
  const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'achievements' | 'notifications'>('profile');
  
  // Profile State
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [email, setEmail] = useState(user?.email || '');
  const [photoURL, setPhotoURL] = useState(user?.photoURL || '');
  const [customAvatar, setCustomAvatar] = useState<string | null>(null);
  const [uploadMode, setUploadMode] = useState<'url' | 'file'>('file');

  // Load custom avatar from localStorage
  useEffect(() => {
    if (!user) return;
    const saved = localStorage.getItem(`joescan_avatar_${user.uid}`);
    if (saved) {
      setCustomAvatar(saved);
      setPhotoURL(saved);
    }
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

      // Save avatar to localStorage (no permissions needed, high quality)
      if (photoURL.trim() && photoURL.trim() !== (customAvatar || user.photoURL || '')) {
        localStorage.setItem(`joescan_avatar_${user.uid}`, photoURL.trim());
        setCustomAvatar(photoURL.trim());
        // Notify App.tsx to update header avatar
        window.dispatchEvent(new Event('avatar_updated'));
        successMessages.push("Avatar updated successfully.");
      }

      // Update Email
      const targetEmail = email.trim();
      if (targetEmail && targetEmail !== user.email) {
        promises.push(updateEmail(user, targetEmail).then(() => {
          successMessages.push("Email address updated successfully.");
        }));
      }

      if (promises.length > 0) {
        await Promise.all(promises);
        setSuccess(successMessages.join(" "));
      } else {
        setSuccess("No changes were made.");
      }
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
        setPhotoURL(dataUrl);
        setUploadMode('url');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDeleteAccount = async () => {
    if (confirm("Are you entirely sure? This action is irreversible.")) {
      try {
        await deleteUser(user);
        onClose();
        onLogout();
      } catch (err: any) {
        if (err.code === 'auth/requires-recent-login') {
          setError("Deleting account requires a recent login. Please log out and back in, then try again.");
        } else {
          setError(err.message);
        }
      }
    }
  };

  const switchTab = (tab: 'profile' | 'security' | 'achievements' | 'notifications') => {
    setActiveTab(tab);
    setError(null);
    setSuccess(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" dir={dir}>
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-md bg-bg-base border border-border-subtle rounded-2xl shadow-2xl overflow-hidden relative flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="bg-bg-surface px-6 pt-4 border-b border-border-subtle shrink-0">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 text-text-main font-bold">
              <UserIcon className="w-5 h-5 text-accent" />
              <span>{t('profile_settings')}</span>
            </div>
            <button onClick={onClose} className="p-2 -mr-2 hover:bg-black/10 rounded-full transition-colors text-text-dim hover:text-text-main">
              <X className="w-4 h-4" />
            </button>
          </div>
          
          <div className="flex gap-4">
            <button 
              onClick={() => switchTab('profile')}
              className={`pb-2.5 font-bold uppercase tracking-wider text-[11px] border-b-2 transition-colors ${activeTab === 'profile' ? 'border-accent text-accent' : 'border-transparent text-text-dim hover:text-text-main'}`}
            >
              {t('tab_general')}
            </button>
            <button 
              onClick={() => switchTab('security')}
              className={`pb-2.5 font-bold uppercase tracking-wider text-[11px] border-b-2 transition-colors flex items-center gap-1.5 ${activeTab === 'security' ? 'border-accent text-accent' : 'border-transparent text-text-dim hover:text-text-main'}`}
            >
              <Lock className="w-3 h-3" /> {t('tab_security')}
            </button>
            <button 
              onClick={() => switchTab('achievements')}
              className={`pb-2.5 font-bold uppercase tracking-wider text-[11px] border-b-2 transition-colors flex items-center gap-1.5 ${activeTab === 'achievements' ? 'border-accent text-accent' : 'border-transparent text-text-dim hover:text-text-main'}`}
            >
              <Trophy className="w-3 h-3" /> {t('achievements_tab' as any) || 'Achievements'}
            </button>
            <button 
              onClick={() => switchTab('notifications')}
              className={`pb-2.5 font-bold uppercase tracking-wider text-[11px] border-b-2 transition-colors flex items-center gap-1.5 ${activeTab === 'notifications' ? 'border-accent text-accent' : 'border-transparent text-text-dim hover:text-text-main'}`}
            >
              <Bell className="w-3 h-3" /> Alerts
            </button>
          </div>
        </div>

        {/* Form Body */}
        <div className="p-6 overflow-y-auto">
          {error && (
            <div className="bg-error/10 border border-error/20 text-error p-3 rounded-lg text-sm mb-4 flex gap-2 items-start text-left">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
          
          {success && (
            <div className="bg-accent/10 border border-accent/20 text-accent p-3 rounded-lg text-sm mb-4 text-left">
              {success}
            </div>
          )}

          {activeTab === 'profile' ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
              <div className="flex items-center gap-4">
                {(customAvatar || photoURL || user.photoURL) ? (
                  <img src={customAvatar || photoURL || user.photoURL!} alt="Avatar" className="w-16 h-16 rounded-full border-2 border-border-subtle object-cover shrink-0" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-bg-surface border-2 border-border-subtle flex items-center justify-center shrink-0">
                    <UserIcon className="w-8 h-8 text-text-dim" />
                  </div>
                )}
                <div className="flex flex-col text-left overflow-hidden">
                  <span className="font-mono text-xs text-text-dim tracking-wider uppercase mb-1">{t('internal_uid')}</span>
                  <div className="flex items-center gap-1.5 bg-bg-surface border border-border-subtle px-2 py-1 rounded max-w-full">
                    <Fingerprint className="w-3 h-3 text-accent shrink-0" />
                    <span className="font-mono text-[10px] text-text-main truncate" dir="ltr">{user.uid}</span>
                  </div>
                </div>
              </div>

              <form onSubmit={handleUpdateProfile} className="space-y-4">
                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider text-text-dim mb-1.5 text-left">{t('display_name')}</label>
                  <input 
                    type="text" 
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full bg-bg-surface border border-border-subtle rounded-lg px-3 py-2 text-text-main focus:border-accent outline-none transition-colors"
                    placeholder="Security Operator"
                    dir="auto"
                  />
                </div>
                
                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider text-text-dim mb-1.5 text-left">{t('account_email')}</label>
                  <input 
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
                      placeholder="https://example.com/avatar.png"
                      dir="ltr"
                    />
                  ) : (
                    <div 
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
                  <label className="block text-xs font-mono uppercase tracking-wider text-text-dim mb-1.5 text-left">{t('old_password') || 'Current Password'}</label>
                  <input 
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
                  <label className="block text-xs font-mono uppercase tracking-wider text-text-dim mb-1.5 text-left">{t('new_password')}</label>
                  <input 
                    type="password" 
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full bg-bg-surface border border-border-subtle rounded-lg px-3 py-2 text-text-main focus:border-accent outline-none transition-colors font-mono tracking-widest text-sm"
                    placeholder="••••••••"
                    dir="ltr"
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono uppercase tracking-wider text-text-dim mb-1.5 text-left">{t('confirm_password')}</label>
                  <input 
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
          ) : (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <BadgeSystem />
            </motion.div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
