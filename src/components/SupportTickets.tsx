import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Ticket, Send, Clock, CheckCircle, MessageSquare, Plus, Zap } from 'lucide-react';
import { auth, db, logActivity } from '../lib/firebase';
import { collection, addDoc, getDocs, query, where, orderBy, doc, setDoc, getDoc } from 'firebase/firestore';

export default function SupportTickets() {
  const [tickets, setTickets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [category, setCategory] = useState('general');
  const [sending, setSending] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [replyTarget, setReplyTarget] = useState<string | null>(null);

  const fetchTickets = async () => {
    if (!auth.currentUser) return;
    try {
      const q = query(collection(db, 'supportTickets'), where('userId', '==', auth.currentUser.uid));
      const snap = await getDocs(q);
      setTickets(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    } catch (err) {
      console.error("Failed to fetch tickets", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTickets(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !message.trim() || !auth.currentUser) return;
    setSending(true);
    try {
      await addDoc(collection(db, 'supportTickets'), {
        userId: auth.currentUser.uid,
        email: auth.currentUser.email,
        subject,
        message,
        category,
        status: 'open',
        replies: [],
        createdAt: new Date().toISOString(),
      });
      await logActivity('ticket_create', `New ticket: ${subject}`);
      setSubject('');
      setMessage('');
      setShowForm(false);
      fetchTickets();
    } catch (err) {
      console.error("Failed to submit ticket", err);
    } finally {
      setSending(false);
    }
  };

  const handleUserReply = async (ticketId: string) => {
    if (!replyText.trim()) return;
    const ticketRef = doc(db, 'supportTickets', ticketId);
    const ticketSnap = await getDoc(ticketRef);
    const existing = ticketSnap.data();
    const replies = existing?.replies || [];
    replies.push({ message: replyText, from: 'user', timestamp: new Date().toISOString() });
    await setDoc(ticketRef, { replies, status: 'open' }, { merge: true });
    setReplyText('');
    setReplyTarget(null);
    fetchTickets();
  };

  const statusConfig: Record<string, { color: string; icon: any; label: string }> = {
    open: { color: 'text-orange-400 bg-orange-500/10 border-orange-500/20', icon: Clock, label: 'Awaiting Response' },
    replied: { color: 'text-accent bg-accent/10 border-accent/20', icon: CheckCircle, label: 'Admin Replied' },
    closed: { color: 'text-text-dim bg-bg-elevated border-border-subtle', icon: CheckCircle, label: 'Resolved' },
  };

  if (loading) return <div className="flex justify-center items-center h-full"><Zap className="w-8 h-8 animate-pulse text-accent" /></div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12 w-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tight flex items-center gap-3">
            <Ticket className="w-8 h-8 text-orange-400" /> Support Center
          </h1>
          <p className="text-text-dim text-sm mt-1 font-mono">Submit and track your support requests.</p>
        </div>
        <button onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2.5 bg-accent/10 border border-accent/20 rounded-xl text-accent text-xs font-bold uppercase tracking-widest hover:bg-accent/20 transition-all">
          <Plus className="w-4 h-4" /> New Ticket
        </button>
      </div>

      {/* New Ticket Form */}
      {showForm && (
        <motion.form onSubmit={handleSubmit} initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="glass-card p-6 rounded-xl space-y-4"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-mono uppercase text-text-dim">Subject</label>
              <input type="text" value={subject} onChange={e => setSubject(e.target.value)} placeholder="Brief description..." className="w-full bg-bg-base border border-border-subtle rounded-lg px-4 py-3 text-sm mt-1" required />
            </div>
            <div>
              <label className="text-[10px] font-mono uppercase text-text-dim">Category</label>
              <select value={category} onChange={e => setCategory(e.target.value)} className="w-full bg-bg-base border border-border-subtle rounded-lg px-4 py-3 text-sm mt-1 font-mono">
                <option value="general">General Inquiry</option>
                <option value="bug">Bug Report</option>
                <option value="billing">Billing Issue</option>
                <option value="feature">Feature Request</option>
                <option value="security">Security Concern</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-[10px] font-mono uppercase text-text-dim">Message</label>
            <textarea value={message} onChange={e => setMessage(e.target.value)} placeholder="Describe your issue in detail..." className="w-full bg-bg-base border border-border-subtle rounded-lg px-4 py-3 text-sm mt-1 min-h-[120px] resize-none" required />
          </div>
          <div className="flex gap-3">
            <button type="submit" disabled={sending} className="flex-1 py-3 btn-glow rounded-xl text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2">
              {sending ? <Zap className="w-4 h-4 animate-pulse" /> : <><Send className="w-4 h-4" /> Submit Ticket</>}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="px-6 py-3 bg-bg-elevated border border-border-subtle rounded-xl text-xs font-bold uppercase text-text-dim hover:text-text-main">Cancel</button>
          </div>
        </motion.form>
      )}

      {/* Tickets List */}
      <div className="space-y-4">
        {tickets.map((ticket, i) => {
          const sc = statusConfig[ticket.status] || statusConfig.open;
          const StatusIcon = sc.icon;
          return (
            <motion.div key={ticket.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              className={`glass-card p-5 rounded-xl border ${ticket.status === 'replied' ? 'border-accent/30' : 'border-border-subtle'}`}
            >
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="font-bold text-text-main">{ticket.subject}</h3>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-[10px] font-mono text-text-dim uppercase">{ticket.category}</span>
                    <span className="text-[10px] font-mono text-text-dim">{new Date(ticket.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
                <span className={`flex items-center gap-1 text-[10px] font-bold uppercase px-2.5 py-1 rounded-lg border ${sc.color}`}>
                  <StatusIcon className="w-3 h-3" /> {sc.label}
                </span>
              </div>
              <p className="text-sm text-text-dim bg-bg-surface p-3 rounded-lg border border-border-subtle/50 mb-3">{ticket.message}</p>

              {/* Replies Thread */}
              {ticket.replies?.length > 0 && (
                <div className="space-y-2 mb-3">
                  {ticket.replies.map((r: any, ri: number) => (
                    <div key={ri} className={`text-xs p-3 rounded-lg border ${r.from === 'admin' ? 'bg-accent/5 border-accent/20 ml-4' : 'bg-bg-surface border-border-subtle mr-4'}`}>
                      <span className={`font-bold ${r.from === 'admin' ? 'text-accent' : 'text-text-main'}`}>{r.from === 'admin' ? '⚡ Support Team' : '👤 You'}:</span>
                      <p className="mt-1 text-text-dim">{r.message}</p>
                      <span className="text-[9px] text-text-dim/50 font-mono mt-1 block">{new Date(r.timestamp).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Reply from user */}
              {ticket.status !== 'closed' && (
                replyTarget === ticket.id ? (
                  <div className="flex gap-2">
                    <input type="text" value={replyText} onChange={e => setReplyText(e.target.value)} placeholder="Type your reply..." className="flex-1 bg-bg-base border border-border-subtle rounded-lg px-3 py-2 text-xs" />
                    <button onClick={() => handleUserReply(ticket.id)} className="px-4 py-2 bg-accent/10 text-accent rounded-lg text-xs font-bold border border-accent/20">Send</button>
                    <button onClick={() => setReplyTarget(null)} className="text-text-dim text-xs px-2">✕</button>
                  </div>
                ) : (
                  <button onClick={() => setReplyTarget(ticket.id)} className="text-xs text-accent font-mono hover:underline flex items-center gap-1">
                    <MessageSquare className="w-3 h-3" /> Reply
                  </button>
                )
              )}
            </motion.div>
          );
        })}
        {tickets.length === 0 && !showForm && (
          <div className="text-center py-12 glass-card rounded-xl">
            <Ticket className="w-12 h-12 text-text-dim/30 mx-auto mb-3" />
            <p className="text-text-dim font-mono text-sm">No tickets yet. Click "New Ticket" to get started.</p>
          </div>
        )}
      </div>
    </div>
  );
}
