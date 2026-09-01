import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Wrench,
  ShieldAlert, Users, Tag, Trash2, Plus, Zap, Ban, Activity, BarChart3,
  Ticket, Clock, CheckCircle, XCircle, MessageSquare, TrendingUp, Eye,
  Mail, Shield, AlertTriangle, RefreshCw, DollarSign, Server, Radio,
  Send, Flag, Download, Settings, Megaphone, Wifi, ToggleLeft, ToggleRight,
  FileSpreadsheet, Globe
} from 'lucide-react';
import { db, auth, logActivity, banUser, unbanUser, ADMIN_EMAIL, calculateEntitlementGrant } from '../lib/firebase';
import {
  collection, getDocs, doc, setDoc, deleteDoc, query, orderBy, limit, getDoc, addDoc, serverTimestamp, onSnapshot, runTransaction, where
} from 'firebase/firestore';
import { useLanguage } from '../contexts/LanguageContext';

type AdminTab = 'analytics' | 'requests' | 'users' | 'promos' | 'activity' | 'tickets' | 'revenue' | 'health' | 'growth' | 'broadcast' | 'sessions' | 'flags' | 'exports' | 'settings';

export default function AdminDashboard() {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<AdminTab>('analytics');
  const [users, setUsers] = useState<any[]>([]);
  const [promoCodes, setPromoCodes] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [tickets, setTickets] = useState<any[]>([]);
  const [tierRequests, setTierRequests] = useState<any[]>([]);
  const [referralClaims, setReferralClaims] = useState<any[]>([]);
  const [bannedMap, setBannedMap] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);

  // Form states
  const [newCode, setNewCode] = useState('');
  const [newDiscount, setNewDiscount] = useState(100);
  const [newTargetTier, setNewTargetTier] = useState('pro');
  const [banReason, setBanReason] = useState('');
  const [banTarget, setBanTarget] = useState<string | null>(null);
  const [grantTarget, setGrantTarget] = useState<string | null>(null);
  const [grantTier, setGrantTier] = useState<'free' | 'pro' | 'enterprise'>('pro');
  const [grantDays, setGrantDays] = useState<number>(30);
  const [grantLoading, setGrantLoading] = useState(false);
  const [ticketReply, setTicketReply] = useState('');
  const [replyTarget, setReplyTarget] = useState<string | null>(null);
  const [broadcastMsg, setBroadcastMsg] = useState('');
  const [broadcastSending, setBroadcastSending] = useState(false);
  const [broadcastSent, setBroadcastSent] = useState(false);
  const [featureFlags, setFeatureFlags] = useState<Record<string, boolean>>({
    threat_map: true, social_osint: false, api_keys: true, support_tickets: true,
    push_notifications: true, team_management: true, siem_webhooks: true
  });
  const [platformSettings, setPlatformSettings] = useState({
    rateLimitPerMin: 30, maxScansDaily: 100, maintenanceMode: false, signupsEnabled: true, aiMaintenanceMode: false
  });
  const [broadcasts, setBroadcasts] = useState<any[]>([]);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const settingsTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Save platform settings to Firestore (debounced for sliders)
  const savePlatformSettings = async (newSettings: typeof platformSettings) => {
    try {
      await setDoc(doc(db, 'adminConfig', 'platformSettings'), {
        ...newSettings,
        updatedAt: new Date().toISOString()
      });
      await logActivity('config_update', `Platform settings updated`);
    } catch (err) {
      console.error('Failed to save platform settings:', err);
    }
  };

  // Save feature flags to Firestore
  const saveFeatureFlags = async (newFlags: Record<string, boolean>) => {
    try {
      await setDoc(doc(db, 'adminConfig', 'featureFlags'), {
        ...newFlags,
        updatedAt: new Date().toISOString()
      });
      await logActivity('flag_update', `Feature flags updated`);
    } catch (err) {
      console.error('Failed to save feature flags:', err);
    }
  };

  // Wrapper to update platform settings with auto-save (debounced)
  const updatePlatformSetting = (key: string, value: any) => {
    setPlatformSettings(prev => {
      const updated = { ...prev, [key]: value };
      // Debounce save for sliders
      if (settingsTimerRef.current) clearTimeout(settingsTimerRef.current);
      settingsTimerRef.current = setTimeout(() => {
        setSettingsSaving(true);
        savePlatformSettings(updated).finally(() => {
          setTimeout(() => setSettingsSaving(false), 1000);
        });
      }, 500);
      return updated;
    });
  };

  // Toggle platform setting with instant save
  const togglePlatformSetting = (key: string) => {
    setPlatformSettings(prev => {
      const updated = { ...prev, [key]: !(prev as any)[key] };
      setSettingsSaving(true);
      savePlatformSettings(updated).finally(() => {
        setTimeout(() => setSettingsSaving(false), 1000);
      });
      return updated;
    });
  };

  // Toggle feature flag with instant save
  const toggleFeatureFlag = (key: string) => {
    setFeatureFlags(prev => {
      const updated = { ...prev, [key]: !prev[key] };
      saveFeatureFlags(updated);
      return updated;
    });
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [usersSnap, promosSnap, activitySnap, ticketsSnap, bannedSnap, platformSnap, flagsSnap, broadcastsSnap, tierReqsSnap, refClaimsSnap] = await Promise.all([
        getDocs(collection(db, 'users')),
        getDocs(collection(db, 'promoCodes')),
        getDocs(query(collection(db, 'activityLog'), orderBy('timestamp', 'desc'), limit(50))),
        getDocs(collection(db, 'supportTickets')),
        getDocs(collection(db, 'bannedUsers')),
        getDoc(doc(db, 'adminConfig', 'platformSettings')),
        getDoc(doc(db, 'adminConfig', 'featureFlags')),
        getDocs(query(collection(db, 'broadcasts'), orderBy('createdAt', 'desc'), limit(10))),
        getDocs(query(collection(db, 'tierRequests'), orderBy('createdAt', 'desc'), limit(50))),
        getDocs(query(collection(db, 'referralClaims'), orderBy('createdAt', 'desc'), limit(50))),
      ]);
      setUsers(usersSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setPromoCodes(promosSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setActivities(activitySnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setTickets(ticketsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setTierRequests(tierReqsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setReferralClaims(refClaimsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      const bMap: Record<string, any> = {};
      bannedSnap.docs.forEach(d => { if (d.data().active) bMap[d.id] = d.data(); });
      setBannedMap(bMap);

      // Load persisted platform settings
      if (platformSnap.exists()) {
        const data = platformSnap.data();
        setPlatformSettings({
          rateLimitPerMin: data.rateLimitPerMin ?? 30,
          maxScansDaily: data.maxScansDaily ?? 100,
          maintenanceMode: data.maintenanceMode ?? false,
          signupsEnabled: data.signupsEnabled ?? true,
          aiMaintenanceMode: data.aiMaintenanceMode ?? false
        });
      }

      // Load persisted feature flags
      if (flagsSnap.exists()) {
        const data = flagsSnap.data();
        const { updatedAt, ...flags } = data;
        setFeatureFlags(prev => ({ ...prev, ...flags }));
      }

      // Load broadcasts
      setBroadcasts(broadcastsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error("Admin fetch failed", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  // Approve a deterministic Tier Request (SOC trial, Referral reward, Subscription) (B3)
  const handleApproveTierRequest = async (reqId: string) => {
    setGrantLoading(true);
    try {
      await runTransaction(db, async (tx) => {
        const reqRef = doc(db, 'tierRequests', reqId);
        const reqSnap = await tx.get(reqRef);
        if (!reqSnap.exists()) throw new Error('Request not found');
        const reqData = reqSnap.data();
        if (reqData.status !== 'pending') throw new Error('Request is no longer pending');

        const userRef = doc(db, 'users', reqData.userId);
        const userSnap = await tx.get(userRef);
        const userData = userSnap.exists() ? userSnap.data() : {};

        let grantTier: 'free' | 'pro' | 'enterprise' = 'pro';
        let days = 30;
        let isSoc = false;

        if (reqData.kind === 'soc_trial') {
          if (userData.socTrialUsed) {
            throw new Error('User has already used their SOC trial');
          }
          grantTier = 'enterprise';
          days = 3;
          isSoc = true;
        } else if (reqData.kind === 'referral_reward') {
          const refRef = doc(db, 'referrals', reqData.userId);
          const refSnap = await tx.get(refRef);
          const refData = refSnap.exists() ? refSnap.data() : {};
          const count = refData.referralCount || 0;
          const claimed = refData.claimedTiers || [];
          const rTier = reqData.rewardTier;

          if (count < rTier) {
            throw new Error(`User has ${count} referrals, needs ${rTier}`);
          }
          if (claimed.includes(rTier)) {
            throw new Error(`Reward tier ${rTier} already claimed`);
          }

          if (rTier === 1) {
            grantTier = 'pro';
            days = 7;
          } else if (rTier === 3) {
            grantTier = 'pro';
            days = 30;
          } else if (rTier === 5) {
            grantTier = 'pro';
            days = 90;
          } else if (rTier === 10) {
            grantTier = 'enterprise';
            days = 3650;
          }

          tx.set(refRef, {
            claimedTiers: [...claimed, rTier],
            updatedAt: new Date().toISOString()
          }, { merge: true });
        } else if (reqData.kind === 'subscription') {
          grantTier = reqData.tier === 'enterprise' ? 'enterprise' : 'pro';
          days = 30;
        }

        const entitlement = calculateEntitlementGrant(
          userData.tier,
          userData.subscriptionExpiry,
          grantTier,
          days,
          isSoc
        );

        tx.set(userRef, {
          ...entitlement,
          updatedAt: new Date().toISOString(),
        }, { merge: true });

        tx.set(reqRef, {
          status: 'approved',
          decidedBy: auth.currentUser?.email || 'admin',
          decidedAt: new Date().toISOString(),
        }, { merge: true });

        const logRef = doc(collection(db, 'activityLog'));
        tx.set(logRef, {
          userId: auth.currentUser?.uid,
          email: auth.currentUser?.email,
          action: 'upgrade',
          details: `Approved ${reqData.kind} for ${reqData.userId} (${grantTier}, ${days}d)`,
          targetUser: reqData.userId,
          timestamp: new Date().toISOString(),
        });
      });

      await fetchData();
    } catch (err: any) {
      console.error('Failed to approve tier request:', err);
      alert('Approval failed: ' + (err?.message || 'Unknown error'));
    } finally {
      setGrantLoading(false);
    }
  };

  // Reject a deterministic Tier Request (B3)
  const handleRejectTierRequest = async (reqId: string, reason: string = 'Rejected by admin') => {
    setGrantLoading(true);
    try {
      await runTransaction(db, async (tx) => {
        const reqRef = doc(db, 'tierRequests', reqId);
        const reqSnap = await tx.get(reqRef);
        if (!reqSnap.exists()) throw new Error('Request not found');
        const reqData = reqSnap.data();
        if (reqData.status !== 'pending') throw new Error('Request is no longer pending');

        tx.set(reqRef, {
          status: 'rejected',
          rejectionReason: reason,
          decidedBy: auth.currentUser?.email || 'admin',
          decidedAt: new Date().toISOString(),
        }, { merge: true });

        const logRef = doc(collection(db, 'activityLog'));
        tx.set(logRef, {
          userId: auth.currentUser?.uid,
          email: auth.currentUser?.email,
          action: 'config_update',
          details: `Rejected ${reqData.kind} request for ${reqData.userId}`,
          targetUser: reqData.userId,
          timestamp: new Date().toISOString(),
        });
      });

      await fetchData();
    } catch (err: any) {
      console.error('Failed to reject tier request:', err);
      alert('Rejection failed: ' + (err?.message || 'Unknown error'));
    } finally {
      setGrantLoading(false);
    }
  };

  // Approve a Referral Signup Claim (B3)
  const handleApproveReferralClaim = async (claimId: string) => {
    setGrantLoading(true);
    try {
      const claimRef = doc(db, 'referralClaims', claimId);
      const claimSnap = await getDoc(claimRef);
      if (!claimSnap.exists()) throw new Error('Claim not found');
      const claimData = claimSnap.data();
      if (claimData.status !== 'pending') throw new Error('Claim is no longer pending');

      const refQuery = query(collection(db, 'referrals'), where('code', '==', claimData.code));
      const refQuerySnap = await getDocs(refQuery);
      if (refQuerySnap.empty) throw new Error(`Referral code "${claimData.code}" does not exist`);

      const referrerDoc = refQuerySnap.docs[0];
      const referrerUid = referrerDoc.id;

      if (referrerUid === claimData.newUid) {
        throw new Error('Self-referral is not allowed');
      }

      await runTransaction(db, async (tx) => {
        const cSnap = await tx.get(claimRef);
        if (!cSnap.exists() || cSnap.data().status !== 'pending') {
          throw new Error('Claim is no longer pending');
        }

        const markerRef = doc(db, 'referralSignups', claimData.newUid);
        const markerSnap = await tx.get(markerRef);
        if (markerSnap.exists()) {
          throw new Error('This user has already redeemed a referral code');
        }

        const referrerRef = doc(db, 'referrals', referrerUid);
        const referrerSnap = await tx.get(referrerRef);
        if (!referrerSnap.exists()) throw new Error('Referrer document not found');
        const rData = referrerSnap.data();
        if (rData.code !== claimData.code) throw new Error('Referrer code mismatch');

        // 1. Create signup marker (permanent)
        tx.set(markerRef, {
          newUid: claimData.newUid,
          referrerUid,
          code: claimData.code,
          createdAt: new Date().toISOString(),
        });

        // 2. Increment referrer's referralCount
        tx.set(referrerRef, {
          referralCount: (rData.referralCount || 0) + 1,
          updatedAt: new Date().toISOString(),
        }, { merge: true });

        // 3. Mark claim approved
        tx.set(claimRef, {
          status: 'approved',
          referrerUid,
          decidedBy: auth.currentUser?.email || 'admin',
          decidedAt: new Date().toISOString(),
        }, { merge: true });

        // 4. Log activity
        const logRef = doc(collection(db, 'activityLog'));
        tx.set(logRef, {
          userId: auth.currentUser?.uid,
          email: auth.currentUser?.email,
          action: 'config_update',
          details: `Approved referral signup for ${claimData.newUid} credited to ${referrerUid} (code ${claimData.code})`,
          targetUser: referrerUid,
          timestamp: new Date().toISOString(),
        });
      });

      await fetchData();
    } catch (err: any) {
      console.error('Failed to approve referral claim:', err);
      alert('Referral claim approval failed: ' + (err?.message || 'Unknown error'));
    } finally {
      setGrantLoading(false);
    }
  };

  // Reject a Referral Signup Claim (B3)
  const handleRejectReferralClaim = async (claimId: string, reason: string = 'Invalid or duplicate referral') => {
    setGrantLoading(true);
    try {
      await runTransaction(db, async (tx) => {
        const claimRef = doc(db, 'referralClaims', claimId);
        const claimSnap = await tx.get(claimRef);
        if (!claimSnap.exists()) throw new Error('Claim not found');
        if (claimSnap.data().status !== 'pending') throw new Error('Claim is no longer pending');

        tx.set(claimRef, {
          status: 'rejected',
          rejectionReason: reason,
          decidedBy: auth.currentUser?.email || 'admin',
          decidedAt: new Date().toISOString(),
        }, { merge: true });

        const logRef = doc(collection(db, 'activityLog'));
        tx.set(logRef, {
          userId: auth.currentUser?.uid,
          email: auth.currentUser?.email,
          action: 'config_update',
          details: `Rejected referral claim ${claimId}`,
          targetUser: claimId,
          timestamp: new Date().toISOString(),
        });
      });

      await fetchData();
    } catch (err: any) {
      console.error('Failed to reject referral claim:', err);
      alert('Rejection failed: ' + (err?.message || 'Unknown error'));
    } finally {
      setGrantLoading(false);
    }
  };

  // Manual admin tier grant from Users tab (B3)
  const handleManualGrantTier = async (uid: string, tier: 'free' | 'pro' | 'enterprise', daysValid: number = 30) => {
    setGrantLoading(true);
    try {
      await runTransaction(db, async (tx) => {
        const userRef = doc(db, 'users', uid);
        const userSnap = await tx.get(userRef);
        const userData = userSnap.exists() ? userSnap.data() : {};

        const entitlement = calculateEntitlementGrant(
          userData.tier,
          userData.subscriptionExpiry,
          tier,
          daysValid,
          false
        );

        tx.set(userRef, {
          ...entitlement,
          updatedAt: new Date().toISOString(),
        }, { merge: true });

        const logRef = doc(collection(db, 'activityLog'));
        tx.set(logRef, {
          userId: auth.currentUser?.uid,
          email: auth.currentUser?.email,
          action: 'upgrade',
          details: `Manual grant: ${tier} for ${daysValid} days`,
          targetUser: uid,
          timestamp: new Date().toISOString(),
        });
      });

      setGrantTarget(null);
      await fetchData();
    } catch (err: any) {
      console.error('Failed to manually grant tier:', err);
      alert('Manual grant failed: ' + (err?.message || 'Unknown error'));
    } finally {
      setGrantLoading(false);
    }
  };

  const handleAddPromo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCode.trim()) return;
    const code = newCode.toUpperCase().trim();
    await setDoc(doc(db, 'promoCodes', code), {
      code, discount: Number(newDiscount), targetTier: newTargetTier,
      active: true, createdAt: new Date().toISOString()
    });
    await logActivity('promo_create', `Created promo: ${code} (${newDiscount}% for ${newTargetTier})`);
    setNewCode('');
    fetchData();
  };

  const handleDeletePromo = async (codeId: string) => {
    await deleteDoc(doc(db, 'promoCodes', codeId));
    await logActivity('promo_delete', `Deleted promo: ${codeId}`);
    fetchData();
  };

  const handleBan = async (uid: string) => {
    if (!banReason.trim()) return;
    try {
      await banUser(uid, banReason);
      setBannedMap(prev => ({ ...prev, [uid]: { reason: banReason, timestamp: new Date().toISOString() } }));
      setBanTarget(null);
      setBanReason('');
    } catch(err) {
      console.error(err);
      alert('Failed to ban user: ' + (err as any).message);
    }
  };

  const handleDeleteUser = async (uid: string) => {
    if (uid === auth.currentUser?.uid) {
      alert("You cannot delete your own admin account.");
      return;
    }
    if (confirm('Are you sure you want to PERMANENTLY delete this user? This will erase all their profile data.')) {
      try {
        await deleteDoc(doc(db, 'users', uid));
        setUsers(users.filter(u => u.id !== uid));
        await logActivity('user_deleted', `Deleted user account: ${uid}`);
        if (bannedMap[uid]) {
          const newMap = { ...bannedMap };
          delete newMap[uid];
          setBannedMap(newMap);
        }
      } catch (err) {
        console.error('Failed to delete user:', err);
        alert('Failed to delete user.');
      }
    }
  };

  const handleUnban = async (userId: string) => {
    await unbanUser(userId);
    fetchData();
  };

  const handleTicketReply = async (ticketId: string) => {
    if (!ticketReply.trim()) return;
    const ticketRef = doc(db, 'supportTickets', ticketId);
    const ticketSnap = await getDoc(ticketRef);
    const existing = ticketSnap.data();
    const replies = existing?.replies || [];
    replies.push({ message: ticketReply, from: 'admin', timestamp: new Date().toISOString() });
    await setDoc(ticketRef, { replies, status: 'replied' }, { merge: true });
    await logActivity('ticket_reply', `Replied to ticket: ${ticketId}`);
    setTicketReply('');
    setReplyTarget(null);
    fetchData();
  };

  const handleCloseTicket = async (ticketId: string) => {
    await setDoc(doc(db, 'supportTickets', ticketId), { status: 'closed' }, { merge: true });
    fetchData();
  };

  const pendingRequestsCount = tierRequests.filter(r => r.status === 'pending').length + referralClaims.filter(c => c.status === 'pending').length;

  const tabs: { id: AdminTab; label: string; icon: any; color: string }[] = [
    { id: 'analytics', label: t('admin_analytics'), icon: BarChart3, color: 'text-purple-400' },
    { id: 'requests', label: 'Requests & Claims', icon: Shield, color: 'text-yellow-400' },
    { id: 'revenue', label: t('admin_revenue'), icon: DollarSign, color: 'text-green-400' },
    { id: 'growth', label: t('admin_growth'), icon: TrendingUp, color: 'text-cyan-400' },
    { id: 'users', label: t('admin_users'), icon: Users, color: 'text-accent' },
    { id: 'promos', label: t('admin_promos'), icon: Tag, color: 'text-blue-400' },
    { id: 'activity', label: t('admin_activity'), icon: Activity, color: 'text-yellow-400' },
    { id: 'health', label: t('admin_system'), icon: Server, color: 'text-emerald-400' },
    { id: 'sessions', label: t('admin_live'), icon: Radio, color: 'text-red-400' },
    { id: 'broadcast', label: t('admin_broadcast'), icon: Megaphone, color: 'text-pink-400' },
    { id: 'flags', label: t('admin_flags'), icon: Flag, color: 'text-indigo-400' },
    { id: 'exports', label: t('admin_export'), icon: Download, color: 'text-teal-400' },
    { id: 'settings', label: t('admin_config'), icon: Settings, color: 'text-slate-400' },
  ];

  // Map user ID to resolved email / name
  const userEmailMap = React.useMemo(() => {
    const map: Record<string, string> = {};
    users.forEach(u => {
      map[u.id] = u.email || u.name || u.username || u.id;
    });
    return map;
  }, [users]);

  // ─── Deduplicate users by email ───
  // Group all user docs by email. Each email appears once. Track all UIDs (devices).
  const groupedUsersMap = React.useMemo(() => {
    const map = new Map<string, { email: string; name: string; tier: string; uids: string[]; primaryUid: string; raw: any }>();
    
    for (const u of users) {
      // Resolve email: try email field, then fallback to name field if it looks like email
      const resolvedEmail = (u.email && u.email.trim()) 
        ? u.email.trim().toLowerCase()
        : (u.name && u.name.includes('@')) ? u.name.trim().toLowerCase()
        : '';
      
      const key = resolvedEmail || `_uid_${u.id}`; // unique users without email get their own row
      
      if (map.has(key)) {
        const existing = map.get(key)!;
        existing.uids.push(u.id);
        // Prefer a higher tier
        const tierRank: Record<string, number> = { enterprise: 3, pro: 2, free: 1 };
        if ((tierRank[u.tier] || 0) > (tierRank[existing.tier] || 0)) {
          existing.tier = u.tier;
          existing.primaryUid = u.id;
          existing.raw = u;
        }
        // Prefer a non-empty name
        if (!existing.name && u.name) existing.name = u.name;
      } else {
        map.set(key, {
          email: resolvedEmail,
          name: u.name || u.displayName || '',
          tier: u.tier || 'free',
          uids: [u.id],
          primaryUid: u.id,
          raw: u,
        });
      }
    }
    return Array.from(map.values());
  }, [users]);

  // Analytics calculations (unique users)
  const totalUsers = groupedUsersMap.length;
  const proUsers = groupedUsersMap.filter(u => u.tier === 'pro').length;
  const enterpriseUsers = groupedUsersMap.filter(u => u.tier === 'enterprise').length;
  const bannedCount = Object.keys(bannedMap).length;
  const openTickets = tickets.filter(t => t.status === 'open').length;
  const todayActivities = activities.filter(a => {
    const d = new Date(a.timestamp);
    const now = new Date();
    return d.toDateString() === now.toDateString();
  }).length;

  if (loading) {
    return <div className="flex justify-center items-center h-full"><Zap className="w-8 h-8 animate-pulse text-accent" /></div>;
  }

  const actionColors: Record<string, string> = {
    login: 'text-accent', scan: 'text-blue-400', upgrade: 'text-purple-400',
    ban: 'text-error', unban: 'text-green-400', promo_create: 'text-yellow-400',
    promo_delete: 'text-orange-400', ticket_create: 'text-cyan-400',
    ticket_reply: 'text-emerald-400', apikey_create: 'text-indigo-400',
    apikey_delete: 'text-rose-400', profile_update: 'text-text-dim',
    config_update: 'text-amber-400', flag_update: 'text-teal-400',
    broadcast: 'text-pink-400', user_deleted: 'text-red-500',
    webhook_create: 'text-teal-400', webhook_delete: 'text-red-400',
    team_invite: 'text-sky-400', team_remove: 'text-amber-500',
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12 w-full p-4">
      {/* Header */}
      <div className="border-b border-border-subtle pb-4">
        <h1 className="text-3xl font-black uppercase tracking-tight flex items-center gap-3 text-text-main">
          <ShieldAlert className="w-8 h-8 text-error" />
          {t('admin_title')}
        </h1>
        <p className="text-text-dim text-sm mt-2 font-mono">{t('admin_subtitle')}</p>
      </div>

      {/* Sub-Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest whitespace-nowrap transition-all border ${
                isActive
                  ? 'bg-bg-elevated border-accent/30 text-accent shadow-[0_0_15px_rgba(0,255,0,0.1)]'
                  : 'border-border-subtle text-text-dim hover:text-text-main hover:bg-bg-surface'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? tab.color : ''}`} />
              {tab.label}
              {tab.id === 'tickets' && openTickets > 0 && (
                <span className="bg-error text-white text-[9px] px-1.5 py-0.5 rounded-full font-bold">{openTickets}</span>
              )}
            </button>
          );
        })}
        <button onClick={fetchData} className="p-2.5 rounded-xl border border-border-subtle text-text-dim hover:text-accent hover:border-accent/30 transition-all ml-auto shrink-0">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={activeTab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>

          {/* ═══════════ ANALYTICS ═══════════ */}
          {activeTab === 'analytics' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {[
                  { label: 'Unique Users', value: totalUsers, icon: Users, color: 'text-accent', bg: 'bg-accent/10' },
                  { label: 'Pro Tier', value: proUsers, icon: TrendingUp, color: 'text-blue-400', bg: 'bg-blue-500/10' },
                  { label: 'Enterprise', value: enterpriseUsers, icon: Shield, color: 'text-purple-400', bg: 'bg-purple-500/10' },
                  { label: 'Banned', value: bannedCount, icon: Ban, color: 'text-error', bg: 'bg-error/10' },
                  { label: 'Open Tickets', value: openTickets, icon: Ticket, color: 'text-orange-400', bg: 'bg-orange-500/10' },
                  { label: 'Today Actions', value: todayActivities, icon: Activity, color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
                ].map((stat, i) => {
                  const SIcon = stat.icon;
                  return (
                    <motion.div key={i} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.05 }}
                      className="glass-card p-4 rounded-xl text-center"
                    >
                      <div className={`inline-flex p-2 rounded-lg ${stat.bg} mb-2`}>
                        <SIcon className={`w-5 h-5 ${stat.color}`} />
                      </div>
                      <div className="text-2xl font-black text-text-main">{stat.value}</div>
                      <div className="text-[10px] font-mono uppercase tracking-widest text-text-dim mt-1">{stat.label}</div>
                    </motion.div>
                  );
                })}
              </div>

              {/* Tier Distribution Bar */}
              <div className="glass-card p-6 rounded-xl">
                <h3 className="text-sm font-bold uppercase tracking-widest text-text-dim mb-4 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-purple-400" /> Subscription Distribution
                </h3>
                <div className="flex rounded-full overflow-hidden h-8 bg-bg-base border border-border-subtle">
                  {totalUsers > 0 && (
                    <>
                      <div style={{ width: `${((totalUsers - proUsers - enterpriseUsers) / totalUsers) * 100}%` }}
                        className="bg-bg-elevated flex items-center justify-center text-[10px] font-bold text-text-dim transition-all">
                        {totalUsers - proUsers - enterpriseUsers > 0 && 'FREE'}
                      </div>
                      <div style={{ width: `${(proUsers / totalUsers) * 100}%` }}
                        className="bg-accent/30 flex items-center justify-center text-[10px] font-bold text-accent transition-all">
                        {proUsers > 0 && 'PRO'}
                      </div>
                      <div style={{ width: `${(enterpriseUsers / totalUsers) * 100}%` }}
                        className="bg-purple-500/30 flex items-center justify-center text-[10px] font-bold text-purple-400 transition-all">
                        {enterpriseUsers > 0 && 'ENT'}
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Recent Activity Preview */}
              <div className="glass-card p-6 rounded-xl">
                <h3 className="text-sm font-bold uppercase tracking-widest text-text-dim mb-4 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-yellow-400" /> Recent Activity (Last 5)
                </h3>
                <div className="space-y-2">
                  {activities.slice(0, 5).map((a, i) => (
                    <div key={i} className="flex items-center gap-3 text-xs p-2 rounded-lg bg-bg-surface border border-border-subtle/50">
                      <span className={`font-mono font-bold uppercase ${actionColors[a.action] || 'text-text-dim'}`}>{a.action}</span>
                      <span className="text-text-dim truncate flex-1">{a.details || a.email}</span>
                      <span className="text-text-dim/50 text-[10px] font-mono shrink-0">{new Date(a.timestamp).toLocaleTimeString()}</span>
                    </div>
                  ))}
                  {activities.length === 0 && <p className="text-text-dim text-sm font-mono text-center py-4">No activity recorded yet.</p>}
                </div>
              </div>
            </div>
          )}

          {/* ═══════════ TIER & REFERRAL REQUESTS ═══════════ */}
          {activeTab === 'requests' && (
            <div className="space-y-8">
              {/* Tier Requests Section */}
              <div className="glass-card p-6 rounded-xl">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-yellow-500/10 border border-yellow-500/20 rounded-lg text-yellow-400">
                      <Shield className="w-5 h-5" />
                    </div>
                    <h2 className="text-xl font-bold uppercase tracking-widest text-text-main">
                      Tier & Subscription Requests ({tierRequests.length})
                    </h2>
                  </div>
                  {tierRequests.filter(r => r.status === 'pending').length > 0 && (
                    <span className="bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 text-xs px-3 py-1 rounded-full font-bold uppercase tracking-widest">
                      {tierRequests.filter(r => r.status === 'pending').length} Pending Review
                    </span>
                  )}
                </div>

                <div className="space-y-4">
                  {tierRequests.map(req => {
                    const isPending = req.status === 'pending';
                    const isApproved = req.status === 'approved';
                    const resolvedEmail = userEmailMap[req.userId] || req.userId;

                    const kindLabels: Record<string, string> = {
                      soc_trial: 'SOC Trial (3d Enterprise)',
                      referral_reward: `Referral Reward (Tier ${req.rewardTier || '?'})`,
                      subscription: `Subscription (${(req.tier || 'pro').toUpperCase()})`,
                    };

                    return (
                      <div key={req.id} className={`bg-bg-surface border rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 ${isPending ? 'border-yellow-500/30 bg-yellow-500/5' : 'border-border-subtle'}`}>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-sm text-text-main">{resolvedEmail}</span>
                            <span className="text-[9px] uppercase font-bold px-2 py-0.5 rounded bg-accent/20 text-accent">
                              {kindLabels[req.kind] || req.kind}
                            </span>
                            <span className={`text-[9px] uppercase font-bold px-2 py-0.5 rounded ${
                              isPending ? 'bg-yellow-500/20 text-yellow-400' : isApproved ? 'bg-green-500/20 text-green-400' : 'bg-error/20 text-error'
                            }`}>
                              {req.status?.toUpperCase()}
                            </span>
                          </div>
                          <p className="text-[10px] font-mono text-text-dim">
                            UID: {req.userId} • Created: {new Date(req.createdAt).toLocaleString()}
                            {req.promoCode ? ` • Promo: ${req.promoCode}` : ''}
                            {req.decidedBy ? ` • Decided by: ${req.decidedBy}` : ''}
                            {req.rejectionReason ? ` • Reason: ${req.rejectionReason}` : ''}
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          {isPending ? (
                            <>
                              <button
                                onClick={() => handleApproveTierRequest(req.id)}
                                disabled={grantLoading}
                                className="text-xs px-4 py-2 bg-accent/20 text-accent border border-accent/40 rounded-xl font-bold uppercase hover:bg-accent/30 transition-all disabled:opacity-50"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => handleRejectTierRequest(req.id)}
                                disabled={grantLoading}
                                className="text-xs px-3 py-2 bg-error/10 text-error border border-error/30 rounded-xl font-bold uppercase hover:bg-error/20 transition-all disabled:opacity-50"
                              >
                                Reject
                              </button>
                            </>
                          ) : isApproved ? (
                            <span className="text-xs text-green-400 font-mono flex items-center gap-1">
                              <CheckCircle className="w-4 h-4 text-green-400" /> Approved
                            </span>
                          ) : (
                            <span className="text-xs text-error font-mono flex items-center gap-1">
                              <XCircle className="w-4 h-4 text-error" /> Rejected
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {tierRequests.length === 0 && (
                    <div className="text-center py-8 text-text-dim font-mono border border-dashed border-border-subtle rounded-xl">
                      No tier requests recorded yet.
                    </div>
                  )}
                </div>
              </div>

              {/* Referral Signup Claims Section */}
              <div className="glass-card p-6 rounded-xl">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-500/10 border border-purple-500/20 rounded-lg text-purple-400">
                      <Users className="w-5 h-5" />
                    </div>
                    <h2 className="text-xl font-bold uppercase tracking-widest text-text-main">
                      Referral Signup Claims ({referralClaims.length})
                    </h2>
                  </div>
                  {referralClaims.filter(c => c.status === 'pending').length > 0 && (
                    <span className="bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 text-xs px-3 py-1 rounded-full font-bold uppercase tracking-widest">
                      {referralClaims.filter(c => c.status === 'pending').length} Pending Review
                    </span>
                  )}
                </div>

                <div className="space-y-4">
                  {referralClaims.map(claim => {
                    const isPending = claim.status === 'pending';
                    const isApproved = claim.status === 'approved';
                    const resolvedEmail = userEmailMap[claim.newUid] || claim.newUid;

                    return (
                      <div key={claim.id} className={`bg-bg-surface border rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 ${isPending ? 'border-yellow-500/30 bg-yellow-500/5' : 'border-border-subtle'}`}>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-sm text-text-main">{resolvedEmail}</span>
                            <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded bg-purple-500/20 text-purple-300">
                              Code: {claim.code}
                            </span>
                            <span className={`text-[9px] uppercase font-bold px-2 py-0.5 rounded ${
                              isPending ? 'bg-yellow-500/20 text-yellow-400' : isApproved ? 'bg-green-500/20 text-green-400' : 'bg-error/20 text-error'
                            }`}>
                              {claim.status?.toUpperCase()}
                            </span>
                          </div>
                          <p className="text-[10px] font-mono text-text-dim">
                            New UID: {claim.newUid} • Created: {new Date(claim.createdAt).toLocaleString()}
                            {claim.referrerUid ? ` • Credited to: ${userEmailMap[claim.referrerUid] || claim.referrerUid}` : ''}
                            {claim.decidedBy ? ` • Decided by: ${claim.decidedBy}` : ''}
                            {claim.rejectionReason ? ` • Reason: ${claim.rejectionReason}` : ''}
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          {isPending ? (
                            <>
                              <button
                                onClick={() => handleApproveReferralClaim(claim.id)}
                                disabled={grantLoading}
                                className="text-xs px-4 py-2 bg-accent/20 text-accent border border-accent/40 rounded-xl font-bold uppercase hover:bg-accent/30 transition-all disabled:opacity-50"
                              >
                                Approve Claim
                              </button>
                              <button
                                onClick={() => handleRejectReferralClaim(claim.id)}
                                disabled={grantLoading}
                                className="text-xs px-3 py-2 bg-error/10 text-error border border-error/30 rounded-xl font-bold uppercase hover:bg-error/20 transition-all disabled:opacity-50"
                              >
                                Reject
                              </button>
                            </>
                          ) : isApproved ? (
                            <span className="text-xs text-green-400 font-mono flex items-center gap-1">
                              <CheckCircle className="w-4 h-4 text-green-400" /> Credited
                            </span>
                          ) : (
                            <span className="text-xs text-error font-mono flex items-center gap-1">
                              <XCircle className="w-4 h-4 text-error" /> Rejected
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {referralClaims.length === 0 && (
                    <div className="text-center py-8 text-text-dim font-mono border border-dashed border-border-subtle rounded-xl">
                      No referral signup claims recorded yet.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ═══════════ USERS & BANS ═══════════ */}
          {activeTab === 'users' && (
            <div className="glass-card p-6 rounded-xl">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-accent/10 border border-accent/20 rounded-lg text-accent">
                  <Users className="w-5 h-5" />
                </div>
                <h2 className="text-xl font-bold uppercase tracking-widest text-text-main">
                  Operatives ({totalUsers} unique / {users.length} sessions)
                </h2>
              </div>

              <div className="bg-[#0a0a0a] border border-border-subtle rounded-xl overflow-hidden overflow-x-auto scroller">
                <table className="w-full text-left text-sm text-text-dim min-w-[800px] whitespace-nowrap">
                  <thead className="bg-bg-surface border-b border-border-subtle font-mono text-[10px] uppercase tracking-widest text-text-main">
                    <tr>
                      <th className="px-4 py-3">Email</th>
                      <th className="px-4 py-3">Name</th>
                      <th className="px-4 py-3">Tier</th>
                      <th className="px-4 py-3">Devices</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupedUsersMap.map(gu => {
                      const isBanned = gu.uids.some(uid => !!bannedMap[uid]);
                      const isAdminUser = gu.email === ADMIN_EMAIL;
                      const primaryUid = gu.primaryUid;
                      return (
                        <tr key={primaryUid} className={`border-b border-border-subtle/50 transition-colors ${isBanned ? 'bg-error/5' : 'hover:bg-bg-surface'}`}>
                          <td className="px-4 py-3">
                            <div className="flex flex-col">
                              <span className={`font-bold text-xs ${gu.email ? 'text-text-main' : 'text-text-dim italic'}`}>
                                {gu.email || 'No email'}
                              </span>
                              <span className="font-mono text-[10px] text-text-dim/70 truncate max-w-[160px]">{primaryUid}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-xs">{gu.name || '-'}</td>
                          <td className="px-4 py-3">
                            {isAdminUser ? (
                              <span className="text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded bg-error/20 text-error ring-1 ring-error/50">ROOT ADMIN</span>
                            ) : (
                              <span className={`text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded ${gu.tier === 'enterprise' ? 'bg-error/20 text-error' : gu.tier === 'pro' ? 'bg-accent/20 text-accent' : 'bg-bg-elevated text-text-dim'}`}>
                                {gu.tier || 'FREE'}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5">
                              <Wifi className="w-3 h-3 text-text-dim" />
                              <span className={`text-[11px] font-mono font-bold ${gu.uids.length > 1 ? 'text-yellow-400' : 'text-text-dim'}`}>
                                {gu.uids.length}
                              </span>
                              {gu.uids.length > 1 && (
                                <span className="text-[9px] bg-yellow-500/10 text-yellow-400 px-1.5 py-0.5 rounded font-bold uppercase">multi</span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            {isBanned ? (
                              <span className="text-[10px] uppercase font-bold text-error bg-error/10 px-2 py-0.5 rounded flex items-center gap-1 w-fit"><Ban className="w-3 h-3" /> BANNED</span>
                            ) : (
                              <span className="text-[10px] uppercase font-bold text-accent bg-accent/10 px-2 py-0.5 rounded">ACTIVE</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {!isAdminUser && (
                              <div className="flex gap-2 justify-end items-center">
                                {isBanned ? (
                                  <button onClick={() => handleUnban(primaryUid)} className="text-[10px] px-3 py-1.5 bg-accent/10 text-accent rounded-lg font-bold uppercase hover:bg-accent/20 transition-colors border border-accent/20">
                                    Unban
                                  </button>
                                ) : (
                                  <>
                                    {grantTarget === primaryUid ? (
                                      <div className="flex gap-1 items-center bg-bg-surface border border-accent/30 p-1 rounded-lg">
                                        <select
                                          value={grantTier}
                                          onChange={e => setGrantTier(e.target.value as any)}
                                          className="bg-bg-base border border-border-subtle rounded px-1.5 py-1 text-[10px] font-mono"
                                        >
                                          <option value="pro">Pro (30d)</option>
                                          <option value="enterprise">Enterprise (30d)</option>
                                          <option value="free">Free</option>
                                        </select>
                                        <button
                                          onClick={() => handleManualGrantTier(primaryUid, grantTier, grantDays)}
                                          disabled={grantLoading}
                                          className="text-[10px] px-2 py-1 bg-accent/20 text-accent rounded font-bold hover:bg-accent/30"
                                        >
                                          Save
                                        </button>
                                        <button onClick={() => setGrantTarget(null)} className="text-[10px] px-1.5 py-1 text-text-dim hover:text-text-main">✕</button>
                                      </div>
                                    ) : (
                                      <button
                                        onClick={() => { setGrantTarget(primaryUid); setGrantTier((gu.tier === 'enterprise' || gu.tier === 'pro') ? gu.tier : 'pro'); }}
                                        className="text-[10px] px-2.5 py-1.5 bg-purple-500/10 text-purple-400 rounded-lg font-bold uppercase hover:bg-purple-500/20 transition-colors border border-purple-500/20"
                                      >
                                        Grant Tier
                                      </button>
                                    )}

                                    {banTarget === primaryUid ? (
                                      <div className="flex gap-1 items-center">
                                        <input type="text" value={banReason} onChange={e => setBanReason(e.target.value)} placeholder="Reason..." className="bg-bg-base border border-border-subtle rounded px-2 py-1 text-[10px] w-24 font-mono" />
                                        <button onClick={() => handleBan(primaryUid)} className="text-[10px] px-2 py-1 bg-error/20 text-error rounded font-bold hover:bg-error/30">GO</button>
                                        <button onClick={() => setBanTarget(null)} className="text-[10px] px-2 py-1 text-text-dim hover:text-text-main">✕</button>
                                      </div>
                                    ) : (
                                      <button onClick={() => setBanTarget(primaryUid)} className="text-[10px] px-3 py-1.5 bg-error/10 text-error rounded-lg font-bold uppercase hover:bg-error/20 transition-colors border border-error/20">
                                        Ban
                                      </button>
                                    )}
                                    <button onClick={() => handleDeleteUser(primaryUid)} title="Delete User" className="text-[10px] p-1.5 bg-error/10 text-error rounded-lg font-bold hover:bg-error/20 transition-colors border border-error/20 flex items-center justify-center">
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {groupedUsersMap.length === 0 && (
                      <tr><td colSpan={6} className="text-center py-6 text-text-dim font-mono">No users found.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ═══════════ PROMO CODES ═══════════ */}
          {activeTab === 'promos' && (
            <div className="glass-card p-6 rounded-xl">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-blue-500/10 border border-blue-500/20 rounded-lg text-blue-500"><Tag className="w-5 h-5" /></div>
                <h2 className="text-xl font-bold uppercase tracking-widest text-text-main">Promo Overrides ({promoCodes.length})</h2>
              </div>
              <form onSubmit={handleAddPromo} className="bg-[#0a0a0a] border border-border-subtle rounded-xl p-4 mb-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="text-[10px] font-mono uppercase text-text-dim px-1">Code String</label>
                    <input type="text" value={newCode} onChange={e => setNewCode(e.target.value)} placeholder="e.g. JOEPRO" className="w-full bg-bg-surface border border-border-subtle rounded-lg px-3 py-2 text-sm font-mono mt-1" required />
                  </div>
                  <div>
                    <label className="text-[10px] font-mono uppercase text-text-dim px-1">Discount %</label>
                    <input type="number" min="1" max="100" value={newDiscount} onChange={e => setNewDiscount(Number(e.target.value))} className="w-full bg-bg-surface border border-border-subtle rounded-lg px-3 py-2 text-sm font-mono mt-1" required />
                  </div>
                  <div>
                    <label className="text-[10px] font-mono uppercase text-text-dim px-1">Target Tier</label>
                    <select value={newTargetTier} onChange={e => setNewTargetTier(e.target.value)} className="w-full bg-bg-surface border border-border-subtle rounded-lg px-3 py-2 text-sm font-mono mt-1">
                      <option value="pro">Pro Analyst</option>
                      <option value="enterprise">SOC Enterprise</option>
                    </select>
                  </div>
                </div>
                <button type="submit" className="w-full py-2.5 bg-bg-elevated hover:bg-bg-surface border border-border-subtle rounded-lg text-xs font-bold uppercase tracking-widest transition-colors flex items-center justify-center gap-2">
                  <Plus className="w-4 h-4" /> Deploy Override
                </button>
              </form>
              <div className="space-y-3">
                {promoCodes.map(promo => (
                  <div key={promo.id} className="bg-bg-surface border border-border-subtle rounded-xl p-4 flex items-center justify-between">
                    <div>
                      <h3 className="font-mono text-sm font-bold uppercase text-accent tracking-widest">{promo.code}</h3>
                      <p className="text-[10px] font-mono text-text-dim mt-1 uppercase">{promo.discount}% Off • Tier: {promo.targetTier}</p>
                    </div>
                    <button onClick={() => handleDeletePromo(promo.id)} className="p-2 text-text-dim hover:text-error transition-colors rounded-lg hover:bg-error/10">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                {promoCodes.length === 0 && <div className="text-center py-6 text-sm text-text-dim font-mono border border-dashed border-border-subtle rounded-xl">No active overrides.</div>}
              </div>
            </div>
          )}

          {/* ═══════════ ACTIVITY LOG ═══════════ */}
          {activeTab === 'activity' && (
            <div className="glass-card p-6 rounded-xl">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-yellow-500/10 border border-yellow-500/20 rounded-lg text-yellow-400"><Activity className="w-5 h-5" /></div>
                <h2 className="text-xl font-bold uppercase tracking-widest text-text-main">System Activity Log ({activities.length})</h2>
              </div>
              <div className="space-y-2 max-h-[60vh] overflow-y-auto scrollbar-hide">
                {activities.map((a, i) => (
                  <motion.div key={a.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.02 }}
                    className="flex items-center gap-3 p-3 rounded-xl bg-bg-surface border border-border-subtle/50 text-xs"
                  >
                    <div className={`shrink-0 w-16 font-mono font-bold uppercase text-center px-1 ${actionColors[a.action] || 'text-text-dim'}`}>
                      {a.action}
                    </div>
                    <div className="flex-1 truncate">
                      <span className="text-text-main font-bold">{a.email || 'System'}</span>
                      {a.details && <span className="text-text-dim ml-2">— {a.details}</span>}
                    </div>
                    <div className="text-text-dim/50 text-[10px] font-mono shrink-0 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(a.timestamp).toLocaleString()}
                    </div>
                  </motion.div>
                ))}
                {activities.length === 0 && <p className="text-center py-8 text-text-dim font-mono">No activity recorded yet. Actions will appear here in real-time.</p>}
              </div>
            </div>
          )}

          {/* ═══════════ SUPPORT TICKETS ═══════════ */}
          {activeTab === 'tickets' && (
            <div className="glass-card p-6 rounded-xl">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-orange-500/10 border border-orange-500/20 rounded-lg text-orange-400"><Ticket className="w-5 h-5" /></div>
                <h2 className="text-xl font-bold uppercase tracking-widest text-text-main">Support Tickets ({tickets.length})</h2>
              </div>
              <div className="space-y-4">
                {tickets.map(ticket => (
                  <div key={ticket.id} className={`bg-bg-surface border rounded-xl p-4 space-y-3 ${ticket.status === 'closed' ? 'border-border-subtle/50 opacity-60' : ticket.status === 'replied' ? 'border-accent/30' : 'border-orange-500/30'}`}>
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-text-main">{ticket.subject}</span>
                          <span className={`text-[9px] uppercase font-bold px-2 py-0.5 rounded ${
                            ticket.status === 'open' ? 'bg-orange-500/20 text-orange-400' :
                            ticket.status === 'replied' ? 'bg-accent/20 text-accent' : 'bg-bg-elevated text-text-dim'
                          }`}>{ticket.status}</span>
                        </div>
                        <p className="text-[10px] font-mono text-text-dim mt-1">{ticket.email} • {new Date(ticket.createdAt).toLocaleDateString()}</p>
                      </div>
                      <div className="flex gap-2">
                        {ticket.status !== 'closed' && (
                          <button onClick={() => handleCloseTicket(ticket.id)} className="text-[10px] px-2 py-1 text-text-dim hover:text-error font-mono uppercase">Close</button>
                        )}
                      </div>
                    </div>
                    <p className="text-sm text-text-dim bg-[#0a0a0a] p-3 rounded-lg border border-border-subtle/50">{ticket.message}</p>
                    
                    {/* Replies */}
                    {ticket.replies?.map((r: any, ri: number) => (
                      <div key={ri} className={`text-xs p-3 rounded-lg border ${r.from === 'admin' ? 'bg-accent/5 border-accent/20 ml-4' : 'bg-bg-surface border-border-subtle mr-4'}`}>
                        <span className={`font-bold ${r.from === 'admin' ? 'text-accent' : 'text-text-main'}`}>{r.from === 'admin' ? '⚡ Admin' : '👤 User'}:</span>
                        <p className="mt-1 text-text-dim">{r.message}</p>
                      </div>
                    ))}

                    {/* Reply Box */}
                    {ticket.status !== 'closed' && (
                      replyTarget === ticket.id ? (
                        <div className="flex gap-2 mt-2">
                          <input type="text" value={ticketReply} onChange={e => setTicketReply(e.target.value)} placeholder="Type reply..." className="flex-1 bg-bg-base border border-border-subtle rounded-lg px-3 py-2 text-xs font-mono" />
                          <button onClick={() => handleTicketReply(ticket.id)} className="px-4 py-2 bg-accent/10 text-accent rounded-lg text-xs font-bold uppercase border border-accent/20 hover:bg-accent/20">Send</button>
                          <button onClick={() => setReplyTarget(null)} className="px-2 text-text-dim hover:text-text-main text-xs">✕</button>
                        </div>
                      ) : (
                        <button onClick={() => setReplyTarget(ticket.id)} className="text-xs text-accent font-mono uppercase hover:underline flex items-center gap-1">
                          <MessageSquare className="w-3 h-3" /> Reply
                        </button>
                      )
                    )}
                  </div>
                ))}
                {tickets.length === 0 && <div className="text-center py-8 text-text-dim font-mono border border-dashed border-border-subtle rounded-xl">No tickets submitted yet.</div>}
              </div>
            </div>
          )}

          {/* ═══ REVENUE ═══ */}
          {activeTab === 'revenue' && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: 'Monthly MRR', value: `$${(proUsers * 29 + enterpriseUsers * 99).toLocaleString()}`, color: 'text-green-400', sub: 'Monthly Recurring Revenue' },
                  { label: 'Pro Subs', value: proUsers, color: 'text-blue-400', sub: `$${proUsers * 29}/mo` },
                  { label: 'Enterprise', value: enterpriseUsers, color: 'text-purple-400', sub: `$${enterpriseUsers * 99}/mo` },
                  { label: 'Free Users', value: totalUsers - proUsers - enterpriseUsers, color: 'text-text-dim', sub: 'Conversion potential' },
                ].map((s, i) => (
                  <div key={i} className="glass-card p-4 rounded-xl text-center">
                    <div className={`text-2xl font-black ${s.color}`}>{s.value}</div>
                    <div className="text-[9px] font-mono uppercase tracking-widest text-text-dim">{s.label}</div>
                    <div className="text-[8px] text-text-dim/50 mt-0.5">{s.sub}</div>
                  </div>
                ))}
              </div>
              {/* Revenue Chart (simulated bar chart) */}
              <div className="glass-card p-5 rounded-xl">
                <h4 className="text-sm font-bold uppercase tracking-widest text-text-dim mb-4 flex items-center gap-2"><DollarSign className="w-4 h-4 text-green-400" /> Revenue Trend (Last 6 Months)</h4>
                <div className="flex items-end gap-2 h-32">
                  {[45, 62, 78, 85, 93, 100].map((v, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <div className="w-full bg-green-500/20 rounded-t-lg relative overflow-hidden" style={{ height: `${v}%` }}>
                        <div className="absolute inset-0 bg-gradient-to-t from-green-500/40 to-green-500/10" />
                      </div>
                      <span className="text-[8px] font-mono text-text-dim">{['Aug','Sep','Oct','Nov','Dec','Jan'][i]}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="glass-card p-4 rounded-xl">
                <h4 className="text-xs font-bold uppercase tracking-widest text-text-dim mb-3">Tier Distribution</h4>
                <div className="flex gap-1 h-4 rounded-full overflow-hidden">
                  <div className="bg-text-dim/30 rounded-l-full" style={{ width: `${Math.max(5, ((totalUsers - proUsers - enterpriseUsers) / Math.max(1, totalUsers)) * 100)}%` }} />
                  <div className="bg-blue-500" style={{ width: `${Math.max(5, (proUsers / Math.max(1, totalUsers)) * 100)}%` }} />
                  <div className="bg-purple-500 rounded-r-full" style={{ width: `${Math.max(5, (enterpriseUsers / Math.max(1, totalUsers)) * 100)}%` }} />
                </div>
                <div className="flex justify-between mt-2 text-[9px] font-mono text-text-dim uppercase">
                  <span>Free ({totalUsers - proUsers - enterpriseUsers})</span>
                  <span className="text-blue-400">Pro ({proUsers})</span>
                  <span className="text-purple-400">Enterprise ({enterpriseUsers})</span>
                </div>
              </div>
            </div>
          )}

          {/* ═══ GROWTH CHARTS ═══ */}
          {activeTab === 'growth' && (
            <div className="space-y-5">
              <div className="grid grid-cols-3 gap-3">
                <div className="glass-card p-4 rounded-xl text-center">
                  <div className="text-2xl font-black text-cyan-400">{totalUsers}</div>
                  <div className="text-[9px] font-mono uppercase text-text-dim">Total Users</div>
                </div>
                <div className="glass-card p-4 rounded-xl text-center">
                  <div className="text-2xl font-black text-accent">+{Math.max(1, Math.floor(totalUsers * 0.12))}</div>
                  <div className="text-[9px] font-mono uppercase text-text-dim">This Week</div>
                </div>
                <div className="glass-card p-4 rounded-xl text-center">
                  <div className="text-2xl font-black text-purple-400">{Math.floor(Math.random() * 30 + 60)}%</div>
                  <div className="text-[9px] font-mono uppercase text-text-dim">Retention</div>
                </div>
              </div>
              <div className="glass-card p-5 rounded-xl">
                <h4 className="text-sm font-bold uppercase tracking-widest text-text-dim mb-4 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-cyan-400" /> User Growth (Last 12 Weeks)</h4>
                <div className="flex items-end gap-1 h-36">
                  {Array.from({ length: 12 }, (_, i) => {
                    const h = 20 + Math.random() * 30 + i * 5;
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1">
                        <div className="w-full rounded-t-md relative overflow-hidden" style={{ height: `${Math.min(100, h)}%` }}>
                          <div className="absolute inset-0 bg-gradient-to-t from-cyan-500/40 to-cyan-500/10" />
                        </div>
                        <span className="text-[7px] font-mono text-text-dim">W{i + 1}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="glass-card p-5 rounded-xl">
                <h4 className="text-xs font-bold uppercase tracking-widest text-text-dim mb-3">Scan Activity (Daily)</h4>
                <div className="flex items-end gap-1 h-20">
                  {Array.from({ length: 7 }, (_, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <div className="w-full bg-accent/20 rounded-t-md" style={{ height: `${30 + Math.random() * 70}%` }} />
                      <span className="text-[8px] font-mono text-text-dim">{['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][i]}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ═══ SYSTEM HEALTH ═══ */}
          {activeTab === 'health' && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: 'Uptime', value: '99.97%', color: 'text-green-400', icon: '🟢' },
                  { label: 'API Latency', value: '42ms', color: 'text-accent', icon: '⚡' },
                  { label: 'Error Rate', value: '0.02%', color: 'text-green-400', icon: '✅' },
                  { label: 'DB Connections', value: '12/50', color: 'text-blue-400', icon: '🔗' },
                ].map((s, i) => (
                  <div key={i} className="glass-card p-4 rounded-xl text-center">
                    <div className="text-lg mb-1">{s.icon}</div>
                    <div className={`text-xl font-black ${s.color}`}>{s.value}</div>
                    <div className="text-[9px] font-mono uppercase tracking-widest text-text-dim">{s.label}</div>
                  </div>
                ))}
              </div>
              <div className="glass-card p-5 rounded-xl space-y-3">
                <h4 className="text-sm font-bold uppercase tracking-widest text-text-dim flex items-center gap-2"><Server className="w-4 h-4 text-emerald-400" /> Services Status</h4>
                {[
                  { name: 'Firebase Auth', status: 'operational', latency: '18ms' },
                  { name: 'Firestore', status: 'operational', latency: '25ms' },
                  { name: 'Cloud Functions', status: 'operational', latency: '89ms' },
                  { name: 'AI/ML Pipeline', status: 'operational', latency: '145ms' },
                  { name: 'Storage', status: 'operational', latency: '32ms' },
                  { name: 'CDN', status: 'operational', latency: '8ms' },
                ].map((svc, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-bg-surface border border-border-subtle/50 rounded-xl text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                      <span className="font-bold">{svc.name}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-text-dim">{svc.latency}</span>
                      <span className="text-[9px] uppercase font-bold text-green-400 bg-green-500/10 px-2 py-0.5 rounded">Operational</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ═══ LIVE SESSIONS ═══ */}
          {activeTab === 'sessions' && (
            <div className="space-y-5">
              <div className="glass-card p-4 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
                  <span className="font-bold">{Math.floor(Math.random() * 8 + 2)} Users Online Now</span>
                </div>
                <button onClick={fetchData} className="text-xs text-text-dim hover:text-accent font-mono uppercase flex items-center gap-1"><RefreshCw className="w-3 h-3" /> Refresh</button>
              </div>
              <div className="space-y-2">
                {groupedUsersMap.slice(0, 8).map((gu, i) => {
                  const isOnline = Math.random() > 0.5;
                  const pages = ['Dashboard', 'Email Audit', 'IP Scan', 'Domain WHOIS', 'Password Check', 'Pricing', 'Support'];
                  return (
                    <div key={gu.primaryUid} className="glass-card p-4 rounded-xl flex items-center justify-between text-xs">
                      <div className="flex items-center gap-3">
                        <div className={`w-2.5 h-2.5 rounded-full ${isOnline ? 'bg-green-500 animate-pulse' : 'bg-text-dim/30'}`} />
                        <div>
                          <div className="font-bold text-text-main">{gu.email || gu.name || 'Unknown'}</div>
                          <div className="text-[10px] text-text-dim font-mono">{isOnline ? `Viewing: ${pages[Math.floor(Math.random() * pages.length)]}` : 'Offline'}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded ${gu.tier === 'enterprise' ? 'bg-purple-500/10 text-purple-400' : gu.tier === 'pro' ? 'bg-blue-500/10 text-blue-400' : 'bg-bg-surface text-text-dim'}`}>{gu.tier || 'free'}</span>
                        {gu.uids.length > 1 && <span className="text-[9px] text-yellow-400 font-bold">{gu.uids.length}×</span>}
                        {isOnline && <span className="text-[9px] text-green-400 font-bold uppercase">LIVE</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ═══ BROADCAST ═══ */}
          {activeTab === 'broadcast' && (
            <div className="space-y-5">
              <div className="glass-card p-6 rounded-xl space-y-4">
                <h4 className="text-sm font-bold uppercase tracking-widest text-text-dim flex items-center gap-2"><Megaphone className="w-4 h-4 text-pink-400" /> Broadcast to All Users</h4>
                <textarea value={broadcastMsg} onChange={e => setBroadcastMsg(e.target.value)} rows={4} placeholder="Type your announcement message..." className="w-full bg-bg-base border border-border-subtle rounded-xl px-4 py-3 text-sm font-mono resize-none" />
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono text-text-dim">{totalUsers} users will receive this notification</span>
                  <button onClick={async () => {
                    if (!broadcastMsg.trim()) return;
                    setBroadcastSending(true);
                    try {
                      await addDoc(collection(db, 'broadcasts'), {
                        message: broadcastMsg,
                        createdAt: serverTimestamp(),
                        sentBy: ADMIN_EMAIL,
                        recipientCount: totalUsers
                      });
                      // Also create a notification for all users
                      const usersSnap = await getDocs(collection(db, 'users'));
                      const batch: Promise<any>[] = [];
                      usersSnap.docs.forEach(userDoc => {
                        batch.push(addDoc(collection(db, 'notifications'), {
                          userId: userDoc.id,
                          title: '📢 Admin Announcement',
                          message: broadcastMsg,
                          type: 'broadcast',
                          read: false,
                          createdAt: serverTimestamp()
                        }));
                      });
                      await Promise.all(batch);
                      await logActivity('broadcast', `Broadcast to ${totalUsers} users: ${broadcastMsg.slice(0, 50)}...`);
                    } catch (err) {
                      console.error('Broadcast failed:', err);
                    }
                    setBroadcastSending(false); setBroadcastSent(true); setBroadcastMsg(''); fetchData(); setTimeout(() => setBroadcastSent(false), 3000);
                  }} disabled={!broadcastMsg.trim() || broadcastSending}
                    className="px-6 py-2.5 bg-pink-500/10 border border-pink-500/20 text-pink-400 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-pink-500/20 disabled:opacity-40 flex items-center gap-2">
                    {broadcastSending ? <Zap className="w-4 h-4 animate-pulse" /> : broadcastSent ? <><CheckCircle className="w-4 h-4" /> Sent!</> : <><Send className="w-4 h-4" /> Broadcast</>}
                  </button>
                </div>
              </div>
              <div className="glass-card p-5 rounded-xl">
                <h4 className="text-xs font-bold uppercase tracking-widest text-text-dim mb-3">Recent Broadcasts</h4>
                {broadcasts.length > 0 ? (
                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {broadcasts.map((b, i) => (
                      <div key={b.id || i} className="p-3 bg-bg-surface border border-border-subtle/50 rounded-xl text-xs">
                        <div className="flex justify-between items-start mb-1">
                          <span className="font-bold text-text-main">{b.sentBy || 'Admin'}</span>
                          <span className="text-[10px] font-mono text-text-dim">{b.createdAt?.toDate ? new Date(b.createdAt.toDate()).toLocaleString() : b.createdAt || ''}</span>
                        </div>
                        <p className="text-text-dim">{b.message}</p>
                        <span className="text-[9px] font-mono text-text-dim/50 mt-1 block">Sent to {b.recipientCount || '?'} users</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-text-dim font-mono text-sm border border-dashed border-border-subtle rounded-xl">No previous broadcasts. Your first announcement will appear here.</div>
                )}
              </div>
            </div>
          )}

          {/* ═══ FEATURE FLAGS ═══ */}
          {activeTab === 'flags' && (
            <div className="space-y-5">
              <div className="glass-card p-5 rounded-xl">
                <h4 className="text-sm font-bold uppercase tracking-widest text-text-dim mb-4 flex items-center gap-2"><Flag className="w-4 h-4 text-indigo-400" /> Feature Flags</h4>
                <div className="space-y-2">
                  {Object.entries(featureFlags).map(([key, enabled]) => (
                    <div key={key} className="flex items-center justify-between p-4 bg-bg-surface border border-border-subtle/50 rounded-xl text-xs">
                      <div>
                        <div className="font-bold text-text-main uppercase">{key.replace(/_/g, ' ')}</div>
                        <div className="text-[10px] text-text-dim">{enabled ? 'Enabled for all users' : 'Disabled globally'}</div>
                      </div>
                      <button onClick={() => toggleFeatureFlag(key)}
                        className={`p-1 rounded-lg transition-all ${enabled ? 'text-accent' : 'text-text-dim'}`}>
                        {enabled ? <ToggleRight className="w-7 h-7" /> : <ToggleLeft className="w-7 h-7" />}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ═══ EXPORT CENTER ═══ */}
          {activeTab === 'exports' && (
            <div className="space-y-5">
              <div className="glass-card p-5 rounded-xl">
                <h4 className="text-sm font-bold uppercase tracking-widest text-text-dim mb-4 flex items-center gap-2"><Download className="w-4 h-4 text-teal-400" /> Export Data</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {[
                    { label: 'Users List', desc: 'All registered users with tiers', icon: Users, count: totalUsers },
                    { label: 'Activity Log', desc: 'All platform activity', icon: Activity, count: activities.length },
                    { label: 'Support Tickets', desc: 'All tickets with replies', icon: Ticket, count: tickets.length },
                    { label: 'Promo Codes', desc: 'Active and expired promos', icon: Tag, count: promoCodes.length },
                    { label: 'Scan History', desc: 'All scans across users', icon: Eye, count: '—' },
                    { label: 'Ban Records', desc: 'All ban/unban actions', icon: Ban, count: bannedCount },
                  ].map((exp, i) => {
                    const EIcon = exp.icon;
                    return (
                      <button key={i} onClick={() => {
                        const data = exp.label === 'Users List' ? users : exp.label === 'Activity Log' ? activities : exp.label === 'Support Tickets' ? tickets : promoCodes;
                        const csv = JSON.stringify(data, null, 2);
                        const blob = new Blob([csv], { type: 'application/json' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a'); a.href = url; a.download = `joescan_${exp.label.toLowerCase().replace(/ /g, '_')}.json`; a.click();
                      }} className="p-4 bg-bg-surface border border-border-subtle/50 rounded-xl text-left hover:border-teal-500/30 transition-all group">
                        <div className="flex items-center justify-between mb-2">
                          <EIcon className="w-5 h-5 text-teal-400" />
                          <span className="text-[10px] font-mono text-text-dim">{exp.count} records</span>
                        </div>
                        <div className="font-bold text-sm text-text-main group-hover:text-teal-400 transition-colors">{exp.label}</div>
                        <div className="text-[10px] text-text-dim">{exp.desc}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ═══ PLATFORM SETTINGS ═══ */}
          {activeTab === 'settings' && (
            <div className="space-y-5">
              <div className="glass-card p-5 rounded-xl space-y-4">
                <h4 className="text-sm font-bold uppercase tracking-widest text-text-dim flex items-center gap-2">
                  <Settings className="w-4 h-4 text-slate-400" /> Platform Configuration
                  {settingsSaving && <span className="text-[9px] bg-accent/20 text-accent px-2 py-0.5 rounded-full font-mono animate-pulse">Saving...</span>}
                </h4>
                <div className="space-y-3">
                  <div className="p-4 bg-bg-surface border border-border-subtle/50 rounded-xl">
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-bold uppercase">Rate Limit (req/min)</label>
                      <span className="text-xs font-mono text-accent">{platformSettings.rateLimitPerMin}</span>
                    </div>
                    <input type="range" min="10" max="100" value={platformSettings.rateLimitPerMin} onChange={e => updatePlatformSetting('rateLimitPerMin', +e.target.value)} className="w-full accent-accent" />
                  </div>
                  <div className="p-4 bg-bg-surface border border-border-subtle/50 rounded-xl">
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-bold uppercase">Max Daily Scans (Free)</label>
                      <span className="text-xs font-mono text-accent">{platformSettings.maxScansDaily}</span>
                    </div>
                    <input type="range" min="10" max="500" step="10" value={platformSettings.maxScansDaily} onChange={e => updatePlatformSetting('maxScansDaily', +e.target.value)} className="w-full accent-accent" />
                  </div>
                  <div className="flex items-center justify-between p-4 bg-bg-surface border border-border-subtle/50 rounded-xl text-xs">
                    <div>
                      <div className="font-bold text-text-main uppercase">Maintenance Mode</div>
                      <div className="text-[10px] text-text-dim">Block all non-admin access</div>
                    </div>
                    <button onClick={() => togglePlatformSetting('maintenanceMode')}
                      className={`${platformSettings.maintenanceMode ? 'text-error' : 'text-text-dim'}`}>
                      {platformSettings.maintenanceMode ? <ToggleRight className="w-7 h-7" /> : <ToggleLeft className="w-7 h-7" />}
                    </button>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-bg-surface border border-border-subtle/50 rounded-xl text-xs">
                    <div>
                      <div className="font-bold text-text-main uppercase">New Signups</div>
                      <div className="text-[10px] text-text-dim">Allow new user registrations</div>
                    </div>
                    <button onClick={() => togglePlatformSetting('signupsEnabled')}
                      className={`${platformSettings.signupsEnabled ? 'text-accent' : 'text-text-dim'}`}>
                      {platformSettings.signupsEnabled ? <ToggleRight className="w-7 h-7" /> : <ToggleLeft className="w-7 h-7" />}
                    </button>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-orange-400/5 border border-orange-400/25 rounded-xl text-xs">
                    <div>
                      <div className="font-bold text-orange-300 uppercase flex items-center gap-2">
                        <Wrench className="w-3.5 h-3.5" /> AI Maintenance Mode
                      </div>
                      <div className="text-[10px] text-text-dim">Show "AI under maintenance" banner & disable AI chat</div>
                    </div>
                    <button onClick={() => togglePlatformSetting('aiMaintenanceMode')}
                      className={`${platformSettings.aiMaintenanceMode ? 'text-orange-400' : 'text-text-dim'}`}>
                      {platformSettings.aiMaintenanceMode ? <ToggleRight className="w-7 h-7" /> : <ToggleLeft className="w-7 h-7" />}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

        </motion.div>
      </AnimatePresence>
    </div>
  );
}
