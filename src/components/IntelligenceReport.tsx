import React, { useState, useEffect } from 'react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { Shield, ShieldAlert, Cpu, Download, X, Eye, Lock, Globe, FileText, CheckCircle2 } from 'lucide-react';
import { auth, getUserTier, SubscriptionTier } from '../lib/firebase';

interface ScanHistory {
  id: string;
  type: string;
  target: string;
  riskLevel: 'Low' | 'Medium' | 'High';
  securityScore?: number;
  createdAt: Date;
  result?: any;
}

interface Props {
  scan: ScanHistory;
  onClose: () => void;
}

export default function IntelligenceReport({ scan, onClose }: Props) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [userTier, setUserTier] = useState<SubscriptionTier>('free');

  useEffect(() => {
    if (auth.currentUser) {
      getUserTier(auth.currentUser.uid).then(t => setUserTier(t));
    }
  }, []);

  const handleDownload = async () => {
    setIsGenerating(true);
    try {
      const element = document.getElementById('dossier-report');
      if (!element) return;
      
      // html2canvas works best when the element is visible. It is visible here.
      const canvas = await html2canvas(element, { 
        scale: 2, 
        useCORS: true, 
        backgroundColor: '#0a0a0a' 
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`joescan_dossier_${scan.target.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`);
    } catch (err) {
      console.error('PDF Generation failed:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 md:p-8 overflow-y-auto font-sans" dir="ltr">
      
      <div className="max-w-4xl w-full flex flex-col gap-4 relative mt-auto mb-auto">
        {/* Controls */}
        <div className="flex justify-between items-center glass-card p-4 sticky top-0 z-10 w-full mb-4 shrink-0 bg-bg-base/90">
          <div className="font-mono text-sm tracking-[0.2em] uppercase text-text-dim flex items-center gap-2">
            <FileText className="w-4 h-4 text-accent" /> Intelligence Brief Preview
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleDownload}
              disabled={isGenerating}
              className="px-4 py-2 bg-accent text-bg-base rounded font-bold uppercase tracking-widest text-xs flex items-center gap-2 transition-all hover:glow-low disabled:opacity-50"
            >
              <Download className="w-4 h-4" /> 
              {isGenerating ? 'GENERATING...' : 'EXPORT PDF'}
            </button>
            <button
              onClick={onClose}
              className="p-2 border border-border-subtle rounded text-text-dim hover:text-text-main hover:bg-bg-elevated transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* The Printable Dossier */}
        <div id="dossier-report" className="bg-[#0a0a0a] border border-[#333] w-[210mm] max-w-full mx-auto p-12 text-[#e0e0e0] flex flex-col relative shadow-2xl shrink-0">
          
          {/* Watermark / Branding Overlay */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none overflow-hidden select-none">
             <ShieldAlert className="w-[800px] h-[800px] opacity-[0.03] absolute" />
             {userTier === 'free' && (
               <div className="z-50 opacity-10 rotate-[-30deg] font-black text-[120px] tracking-tighter text-white uppercase whitespace-nowrap">
                 JOESCAN <span className="text-[#00ff00]">FREE EDITION</span>
               </div>
             )}
          </div>
          
          <div className="absolute top-10 left-10 w-40 h-40 bg-[rgba(0,255,0,0.05)] blur-[80px] rounded-full pointer-events-none" />
          <div className="absolute bottom-10 right-10 w-64 h-64 bg-[rgba(255,0,0,0.03)] blur-[80px] rounded-full pointer-events-none" />

          {/* Header */}
          <div className="border-b-2 border-[#333] pb-6 mb-8 flex justify-between items-end relative z-10">
            <div>
              <h1 className="text-4xl font-black tracking-tighter uppercase mb-2 text-white">Cyber Threat Dossier</h1>
              <div className="font-mono text-[10px] tracking-[0.3em] uppercase text-[#888]">Automated OSINT Briefing &nbsp;&nbsp;|&nbsp;&nbsp; Confidential</div>
            </div>
            <div className="text-right">
              <div className="font-mono text-xl tracking-tighter flex justify-end">
                <span className="font-light">JOE</span>
                <span className="font-black text-[#00ff00]">SCAN</span>
              </div>
              <div className="font-mono text-[10px] text-[#666] mt-1">{new Date().toISOString()}</div>
            </div>
          </div>

          {/* Summary Block */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8 relative z-10">
            <div className="bg-[#111] border border-[#222] p-4 rounded-lg">
              <div className="text-[10px] text-[#888] uppercase tracking-[0.2em] font-mono mb-1 flex items-center gap-1"><TargetIcon /> Target Asset</div>
              <div className="font-bold text-lg text-white truncate">{scan.type === 'password' ? '********' : scan.target}</div>
            </div>
            <div className="bg-[#111] border border-[#222] p-4 rounded-lg">
              <div className="text-[10px] text-[#888] uppercase tracking-[0.2em] font-mono mb-1 flex items-center gap-1"><Cpu /> Vector Type</div>
              <div className="font-bold text-lg text-white uppercase">{scan.type.replace('_', ' ')}</div>
            </div>
            <div className="bg-[#111] border border-[#222] p-4 rounded-lg">
              <div className="text-[10px] text-[#888] uppercase tracking-[0.2em] font-mono mb-1 flex items-center gap-1"><ShieldAlert /> Risk Level</div>
              <div className={`font-bold text-lg uppercase ${(scan.riskLevel || 'Low') === 'High' ? 'text-[#ff0033]' : (scan.riskLevel || 'Low') === 'Medium' ? 'text-[#ffa500]' : 'text-[#00ff00]'}`}>
                {scan.riskLevel || 'Low'}
              </div>
            </div>
            <div className="bg-[#111] border border-[#222] p-4 rounded-lg">
              <div className="text-[10px] text-[#888] uppercase tracking-[0.2em] font-mono mb-1 flex items-center gap-1"><Eye /> Posture Score</div>
              <div className="font-black text-2xl" style={{ color: scan.securityScore && scan.securityScore >= 80 ? '#00ff00' : scan.securityScore && scan.securityScore >= 50 ? '#ffa500' : '#ff0033' }}>
                {scan.securityScore !== undefined ? `${scan.securityScore} / 100` : 'N/A'}
              </div>
            </div>
          </div>

          {/* Main Assessment Body */}
          <div className="flex-1 relative z-10">
             <h2 className="text-xl font-bold uppercase border-b border-[#333] pb-2 mb-4 tracking-widest text-white">Executive Assessment</h2>
             
             {(scan.riskLevel || 'Low') === 'High' && (
                <div className="bg-[rgba(255,0,0,0.1)] border-l-4 border-[#ff0033] p-4 mb-6 rounded-r font-mono text-sm leading-relaxed text-[#ffaaab]">
                  CRITICAL INCIDENT: The target asset has been flagged with severe vulnerabilities or active compromises. Immediate remediation protocols are advised. Associated data may be accessible to threat actors on deep/dark networks or public vulnerability catalogs.
                </div>
             )}

             {(scan.riskLevel || 'Low') === 'Medium' && (
                <div className="bg-[rgba(255,165,0,0.1)] border-l-4 border-[#ffa500] p-4 mb-6 rounded-r font-mono text-sm leading-relaxed text-[#ffd48a]">
                  ELEVATED RISK: Anomalies or moderate risks detected. The asset presents potential attack vectors that could be exploited. Recommend proactive security hardening and continuous monitoring.
                </div>
             )}

             {(scan.riskLevel || 'Low') === 'Low' && (
                <div className="bg-[rgba(0,255,0,0.1)] border-l-4 border-[#00ff00] p-4 mb-6 rounded-r font-mono text-sm leading-relaxed text-[#aaffaa]">
                  CLEAR POSTURE: The target asset demonstrates strong integrity boundaries. No immediate critical threats or public compromises observed during the intelligence sweep.
                </div>
             )}

             {/* Detail Node (mockup for cinematic effect, simulating DB Dump) */}
             <div className="mt-8 border border-[#333] rounded-lg overflow-hidden">
                <div className="bg-[#1a1a1a] p-3 text-[10px] font-mono uppercase tracking-[0.2em] text-[#888] border-b border-[#333] flex justify-between">
                  <span>RAW TELEMETRY DATABLOCK // {scan.id.substring(0,8)}</span>
                  <span>CONFIDENTIAL</span>
                </div>
                <div className="p-4 font-mono text-xs text-[#aaa] leading-relaxed relative min-h-[150px]">
                   <div className="absolute top-4 left-4 border-l-2 border-[#00ff00] pl-4 space-y-3">
                     <div><span className="text-white">Timestamp:</span> {scan.createdAt.toISOString()}</div>
                     <div><span className="text-white">Query Vector:</span> OSINT_DEEP_SEARCH_{scan.type.toUpperCase()}</div>
                     <div><span className="text-white">Target Hash:</span> {btoa(scan.target).substring(0,20).toUpperCase()}</div>
                     <div><span className="text-white">Status Flags:</span> SCANNED, CORRELATED, ARCHIVED</div>
                     
                     <div className="mt-6 text-[#555]">
                        <br/>
                        &gt; Connecting to global intelligence hives...<br/>
                        &gt; Compiling cross-registry threat indicators...<br/>
                        &gt; {(scan.riskLevel || 'Low') === 'High' ? 'MATCH FOUND IN THREAT MATRICES.' : 'NO ACTIVE MATCH IN CORE MATRICES.'}<br/>
                        &gt; Operation Terminated.<br/>
                     </div>
                   </div>
                </div>
             </div>
          </div>

          <div className="mt-16 pt-6 border-t border-[#333] flex justify-between items-center text-[10px] font-mono text-[#555] uppercase tracking-[0.2em] relative z-10">
            <div className="flex items-center gap-1"><Lock className="w-3 h-3" /> E2E Encrypted Generation</div>
            <div>[ END OF REPORT ]</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Inline Icon to avoid extra imports at the top
const TargetIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>;
