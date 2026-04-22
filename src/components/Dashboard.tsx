import { useState, useEffect } from 'react';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { motion } from 'motion/react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, LineChart, Line, XAxis, YAxis, CartesianGrid, BarChart, Bar, Legend, Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Area, ComposedChart, AreaChart } from 'recharts';
import { Shield, Mail, KeyRound, Smartphone, Link as LinkIcon, UserSearch, MessageSquareWarning, Wifi, Activity, ChevronRight, AlertTriangle, ShieldCheck, Trophy, Globe, Fingerprint, TrendingUp, Target, Hexagon, Monitor } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { computeTier } from './BadgeSystem';

type TabId = 'email' | 'password' | 'phone' | 'url' | 'username' | 'social' | 'message' | 'ip' | 'domain' | 'fingerprint' | 'history' | 'device_security';

const TerminalFeed = () => {
  const [lines, setLines] = useState<string[]>(['[SYS] Initializing god-tier protocols...']);

  useEffect(() => {
    const payloads = [
      '[NET] Intercepting tcp/udp 443 routes...',
      '[OSINT] Cross-referencing dark web hashes...',
      '[WARN] Anomalous ping from proxy node',
      '[SYS] Overriding core protocols...',
      '[OK] Security handshake verified.',
      '[NET] Scanning subnet 192.168.',
      '[INTEL] Scraping metadata footprints...',
      '[OK] Encrypted channels stable.',
      '[BREACH] Checking multi-vector vulnerabilities...'
    ];
    let interval = setInterval(() => {
      setLines(prev => {
        const next = [...prev, payloads[Math.floor(Math.random() * payloads.length)] + Math.floor(Math.random()*999)];
        return next.length > 8 ? next.slice(1) : next;
      });
    }, 1500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="absolute top-0 right-0 m-4 w-64 h-32 overflow-hidden pointer-events-none z-0 hidden lg:block opacity-60 mix-blend-screen">
      <div className="flex flex-col justify-end h-full glitch-text-feed text-accent/80 font-mono tracking-tighter">
        {lines.map((line, i) => (
          <motion.div key={i} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="truncate">
            {line}
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default function Dashboard({ onNavigate }: { onNavigate: (tab: TabId) => void }) {
  const { lang, t, theme } = useLanguage();
  const [scans, setScans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const colors = {
    accent: theme === 'dark' ? '#00ff00' : '#10b981',
    error: theme === 'dark' ? '#ff3b3b' : '#ef4444',
    caution: theme === 'dark' ? '#ff9f0a' : '#f59e0b',
    low: theme === 'dark' ? '#00ff00' : '#10b981',
    bgElevated: theme === 'dark' ? '#111118' : '#fafafa',
    textDim: theme === 'dark' ? '#6b6b80' : '#71717a',
  };

  useEffect(() => {
    if (!auth.currentUser) return;

    const scansQuery = query(
      collection(db, 'scans'),
      where('userId', '==', auth.currentUser.uid),
      orderBy('createdAt', 'desc'),
    );

    const unsubscribe = onSnapshot(scansQuery, (snapshot) => {
      const results = snapshot.docs.map((snapshotDoc) => {
        const data = snapshotDoc.data();
        return {
          id: snapshotDoc.id,
          type: data.type || 'email',
          target: data.target || data.emailScanned || 'Unknown',
          riskLevel: data.riskLevel,
          securityScore: data.securityScore,
          createdAt: data.createdAt?.toDate() || new Date(),
        };
      });
      setScans(results);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'scans');
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const calculateGlobalScore = () => {
    if (scans.length === 0) return 100;

    let totalScore = 0;
    let counted = 0;

    scans.forEach((scan) => {
      if (scan.securityScore !== undefined) {
        totalScore += scan.securityScore;
        counted += 1;
        return;
      }

      if (scan.riskLevel === 'Low') { totalScore += 90; counted += 1; }
      if (scan.riskLevel === 'Medium') { totalScore += 50; counted += 1; }
      if (scan.riskLevel === 'High') { totalScore += 10; counted += 1; }
    });

    return counted === 0 ? 100 : Math.round(totalScore / counted);
  };

  const generateActivityTimeline = () => {
    const result = [];
    const now = new Date();

    for (let index = 6; index >= 0; index -= 1) {
      const date = new Date(now);
      date.setDate(date.getDate() - index);
      const dateString = date.toLocaleDateString(undefined, { weekday: 'short' });

      const dayScans = scans.filter((scan) => {
        const scanDate = new Date(scan.createdAt);
        return scanDate.getDate() === date.getDate() && scanDate.getMonth() === date.getMonth();
      });

      result.push({
        name: dateString,
        scans: dayScans.length,
        highRisk: dayScans.filter((scan) => scan.riskLevel?.toUpperCase() === 'HIGH').length,
      });
    }

    return result;
  };

  const getRiskDistribution = () => {
    const high = scans.filter((scan) => scan.riskLevel?.toUpperCase() === 'HIGH').length;
    const medium = scans.filter((scan) => scan.riskLevel?.toUpperCase() === 'MEDIUM').length;
    const low = scans.filter((scan) => scan.riskLevel?.toUpperCase() === 'LOW').length;

    return [
      { name: 'High', value: high, color: colors.error },
      { name: 'Medium', value: medium, color: colors.caution },
      { name: 'Low', value: low, color: colors.low },
    ].filter((entry) => entry.value > 0);
  };

  const generateMonthlyTimeline = () => {
    const result = [];
    const currentYear = new Date().getFullYear();
    const monthNames = lang === 'ar' 
      ? ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر']
      : ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    for (let i = 0; i < 12; i++) {
      const monthScans = scans.filter((scan) => {
        const d = new Date(scan.createdAt);
        return d.getMonth() === i && d.getFullYear() === currentYear;
      });
      result.push({
        name: monthNames[i],
        scans: monthScans.length,
        highRisk: monthScans.filter((s) => s.riskLevel?.toUpperCase() === 'HIGH').length
      });
    }
    // Optimization: only show from Jan up to the current month or months with data
    const lastMonthWithData = result.reduce((lastIdx, m, idx) => m.scans > 0 ? idx : lastIdx, new Date().getMonth());
    return result.slice(0, Math.max(lastMonthWithData + 1, 6)); // At least show 6 months
  };

  const generateTypeDistribution = () => {
    const typeCounts: Record<string, number> = {};
    scans.forEach(scan => {
      const type = scan.type || 'unknown';
      typeCounts[type] = (typeCounts[type] || 0) + 1;
    });

    const definedColors = [colors.accent, '#3b82f6', '#8b5cf6', '#ec4899', '#f97316', '#14b8a6', colors.error, colors.caution];
    
    return Object.keys(typeCounts).map((key, idx) => ({
      name: key.replace('_', ' ').toUpperCase(),
      value: typeCounts[key],
      color: definedColors[idx % definedColors.length]
    })).sort((a, b) => b.value - a.value);
  };

  const getToolStats = (typeId: string) => {
    const toolScans = scans.filter((scan) => scan.type === typeId);
    let score = '-';

    if (toolScans.length > 0) {
      const avg = toolScans.reduce((acc: number, scan: any) => acc + (scan.securityScore || 0), 0) / toolScans.length;
      score = Math.round(avg).toString();
    }

    return {
      count: toolScans.length,
      avgScore: score,
      lastScan: toolScans.length > 0 ? getRelativeTime(toolScans[0].createdAt) : '-',
    };
  };

  const getRelativeTime = (date: Date) => {
    const diffInSeconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    if (diffInSeconds < 60) return t('just_now');
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}${t('dash_time_m_ago')}`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}${t('dash_time_h_ago')}`;
    return `${Math.floor(diffInSeconds / 86400)}${t('dash_time_d_ago')}`;
  };

  const globalScore = calculateGlobalScore();
  const timelineData = generateActivityTimeline();
  const monthlyData = generateMonthlyTimeline();
  const typeDistributionData = generateTypeDistribution();
  const riskData = getRiskDistribution();
  const userTier = computeTier(scans.length);

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-[#0f0] border-[#0f0]/20 bg-[#0f0]/10';
    if (score >= 50) return 'text-caution border-caution/20 bg-caution/10';
    return 'text-error border-error/20 bg-error/10';
  };

  const toolsList = [
    { id: 'email', label: t('nav_email'), icon: Mail, scanType: 'email' },
    { id: 'password', label: t('nav_password'), icon: KeyRound, scanType: 'password' },
    { id: 'phone', label: t('nav_phone'), icon: Smartphone, scanType: 'phone' },
    { id: 'url', label: t('nav_url'), icon: LinkIcon, scanType: 'url' },
    { id: 'username', label: t('nav_username'), icon: UserSearch, scanType: 'username' },
    { id: 'social', label: t('nav_social'), icon: Globe, scanType: 'social_osint' },
    { id: 'message', label: t('nav_message'), icon: MessageSquareWarning, scanType: 'message' },
    { id: 'ip', label: t('nav_ip'), icon: Wifi, scanType: 'ip' },
    { id: 'domain', label: t('nav_domain'), icon: Globe, scanType: 'domain' },
    { id: 'fingerprint', label: t('nav_fingerprint'), icon: Fingerprint, scanType: 'browser_fingerprint' },
    { id: 'device_security', label: t('nav_device_security'), icon: Monitor, scanType: 'device_security' },
  ] as const;

  const CustomTerminalTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-bg-elevated/90 backdrop-blur-md border border-accent/40 p-3 rounded-lg shadow-[0_0_15px_rgba(0,255,0,0.15)] font-mono text-xs">
          <p className="text-text-dim mb-2 pb-1 border-b border-border-subtle uppercase tracking-widest">{label}</p>
          {payload.map((p: any, idx: number) => (
            <div key={idx} className="flex items-center justify-between gap-4 py-1">
              <span style={{ color: p.color || p.fill }} className="flex items-center gap-1.5 uppercase font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-current" /> {p.name || p.dataKey}
              </span>
              <span className="text-text-main font-black glitch-text" data-text={p.value}>
                {p.value} {t('dash_detections')}
              </span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="w-full flex flex-col gap-6 relative" dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <div className="cyber-scanner-overlay" />
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={`glass-card p-6 md:p-10 flex flex-col md:flex-row items-center md:items-start gap-8 justify-between relative overflow-hidden transition-colors ${getScoreColor(globalScore)}`}
      >
        <div className="absolute right-0 top-0 p-8 opacity-5 pointer-events-none mix-blend-overlay">
          <Shield className="w-64 h-64 -mr-8 -mt-8" />
        </div>

        <div className="flex-1 text-center md:text-left md:rtl:text-right z-10 w-full relative">
          <h2 className="font-mono text-sm tracking-[0.2em] uppercase opacity-80 mb-6 flex items-center justify-center md:justify-start gap-2">
            <Activity className="w-4 h-4 animate-pulse" /> {t('global_security_posture')}
          </h2>
          <div className="flex flex-col md:flex-row items-center gap-6">
            <div className="relative w-32 h-32 flex items-center justify-center filter drop-shadow-[0_0_15px_currentColor]">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="2 4" strokeOpacity="0.2" />
                <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="6" strokeDasharray={`${globalScore * 2.8} 300`} className="transition-all duration-1000 ease-out" strokeLinecap="round" />
              </svg>
              <div className="absolute text-4xl font-black tracking-tighter">
                {globalScore}
              </div>
            </div>
            <p className="opacity-90 max-w-lg leading-relaxed font-mono mt-4 md:mt-0 text-sm md:text-base p-4 bg-bg-base/30 rounded-lg border border-[currentColor]/20 shadow-[0_0_20px_currentColor_inset]">
              <span className="block text-xs uppercase tracking-widest opacity-60 mb-1">{t('dash_system_diagnosis')}</span>
              {globalScore >= 80 ? t('score_high_desc') : globalScore >= 50 ? t('score_medium_desc') : t('score_low_desc')}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 z-10 w-full md:w-auto mt-6 md:mt-0 glass-surface p-4 rounded-xl border border-[currentColor]/30 backdrop-blur-3xl shadow-xl relative">
          <div className="absolute inset-0 bg-[currentColor]/5 rounded-xl animate-pulse-glow" />
          <div className="flex flex-col items-center p-3 border-r border-[currentColor]/10 pr-6">
            <span className="text-3xl font-black">{loading ? '...' : scans.length}</span>
            <span className="text-xs uppercase tracking-widest opacity-80 mt-1 font-mono">{t('dash_total_scans')}</span>
          </div>
          <div className="flex flex-col items-center p-3 border-[currentColor]/10 px-4">
            <span className="text-3xl font-black flex items-center justify-center gap-1.5 h-9"><Trophy className="w-5 h-5" /> {userTier.name.charAt(0)}</span>
            <span className="text-xs uppercase tracking-widest opacity-80 mt-1 font-mono">{t('dash_tier')}</span>
          </div>
          <div className="flex flex-col items-center p-3 border-l border-[currentColor]/10 pl-6">
            <span className="text-3xl font-black">{scans.filter((scan) => scan.riskLevel?.toUpperCase() === 'HIGH').length}</span>
            <span className="text-xs uppercase tracking-widest opacity-80 mt-1 font-mono">{t('dash_high_risk')}</span>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="lg:col-span-1 flex flex-col gap-6"
        >
          <div className="glass-card p-6 h-64 flex flex-col">
            <h3 className="font-bold text-sm tracking-widest uppercase mb-2 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-accent" /> {t('dashboard_risk_dist')}
            </h3>
            <div className="flex-1 w-full relative">
              {riskData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={riskData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={70}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {riskData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <RechartsTooltip
                      contentStyle={{ backgroundColor: colors.bgElevated, borderColor: colors.textDim, borderRadius: '8px' }}
                      itemStyle={{ color: '#fff' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-text-dim/50 font-mono text-sm uppercase">
                  {t('dash_no_data')}
                </div>
              )}
            </div>
          </div>

          <div className="glass-card p-6 h-64 flex flex-col">
            <h3 className="font-bold text-sm tracking-widest uppercase mb-4 flex items-center gap-2">
              <Activity className="w-4 h-4 text-accent" /> {t('dashboard_activity_timeline')}
            </h3>
            <div className="flex-1 w-full text-xs">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={timelineData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={colors.textDim} opacity={0.2} vertical={false} />
                  <XAxis dataKey="name" stroke={colors.textDim} tick={{ fill: colors.textDim }} axisLine={false} tickLine={false} />
                  <YAxis stroke={colors.textDim} tick={{ fill: colors.textDim }} axisLine={false} tickLine={false} width={30} />
                  <RechartsTooltip
                    contentStyle={{ backgroundColor: colors.bgElevated, borderColor: colors.textDim, borderRadius: '8px' }}
                    itemStyle={{ color: '#fff' }}
                  />
                  <Line type="monotone" dataKey="scans" name={t('dash_total_scans_legend')} stroke={colors.accent} strokeWidth={3} dot={{ r: 4, fill: colors.bgElevated, strokeWidth: 2 }} />
                  <Line type="monotone" dataKey="highRisk" name={t('dash_high_risk')} stroke={colors.error} strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="lg:col-span-2 glass-card p-6"
        >
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-bold text-sm tracking-widest uppercase flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-accent" /> {t('dash_tools')}
            </h3>
            <button
              onClick={() => onNavigate('history')}
              className="text-xs text-accent hover:text-accent-fg bg-accent/10 hover:bg-accent px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 font-mono uppercase tracking-widest"
            >
              {t('nav_history')} <ChevronRight className="w-3 h-3 rtl:rotate-180" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {toolsList.map((tool) => {
              const stats = getToolStats(tool.scanType);
              return (
                <button
                  key={tool.id}
                  onClick={() => onNavigate(tool.id)}
                  className="bg-bg-elevated border border-border-subtle p-4 rounded-xl flex flex-col text-left rtl:text-right hover:border-accent/40 hover:shadow-[0_0_15px_rgba(0,255,0,0.1)] transition-all group relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 w-16 h-16 bg-accent opacity-0 group-hover:opacity-5 blur-2xl rounded-full transition-opacity" />

                  <div className="flex items-center justify-between mb-3 w-full">
                    <tool.icon className="w-5 h-5 text-text-dim group-hover:text-accent transition-colors" />
                    <span className="text-[10px] uppercase font-mono tracking-widest text-text-dim/50 group-hover:text-accent/80">
                      {t('audit')} <ChevronRight className="w-3 h-3 inline rtl:rotate-180" />
                    </span>
                  </div>

                  <div className="text-sm font-bold text-text-main mb-1 truncate">{tool.label}</div>

                  <div className="grid grid-cols-3 gap-2 mt-2 pt-2 border-t border-border-subtle/50 text-[10px] uppercase tracking-widest font-mono text-text-dim w-full">
                    <div className="flex flex-col">
                      <span className="opacity-50">{t('dash_scans')}</span>
                      <span className="font-bold text-text-main text-xs">{stats.count}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="opacity-50">{t('dash_avg_score')}</span>
                      <span className="font-bold text-text-main text-xs">{stats.avgScore}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="opacity-50">{t('dash_last')}</span>
                      <span className="font-bold text-text-main text-xs truncate">{stats.lastScan}</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </motion.div>
      </div>

      {/* Advanced Analytics / Metrics Dashboard */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-2"
      >
        {/* Monthly Breaches Trend */}
        <div className="glass-card p-6 h-80 flex flex-col relative overflow-hidden group border-accent/20 hover:border-accent/40 hover:shadow-[0_0_20px_rgba(0,255,0,0.05)] transition-all">
          <div className="absolute top-0 right-0 w-32 h-32 bg-accent opacity-0 group-hover:opacity-5 blur-3xl rounded-full transition-opacity" />
          <h3 className="font-bold text-sm tracking-widest uppercase mb-4 flex items-center gap-2 relative z-10 text-accent glow-text">
            <TrendingUp className="w-4 h-4" /> {t('dash_osint_timeline')}
          </h3>
          <div className="flex-1 w-full text-xs relative z-10">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={colors.accent} stopOpacity={0.5}/>
                    <stop offset="95%" stopColor={colors.accent} stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorRisk" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={colors.error} stopOpacity={0.8}/>
                    <stop offset="95%" stopColor={colors.error} stopOpacity={0.1}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={colors.textDim} opacity={0.1} vertical={false} />
                <XAxis dataKey="name" stroke={colors.textDim} tick={{ fill: colors.textDim }} axisLine={false} tickLine={false} />
                <YAxis stroke={colors.textDim} tick={{ fill: colors.textDim }} axisLine={false} tickLine={false} />
                <RechartsTooltip content={<CustomTerminalTooltip />} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} />
                
                {/* Total Scans Area */}
                <Area type="monotone" dataKey="scans" name={t('dash_total_scans_legend')} stroke={colors.accent} strokeWidth={2} fillOpacity={1} fill="url(#colorTotal)" dot={false} activeDot={{ r: 6, fill: colors.bgElevated, stroke: colors.accent, strokeWidth: 2 }} />
                
                {/* High Risk Area Overlay */}
                <Area type="monotone" dataKey="highRisk" name={t('dash_critical_detects')} stroke={colors.error} strokeWidth={2} fillOpacity={1} fill="url(#colorRisk)" dot={false} activeDot={{ r: 6, fill: colors.bgElevated, stroke: colors.error, strokeWidth: 2 }} className="drop-shadow-[0_0_10px_rgba(255,0,0,0.5)]" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Leaks / Tools Distribution - Radar Intelligence */}
        <div className="glass-card p-6 h-80 flex flex-col relative overflow-hidden group border-error/10 hover:border-error/30 hover:shadow-[0_0_20px_rgba(255,0,0,0.05)] transition-all">
          <div className="absolute top-0 right-0 w-32 h-32 bg-error opacity-0 group-hover:opacity-5 blur-3xl rounded-full transition-opacity" />
          <h3 className="font-bold text-sm tracking-widest uppercase mb-4 flex items-center gap-2 relative z-10 text-text-main shadow-md">
            <Hexagon className="w-4 h-4 text-error" /> {t('dash_attack_radar')}
          </h3>
          <div className="flex-1 w-full relative z-10">
            {typeDistributionData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="75%" data={typeDistributionData}>
                  <defs>
                    <radialGradient id="radarFill" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
                      <stop offset="0%" stopColor={colors.error} stopOpacity={0.6}/>
                      <stop offset="100%" stopColor={colors.error} stopOpacity={0.1}/>
                    </radialGradient>
                  </defs>
                  <PolarGrid stroke={colors.textDim} opacity={0.3} gridType="polygon" />
                  <PolarAngleAxis dataKey="name" tick={{ fill: colors.textDim, fontSize: 10, fontFamily: 'monospace' }} />
                  <PolarRadiusAxis angle={30} domain={[0, 'auto']} tick={{ fill: colors.textDim, fontSize: 9 }} tickCount={4} axisLine={false} />
                  <Radar
                    name="Detections"
                    dataKey="value"
                    stroke={colors.error}
                    strokeWidth={2}
                    fill="url(#radarFill)"
                    fillOpacity={1}
                    dot={{ r: 3, fill: colors.error, stroke: colors.bgElevated, strokeWidth: 1 }}
                    activeDot={{ r: 6, fill: colors.accent, stroke: colors.bgElevated }}
                  />
                  <RechartsTooltip content={<CustomTerminalTooltip />} />
                </RadarChart>
              </ResponsiveContainer>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-text-dim/50 font-mono text-sm uppercase">
                <Target className="w-8 h-8 opacity-20 absolute animate-spin-slow" />
                <span className="relative z-10 bg-bg-base/80 px-4 py-1 rounded border border-border-subtle">{t('dash_no_intel')}</span>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
