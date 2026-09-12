import React, { useEffect, useRef } from 'react';
import { AlertCircle, ChevronLeft, ChevronRight, CircleCheck, X } from 'lucide-react';
import { dateMs, type AdminRecord } from '../../lib/adminControl';
export const shortDate = (value: any) => dateMs(value) ? new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(dateMs(value)) : 'Not recorded';
export const fullDate = (value: any) => dateMs(value) ? new Date(dateMs(value)).toLocaleString() : 'Not recorded';
export const planName = (tier: string) => ({ free: 'Stealth', pro: 'Pro Analyst', enterprise: 'SOC Enterprise', all: 'All paid plans' }[tier] || tier || 'Not recorded');
export const requestName = (row: AdminRecord) => ({ claim: 'Referral signup', soc_trial: 'SOC trial', referral_reward: 'Referral reward', subscription: 'Subscription' }[row.kind] || 'Unknown request');
export function Badge({ children, tone = '' }: { children: React.ReactNode; tone?: string }) { return <span className="ac-badge" data-tone={tone}>{children}</span>; }
export function Empty({ title, detail }: { title: string; detail?: string }) { return <div className="ac-empty"><CircleCheck size={25}/><h3>{title}</h3>{detail && <p>{detail}</p>}</div>; }
export function ErrorNote({ message }: { message: string }) { return <div className="ac-form-error" role="alert"><AlertCircle size={17}/><p>{message}</p></div>; }
export function Pager({ page, total, onChange }: { page: number; total: number; onChange: (n: number) => void }) {
  const count = Math.max(1, Math.ceil(total / 8)); const active = Math.min(page, count);
  return <div className="ac-pagination"><span>{total ? `${(active - 1) * 8 + 1}–${Math.min(active * 8, total)} of ${total}` : '0 records'}</span><div><button disabled={active === 1} aria-label="Previous page" onClick={() => onChange(active - 1)}><ChevronLeft size={16}/></button><span>{active} / {count}</span><button disabled={active === count} aria-label="Next page" onClick={() => onChange(active + 1)}><ChevronRight size={16}/></button></div></div>;
}
export function Modal({ title, busy, close, children }: { title: string; busy: boolean; close: () => void; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { const previous = document.activeElement as HTMLElement; const overflow = document.body.style.overflow; document.body.style.overflow = 'hidden'; ref.current?.focus(); return () => { document.body.style.overflow = overflow; previous?.focus(); }; }, []);
  return <div className="ac-overlay" onClick={e => { if (e.target === e.currentTarget && !busy) close(); }}><div className="ac-dialog" ref={ref} role="dialog" aria-modal="true" aria-labelledby="admin-dialog-title" tabIndex={-1} onKeyDown={e => {
    if (e.key === 'Escape' && !busy) close();
    if (e.key === 'Tab') { const nodes = Array.from(ref.current?.querySelectorAll<HTMLElement>('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href]') || []) as HTMLElement[]; const first = nodes[0], last = nodes[nodes.length - 1]; if (e.shiftKey && (document.activeElement === first || document.activeElement === ref.current)) { e.preventDefault(); last?.focus(); } else if (!e.shiftKey && (document.activeElement === last || document.activeElement === ref.current)) { e.preventDefault(); first?.focus(); } }
  }}><div className="ac-dialog-heading"><div><span className="ac-eyebrow">JOESCAN / ADMINISTRATOR</span><h2 id="admin-dialog-title">{title}</h2></div><button className="ac-icon" aria-label="Close dialog" disabled={busy} onClick={close}><X size={20}/></button></div>{children}</div></div>;
}
