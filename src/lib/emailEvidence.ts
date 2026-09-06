import type { EmailBreach } from './emailExposure';
export interface ExtraExposure { source: string; matchedRecords: number; sources: {name: string; date: string}[]; fields: string[]; checkedAt: string }
export interface Evidence { provider: string; name: string; date: string; categories?: string; description?: string; recordCount?: string }
export interface EvidenceGroup { name: string; evidence: Evidence[] }
const normalize = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');
// Group identical names with compatible known dates; never infer aliases.
export function groupEmailEvidence(primary: EmailBreach[], extra: ExtraExposure | null): EvidenceGroup[] {
  const rows: Evidence[] = primary.map(b => ({provider:'XposedOrNot', ...b, categories:b.dataExposed}));
  rows.push(...(extra?.sources || []).map(s => ({provider:'LeakCheck Public', ...s})));
  const groups: EvidenceGroup[] = []; const keys = new Map<string, EvidenceGroup>();
  for (const row of rows) {
    const date = row.date.trim();
    const knownDate = /^\d{4}(?:-\d{2}(?:-\d{2})?)?$/.test(date);
    const key = normalize(row.name) + '|' + date;
    const compatible = groups.filter(g => normalize(g.name) === normalize(row.name) && g.evidence.every(e => /^\d{4}(?:-\d{2}(?:-\d{2})?)?$/.test(e.date) && (e.date === date || e.date.startsWith(date+'-') || date.startsWith(e.date+'-'))));
    const existing = knownDate ? keys.get(key) || (compatible.length === 1 ? compatible[0] : undefined) : undefined;
    if (existing) {
      if (!existing.evidence.some(e => JSON.stringify(e) === JSON.stringify(row))) existing.evidence.push(row);
    } else {
      const group = {name:row.name,evidence:[row]}; groups.push(group);
      if (knownDate) keys.set(key,group);
    }
  }
  return groups;
}
export function parseExtraExposure(data: unknown): ExtraExposure {
  const d = data as ExtraExposure;
  if (!d || d.source !== 'LeakCheck Public' || !Number.isSafeInteger(d.matchedRecords) || d.matchedRecords < 0 ||
      !Array.isArray(d.sources) || d.sources.length > 2000 || !Array.isArray(d.fields) || d.fields.length > 100 ||
      typeof d.checkedAt !== 'string' || !Number.isFinite(Date.parse(d.checkedAt)) ||
      d.sources.some(s => !s || typeof s.name !== 'string' || !s.name.trim() || s.name.length > 256 || typeof s.date !== 'string' || s.date.length > 32) ||
      d.fields.some(f => typeof f !== 'string' || f.length > 80) || (d.matchedRecords > 0 && !d.sources.length) || (d.matchedRecords === 0 && d.sources.length > 0)) throw new Error('The provider returned an incomplete response. Please retry.');
  return {source:d.source,matchedRecords:d.matchedRecords,sources:d.sources.map(s=>({name:s.name,date:s.date})),fields:d.fields,checkedAt:d.checkedAt};
}
