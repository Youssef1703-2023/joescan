export type WatchlistTargetType = 'ip' | 'domain' | 'email' | 'phone';
export type WatchlistFrequency = 'daily' | 'weekly';

export interface WatchlistTargetRecord {
  id: string;
  type: WatchlistTargetType;
  value: string; // canonicalized
  frequency: WatchlistFrequency;
  scheduleTime?: string; // HH:mm format
  scheduleDay?: string; // e.g. "Monday"
  nextDueAt: number; // timestamp in ms
  nextAttemptAt?: number; // timestamp in ms for backoff
  failureCount: number;
  lastConfirmedAt: number; // timestamp in ms (for 30-day lease)
  consecutiveResolutionFailures?: number; // for DNS resolution loss confirmation
}

export interface IpSnapshot {
  type: 'ip';
  ip: string;
  ports: number[];
  cves: string[];
  hostnames: string[];
  lastSweptAt: number;
}

export interface DomainSnapshot {
  type: 'domain';
  domain: string;
  dnsStatus: 'NOERROR' | 'NODATA' | 'NXDOMAIN' | 'TIMEOUT' | 'HTTP_FAILURE' | 'MALFORMED';
  records: {
    a: string[];
    mx: string[];
    ns: string[];
  };
  rdapExpiry?: string;
  lastSweptAt: number;
}

export type TargetSnapshot = IpSnapshot | DomainSnapshot;

export interface WatchlistFinding {
  id: string; // deterministic id
  targetId: string;
  kind:
    | 'port_opened'
    | 'port_closed'
    | 'cve_detected'
    | 'hostname_changed'
    | 'dns_a_changed'
    | 'dns_mx_changed'
    | 'dns_ns_changed'
    | 'domain_expiring'
    | 'resolution_lost';
  detail: string;
  severity: 'info' | 'low' | 'medium' | 'high' | 'critical';
  detectedAt: number;
}

export type TargetStatus =
  | 'monitoring'
  | 'threat_detected'
  | 'evaluating'
  | 'baseline_established'
  | 'clean'
  | 'stale_unconfirmed'
  | 'unsupported'
  | 'on_demand';

export interface TargetRuntimeState {
  status: TargetStatus;
  baselineEstablished: boolean;
  lastChecked: number | null;
  lastError: string | null;
  threatDetails?: string;
}

export interface WatchlistStoredState {
  targets: WatchlistTargetRecord[];
  snapshots: Record<string, TargetSnapshot>;
  findings: WatchlistFinding[];
  perTarget: Record<string, TargetRuntimeState>;
  revision: number;
  sweepInProgress: boolean;
  cursor: number;
  lastSweptAt: number | null;
  rdapCache?: Record<string, { expiry: string; cachedAt: number }>;
}

export interface SyncTargetInput {
  id?: string;
  type: WatchlistTargetType;
  value: string;
  frequency?: WatchlistFrequency;
  scheduleTime?: string;
  scheduleDay?: string;
}

export interface SyncResult {
  ok: boolean;
  error?: string;
  message?: string;
  revision?: number;
  targetCount?: number;
  limit?: number;
}

export interface SweepResult {
  ok: boolean;
  error?: string;
  message?: string;
  sweptCount?: number;
  findingsCount?: number;
  lastSweptAt?: number;
}

export interface WatchlistStateResponse {
  revision: number;
  lastSweptAt: number | null;
  sweepInProgress: boolean;
  targets: Array<{
    id: string;
    type: WatchlistTargetType;
    value: string;
    frequency: WatchlistFrequency;
    scheduleTime?: string;
    scheduleDay?: string;
    nextDueAt: number;
    status: TargetStatus;
    baselineEstablished: boolean;
    lastChecked: number | null;
    lastError: string | null;
    threatDetails?: string;
    lastConfirmedAt: number;
  }>;
  findings: WatchlistFinding[];
}

export const WATCHLIST_TIER_LIMITS: Record<string, number> = {
  free: 1,
  pro: 50,
  enterprise: 200,
};

const LEASE_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const MAX_FINDINGS = 50;
const MAX_SUBREQUEST_TARGET_BATCH = 8; // Bounds subrequests to ~40 per invocation (limit is 50 on Free)
const MAX_VALUE_LENGTH = 253;
const MAX_ERROR_LENGTH = 200;
const RDAP_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// Canonicalization helpers
export function canonicalizeValue(type: WatchlistTargetType, rawValue: string): { ok: boolean; value: string; error?: string } {
  if (typeof rawValue !== 'string') {
    return { ok: false, value: '', error: 'Target value must be a string' };
  }
  const trimmed = rawValue.trim();
  if (!trimmed || trimmed.length > MAX_VALUE_LENGTH) {
    return { ok: false, value: '', error: `Target value must be between 1 and ${MAX_VALUE_LENGTH} characters` };
  }

  if (type === 'ip') {
    // IPv4 check: 4 octets 0-255
    const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
    const ipv4Match = trimmed.match(ipv4Regex);
    if (ipv4Match) {
      const octets = ipv4Match.slice(1, 5).map(Number);
      const allValid = octets.every(o => o >= 0 && o <= 255);
      if (allValid) {
        return { ok: true, value: octets.join('.') };
      }
    }
    // Basic IPv6 check
    if (trimmed.includes(':') && /^[0-9a-fA-F:]+$/.test(trimmed)) {
      return { ok: true, value: trimmed.toLowerCase() };
    }
    return { ok: false, value: '', error: 'Invalid IP address format' };
  }

  if (type === 'domain') {
    let clean = trimmed.toLowerCase();
    clean = clean.replace(/^(https?:\/\/|ftp:\/\/)/i, '');
    clean = clean.replace(/\/.*$/, ''); // strip path
    clean = clean.replace(/:\d+$/, ''); // strip port
    clean = clean.replace(/\.+$/, ''); // strip trailing dots
    clean = clean.trim();

    const domainRegex = /^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9][a-z0-9-]{0,61}[a-z0-9]$/;
    if (!domainRegex.test(clean)) {
      return { ok: false, value: '', error: 'Invalid domain name format' };
    }
    return { ok: true, value: clean };
  }

  if (type === 'email') {
    const clean = trimmed.toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(clean)) {
      return { ok: false, value: '', error: 'Invalid email address format' };
    }
    return { ok: true, value: clean };
  }

  if (type === 'phone') {
    const clean = trimmed.replace(/[\s\-()]/g, '');
    if (clean.length < 5 || clean.length > 25) {
      return { ok: false, value: '', error: 'Invalid phone number format' };
    }
    return { ok: true, value: clean };
  }

  return { ok: false, value: '', error: `Unsupported target type: ${type}` };
}

export function computeNextDueTime(frequency: WatchlistFrequency, scheduleTime?: string, scheduleDay?: string, baseTime: number = Date.now()): number {
  if (frequency === 'weekly') {
    return baseTime + 7 * 24 * 60 * 60 * 1000;
  }
  // Daily default: 24 hours
  return baseTime + 24 * 60 * 60 * 1000;
}

export function deriveDeterministicFindingId(targetId: string, kind: string, key: string): string {
  const safeKey = key.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80);
  return `${targetId}:${kind}:${safeKey}`;
}

export class WatchlistMonitor {
  private state: any;
  private env: any;

  constructor(state: any, env: any) {
    this.state = state;
    this.env = env;
  }

  private async loadState(): Promise<WatchlistStoredState> {
    const raw = (await this.state.storage.get('watchlist_state')) as WatchlistStoredState | undefined;
    if (raw) {
      return {
        targets: raw.targets || [],
        snapshots: raw.snapshots || {},
        findings: raw.findings || [],
        perTarget: raw.perTarget || {},
        revision: typeof raw.revision === 'number' ? raw.revision : 0,
        sweepInProgress: Boolean(raw.sweepInProgress),
        cursor: typeof raw.cursor === 'number' ? raw.cursor : 0,
        lastSweptAt: raw.lastSweptAt || null,
        rdapCache: raw.rdapCache || {},
      };
    }
    return {
      targets: [],
      snapshots: {},
      findings: [],
      perTarget: {},
      revision: 0,
      sweepInProgress: false,
      cursor: 0,
      lastSweptAt: null,
      rdapCache: {},
    };
  }

  private async saveState(st: WatchlistStoredState): Promise<void> {
    await this.state.storage.put('watchlist_state', st);
  }

  private async armNextAlarm(st: WatchlistStoredState): Promise<void> {
    const now = Date.now();
    const schedulable = st.targets.filter(t => {
      const isSchedulableType = t.type === 'ip' || t.type === 'domain';
      const isLeaseActive = now - t.lastConfirmedAt <= LEASE_DURATION_MS;
      return isSchedulableType && isLeaseActive;
    });

    if (schedulable.length === 0) {
      await this.state.storage.deleteAlarm();
      return;
    }

    const dueTimes = schedulable.map(t => {
      if (t.nextAttemptAt && t.nextAttemptAt > now) {
        return t.nextAttemptAt;
      }
      return t.nextDueAt;
    });

    const earliestDue = Math.min(...dueTimes);
    // Never set alarm at or before Date.now() to prevent alarm storms
    const alarmTime = Math.max(Date.now() + 2000, earliestDue);
    await this.state.storage.setAlarm(alarmTime);
  }

  // ─── Upstream Provider Fetchers ───

  private async fetchShodanIp(ip: string): Promise<{ ports: number[]; cves: string[]; hostnames: string[] }> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    try {
      const res = await fetch(`https://internetdb.shodan.io/${encodeURIComponent(ip)}`, {
        headers: {
          'User-Agent': 'JoeScan-Watchlist/1.0 (+https://joescan.me)',
          'Accept': 'application/json',
        },
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (res.status === 404) {
        // Not indexed = clean / no open ports in InternetDB
        return { ports: [], cves: [], hostnames: [] };
      }
      if (!res.ok) {
        throw new Error(`Shodan InternetDB HTTP ${res.status}`);
      }

      const data = (await res.json()) as any;
      const rawPorts = Array.isArray(data.ports) ? data.ports : [];
      const ports = Array.from(new Set<number>(rawPorts.map((p: any) => Number(p)).filter((p: number) => !isNaN(p) && p > 0))).sort((a, b) => a - b);

      const rawCves = Array.isArray(data.cves) ? data.cves : [];
      const cves = Array.from(new Set<string>(rawCves.map((c: any) => String(c).toUpperCase().trim()).filter(Boolean))).sort();

      const rawHostnames = Array.isArray(data.hostnames) ? data.hostnames : [];
      const hostnames = Array.from(new Set<string>(rawHostnames.map((h: any) => String(h).toLowerCase().replace(/\.+$/, '').trim()).filter(Boolean))).sort();

      return { ports, cves, hostnames };
    } catch (err: any) {
      clearTimeout(timer);
      throw err;
    }
  }

  private async fetchGoogleDnsRecord(
    domain: string,
    type: 'A' | 'MX' | 'NS'
  ): Promise<{ status: 'NOERROR' | 'NODATA' | 'NXDOMAIN'; answers: string[] }> {
    const typeMap = { A: 'A', MX: 'MX', NS: 'NS' };
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);

    try {
      const res = await fetch(`https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=${typeMap[type]}`, {
        headers: {
          'User-Agent': 'JoeScan-Watchlist/1.0 (+https://joescan.me)',
          'Accept': 'application/dns-json',
        },
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (res.status === 429) {
        throw new Error('dns.google rate limited (HTTP 429)');
      }
      if (!res.ok) {
        throw new Error(`dns.google HTTP ${res.status}`);
      }

      const data = (await res.json()) as any;
      const dnsStatus = data.Status;

      if (dnsStatus === 3) {
        return { status: 'NXDOMAIN', answers: [] };
      }

      if (dnsStatus === 0) {
        const rawAnswers = Array.isArray(data.Answer) ? data.Answer : [];
        const answers = Array.from(
          new Set<string>(
            rawAnswers
              .map((ans: any) => {
                const val = typeof ans.data === 'string' ? ans.data : '';
                // Lowercase, strip trailing dot, trim, exclude TTL
                return val.toLowerCase().replace(/\.+$/, '').trim();
              })
              .filter(Boolean)
          )
        ).sort();

        if (answers.length === 0) {
          return { status: 'NODATA', answers: [] };
        }
        return { status: 'NOERROR', answers };
      }

      return { status: 'NODATA', answers: [] };
    } catch (err: any) {
      clearTimeout(timer);
      throw err;
    }
  }

  private async fetchRdapExpiry(domain: string, st: WatchlistStoredState): Promise<string | undefined> {
    const now = Date.now();
    const cache = st.rdapCache || {};
    if (cache[domain] && now - cache[domain].cachedAt < RDAP_CACHE_TTL_MS) {
      return cache[domain].expiry;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    try {
      const res = await fetch(`https://rdap.org/domain/${encodeURIComponent(domain)}`, {
        headers: {
          'User-Agent': 'JoeScan-Watchlist/1.0 (+https://joescan.me)',
          'Accept': 'application/rdap+json, application/json',
        },
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (res.status === 429) {
        // Rate limited on rdap.org -> use cached if available
        if (cache[domain]) return cache[domain].expiry;
        return undefined;
      }
      if (!res.ok) {
        if (cache[domain]) return cache[domain].expiry;
        return undefined;
      }

      const data = (await res.json()) as any;
      const events = Array.isArray(data.events) ? data.events : [];
      let expiryDate: string | undefined;

      for (const ev of events) {
        const action = String(ev.eventAction || '').toLowerCase();
        if (action === 'expiration' || action === 'registration expiration') {
          if (ev.eventDate && typeof ev.eventDate === 'string') {
            expiryDate = ev.eventDate;
            break;
          }
        }
      }

      if (expiryDate) {
        st.rdapCache = {
          ...cache,
          [domain]: { expiry: expiryDate, cachedAt: now },
        };
      }
      return expiryDate;
    } catch {
      clearTimeout(timer);
      if (cache[domain]) return cache[domain].expiry;
      return undefined;
    }
  }

  // ─── Single Target Sweep and Diffing ───

  private async sweepTarget(
    target: WatchlistTargetRecord,
    st: WatchlistStoredState
  ): Promise<{ findings: WatchlistFinding[]; runtime: TargetRuntimeState }> {
    const now = Date.now();

    if (target.type === 'ip') {
      const data = await this.fetchShodanIp(target.value);
      const newSnapshot: IpSnapshot = {
        type: 'ip',
        ip: target.value,
        ports: data.ports,
        cves: data.cves,
        hostnames: data.hostnames,
        lastSweptAt: now,
      };

      const prevSnapshot = st.snapshots[target.id] as IpSnapshot | undefined;
      const findings: WatchlistFinding[] = [];

      if (!prevSnapshot || !st.perTarget[target.id]?.baselineEstablished) {
        // Baseline sweep: no change findings, but record initial exposure
        st.snapshots[target.id] = newSnapshot;
        const hasExposure = data.ports.length > 0 || data.cves.length > 0;
        const details = hasExposure
          ? `Baseline: Open ports [${data.ports.slice(0, 4).join(', ')}]${data.cves.length > 0 ? `, CVEs: ${data.cves.length}` : ''}`
          : 'Baseline established: No exposed ports or known CVEs';

        const runtime: TargetRuntimeState = {
          status: hasExposure ? 'threat_detected' : 'baseline_established',
          baselineEstablished: true,
          lastChecked: now,
          lastError: null,
          threatDetails: details,
        };
        return { findings, runtime };
      }

      // Subsequent sweep: diff against baseline/previous
      const prevPorts = prevSnapshot.ports || [];
      const newPorts = data.ports.filter(p => !prevPorts.includes(p));
      const closedPorts = prevPorts.filter(p => !data.ports.includes(p));

      for (const p of newPorts) {
        findings.push({
          id: deriveDeterministicFindingId(target.id, 'port_opened', String(p)),
          targetId: target.id,
          kind: 'port_opened',
          detail: `New open port detected: ${p}`,
          severity: 'high',
          detectedAt: now,
        });
      }

      for (const p of closedPorts) {
        findings.push({
          id: deriveDeterministicFindingId(target.id, 'port_closed', String(p)),
          targetId: target.id,
          kind: 'port_closed',
          detail: `Port closed: ${p}`,
          severity: 'info',
          detectedAt: now,
        });
      }

      const prevCves = prevSnapshot.cves || [];
      const newCves = data.cves.filter(c => !prevCves.includes(c));
      for (const c of newCves) {
        findings.push({
          id: deriveDeterministicFindingId(target.id, 'cve_detected', c),
          targetId: target.id,
          kind: 'cve_detected',
          detail: `New CVE vulnerability reported: ${c}`,
          severity: 'critical',
          detectedAt: now,
        });
      }

      const prevHostnames = prevSnapshot.hostnames || [];
      const newHostnames = data.hostnames.filter(h => !prevHostnames.includes(h));
      for (const h of newHostnames) {
        findings.push({
          id: deriveDeterministicFindingId(target.id, 'hostname_changed', h),
          targetId: target.id,
          kind: 'hostname_changed',
          detail: `New hostname associated: ${h}`,
          severity: 'low',
          detectedAt: now,
        });
      }

      st.snapshots[target.id] = newSnapshot;
      const isThreat = data.ports.length > 0 || data.cves.length > 0 || newPorts.length > 0 || newCves.length > 0;
      const threatDetails = isThreat
        ? `Open Ports: [${data.ports.slice(0, 4).join(', ')}]${data.cves.length > 0 ? `, CVEs: ${data.cves.slice(0, 3).join(', ')}` : ''}`
        : 'Clean: No exposed ports or CVEs detected';

      const runtime: TargetRuntimeState = {
        status: isThreat ? 'threat_detected' : 'clean',
        baselineEstablished: true,
        lastChecked: now,
        lastError: null,
        threatDetails,
      };

      return { findings, runtime };
    }

    if (target.type === 'domain') {
      const [resA, resMx, resNs] = await Promise.all([
        this.fetchGoogleDnsRecord(target.value, 'A'),
        this.fetchGoogleDnsRecord(target.value, 'MX'),
        this.fetchGoogleDnsRecord(target.value, 'NS'),
      ]);

      const rdapExpiry = await this.fetchRdapExpiry(target.value, st);

      // Determine DNS outcome
      let overallDnsStatus: DomainSnapshot['dnsStatus'] = 'NOERROR';
      if (resA.status === 'NXDOMAIN') {
        overallDnsStatus = 'NXDOMAIN';
      } else if (resA.status === 'NODATA' && resMx.status === 'NODATA' && resNs.status === 'NODATA') {
        overallDnsStatus = 'NODATA';
      }

      const newSnapshot: DomainSnapshot = {
        type: 'domain',
        domain: target.value,
        dnsStatus: overallDnsStatus,
        records: {
          a: resA.answers,
          mx: resMx.answers,
          ns: resNs.answers,
        },
        rdapExpiry,
        lastSweptAt: now,
      };

      const prevSnapshot = st.snapshots[target.id] as DomainSnapshot | undefined;
      const findings: WatchlistFinding[] = [];

      // Check Expiry within 30 days
      let daysUntilExpiry: number | null = null;
      if (rdapExpiry) {
        const expiryMs = new Date(rdapExpiry).getTime();
        if (!isNaN(expiryMs)) {
          daysUntilExpiry = Math.ceil((expiryMs - now) / (24 * 60 * 60 * 1000));
        }
      }

      if (!prevSnapshot || !st.perTarget[target.id]?.baselineEstablished) {
        // Baseline sweep
        st.snapshots[target.id] = newSnapshot;
        let isExpiringSoon = false;
        let details = `Baseline: DNS A [${resA.answers.join(', ')}]`;
        if (daysUntilExpiry !== null && daysUntilExpiry <= 30 && daysUntilExpiry >= 0) {
          isExpiringSoon = true;
          details += ` — Domain expires in ${daysUntilExpiry} days`;
        }

        const runtime: TargetRuntimeState = {
          status: isExpiringSoon ? 'threat_detected' : 'baseline_established',
          baselineEstablished: true,
          lastChecked: now,
          lastError: null,
          threatDetails: details,
        };
        return { findings, runtime };
      }

      // Subsequent sweep diffing
      const prevRecords = prevSnapshot.records || { a: [], mx: [], ns: [] };

      // A records diff
      if (JSON.stringify(prevRecords.a) !== JSON.stringify(resA.answers)) {
        findings.push({
          id: deriveDeterministicFindingId(target.id, 'dns_a_changed', resA.answers.join(',')),
          targetId: target.id,
          kind: 'dns_a_changed',
          detail: `A record changed from [${prevRecords.a.join(', ')}] to [${resA.answers.join(', ')}]`,
          severity: 'medium',
          detectedAt: now,
        });
      }

      // MX records diff
      if (JSON.stringify(prevRecords.mx) !== JSON.stringify(resMx.answers)) {
        findings.push({
          id: deriveDeterministicFindingId(target.id, 'dns_mx_changed', resMx.answers.join(',')),
          targetId: target.id,
          kind: 'dns_mx_changed',
          detail: `MX record changed from [${prevRecords.mx.join(', ')}] to [${resMx.answers.join(', ')}]`,
          severity: 'medium',
          detectedAt: now,
        });
      }

      // NS records diff
      if (JSON.stringify(prevRecords.ns) !== JSON.stringify(resNs.answers)) {
        findings.push({
          id: deriveDeterministicFindingId(target.id, 'dns_ns_changed', resNs.answers.join(',')),
          targetId: target.id,
          kind: 'dns_ns_changed',
          detail: `NS record changed from [${prevRecords.ns.join(', ')}] to [${resNs.answers.join(', ')}]`,
          severity: 'high',
          detectedAt: now,
        });
      }

      // Expiry within 30 days finding
      if (daysUntilExpiry !== null && daysUntilExpiry <= 30 && daysUntilExpiry >= 0) {
        findings.push({
          id: deriveDeterministicFindingId(target.id, 'domain_expiring', `${daysUntilExpiry}d`),
          targetId: target.id,
          kind: 'domain_expiring',
          detail: `Domain expires in ${daysUntilExpiry} days (${rdapExpiry})`,
          severity: 'high',
          detectedAt: now,
        });
      }

      // Resolution loss: Require 2 consecutive sweeps before emitting finding
      if (overallDnsStatus === 'NXDOMAIN' || overallDnsStatus === 'NODATA') {
        target.consecutiveResolutionFailures = (target.consecutiveResolutionFailures || 0) + 1;
        if (target.consecutiveResolutionFailures >= 2 && prevSnapshot.dnsStatus === 'NOERROR') {
          findings.push({
            id: deriveDeterministicFindingId(target.id, 'resolution_lost', overallDnsStatus),
            targetId: target.id,
            kind: 'resolution_lost',
            detail: `Confirmed DNS resolution failure (${overallDnsStatus}) across consecutive sweeps`,
            severity: 'high',
            detectedAt: now,
          });
        }
      } else if (overallDnsStatus === 'NOERROR') {
        target.consecutiveResolutionFailures = 0;
      }

      st.snapshots[target.id] = newSnapshot;
      const isThreat =
        (daysUntilExpiry !== null && daysUntilExpiry <= 30) ||
        (target.consecutiveResolutionFailures || 0) >= 2 ||
        findings.some(f => f.severity === 'high' || f.severity === 'critical');

      const threatDetails = isThreat
        ? (daysUntilExpiry !== null && daysUntilExpiry <= 30
            ? `Domain expiring in ${daysUntilExpiry} days`
            : overallDnsStatus !== 'NOERROR'
            ? `DNS resolution failure (${overallDnsStatus})`
            : `DNS infrastructure updated: A [${resA.answers.join(', ')}]`)
        : `Clean: DNS active (${resA.answers.length} A records)`;

      const runtime: TargetRuntimeState = {
        status: isThreat ? 'threat_detected' : 'clean',
        baselineEstablished: true,
        lastChecked: now,
        lastError: null,
        threatDetails,
      };

      return { findings, runtime };
    }

    // Default for non-schedulable types (email, phone)
    const runtime: TargetRuntimeState = {
      status: target.type === 'email' ? 'on_demand' : 'unsupported',
      baselineEstablished: false,
      lastChecked: null,
      lastError: null,
    };
    return { findings: [], runtime };
  }

  // ─── Batched Sweep Execution ───

  private async executeSweepBatch(st: WatchlistStoredState, isImmediate: boolean = false): Promise<number> {
    const now = Date.now();
    const schedulableTargets = st.targets.filter(t => {
      const isSchedulableType = t.type === 'ip' || t.type === 'domain';
      const isLeaseActive = now - t.lastConfirmedAt <= LEASE_DURATION_MS;
      if (!isSchedulableType) return false;
      if (!isLeaseActive) {
        st.perTarget[t.id] = {
          status: 'stale_unconfirmed',
          baselineEstablished: st.perTarget[t.id]?.baselineEstablished || false,
          lastChecked: st.perTarget[t.id]?.lastChecked || null,
          lastError: 'Target inactive for > 30 days without sync confirmation',
        };
        return false;
      }
      return true;
    });

    if (schedulableTargets.length === 0) {
      st.cursor = 0;
      st.sweepInProgress = false;
      await this.saveState(st);
      await this.armNextAlarm(st);
      return 0;
    }

    // Determine targets due for sweep
    let targetsToSweep = schedulableTargets;
    if (!isImmediate) {
      targetsToSweep = schedulableTargets.filter(t => {
        if (t.nextAttemptAt && t.nextAttemptAt > now) {
          return false; // In backoff
        }
        return t.nextDueAt <= now;
      });
    }

    if (targetsToSweep.length === 0) {
      st.cursor = 0;
      st.sweepInProgress = false;
      await this.saveState(st);
      await this.armNextAlarm(st);
      return 0;
    }

    // Resume from cursor
    let startIndex = st.cursor;
    if (startIndex >= targetsToSweep.length) {
      startIndex = 0;
      st.cursor = 0;
    }

    const batch = targetsToSweep.slice(startIndex, startIndex + MAX_SUBREQUEST_TARGET_BATCH);
    let sweptInThisBatch = 0;

    for (const target of batch) {
      try {
        const { findings, runtime } = await this.sweepTarget(target, st);
        st.perTarget[target.id] = runtime;

        // Merge findings idempotently, capped at MAX_FINDINGS
        if (findings.length > 0) {
          const existingIds = new Set(st.findings.map(f => f.id));
          const newUniqueFindings = findings.filter(f => !existingIds.has(f.id));
          st.findings = [...newUniqueFindings, ...st.findings].slice(0, MAX_FINDINGS);
        }

        target.failureCount = 0;
        target.nextAttemptAt = undefined;
        target.nextDueAt = computeNextDueTime(target.frequency, target.scheduleTime, target.scheduleDay, now);
        sweptInThisBatch += 1;
      } catch (err: any) {
        // Target failed: record error, backoff, and ALWAYS advance cursor
        const errMsg = String(err?.message || 'Upstream lookup error').slice(0, MAX_ERROR_LENGTH);
        target.failureCount = (target.failureCount || 0) + 1;
        const backoffMs = Math.min(24 * 60 * 60 * 1000, 60_000 * Math.pow(2, Math.min(target.failureCount, 10)));
        target.nextAttemptAt = now + backoffMs;

        st.perTarget[target.id] = {
          status: st.perTarget[target.id]?.status || 'evaluating',
          baselineEstablished: st.perTarget[target.id]?.baselineEstablished || false,
          lastChecked: st.perTarget[target.id]?.lastChecked || null,
          lastError: errMsg,
          threatDetails: st.perTarget[target.id]?.threatDetails,
        };
      }

      // Checkpoint state after each target
      st.cursor += 1;
      await this.saveState(st);
    }

    const nextIndex = st.cursor;
    if (nextIndex < targetsToSweep.length) {
      // More targets remain in this sweep run: schedule next slice in 2s with fresh subrequest budget
      await this.state.storage.setAlarm(Date.now() + 2000);
    } else {
      // Finished all targets in this sweep run
      st.cursor = 0;
      st.lastSweptAt = Date.now();
      st.sweepInProgress = false;
      await this.saveState(st);
      await this.armNextAlarm(st);
    }

    return sweptInThisBatch;
  }

  // ─── Durable Object Alarm Handler ───

  async alarm(): Promise<void> {
    try {
      const st = await this.loadState();
      st.sweepInProgress = true;
      await this.saveState(st);

      await this.executeSweepBatch(st, false);
    } catch (err) {
      // Alarm handlers must never throw uncaught exceptions to prevent schedule termination
      console.error('WatchlistMonitor alarm execution error:', err);
      try {
        const st = await this.loadState();
        st.sweepInProgress = false;
        st.cursor = 0;
        await this.saveState(st);
        await this.armNextAlarm(st);
      } catch (recoveryErr) {
        console.error('WatchlistMonitor recovery error:', recoveryErr);
      }
    }
  }

  // ─── Public RPC Methods ───

  async sync(targetsInput: SyncTargetInput[], clientRevision: number, userTier: string = 'free'): Promise<SyncResult> {
    const tierLimit = WATCHLIST_TIER_LIMITS[userTier] || WATCHLIST_TIER_LIMITS.free;

    if (!Array.isArray(targetsInput)) {
      return { ok: false, error: 'INVALID_INPUT', message: 'Targets must be an array' };
    }

    if (typeof clientRevision !== 'number' || clientRevision < 1) {
      return { ok: false, error: 'INVALID_REVISION', message: 'Revision must be a positive integer' };
    }

    if (targetsInput.length > tierLimit) {
      return {
        ok: false,
        error: 'TARGET_LIMIT_EXCEEDED',
        message: `Watchlist target limit exceeded for tier '${userTier}' (max ${tierLimit} targets).`,
        limit: tierLimit,
      };
    }

    const st = await this.loadState();

    // Reject stale revisions (monotonic sequence)
    if (clientRevision <= st.revision) {
      return {
        ok: false,
        error: 'STALE_REVISION',
        message: `Stale revision ${clientRevision}. Current accepted revision is ${st.revision}.`,
        revision: st.revision,
      };
    }

    const now = Date.now();
    const validatedTargets: WatchlistTargetRecord[] = [];
    const seenValues = new Set<string>();

    for (let i = 0; i < targetsInput.length; i++) {
      const item = targetsInput[i];
      const validCanonical = canonicalizeValue(item.type, item.value);
      if (!validCanonical.ok) {
        return {
          ok: false,
          error: 'INVALID_TARGET_VALUE',
          message: `Target [${i}] ${item.type} error: ${validCanonical.error}`,
        };
      }

      const dedupeKey = `${item.type}:${validCanonical.value}`;
      if (seenValues.has(dedupeKey)) {
        return {
          ok: false,
          error: 'DUPLICATE_TARGET',
          message: `Duplicate target in request: ${validCanonical.value}`,
        };
      }
      seenValues.add(dedupeKey);

      const targetId = item.id || `tgt_${i}_${Date.now()}`;
      const existing = st.targets.find(t => t.id === targetId || (t.type === item.type && t.value === validCanonical.value));

      const frequency = item.frequency === 'weekly' ? 'weekly' : 'daily';

      validatedTargets.push({
        id: targetId,
        type: item.type,
        value: validCanonical.value,
        frequency,
        scheduleTime: item.scheduleTime || '12:00',
        scheduleDay: item.scheduleDay || 'Monday',
        nextDueAt: existing ? existing.nextDueAt : computeNextDueTime(frequency, item.scheduleTime, item.scheduleDay, now),
        nextAttemptAt: existing ? existing.nextAttemptAt : undefined,
        failureCount: existing ? existing.failureCount : 0,
        lastConfirmedAt: now, // refresh lease
        consecutiveResolutionFailures: existing ? existing.consecutiveResolutionFailures : 0,
      });

      // Maintain runtime state
      if (!st.perTarget[targetId]) {
        st.perTarget[targetId] = {
          status: item.type === 'email' ? 'on_demand' : item.type === 'phone' ? 'unsupported' : 'evaluating',
          baselineEstablished: false,
          lastChecked: null,
          lastError: null,
        };
      }
    }

    // Clean up deleted targets' runtime/snapshots
    const currentTargetIds = new Set(validatedTargets.map(t => t.id));
    for (const oldId of Object.keys(st.perTarget)) {
      if (!currentTargetIds.has(oldId)) {
        delete st.perTarget[oldId];
        delete st.snapshots[oldId];
      }
    }

    st.targets = validatedTargets;
    st.revision = clientRevision;
    st.cursor = 0;
    await this.saveState(st);

    await this.armNextAlarm(st);

    return {
      ok: true,
      revision: st.revision,
      targetCount: st.targets.length,
    };
  }

  async getState(): Promise<WatchlistStateResponse> {
    const st = await this.loadState();
    const now = Date.now();

    const targets = st.targets.map(t => {
      const isLeaseActive = now - t.lastConfirmedAt <= LEASE_DURATION_MS;
      const rt = st.perTarget[t.id] || {
        status: t.type === 'email' ? 'on_demand' : t.type === 'phone' ? 'unsupported' : 'evaluating',
        baselineEstablished: false,
        lastChecked: null,
        lastError: null,
      };

      const effectiveStatus = !isLeaseActive && (t.type === 'ip' || t.type === 'domain') ? 'stale_unconfirmed' : rt.status;

      return {
        id: t.id,
        type: t.type,
        value: t.value,
        frequency: t.frequency,
        scheduleTime: t.scheduleTime,
        scheduleDay: t.scheduleDay,
        nextDueAt: t.nextDueAt,
        status: effectiveStatus,
        baselineEstablished: rt.baselineEstablished,
        lastChecked: rt.lastChecked,
        lastError: rt.lastError,
        threatDetails: rt.threatDetails,
        lastConfirmedAt: t.lastConfirmedAt,
      };
    });

    return {
      revision: st.revision,
      lastSweptAt: st.lastSweptAt,
      sweepInProgress: st.sweepInProgress,
      targets,
      findings: st.findings,
    };
  }

  async sweepNow(): Promise<SweepResult> {
    const st = await this.loadState();
    if (st.sweepInProgress) {
      return {
        ok: false,
        error: 'SWEEP_IN_PROGRESS',
        message: 'A watchlist sweep is already in progress.',
      };
    }

    st.sweepInProgress = true;
    st.cursor = 0;
    await this.saveState(st);

    try {
      const sweptCount = await this.executeSweepBatch(st, true);
      const updated = await this.loadState();
      return {
        ok: true,
        sweptCount,
        findingsCount: updated.findings.length,
        lastSweptAt: updated.lastSweptAt || Date.now(),
      };
    } catch (err: any) {
      st.sweepInProgress = false;
      await this.saveState(st);
      return {
        ok: false,
        error: 'SWEEP_FAILED',
        message: err?.message || 'Sweep execution encountered an error.',
      };
    }
  }

  // ─── Fetch Fallback Routing ───

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const pathname = url.pathname.replace(/\/+$/, '') || '/';

    if (pathname === '/sync' && request.method === 'POST') {
      try {
        const body = (await request.json()) as { targets: SyncTargetInput[]; revision: number; tier?: string };
        const result = await this.sync(body.targets, body.revision, body.tier);
        const status = result.ok ? 200 : result.error === 'STALE_REVISION' ? 409 : 400;
        return new Response(JSON.stringify(result), {
          status,
          headers: { 'Content-Type': 'application/json' },
        });
      } catch {
        return new Response(JSON.stringify({ ok: false, error: 'INVALID_REQUEST' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    if (pathname === '/state' && request.method === 'GET') {
      const result = await this.getState();
      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (pathname === '/sweep-now' && request.method === 'POST') {
      const result = await this.sweepNow();
      const status = result.ok ? 200 : result.error === 'SWEEP_IN_PROGRESS' ? 409 : 500;
      return new Response(JSON.stringify(result), {
        status,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response('Not Found', { status: 404 });
  }
}
