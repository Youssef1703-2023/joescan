import React, {useState} from 'react';
import {sendEmailVerification, type User} from 'firebase/auth';

export default function EmailVerificationGate({user,onLogout}:{user:User;onLogout:()=>void}) {
  const [message,setMessage]=useState('');
  const [busy,setBusy]=useState(false);
  const refresh = async () => {
    setBusy(true);
    try {
      await user.reload();
      await user.getIdToken(true);
      location.reload();
    } catch { setMessage('Your session could not be refreshed. Check your connection or sign out and sign in again.'); }
    finally { setBusy(false); }
  };
  const send = async () => {
    setBusy(true);
    try {
      await user.reload();
      if (user.emailVerified) { await refresh(); return; }
      if (!user.email) { setMessage('This session has no email address for verification. Sign out and sign in again with Google.'); return; }
      await sendEmailVerification(user);
      setMessage('Verification email sent. Check your inbox and spam folder, then return here.');
    } catch (error) {
      const code = (error as {code?: string}).code;
      const messages: Record<string,string> = {
        'auth/too-many-requests': 'Too many requests. Please wait before sending another email.',
        'auth/network-request-failed': 'Could not connect. Check your internet connection and try again.',
        'auth/user-token-expired': 'Your session has expired. Sign out and sign in again.',
        'auth/requires-recent-login': 'Please sign out and sign in again before requesting verification.',
      };
      setMessage(messages[code || ''] || 'Verification could not be sent (' + (code || 'unknown error') + '). Try signing in again or contact joetech.dev.systems@gmail.com.');
    } finally { setBusy(false); }
  };
  return <main className="min-h-screen bg-bg-base text-text-main flex items-center justify-center p-6"><section className="w-full max-w-lg rounded-2xl border border-accent/30 p-8 bg-bg-surface">
    <h1 className="text-2xl font-bold">Verify your email</h1>
    <p className="mt-4 text-text-dim">Email and password accounts need a verified email before accessing JoeScan tools. If you signed in with Google, refresh your session below.</p>
    {user.email && <p className="mt-3 break-all">{user.email}</p>}
    <p role="status" className="mt-4">{message}</p>
    <button disabled={busy} className="mt-4 rounded-lg bg-accent text-accent-fg px-4 py-3 disabled:opacity-50" onClick={send}>Send verification email</button>
    <button disabled={busy} className="block mt-4 text-accent" onClick={refresh}>Refresh verification status</button>
    <button disabled={busy} className="block mt-4 text-text-dim" onClick={onLogout}>Sign out</button>
  </section></main>;
}
