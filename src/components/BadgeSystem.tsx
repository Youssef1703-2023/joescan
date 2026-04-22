import { Trophy, Shield, Star, ShieldCheck, Target, Zap, Medal, Loader2 } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';
import { useEffect, useState } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';

export interface ScanRecord {
  type?: string;
  riskLevel: 'Low' | 'Medium' | 'High';
  securityScore?: number;
}

export const computeTier = (scansCount: number) => {
  if (scansCount >= 100) return { name: 'Diamond', next: null, current: scansCount, target: 100, color: 'text-[#b9f2ff]', bg: 'bg-[#b9f2ff]/10', border: 'border-[#b9f2ff]' };
  if (scansCount >= 50) return { name: 'Gold', next: 'Diamond', current: scansCount, target: 100, color: 'text-[#ffd700]', bg: 'bg-[#ffd700]/10', border: 'border-[#ffd700]' };
  if (scansCount >= 10) return { name: 'Silver', next: 'Gold', current: scansCount, target: 50, color: 'text-[#c0c0c0]', bg: 'bg-[#c0c0c0]/10', border: 'border-[#c0c0c0]' };
  return { name: 'Bronze', next: 'Silver', current: scansCount, target: 10, color: 'text-[#cd7f32]', bg: 'bg-[#cd7f32]/10', border: 'border-[#cd7f32]' };
};

export const computeBadges = (scans: ScanRecord[]) => {
  const badges = [];

  // First Scan
  const hasFirstScan = scans.length > 0;
  badges.push({
    id: 'first_scan',
    title: 'Initiate Contact',
    desc: 'Performed your first security scan.',
    icon: Zap,
    earned: hasFirstScan,
    color: 'text-accent'
  });

  // Full Audit
  const uniqueTypes = new Set(scans.map(s => s.type || 'email').filter(Boolean));
  const hasFullAudit = uniqueTypes.size >= 7;
  badges.push({
    id: 'full_audit',
    title: 'Full Spectrum',
    desc: 'Utilized all 7 OSINT modules.',
    icon: Target,
    earned: hasFullAudit,
    color: 'text-[#ff3366]'
  });

  // Clean Sweep
  let consecutiveSafe = 0;
  let maxConsecutiveSafe = 0;
  scans.forEach(s => {
    if (s.riskLevel?.toUpperCase() === 'LOW') {
      consecutiveSafe++;
      if (consecutiveSafe > maxConsecutiveSafe) maxConsecutiveSafe = consecutiveSafe;
    } else {
      consecutiveSafe = 0;
    }
  });

  const hasCleanSweep = maxConsecutiveSafe >= 5;
  badges.push({
    id: 'clean_sweep',
    title: 'Clean Sweep',
    desc: 'Achieved 5 consecutive LOW risk scans.',
    icon: ShieldCheck,
    earned: hasCleanSweep,
    color: 'text-[#00ffcc]'
  });

  // Defensive Matrix
  const highScorers = scans.filter(s => s.securityScore !== undefined && s.securityScore >= 80).length;
  const hasDefensiveMatrix = highScorers >= 10;
  badges.push({
    id: 'defensive_matrix',
    title: 'Defensive Matrix',
    desc: 'Maintained a Security Score of 80+ across 10 scans.',
    icon: Shield,
    earned: hasDefensiveMatrix,
    color: 'text-[#9b51e0]'
  });

  return badges;
};

export default function BadgeSystem({ initialScans }: { initialScans?: ScanRecord[] }) {
  const { t } = useLanguage();
  const [scans, setScans] = useState<ScanRecord[]>(initialScans || []);
  const [loading, setLoading] = useState(!initialScans);

  useEffect(() => {
    if (initialScans) {
      setScans(initialScans);
      setLoading(false);
      return;
    }
    
    if (!auth.currentUser) return;

    const fetchScans = async () => {
      try {
        const q = query(collection(db, 'scans'), where('userId', '==', auth.currentUser!.uid));
        const snapshot = await getDocs(q);
        const results = snapshot.docs.map(doc => doc.data() as ScanRecord);
        setScans(results);
      } catch (err) {
        console.error("Error fetching scans for badges:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchScans();
  }, [initialScans, auth.currentUser?.uid]);

  if (loading) {
    return <div className="p-8 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-accent" /></div>;
  }
  const tier = computeTier(scans.length);
  const badges = computeBadges(scans);
  const earnedCount = badges.filter(b => b.earned).length;

  return (
    <div className="w-full flex flex-col gap-6">
      {/* Tier Progress */}
      <div className={cn("glass-card p-6 border transition-all relative overflow-hidden", tier.border, tier.bg)}>
        <div className="absolute right-0 top-0 p-4 opacity-10 pointer-events-none">
          <Medal className="w-24 h-24 -mr-4 -mt-4 text-currentColor" />
        </div>
        <div className="flex items-center gap-4 mb-4 relative z-10">
          <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center font-bold text-2xl bg-bg-elevated/50", tier.color, tier.border, "border-2")}>
            {tier.name.charAt(0)}
          </div>
          <div>
            <h3 className={cn("text-xs font-mono tracking-widest uppercase opacity-80", tier.color)}>{t('security_tier' as any) || 'Security Tier'}</h3>
            <div className={cn("text-2xl font-black uppercase tracking-tight", tier.color)}>{t(`tier_${tier.name.toLowerCase()}` as any) || tier.name}</div>
          </div>
        </div>

        {tier.next && (
          <div className="relative z-10">
            <div className="flex justify-between text-xs font-mono mb-2 opacity-80">
              <span className={tier.color}>{t('progress_to_next' as any) || 'Progress to Next Tier'}</span>
              <span>{Math.round((tier.current / tier.target) * 100)}%</span>
            </div>
            <div className="h-2 w-full bg-bg-base/50 rounded-full overflow-hidden shadow-inner">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(100, Math.max(0, (tier.current / tier.target) * 100))}%` }}
                transition={{ duration: 1.5, ease: 'easeOut' }}
                className={cn("h-full", tier.bg.replace('/10', ''))}
                style={{ backgroundColor: 'currentColor' }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Badges Grid */}
      <div className="glass-card p-6">
        <h3 className="font-bold text-sm tracking-widest uppercase mb-6 flex items-center justify-between">
          <span className="flex items-center gap-2"><Trophy className="w-4 h-4 text-accent" /> {t('achievements_tab' as any) || 'Achievements'}</span>
          <span className="text-xs font-mono opacity-60 bg-bg-elevated px-2 py-1 rounded">{earnedCount} / {badges.length} {t('badges_earned' as any) || 'Earned'}</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {badges.map((badge, i) => {
            const Icon = badge.icon;
            return (
              <motion.div
                key={badge.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className={cn(
                  "relative p-4 rounded-xl border flex gap-4 transition-all duration-300 overflow-hidden",
                  badge.earned ? "border-border-subtle bg-bg-elevated hover:border-accent/30" : "border-border-subtle/30 bg-bg-base opacity-60 grayscale"
                )}
              >
                {badge.earned && (
                  <div className={cn("absolute right-0 top-0 w-16 h-16 opacity-5 blur-2xl rounded-full", badge.color.replace('text-', 'bg-'))} />
                )}
                <div className={cn("w-10 h-10 shrink-0 rounded-full border-2 flex items-center justify-center bg-bg-base", badge.earned ? badge.color + " border-currentColor" : "text-text-dim border-text-dim/20")}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex flex-col gap-1 justify-center z-10 w-full">
                  <div className="flex justify-between items-start">
                    <h4 className={cn("font-bold text-sm", badge.earned ? "text-text-main" : "text-text-dim")}>{badge.title}</h4>
                    {badge.earned && <Star className="w-3 h-3 text-accent fill-accent shrink-0 mt-0.5" />}
                  </div>
                  <p className="text-[11px] text-text-dim leading-snug">{badge.desc}</p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
