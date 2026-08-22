import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Key, Copy, Trash2, Plus, Zap, Shield } from 'lucide-react';
import { auth, db, logActivity, getUserTier } from '../lib/firebase';
import { collection, addDoc, getDocs, query, where, deleteDoc, doc } from 'firebase/firestore';

export default function ApiKeysPanel() {
  const [keys, setKeys] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [keyName, setKeyName] = useState('');
  // Held in memory only, shown once right after creation.
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<string | null>(null);
  const [tier, setTier] = useState('free');
  const [copied, setCopied] = useState<string | null>(null);

  const fetchKeys = async () => {
    if (!auth.currentUser) return;
    try {
      const q = query(collection(db, 'apiKeys'), where('userId', '==', auth.currentUser.uid));
      const snap = await getDocs(q);
      setKeys(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      const t = await getUserTier(auth.currentUser.uid);
      setTier(t);
    } catch (err) {
      console.error("Failed to fetch API keys", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchKeys(); }, []);

  const generateApiKey = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const prefix = 'js_live_';
    // crypto.getRandomValues, not Math.random — this is a credential.
    const bytes = new Uint8Array(40);
    crypto.getRandomValues(bytes);
    let result = prefix;
    for (let i = 0; i < bytes.length; i++) result += chars.charAt(bytes[i] % chars.length);
    return result;
  };

  const sha256Hex = async (input: string) => {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
    return Array.from(new Uint8Array(digest))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyName.trim() || !auth.currentUser) return;
    setCreating(true);
    try {
      const apiKey = generateApiKey();
      // Store only a hash and the last 4 characters. The raw key is shown to the
      // user once, below, and is never persisted — so a leak of this collection
      // discloses nothing usable.
      await addDoc(collection(db, 'apiKeys'), {
        userId: auth.currentUser.uid,
        email: auth.currentUser.email,
        name: keyName,
        keyHash: await sha256Hex(apiKey),
        last4: apiKey.slice(-4),
        createdAt: new Date().toISOString(),
        lastUsed: null,
        requestCount: 0,
      });
      await logActivity('apikey_create', `Created API key: ${keyName}`);
      setNewlyCreatedKey(apiKey);
      setKeyName('');
      fetchKeys();
    } catch (err) {
      console.error("Failed to create API key", err);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (keyId: string, name: string) => {
    await deleteDoc(doc(db, 'apiKeys', keyId));
    await logActivity('apikey_delete', `Deleted API key: ${name}`);
    fetchKeys();
  };

  const handleCopy = (key: string, id: string) => {
    navigator.clipboard.writeText(key);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const maxKeys = tier === 'enterprise' ? 20 : tier === 'pro' ? 5 : 1;
  const canCreate = keys.length < maxKeys;

  if (loading) return <div className="flex justify-center items-center h-full"><Zap className="w-8 h-8 animate-pulse text-accent" /></div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12 w-full">
      <div>
        <h1 className="text-3xl font-black uppercase tracking-tight flex items-center gap-3">
          <Key className="w-8 h-8 text-indigo-400" /> API Access
        </h1>
        <p className="text-text-dim text-sm mt-1 font-mono">Manage your API keys for programmatic access to JoeScan intelligence.</p>
      </div>

      {/* Tier Info */}
      <div className="glass-card p-4 rounded-xl flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Shield className="w-5 h-5 text-accent" />
          <span className="text-sm font-bold text-text-main">{keys.length} / {maxKeys} Keys Used</span>
        </div>
        <span className={`text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded ${tier === 'enterprise' ? 'bg-error/20 text-error' : tier === 'pro' ? 'bg-accent/20 text-accent' : 'bg-bg-elevated text-text-dim'}`}>
          {tier} TIER
        </span>
      </div>

      {/* Create Form  */}
      <form onSubmit={handleCreate} className="glass-card p-5 rounded-xl flex gap-3 items-end">
        <div className="flex-1">
          <label className="text-[10px] font-mono uppercase text-text-dim">Key Name</label>
          <input type="text" value={keyName} onChange={e => setKeyName(e.target.value)} placeholder="e.g. Production Server" 
            className="w-full bg-bg-base border border-border-subtle rounded-lg px-4 py-3 text-sm mt-1" required disabled={!canCreate} />
        </div>
        <button type="submit" disabled={creating || !canCreate}
          className="px-6 py-3 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-indigo-500/20 transition-all disabled:opacity-40 flex items-center gap-2 shrink-0">
          {creating ? <Zap className="w-4 h-4 animate-pulse" /> : <><Plus className="w-4 h-4" /> Generate Key</>}
        </button>
      </form>

      {!canCreate && (
        <div className="text-xs text-orange-400 font-mono bg-orange-500/10 p-3 rounded-lg border border-orange-500/20 text-center">
          You've reached the maximum number of API keys for your tier. Upgrade to create more.
        </div>
      )}

      {/* The one and only time the raw key is visible */}
      {newlyCreatedKey && (
        <div className="glass-card p-5 rounded-xl border border-accent/40 mb-4">
          <div className="flex items-center gap-2 mb-2">
            <Shield className="w-4 h-4 text-accent" />
            <h3 className="font-bold text-sm text-accent uppercase tracking-wide">Copy your key now</h3>
          </div>
          <p className="text-xs text-text-dim mb-3">
            This is the only time it will be shown. Only a hash is stored, so it cannot be recovered later.
          </p>
          <div className="bg-[#0a0a0a] border border-border-subtle rounded-lg px-4 py-2.5 font-mono text-xs flex items-center justify-between gap-3">
            <span className="truncate">{newlyCreatedKey}</span>
            <button
              onClick={() => handleCopy(newlyCreatedKey, 'new')}
              className="p-1.5 text-text-dim hover:text-accent transition-colors rounded shrink-0"
              title="Copy"
            >
              <Copy className="w-4 h-4" />
            </button>
          </div>
          <div className="flex items-center justify-between mt-3">
            {copied === 'new' && <span className="text-accent text-[10px] font-bold uppercase">Copied!</span>}
            <button
              onClick={() => setNewlyCreatedKey(null)}
              className="ml-auto text-[10px] font-mono uppercase tracking-widest text-text-dim hover:text-text-main transition-colors"
            >
              I saved it — dismiss
            </button>
          </div>
        </div>
      )}

      {/* Keys List */}
      <div className="space-y-3">
        {keys.map((k, i) => (
          <motion.div key={k.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className="glass-card p-5 rounded-xl"
          >
            <div className="flex justify-between items-start mb-3">
              <div>
                <h3 className="font-bold text-text-main text-sm">{k.name}</h3>
                <p className="text-[10px] font-mono text-text-dim mt-1">Created: {new Date(k.createdAt).toLocaleDateString()}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => handleDelete(k.id, k.name)} className="p-2 text-text-dim hover:text-error transition-colors rounded-lg hover:bg-error/10" title="Delete">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="bg-[#0a0a0a] border border-border-subtle rounded-lg px-4 py-2.5 font-mono text-xs flex items-center justify-between">
              <span className="truncate">{`js_live_${'•'.repeat(30)}${k.last4 || ''}`}</span>
              <span className="text-text-dim text-[10px] uppercase shrink-0 ml-2">shown once at creation</span>
            </div>
          </motion.div>
        ))}
        {keys.length === 0 && (
          <div className="text-center py-12 glass-card rounded-xl">
            <Key className="w-12 h-12 text-text-dim/30 mx-auto mb-3" />
            <p className="text-text-dim font-mono text-sm">No API keys yet. Generate one to get started.</p>
          </div>
        )}
      </div>
    </div>
  );
}
