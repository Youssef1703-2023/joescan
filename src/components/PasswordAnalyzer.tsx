import { useState, useEffect } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { useLanguage } from '../contexts/LanguageContext';
import { KeyRound, Loader2, ShieldCheck, AlertTriangle, ArrowRight, RefreshCw, X, ShieldAlert, Settings2, Check, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { generateReportPDF } from '../lib/generatePDF';
import MiniHistory from './MiniHistory';

interface ScanResult {
  riskLevel: 'Low' | 'Medium' | 'High';
  reportText: string;
  actionPlan: string;
  securityScore?: number;
  scoreFactors?: string[];
  scoreImprovement?: string[];
}

export default function PasswordAnalyzer() {
  const { lang, t } = useLanguage();
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Generator Settings
  const [showGenSettings, setShowGenSettings] = useState(false);
  const [genLength, setGenLength] = useState(16);
  const [genNum, setGenNum] = useState(true);
  const [genSym, setGenSym] = useState(true);
  const [genUpper, setGenUpper] = useState(true);
  const [genLower, setGenLower] = useState(true);

  // Reset Gemini results when user starts typing a new password
  useEffect(() => {
    if (result || error) {
      setResult(null);
      setError(null);
    }
  }, [password]);

  const reqLength = password.length >= 8;
  const reqUpper = /[A-Z]/.test(password);
  const reqLower = /[a-z]/.test(password);
  const reqNumber = /[0-9]/.test(password);
  const reqSpecial = /[^A-Za-z0-9]/.test(password);

  const seqPattern = /(123|234|345|456|567|678|789|012|abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz)/i.test(password);
  const repeatPattern = /(.)\1{2,}/.test(password);
  const commonWords = /(password|qwerty|admin|login|123456)/i.test(password);
  
  const hasPatterns = seqPattern || repeatPattern || commonWords;
  const passedPatterns = password.length > 0 && !hasPatterns;

  const generatePassword = () => {
    let chars = "";
    const upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const lower = "abcdefghijklmnopqrstuvwxyz";
    const nums = "0123456789";
    const spec = "!@#$%^&*()_+~`|}{[]:;?><,./-=";
    
    if (genUpper) chars += upper;
    if (genLower) chars += lower;
    if (genNum) chars += nums;
    if (genSym) chars += spec;
    
    if (chars === "") {
      chars = lower;
      setGenLower(true);
    }

    let pass = "";
    if (genUpper) pass += upper[Math.floor(Math.random() * upper.length)];
    if (genLower) pass += lower[Math.floor(Math.random() * lower.length)];
    if (genNum) pass += nums[Math.floor(Math.random() * nums.length)];
    if (genSym) pass += spec[Math.floor(Math.random() * spec.length)];
    
    const remainingLength = Math.max(0, genLength - pass.length);
    for(let i=0; i<remainingLength; i++) {
        pass += chars[Math.floor(Math.random() * chars.length)];
    }
    
    pass = pass.split('').sort(() => 0.5 - Math.random()).join('');
    setPassword(pass);
  };

  let score = 0;
  if (password.length > 0) {
    if (reqLength) score++;
    if (reqUpper && reqLower) score++;
    if (reqNumber || reqSpecial) score++;
    if (reqNumber && reqSpecial) score++;
    
    if (hasPatterns) {
      score = Math.max(0, score - 2);
    }
  }

  const criteria = [
    { met: reqLength, label: t('pwd_req_length') || "At least 8 characters" },
    { met: reqUpper, label: t('pwd_req_upper') || "Uppercase letters" },
    { met: reqLower, label: t('pwd_req_lower') || "Lowercase letters" },
    { met: reqNumber, label: t('pwd_req_number') || "Numbers" },
    { met: reqSpecial, label: t('pwd_req_special') || "Symbols" },
    { met: passedPatterns, label: t('pwd_req_no_patterns') || "No common patterns" }
  ];

  const sha1 = async (str: string) => {
    const buffer = new TextEncoder().encode(str);
    const hashBuffer = await crypto.subtle.digest('SHA-1', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
  };

  const handleScan = async () => {
    if (!password.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const hash = await sha1(password);
      const prefix = hash.substring(0, 5);
      const suffix = hash.substring(5);

      const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`);
      if (!res.ok) throw new Error("Could not connect to vulnerability database.");
      
      const text = await res.text();
      const lines = text.split(/\r?\n/);
      
      let pwnCount = 0;
      for (const line of lines) {
        const [hashSuffix, count] = line.split(':');
        if (hashSuffix && hashSuffix.trim() === suffix) {
          pwnCount = parseInt(count.trim(), 10);
          break;
        }
      }

      let riskLevel: 'Low' | 'Medium' | 'High' = 'Low';
      if (pwnCount > 0) {
        riskLevel = 'High';
      } else if (!passedPatterns || reqLength === false) {
        riskLevel = 'Medium';
      }
      
      const isArabic = lang === 'ar';
      
      const reportText = isArabic 
        ? (pwnCount > 0 
           ? `تحذير خطير: تم العثور على المقطع المُميز لكلمة المرور هذه في قواعد بيانات التسريبات ${pwnCount.toLocaleString()} مرة. الكلمة مخترقة بالكامل (تم الحفاظ على خصوصيتك ولا يتم إرسال الكلمة بالكامل بأي شكل من الأشكال للتحليل).`
           : `لم يتم العثور على كلمة المرور في أي تسريبات عامة متوفرة حالياً. حافظ على إبقاءها معقدة للوقاية من التخمين.`)
        : (pwnCount > 0 
           ? `CRITICAL WARNING: This password sequence has been found in known data breaches ${pwnCount.toLocaleString()} times. It is extremely compromised (Your privacy is preserved thanks to k-anonymity hashing).`
           : `Zero Exposure. This password was not found in any monitored public data breaches. Continue enforcing password complexity.`);
           
      const actionPlan = isArabic
        ? (pwnCount > 0 ? "1. قم بتغيير هذه الكلمة فورا في جميع حساباتك الحالية.\n2. لا تقم بإعادة استخدامها نهائيا لتجنب اختراق القاموس.\n3. استخدم مولد الكلمات السفلية لإنشاء بديل قوي." : "1. استمر بإنشاء كلمات سر فريدة لكل منصة.\n2. احفظ الكلمة في تطبيق لإدارة كلمات المرور (Password Manager).\n3. فعّل التحقق بخطوتين (2FA) للأمان الإضافي.")
        : (pwnCount > 0 ? "1. Change this exact password IMMEDIATELY on all utilized accounts.\n2. Hackers already employ this within their brute-forcing dictionaries.\n3. Utilize the onboard generator to deploy a new uncompromised key." : "1. Maintain unique passwords mapping across services.\n2. Store operations inside an encrypted Password Vault.\n3. Enforce multi-factor authentication (2FA) configurations.");

      const scanResult: ScanResult = {
        riskLevel,
        reportText,
        actionPlan,
        securityScore: score * 17,
        scoreFactors: isArabic ? [`درجة التسريب: ${pwnCount > 0 ? 'خطير' : 'آمن'}`, `نمط التخمين: ${passedPatterns ? 'غير محتمل' : 'شائع الأنماط'}`] : [`Breach Index: ${pwnCount > 0 ? 'CRITICAL EXPOSURE' : 'CLEAN'}`, `Pattern Safety: ${passedPatterns ? 'PASSED' : 'VULNERABLE'}`],
        scoreImprovement: []
      };

      setResult(scanResult);

      if (auth.currentUser) {
        await addDoc(collection(db, 'scans'), {
          userId: auth.currentUser.uid,
          target: password.length > 3 ? password.substring(0, 3) + '...' : '***',
          type: 'password',
          riskLevel: scanResult.riskLevel,
          securityScore: scanResult.securityScore,
          reportText: scanResult.reportText,
          actionPlan: scanResult.actionPlan,
          createdAt: serverTimestamp(),
        });
      }
    } catch (err: any) {
      setError(err.message || "Failed to analyze password.");
    } finally {
      setLoading(false);
    }
  };

  const getRiskColor = (level: string) => {
    switch(level?.toUpperCase()) {
      case 'HIGH': return 'text-error bg-error/10 border-error/20';
      case 'MEDIUM': return 'text-caution bg-caution/10 border-caution/20';
      case 'LOW': return 'text-[#0f0] bg-[#0f0]/10 border-[#0f0]/20';
      default: return 'text-text-dim bg-bg-surface border-border-subtle';
    }
  };

  const renderIcon = (level: string) => {
    switch(level?.toUpperCase()) {
      case 'HIGH': return <ShieldAlert className="w-12 h-12 text-error" />;
      case 'MEDIUM': return <AlertTriangle className="w-12 h-12 text-caution" />;
      case 'LOW': return <ShieldCheck className="w-12 h-12 text-[#0f0]" />;
      default: return <KeyRound className="w-12 h-12 text-text-dim" />;
    }
  };

  return (
    <div className="w-full flex flex-col gap-6" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-bg-base border border-border-subtle p-6 md:p-8 rounded-xl shadow-lg relative overflow-hidden flex flex-col gap-6"
      >
        <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
          <KeyRound className="w-48 h-48 -mt-8 -mr-8" />
        </div>
        
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 relative z-10">
          <div>
            <h2 className="text-2xl font-bold font-mono tracking-tight uppercase mb-2 text-text-main flex items-center gap-3">
              <KeyRound className="w-6 h-6 text-accent" /> Password Vault Check
            </h2>
            <p className="text-text-dim text-sm max-w-xl leading-relaxed">
              Evaluate password strength algorithmically in real-time, then run a deep audit against neural-network breach databases to detect compromised footprints.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start">
           <button
             onClick={() => setShowGenSettings(!showGenSettings)}
             title={t('pwd_gen_settings') || "Generator Settings"}
             className={cn("bg-bg-surface border transition-colors p-3 rounded-lg flex items-center justify-center shrink-0 shadow-sm", showGenSettings ? "border-accent text-accent" : "border-border-subtle hover:border-accent text-text-dim hover:text-accent")}
           >
             <Settings2 className="w-5 h-5" />
           </button>
           <button
             onClick={generatePassword}
             title={t('pwd_generate') || "Generate Password"}
             className="bg-bg-surface border border-border-subtle hover:border-accent text-text-dim hover:text-accent transition-colors p-3 rounded-lg flex items-center justify-center shrink-0 shadow-sm"
           >
             <RefreshCw className="w-5 h-5" />
           </button>
         </div>
        </div>

        <AnimatePresence>
         {showGenSettings && (
           <motion.div
             initial={{ height: 0, opacity: 0 }}
             animate={{ height: "auto", opacity: 1 }}
             exit={{ height: 0, opacity: 0 }}
             className="overflow-hidden relative z-10"
           >
             <div className="bg-bg-surface/50 border border-border-subtle rounded-lg p-4 flex flex-wrap items-center gap-6 text-sm mb-2">
               <label className="flex items-center gap-3 text-text-main cursor-pointer hover:text-accent transition-colors">
                 <input 
                   type="number" 
                   value={genLength}
                   onChange={e => setGenLength(Math.max(8, Math.min(64, parseInt(e.target.value) || 8)))}
                   className="bg-bg-base border border-border-subtle rounded w-16 p-1.5 text-center outline-none focus:border-accent font-mono"
                 />
                 {t('pwd_gen_length') || "Length"}
               </label>
               <label className="flex items-center gap-2 text-text-main cursor-pointer hover:text-accent transition-colors">
                 <input 
                   type="checkbox" 
                   checked={genUpper}
                   onChange={e => setGenUpper(e.target.checked)}
                   className="accent-accent w-4 h-4 cursor-pointer"
                  />
                  {t('pwd_req_upper') || "A-Z"}
                </label>
                <label className="flex items-center gap-2 text-text-main cursor-pointer hover:text-accent transition-colors">
                  <input 
                    type="checkbox" 
                    checked={genLower}
                    onChange={e => setGenLower(e.target.checked)}
                    className="accent-accent w-4 h-4 cursor-pointer"
                  />
                  {t('pwd_req_lower') || "a-z"}
                </label>
                <label className="flex items-center gap-2 text-text-main cursor-pointer hover:text-accent transition-colors">
                  <input 
                    type="checkbox" 
                    checked={genNum}
                   onChange={e => setGenNum(e.target.checked)}
                   className="accent-accent w-4 h-4 cursor-pointer"
                 />
                 {t('pwd_gen_numbers') || "0-9"}
               </label>
               <label className="flex items-center gap-2 text-text-main cursor-pointer hover:text-accent transition-colors">
                 <input 
                   type="checkbox" 
                   checked={genSym}
                   onChange={e => setGenSym(e.target.checked)}
                   className="accent-accent w-4 h-4 cursor-pointer"
                 />
                 {t('pwd_gen_symbols') || "!@#$"}
               </label>
             </div>
           </motion.div>
         )}
       </AnimatePresence>

        <div className="flex flex-col gap-4 relative z-10 w-full">
           <div className="relative">
             <input
               type="text"
               value={password}
               onChange={(e) => setPassword(e.target.value)}
               placeholder={t('pwd_placeholder') || "e.g. MySuperSecret123!"}
               className={cn(
                 "w-full bg-bg-surface border-2 rounded-xl pl-5 pr-12 py-4 text-lg text-text-main outline-none transition-all font-mono shadow-inner",
                 score <= 1 && password.length > 0 ? "border-error focus:border-error" : "border-border-subtle focus:border-accent"
               )}
               dir="ltr"
             />
             {password && (
               <button
                 type="button"
                 onClick={() => setPassword('')}
                 className="absolute right-4 top-1/2 -translate-y-1/2 text-text-dim hover:text-text-main transition-colors"
               >
                 <X className="w-5 h-5" />
               </button>
             )}
           </div>

           <div className={cn("flex gap-2 transition-opacity duration-300", password.length > 0 ? "opacity-100" : "opacity-0")}>
             {[1,2,3,4].map((idx) => {
                 let bgColor = 'var(--border-subtle)';
                 let shadows = 'none';
                 if (score >= idx) {
                    if (score === 1) bgColor = 'var(--error)';
                    else if (score === 2) bgColor = 'var(--warning)';
                    else if (score === 3) bgColor = 'var(--accent)';
                    else if (score === 4) {
                      bgColor = 'var(--accent)';
                      shadows = '0 0 10px currentColor';
                    }
                 }
                 if (password.length > 0 && score === 0 && idx === 1) {
                    bgColor = 'var(--error)';
                 }

                 return (
                   <div
                     key={idx}
                     className={cn("h-2.5 flex-1 rounded-full transition-all duration-300", score === 3 && "opacity-80", score === 4 && "text-accent")}
                     style={{ backgroundColor: bgColor, boxShadow: shadows }}
                   />
                 )
             })}
           </div>

           <div className={cn("text-xs font-black uppercase tracking-widest text-right mt-1", password.length > 0 ? "block" : "hidden")}>
               {score === 0 && <span className="text-error">{t('pwd_strength_0') || "Very Weak"}</span>}
               {score === 1 && <span className="text-error">{t('pwd_strength_1') || "Weak"}</span>}
               {score === 2 && <span className="text-warning">{t('pwd_strength_2') || "Fair"}</span>}
               {score === 3 && <span className="text-accent/80">{t('pwd_strength_3') || "Good"}</span>}
               {score === 4 && <span className="text-accent">{t('pwd_strength_4') || "Strong"}</span>}
           </div>
        </div>

        {password.length > 0 && (
          <div className="flex flex-col lg:flex-row gap-8 items-end justify-between border-t border-border-subtle pt-6 mt-2 relative z-10">
             <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-3 gap-x-8 w-full lg:w-auto flex-1">
                 {criteria.map((c, i) => (
                   <div key={i} className="flex items-center gap-3">
                     {c.met ? (
                       <Check className="w-4 h-4 text-accent shrink-0" />
                     ) : (
                       <X className="w-4 h-4 text-error shrink-0" />
                     )}
                     <span className={cn("text-sm font-medium transition-colors", c.met ? "text-text-dim line-through decoration-text-dim/50" : "text-text-main")}>
                       {c.label}
                     </span>
                   </div>
                 ))}
             </div>

             <button
                type="button"
                onClick={handleScan}
                disabled={loading || !password.trim()}
                className="w-full lg:w-auto bg-accent text-accent-fg px-8 py-4 rounded-xl font-black tracking-[0.15em] uppercase hover:bg-opacity-90 disabled:opacity-50 transition-all flex items-center justify-center shrink-0 shadow-[0_0_20px_rgba(0,255,0,0.15)] hover:shadow-[0_0_30px_rgba(0,255,0,0.3)]"
              >
                {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : 'Deep Audit'}
              </button>
          </div>
        )}
        
        {error && <p className="text-error text-sm relative z-10">{error}</p>}
      </motion.div>

      <AnimatePresence mode="wait">
        {result && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className={cn(
              "w-full border rounded-xl overflow-hidden p-6 md:p-8 transition-all",
              getRiskColor(result.riskLevel)
            )}
          >
            <div className="flex flex-col md:flex-row gap-6 md:items-start items-center text-center md:text-left">
              <div className="shrink-0 p-5 bg-bg-base/60 rounded-full backdrop-blur-md shadow-lg shadow-[currentColor]/10">
                {renderIcon(result.riskLevel)}
              </div>
              <div className="flex-1 space-y-5 w-full">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div>
                    <h3 className="font-mono text-xs uppercase tracking-[0.2em] opacity-80 mb-2">Risk Assessed</h3>
                    <div className="text-3xl font-black uppercase tracking-tight">{result.riskLevel} EXPOSURE</div>
                  </div>
                  <button
                    onClick={() => generateReportPDF({ ...result, target: '••••••••' }, 'password', lang)}
                    className="flex items-center gap-2 bg-text-main text-bg-base hover:bg-opacity-90 px-4 py-2 rounded-lg text-xs uppercase tracking-widest font-bold transition-all"
                  >
                    <Download className="w-4 h-4" /> Download Report
                  </button>
                </div>

                <div className="text-base opacity-95 leading-relaxed font-medium max-w-3xl">
                  {result.reportText}
                </div>

                {result.securityScore !== undefined && (
                  <div className="pt-5 border-t border-[currentColor]/15">
                    <div className="flex items-center gap-5 mb-5">
                      <div className="w-20 h-20 shrink-0 rounded-full flex items-center justify-center border-4 border-[currentColor] font-mono text-2xl font-black bg-bg-base/50 shadow-inner">
                        {result.securityScore}
                      </div>
                      <div className="flex-1 max-w-md">
                        <div className="h-3 w-full bg-[currentColor]/20 rounded-full overflow-hidden shadow-inner">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${result.securityScore}%` }}
                            transition={{ duration: 1, ease: 'easeOut' }}
                            className="h-full bg-[currentColor]"
                          />
                        </div>
                        <p className="text-xs font-mono uppercase mt-3 opacity-80 tracking-widest font-bold">Threat Resistance Score</p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="bg-bg-base/50 rounded-xl p-5 md:p-6 mt-4 backdrop-blur-sm border border-[currentColor]/10">
                  <h4 className="font-bold text-sm uppercase tracking-widest opacity-90 mb-4 flex items-center justify-center md:justify-start gap-2">
                    <ArrowRight className="w-5 h-5" /> Remediation Steps
                  </h4>
                  <ul className="space-y-3 text-sm opacity-95 text-left">
                    {(typeof result.actionPlan === 'string' ? result.actionPlan : String(result.actionPlan || '')).split('\n').filter(Boolean).map((step, i) => (
                      <li key={i} className="flex gap-3 items-start">
                        <span className="font-mono opacity-50 shrink-0 font-bold mt-0.5">{i + 1}.</span>
                        <span className="leading-relaxed">{step.replace(/^\d+\.\s*/, '')}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                
                {result.scoreFactors && result.scoreFactors.length > 0 && (
                  <div className="mt-4 opacity-80">
                    <p className="text-xs uppercase tracking-widest font-mono font-bold mb-2">Why this score?</p>
                    <ul className="text-sm space-y-1 text-left list-disc list-inside">
                      {(Array.isArray(result.scoreFactors) ? result.scoreFactors : [String(result.scoreFactors)]).map((f, i) => <li key={i}>{f}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mini History */}
      <MiniHistory scanType="password" />
    </div>
  );
}
