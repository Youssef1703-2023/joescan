import type { FormEvent } from 'react';
import { useEffect, useRef, useState } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { useLanguage } from '../contexts/LanguageContext';
import { searchUsername, searchPhoneNumber, SocialOsintResult, PlatformHit, PhoneInfo } from '../lib/socialOsint';
import { analyzeSocialFootprint } from '../lib/gemini';
import { Globe, Loader2, ShieldCheck, AlertTriangle, ShieldAlert, ArrowRight, ExternalLink, Users, Gamepad2, Briefcase, MessageCircle, Download, Search, Info, BadgeCheck, Phone, UserSearch } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { generateReportPDF } from '../lib/generatePDF';
import MiniHistory from './MiniHistory';

interface AIResult {
  riskLevel: 'Low' | 'Medium' | 'High';
  reportText: string;
  actionPlan: string;
  securityScore?: number;
  scoreFactors?: string[];
  scoreImprovement?: string[];
}

type ScanPhase = 'idle' | 'scanning' | 'analyzing' | 'success' | 'empty' | 'error';

const CATEGORY_ORDER = ['social', 'professional', 'gaming', 'forums', 'other'] as const;

function splitActionPlan(actionPlan: string) {
  return actionPlan
    .split(/\\n|\n/g)
    .map((step) => step.trim())
    .filter(Boolean);
}

function getFaviconUrl(url: string) {
  try {
    const hostname = new URL(url).hostname;
    return `https://www.google.com/s2/favicons?domain=${hostname}&sz=32`;
  } catch {
    return null;
  }
}

type SearchMode = 'username' | 'phone';

export default function SocialOsintScanner() {
  const { lang, t } = useLanguage();
  const [searchMode, setSearchMode] = useState<SearchMode>('username');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState<ScanPhase>('idle');
  const [scanProgress, setScanProgress] = useState<{ checked: number; total: number; status: string } | null>(null);
  const [result, setResult] = useState<SocialOsintResult | null>(null);
  const [aiResult, setAiResult] = useState<AIResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const getRiskColor = (level: string) => {
    switch (level?.toUpperCase()) {
      case 'HIGH': return 'text-error bg-error/10 border-error/20';
      case 'MEDIUM': return 'text-caution bg-caution/10 border-caution/20';
      case 'LOW': return 'text-[#0f0] bg-[#0f0]/10 border-[#0f0]/20';
      default: return 'text-text-dim bg-bg-surface border-border-subtle';
    }
  };

  const renderIcon = (level: string) => {
    switch (level?.toUpperCase()) {
      case 'HIGH': return <ShieldAlert className="w-12 h-12 text-error" />;
      case 'MEDIUM': return <AlertTriangle className="w-12 h-12 text-caution" />;
      case 'LOW': return <ShieldCheck className="w-12 h-12 text-[#0f0]" />;
      default: return <Globe className="w-12 h-12 text-text-dim" />;
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'social': return <Globe className="w-4 h-4" />;
      case 'professional': return <Briefcase className="w-4 h-4" />;
      case 'gaming': return <Gamepad2 className="w-4 h-4" />;
      case 'forums': return <MessageCircle className="w-4 h-4" />;
      default: return <Users className="w-4 h-4" />;
    }
  };

  const getCategoryTranslation = (category: string) => {
    return t(`social_category_${category}` as never) || category;
  };

  const mapErrorMessage = (message: string) => {
    switch (message) {
      case 'RATE_LIMIT':
        return t('social_rate_limit' as never);
      case 'INVALID_USERNAME':
        return 'Use 1-50 characters: letters, numbers, dot, underscore, or hyphen.';
      case 'INVALID_QUERY_ID':
        return 'The username scan session became invalid. Please try again.';
      case 'NETWORK_ERROR':
        return 'Unable to reach the OSINT service right now. Check your connection and try again.';
      case 'MALFORMED_RESPONSE':
      case 'MALFORMED_UPSTREAM_RESPONSE':
        return 'The OSINT service returned an unexpected response. Please try again.';
      case 'TIMEOUT':
      case 'UPSTREAM_TIMEOUT':
        return 'The username scan took too long to finish. Please try again in a moment.';
      case 'UPSTREAM_UNAVAILABLE':
        return 'The OSINT provider is temporarily unavailable. Please try again shortly.';
      case 'UPSTREAM_ERROR':
        return 'The OSINT provider returned an unexpected error. Please try again shortly.';
      default:
        if (message.startsWith('API_ERROR_')) {
          return `The OSINT service returned ${message.replace('API_ERROR_', 'HTTP ')}. Please try again shortly.`;
        }
        return message || 'An error occurred during the scan.';
    }
  };

  const groupedHits = (result?.hits || []).reduce((acc, hit) => {
    const category = hit.category || 'other';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(hit);
    return acc;
  }, {} as Record<string, PlatformHit[]>);

  const orderedCategoryEntries = CATEGORY_ORDER
    .map((category) => [category, (groupedHits[category] || []).slice().sort((a, b) => a.platform.localeCompare(b.platform))] as const)
    .filter(([, hits]) => hits.length > 0);

  const categoryCounts = CATEGORY_ORDER.map((category) => ({
    category,
    count: groupedHits[category]?.length || 0,
  })).filter((entry) => entry.count > 0);

  const handleScan = async (event: FormEvent) => {
    event.preventDefault();

    const trimmedUsername = username.trim();
    if (!trimmedUsername || loading) {
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setUsername(trimmedUsername);
    setLoading(true);
    setPhase('scanning');
    setError(null);
    setResult(null);
    setAiResult(null);
    setScanProgress({ checked: 0, total: 100, status: 'running' });

    // ─── Phase 1: Scan for profiles ───
    let osintResult: SocialOsintResult | null = null;
    try {
      if (searchMode === 'phone') {
        osintResult = await searchPhoneNumber(
          trimmedUsername,
          (status, checked, total) => {
            setScanProgress({ checked, total, status });
          },
        );
      } else {
        osintResult = await searchUsername(
          trimmedUsername,
          (status, checked, total) => {
            setScanProgress({ checked, total, status });
          },
          { signal: controller.signal },
        );
      }

      setResult(osintResult);
      setScanProgress(null);

      if (osintResult.hits.length === 0) {
        setPhase('empty');
        setLoading(false);
        return;
      }
    } catch (scanError: any) {
      if (scanError instanceof DOMException && scanError.name === 'AbortError') {
        setLoading(false);
        return;
      }
      console.error('[SocialOSINT] Scan error:', scanError);
      setError(mapErrorMessage(scanError?.message || ''));
      setScanProgress(null);
      setPhase('error');
      setLoading(false);
      return;
    }

    // ─── Phase 2: AI Analysis (independent — failures don't hide results) ───
    if (osintResult && osintResult.hits.length > 0) {
      setPhase('analyzing');
      try {
        const platformsFound = osintResult.hits.map((hit) => hit.platform);
        const analysis = await analyzeSocialFootprint(trimmedUsername, platformsFound, lang);

        if (controller.signal.aborted) {
          setLoading(false);
          return;
        }

        const nextAiResult: AIResult = {
          riskLevel: (analysis?.riskLevel as 'Low' | 'Medium' | 'High') || 'Medium',
          reportText: analysis?.reportText || '',
          actionPlan: analysis?.actionPlan || '',
          securityScore: typeof analysis?.securityScore === 'number' ? analysis.securityScore : undefined,
          scoreFactors: Array.isArray(analysis?.scoreFactors) ? analysis.scoreFactors : [],
          scoreImprovement: Array.isArray(analysis?.scoreImprovement) ? analysis.scoreImprovement : [],
        };

        setAiResult(nextAiResult);
        setPhase('success');

        // Save to Firestore (don't crash if this fails)
        try {
          if (auth.currentUser) {
            await addDoc(collection(db, 'scans'), {
              userId: auth.currentUser.uid,
              target: trimmedUsername,
              type: 'social_osint',
              riskLevel: nextAiResult.riskLevel,
              securityScore: nextAiResult.securityScore ?? null,
              reportText: nextAiResult.reportText,
              actionPlan: nextAiResult.actionPlan,
              platformsFound: osintResult.hits.length,
              platforms: platformsFound,
              totalPlatformsChecked: osintResult.totalPlatforms,
              createdAt: serverTimestamp(),
            });
          }
        } catch (firestoreErr) {
          console.error('[SocialOSINT] Firestore save failed:', firestoreErr);
        }
      } catch (aiError: any) {
        console.error('[SocialOSINT] AI analysis failed:', aiError);
        // Still show scan results even if AI analysis failed
        setPhase('success');
        setError('AI analysis could not be completed, but scan results are shown above.');
      }
    }

    if (abortRef.current === controller) {
      abortRef.current = null;
    }
    setLoading(false);
  };

  const actionPlanSteps = aiResult ? splitActionPlan(aiResult.actionPlan || '') : [];

  return (
    <div className="w-full flex flex-col gap-6" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card p-6 rounded-xl relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
          <Globe className="w-32 h-32" />
        </div>

        <h2 className="text-xl font-bold font-mono tracking-tight uppercase mb-2 text-text-main flex items-center gap-2">
          <Globe className="w-5 h-5 text-accent" /> {t('social_title' as never)}
        </h2>

        <p className="text-text-dim mb-4 text-sm">
          {t('social_desc' as never)}
        </p>

        <form onSubmit={handleScan} className="flex gap-2 relative z-10 w-full max-w-2xl">
          <div className="relative flex-1">
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder={t('social_placeholder' as never) || 'e.g. john_doe'}
              className="w-full bg-bg-surface border border-border-subtle rounded-lg pl-4 pr-10 py-3 text-text-main focus:border-accent focus:ring-1 focus:ring-accent outline-none transition-all font-mono"
              dir="ltr"
              autoComplete="off"
              spellCheck={false}
              aria-label={t('social_title' as never)}
            />
          </div>
          <button
            type="submit"
            disabled={loading || !username.trim()}
            className="bg-accent text-accent-fg px-6 py-3 rounded-lg font-bold tracking-wider uppercase hover:bg-opacity-90 disabled:opacity-50 transition-all flex items-center justify-center min-w-[120px]"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Search className="w-4 h-4 mr-2 rtl:ml-2 rtl:mr-0 hidden sm:block" /> {t('audit')}</>}
          </button>
        </form>

        {error && (
          <div role="alert" aria-live="assertive" className="mt-4 text-sm text-error bg-error/10 border border-error/20 rounded-lg px-4 py-3">
            {error}
          </div>
        )}

        <AnimatePresence>
          {phase === 'scanning' && scanProgress && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-6 pt-6 border-t border-border-subtle"
              role="status"
              aria-live="polite"
            >
              <div className="flex justify-between items-center mb-2 text-xs font-mono uppercase tracking-widest text-text-dim">
                <span className="flex items-center gap-2">
                  <Loader2 className="w-3 h-3 animate-spin text-accent" />
                  {t('social_scanning' as never)}
                </span>
                <span>
                  {scanProgress.checked} / {scanProgress.total}
                </span>
              </div>
              <div className="h-2 w-full bg-bg-base rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min((scanProgress.checked / Math.max(scanProgress.total, 1)) * 100, 100)}%` }}
                  transition={{ duration: 0.3 }}
                  className="h-full bg-accent"
                />
              </div>
              <p className="text-[10px] text-text-dim mt-2 text-center opacity-70">
                {t('social_scanning_desc' as never)}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      <AnimatePresence mode="wait">
        {(result || phase === 'analyzing') && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col gap-6"
          >
            {result && (
              <div className="glass-surface border border-accent/20 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center text-accent">
                    {searchMode === 'phone' ? <Phone className="w-5 h-5" /> : <Users className="w-5 h-5" />}
                  </div>
                  <div>
                    <h3 className="font-mono text-[10px] uppercase tracking-widest text-text-dim mb-0.5">{t('social_found_on' as never)}</h3>
                    <div className="text-xl font-bold font-mono text-text-main">
                      {searchMode === 'phone'
                        ? result.hits.filter(h => h.registrationStatus === 'registered').length
                        : result.hits.length
                      } <span className="text-sm font-sans">{t('social_platforms' as never)}</span>
                    </div>
                    <div className="text-xs text-text-dim mt-1">
                      {result.totalPlatforms} checked
                    </div>
                  </div>
                </div>
                {searchMode === 'phone' ? (
                  <div className="flex gap-4 ml-auto text-xs font-mono border-l border-border-subtle pl-4 pr-1">
                    <div className="flex flex-col items-center min-w-[68px]">
                      <span className="opacity-60 uppercase text-[10px] text-center text-[#0f0]">Registered</span>
                      <span className="font-bold text-[#0f0]">{result.hits.filter(h => h.registrationStatus === 'registered').length}</span>
                    </div>
                    <div className="flex flex-col items-center min-w-[68px]">
                      <span className="opacity-60 uppercase text-[10px] text-center">Not Found</span>
                      <span className="font-bold">{result.hits.filter(h => h.registrationStatus !== 'registered').length}</span>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2 sm:gap-4 ml-auto text-xs font-mono border-l border-border-subtle pl-4 pr-1">
                    {categoryCounts.map((entry) => (
                      <div key={entry.category} className="flex flex-col items-center min-w-[68px]">
                        <span className="opacity-60 uppercase text-[10px] text-center">{getCategoryTranslation(entry.category)}</span>
                        <span className="font-bold">{entry.count}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Phone Info Panel */}
            {result?.phoneInfo && searchMode === 'phone' && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-card p-5 rounded-xl border border-blue-500/20"
              >
                <h3 className="font-bold text-xs uppercase tracking-widest mb-4 flex items-center gap-2 text-text-main border-b border-border-subtle pb-2">
                  <Phone className="w-4 h-4 text-blue-400" />
                  Phone Intelligence
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {result.phoneInfo.carrier && (
                    <div className="bg-bg-surface rounded-lg p-3 border border-border-subtle">
                      <p className="text-[10px] font-mono uppercase tracking-widest text-text-dim mb-1">Carrier</p>
                      <p className="text-sm font-semibold text-text-main">{result.phoneInfo.carrier}</p>
                    </div>
                  )}
                  {result.phoneInfo.country && (
                    <div className="bg-bg-surface rounded-lg p-3 border border-border-subtle">
                      <p className="text-[10px] font-mono uppercase tracking-widest text-text-dim mb-1">Country</p>
                      <p className="text-sm font-semibold text-text-main">{result.phoneInfo.country}</p>
                    </div>
                  )}
                  {result.phoneInfo.region && (
                    <div className="bg-bg-surface rounded-lg p-3 border border-border-subtle">
                      <p className="text-[10px] font-mono uppercase tracking-widest text-text-dim mb-1">Region</p>
                      <p className="text-sm font-semibold text-text-main">{result.phoneInfo.region}</p>
                    </div>
                  )}
                  {result.phoneInfo.lineType && (
                    <div className="bg-bg-surface rounded-lg p-3 border border-border-subtle">
                      <p className="text-[10px] font-mono uppercase tracking-widest text-text-dim mb-1">Line Type</p>
                      <p className="text-sm font-semibold text-text-main">{result.phoneInfo.lineType}</p>
                    </div>
                  )}
                  {result.phoneInfo.breachExposure && (
                    <div className="bg-bg-surface rounded-lg p-3 border border-error/20 col-span-2">
                      <p className="text-[10px] font-mono uppercase tracking-widest text-error mb-1">Breach Exposure</p>
                      <p className="text-sm font-medium text-text-main">{result.phoneInfo.breachExposure}</p>
                    </div>
                  )}
                </div>
                {result.phoneInfo.associatedNames && result.phoneInfo.associatedNames.length > 0 && (
                  <div className="mt-3 bg-bg-surface rounded-lg p-3 border border-border-subtle">
                    <p className="text-[10px] font-mono uppercase tracking-widest text-text-dim mb-2">Associated Names</p>
                    <div className="flex flex-wrap gap-2">
                      {result.phoneInfo.associatedNames.map((name, i) => (
                        <span key={i} className="bg-bg-base px-2.5 py-1 rounded-full text-xs font-medium text-text-main border border-border-subtle">
                          {name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {result && result.hits.length === 0 && phase === 'empty' && (
              <div className="glass-surface p-8 text-center text-text-dim rounded-xl border border-border-subtle">
                <div className="font-semibold text-text-main mb-2">{t('social_not_found' as never)}</div>
                <div className="text-sm font-mono">{result.username}</div>
              </div>
            )}

            {/* Phone Mode: Table View */}
            {searchMode === 'phone' && result && result.hits.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-card rounded-xl overflow-hidden border border-border-subtle"
              >
                <div className="p-4 border-b border-border-subtle">
                  <h3 className="font-bold text-xs uppercase tracking-widest flex items-center gap-2 text-text-main">
                    <Phone className="w-4 h-4 text-accent" />
                    Linked Accounts
                    <span className="ml-auto bg-accent/10 text-accent px-2 py-0.5 rounded-full text-[10px]">
                      {result.hits.filter(h => h.registrationStatus === 'registered').length} found
                    </span>
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border-subtle bg-bg-surface/50">
                        <th className="text-left px-4 py-3 text-[10px] font-mono uppercase tracking-widest text-text-dim">Platform</th>
                        <th className="text-center px-4 py-3 text-[10px] font-mono uppercase tracking-widest text-text-dim">Status</th>
                        <th className="text-left px-4 py-3 text-[10px] font-mono uppercase tracking-widest text-text-dim">Account Name</th>
                        <th className="text-center px-4 py-3 text-[10px] font-mono uppercase tracking-widest text-text-dim">Link</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.hits.map((hit, idx) => {
                        const faviconUrl = getFaviconUrl(hit.url || `https://${hit.platform.toLowerCase().replace(/[^a-z]/g, '')}.com`);
                        const isRegistered = hit.registrationStatus === 'registered';
                        return (
                          <tr
                            key={`${hit.platform}-${idx}`}
                            className={cn(
                              'border-b border-border-subtle/50 transition-colors',
                              isRegistered ? 'hover:bg-accent/5' : 'opacity-50 hover:opacity-70'
                            )}
                          >
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                {faviconUrl && (
                                  <img
                                    src={faviconUrl}
                                    alt=""
                                    className="w-4 h-4 rounded-sm"
                                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                  />
                                )}
                                <span className={cn('font-medium', isRegistered && 'text-text-main')}>{hit.platform}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-center">
                              {isRegistered ? (
                                <span className="inline-flex items-center gap-1 bg-[#0f0]/10 text-[#0f0] border border-[#0f0]/20 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase">
                                  ✓ Registered
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 bg-bg-surface text-text-dim border border-border-subtle px-2 py-0.5 rounded-full text-[10px] font-bold uppercase">
                                  ✗ Not Found
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              {isRegistered && hit.accountName ? (
                                <span className="font-semibold text-accent">{hit.accountName}</span>
                              ) : isRegistered ? (
                                <span className="text-text-dim italic text-xs">Account detected</span>
                              ) : (
                                <span className="text-text-dim">—</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-center">
                              {isRegistered && hit.url ? (
                                <a
                                  href={hit.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-accent hover:text-accent/80 transition-colors"
                                >
                                  <ExternalLink className="w-4 h-4 inline" />
                                </a>
                              ) : (
                                <span className="text-text-dim opacity-30">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            )}

            {/* Username Mode: Card Grid */}
            {searchMode === 'username' && orderedCategoryEntries.length > 0 && (
              <div className="grid grid-cols-1 gap-6">
                {orderedCategoryEntries.map(([category, hits]) => (
                  <div key={category} className="glass-card p-5 rounded-xl border-border-subtle">
                    <h3 className="font-bold text-xs uppercase tracking-widest mb-4 flex items-center gap-2 text-text-main border-b border-border-subtle pb-2">
                      <span className="text-accent">{getCategoryIcon(category)}</span>
                      {getCategoryTranslation(category)}
                      <span className="ml-auto bg-bg-elevated px-2 py-0.5 rounded-full text-[10px]">{hits.length}</span>
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {hits.map((hit) => {
                        const faviconUrl = getFaviconUrl(hit.url);
                        return (
                          <a
                            key={`${hit.platform}-${hit.url}`}
                            href={hit.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="group bg-bg-surface border border-border-subtle hover:border-accent/40 rounded-lg p-4 flex flex-col gap-2 transition-all hover:shadow-[0_0_15px_rgba(16,185,129,0.08)] focus:outline-none focus:ring-2 focus:ring-accent/40"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 truncate">
                                {faviconUrl && (
                                  <img
                                    src={faviconUrl}
                                    alt=""
                                    className="w-5 h-5 rounded-sm grayscale group-hover:grayscale-0 transition-all opacity-80"
                                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                  />
                                )}
                                <span className="font-semibold text-sm truncate group-hover:text-accent transition-colors">{hit.platform}</span>
                                {hit.verified && (
                                  <BadgeCheck className="w-4 h-4 text-blue-400 shrink-0" />
                                )}
                              </div>
                              <ExternalLink className="w-3.5 h-3.5 text-text-dim group-hover:text-accent opacity-40 group-hover:opacity-100 transition-all shrink-0" />
                            </div>
                            {(hit.bio || hit.followers || hit.accountType) && (
                              <div className="flex flex-col gap-1 mt-1">
                                {hit.bio && (
                                  <p className="text-[11px] text-text-dim leading-snug line-clamp-2">{hit.bio}</p>
                                )}
                                <div className="flex items-center gap-3 flex-wrap">
                                  {hit.followers && (
                                    <span className="text-[10px] font-mono text-text-dim bg-bg-base px-1.5 py-0.5 rounded flex items-center gap-1">
                                      <Users className="w-3 h-3" /> {hit.followers}
                                    </span>
                                  )}
                                  {hit.accountType && (
                                    <span className="text-[10px] font-mono text-text-dim bg-bg-base px-1.5 py-0.5 rounded">
                                      {hit.accountType}
                                    </span>
                                  )}
                                </div>
                              </div>
                            )}
                          </a>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {phase === 'analyzing' && (
              <div className="glass-surface p-6 rounded-xl border border-accent/20 flex flex-col items-center justify-center gap-3 text-center" role="status" aria-live="polite">
                <div className="w-12 h-12 bg-accent/10 rounded-full flex items-center justify-center text-accent">
                  <Loader2 className="w-6 h-6 animate-spin" />
                </div>
                <p className="font-mono text-sm tracking-widest uppercase">{t('social_ai_analyzing' as never)}</p>
              </div>
            )}

            {!aiResult && result?.hits.length && phase === 'success' && error && (
              <div className="glass-surface p-4 rounded-xl border border-caution/20 flex items-start gap-3 text-caution">
                <Info className="w-5 h-5 mt-0.5 shrink-0" />
                <div>
                  <div className="font-semibold text-sm">Scan results are available, but AI analysis could not be completed.</div>
                  <div className="text-sm opacity-80 mt-1">{error}</div>
                </div>
              </div>
            )}

            {aiResult && result && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className={cn(
                  'w-full border rounded-xl overflow-hidden p-6 transition-all',
                  getRiskColor(aiResult.riskLevel),
                )}
              >
                <div className="flex flex-col md:flex-row gap-6 md:items-start items-center text-center md:text-left">
                  <div className="shrink-0 p-4 bg-bg-base/50 rounded-full backdrop-blur-md">
                    {renderIcon(aiResult.riskLevel)}
                  </div>
                  <div className="flex-1 space-y-4 w-full">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                      <div>
                        <h3 className="font-mono text-xs uppercase tracking-widest opacity-80 mb-1">{t('social_exposure_summary' as never)}</h3>
                        <div className="text-2xl font-black uppercase tracking-tight">{aiResult.riskLevel} {t('exposure').toUpperCase()}</div>
                      </div>
                      <button
                        onClick={() => generateReportPDF({
                          ...aiResult,
                          target: result.username,
                          hits: result.hits,
                          platformExposure: result.hits.map((hit) => hit.platform),
                          totalPlatformsChecked: result.totalPlatforms,
                        }, 'social', lang)}
                        className="flex items-center gap-2 bg-text-main text-bg-base hover:bg-opacity-90 px-4 py-2 rounded-lg text-xs uppercase tracking-widest font-bold transition-all"
                      >
                        <Download className="w-4 h-4" /> {t('download_report')}
                      </button>
                    </div>

                    <div className="text-sm opacity-90 leading-relaxed font-medium">
                      {aiResult.reportText}
                    </div>

                    {typeof aiResult.securityScore === 'number' && (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="bg-bg-base/40 rounded-lg p-4">
                          <p className="text-[10px] font-mono uppercase tracking-widest opacity-60 mb-2">{t('security_score_title')}</p>
                          <p className="text-2xl font-black">{aiResult.securityScore}<span className="opacity-50 text-base">/100</span></p>
                        </div>
                        <div className="bg-bg-base/40 rounded-lg p-4 md:col-span-2">
                          <p className="text-[10px] font-mono uppercase tracking-widest opacity-60 mb-2">{t('score_factors')}</p>
                          <div className="flex flex-wrap gap-2">
                            {(aiResult.scoreFactors || []).map((factor) => (
                              <span key={factor} className="px-2 py-1 rounded-full bg-bg-base/70 text-xs border border-border-subtle">
                                {factor}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {(aiResult.scoreImprovement || []).length > 0 && (
                      <div className="bg-bg-base/40 rounded-lg p-4">
                        <h4 className="font-bold text-xs uppercase tracking-widest opacity-80 mb-3">
                          {t('score_improvement')}
                        </h4>
                        <ul className="space-y-2 text-sm opacity-90">
                          {aiResult.scoreImprovement?.map((item) => (
                            <li key={item} className="flex gap-2">
                              <span className="font-mono opacity-50">+</span>
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div className="bg-bg-base/40 rounded-lg p-4 mt-2">
                      <h4 className="font-bold text-xs uppercase tracking-widest opacity-80 mb-3 flex items-center gap-2">
                        <ArrowRight className="w-4 h-4" /> {t('action_plan')}
                      </h4>
                      <ul className="space-y-2 text-sm opacity-90">
                        {actionPlanSteps.map((step, index) => (
                          <li key={`${index}-${step}`} className="flex gap-2">
                            <span className="font-mono opacity-50">{index + 1}.</span>
                            <span>{step.replace(/^\d+\.\s*/, '')}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <MiniHistory scanType="social_osint" />
    </div>
  );
}
