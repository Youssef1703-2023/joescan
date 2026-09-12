import { useCallback, useEffect, useRef, useState } from 'react';
import { loadAdminSection, requireAdministrator, SETTING_DEFAULTS, type AdminSection, type AdminRecord, type AdminSettings } from '../lib/adminControl';
export type AdminData = Record<Exclude<AdminSection, 'settings'>, AdminRecord[]> & { settings: AdminSettings };
const empty: AdminData = { users: [], bans: [], requests: [], claims: [], tickets: [], promos: [], activity: [], settings: SETTING_DEFAULTS, announcements: [] };
export function useAdminCenter() {
  const [data, setData] = useState<AdminData>(empty);
  const [errors, setErrors] = useState<Partial<Record<AdminSection, string>>>({});
  const [loading, setLoading] = useState(true);
  const [accessError, setAccessError] = useState('');
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const mounted = useRef(false); const generation = useRef(0);
  const refresh = useCallback(async () => {
    const request = ++generation.current; setLoading(true);
    try {
      await requireAdministrator();
      if (!mounted.current || request !== generation.current) return;
      setAccessError('');
      const sections = Object.keys(empty) as AdminSection[];
      const responses = await Promise.allSettled(sections.map(loadAdminSection));
      if (!mounted.current || request !== generation.current) return;
      const next = { ...empty }; const failures: Partial<Record<AdminSection, string>> = {};
      responses.forEach((result, i) => {
        if (result.status === 'fulfilled') (next as any)[sections[i]] = result.value;
        else failures[sections[i]] = result.reason?.code === 'permission-denied' ? 'Access denied. Refresh your administrator session.' : 'Data could not be loaded. Please retry.';
      });
      setData(next); setErrors(failures); setUpdatedAt(new Date());
    } catch (err) {
      if (mounted.current && request === generation.current) { setData(empty); setAccessError(err instanceof Error ? err.message : 'Unable to verify administrator access.'); }
    } finally { if (mounted.current && request === generation.current) setLoading(false); }
  }, []);
  useEffect(() => { mounted.current = true; void refresh(); return () => { mounted.current = false; generation.current++; }; }, [refresh]);
  return { data, errors, loading, accessError, updatedAt, refresh };
}
