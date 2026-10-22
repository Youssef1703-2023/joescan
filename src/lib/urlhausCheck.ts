export const URLHAUS_ENDPOINT = 'https://urlhaus-api.abuse.ch/v1/host/';
export const URLHAUS_URL_ENDPOINT = 'https://urlhaus-api.abuse.ch/v1/url/';
export const URLHAUS_TIMEOUT_MS = 15_000;

export type UrlhausState = 'match' | 'no_match' | 'unavailable';
export type UrlVerdict = 'safe' | 'suspicious' | 'dangerous' | 'incomplete';

export interface UrlhausResult {
  state: UrlhausState;
  threat?: string;
  tags: string[];
  dateAdded?: string;
}

export interface UrlhausPresentation {
  status: 'pass' | 'fail' | 'unknown';
  severity: number;
  detail: string;
  detailAr: string;
  persisted: 'MATCH' | 'NO MATCH' | 'UNAVAILABLE';
}

const unavailable = (): UrlhausResult => ({ state: 'unavailable', tags: [] });

function cleanStrings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    .map((item) => item.trim());
}

/** Map a parsed URLhaus body (/v1/host/ or /v1/url/) to match, confirmed no_results, or unavailable. */
export function interpretUrlhausBody(body: unknown): UrlhausResult {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return unavailable();
  const data = body as Record<string, unknown>;
  const urls = data.urls;
  const hasUrls = Array.isArray(urls) && urls.length > 0;
  const hasTopLevelUrlMatch =
    (typeof data.url_status === 'string' && data.url_status.trim().length > 0) ||
    (typeof data.threat === 'string' && data.threat.trim().length > 0) ||
    (typeof data.date_added === 'string' && data.date_added.trim().length > 0) ||
    (typeof data.id === 'string' && data.id.trim().length > 0) ||
    typeof data.id === 'number';

  if (data.query_status === 'no_results') {
    return hasUrls || hasTopLevelUrlMatch ? unavailable() : { state: 'no_match', tags: [] };
  }
  if (data.query_status !== 'ok') return unavailable();

  if (hasUrls && Array.isArray(urls)) {
    const latest = urls[0];
    if (!latest || typeof latest !== 'object' || Array.isArray(latest)) return unavailable();
    const record = latest as Record<string, unknown>;
    const threat = typeof record.threat === 'string' && record.threat.trim() ? record.threat.trim() : undefined;
    const dateAdded = typeof record.date_added === 'string' && record.date_added.trim() ? record.date_added.trim() : undefined;
    const tags = cleanStrings(data.tags).length > 0 ? cleanStrings(data.tags) : cleanStrings(record.tags);
    return { state: 'match', threat, tags, dateAdded };
  }

  if (urls === undefined && hasTopLevelUrlMatch) {
    const threat = typeof data.threat === 'string' && data.threat.trim() ? data.threat.trim() : undefined;
    const dateAdded = typeof data.date_added === 'string' && data.date_added.trim() ? data.date_added.trim() : undefined;
    const tags = cleanStrings(data.tags);
    return { state: 'match', threat, tags, dateAdded };
  }

  return unavailable();
}

/**
 * Query URLhaus. HTTP errors, timeouts, network failures, and unusable payloads
 * are unavailable. They are never converted into a confirmed non-match.
 */
type UrlhausResponse = {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
};

export async function queryUrlhaus(
  hostname: string,
  fetchImpl: (input: string, init?: RequestInit) => Promise<UrlhausResponse> = globalThis.fetch,
  timeoutMs = URLHAUS_TIMEOUT_MS,
): Promise<UrlhausResult> {
  if (!hostname.trim()) return unavailable();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(URLHAUS_ENDPOINT, {
      method: 'POST',
      headers: { Accept: 'application/json' },
      body: new URLSearchParams({ host: hostname }),
      signal: controller.signal,
    });
    if (!response.ok) return unavailable();
    try {
      return interpretUrlhausBody(await response.json());
    } catch {
      return unavailable();
    }
  } catch {
    return unavailable();
  } finally {
    clearTimeout(timer);
  }
}

export async function queryUrlhausUrl(
  url: string,
  fetchImpl: (input: string, init?: RequestInit) => Promise<UrlhausResponse> = globalThis.fetch,
  timeoutMs = URLHAUS_TIMEOUT_MS,
): Promise<UrlhausResult> {
  const trimmed = url.trim();
  if (!trimmed) return unavailable();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(URLHAUS_URL_ENDPOINT, {
      method: 'POST',
      headers: { Accept: 'application/json' },
      body: new URLSearchParams({ url: trimmed }),
      signal: controller.signal,
    });
    if (!response.ok) return unavailable();
    try {
      return interpretUrlhausBody(await response.json());
    } catch {
      return unavailable();
    }
  } catch {
    return unavailable();
  } finally {
    clearTimeout(timer);
  }
}

export function combineUrlhausResults(hostResult: UrlhausResult, urlResult: UrlhausResult): UrlhausResult {
  if (urlResult.state === 'match' || hostResult.state === 'match') {
    const primary = urlResult.state === 'match' ? urlResult : hostResult;
    const secondary = urlResult.state === 'match' ? hostResult : urlResult;
    const mergedTags = Array.from(new Set([...primary.tags, ...(secondary.state === 'match' ? secondary.tags : [])]));
    return {
      state: 'match',
      threat: primary.threat ?? (secondary.state === 'match' ? secondary.threat : undefined),
      dateAdded: primary.dateAdded ?? (secondary.state === 'match' ? secondary.dateAdded : undefined),
      tags: mergedTags,
    };
  }
  if (hostResult.state === 'no_match' && urlResult.state === 'no_match') {
    return { state: 'no_match', tags: [] };
  }
  return unavailable();
}

export function presentUrlhaus(result: UrlhausResult): UrlhausPresentation {
  if (result.state === 'match') {
    const threat = result.threat ? ` Threat type: "${result.threat}".` : ' The response did not include a threat type.';
    const tags = result.tags.length ? ` Tags: ${result.tags.join(', ')}.` : '';
    const date = result.dateAdded ? ` First reported: ${result.dateAdded}.` : '';
    const threatAr = result.threat ? ` نوع التهديد: "${result.threat}".` : ' لم تتضمن الاستجابة نوع التهديد.';
    const tagsAr = result.tags.length ? ` الوسوم: ${result.tags.join(', ')}.` : '';
    return {
      status: 'fail',
      severity: 30,
      persisted: 'MATCH',
      detail: `MATCH FOUND — URLhaus reports this host.${threat}${tags}${date}`,
      detailAr: `تم العثور على تطابق — أبلغت URLhaus عن هذا النطاق.${threatAr}${tagsAr}`,
    };
  }
  if (result.state === 'no_match') {
    return {
      status: 'pass',
      severity: 0,
      persisted: 'NO MATCH',
      detail: 'URLhaus returned query_status no_results for this host. This is a confirmed non-match from URLhaus only.',
      detailAr: 'أعادت URLhaus الحالة no_results لهذا النطاق. هذا عدم تطابق مؤكد من URLhaus فقط.',
    };
  }
  return {
    status: 'unknown',
    severity: 0,
    persisted: 'UNAVAILABLE',
    detail: 'URLhaus is unavailable. The provider returned an HTTP error, timed out, failed on the network, or sent an unusable response. This is not evidence that the host is safe.',
    detailAr: 'فحص URLhaus غير متاح. أعاد المصدر خطأ أو انتهت المهلة أو فشل الاتصال أو أرسل استجابة غير صالحة. هذه ليست دليلاً على أن النطاق آمن.',
  };
}

export function urlScanVerdict(riskScore: number, urlhaus: UrlhausState): UrlVerdict {
  const score = Number.isFinite(riskScore) ? Math.max(0, riskScore) : 0;
  if (score >= 50) return 'dangerous';
  if (score >= 20) return 'suspicious';
  if (urlhaus === 'match') return 'suspicious';
  if (urlhaus !== 'no_match') return 'incomplete';
  return 'safe';
}

export function urlRiskLevel(verdict: UrlVerdict): 'High' | 'Medium' | 'Low' | 'Unknown' {
  if (verdict === 'dangerous') return 'High';
  if (verdict === 'suspicious') return 'Medium';
  if (verdict === 'incomplete') return 'Unknown';
  return 'Low';
}

/** Incomplete checks do not receive a reassuring numeric score. */
export function urlSecurityScore(verdict: UrlVerdict, riskScore: number): number | null {
  if (verdict === 'incomplete') return null;
  const score = Number.isFinite(riskScore) ? riskScore : 0;
  return Math.max(0, Math.min(100, 100 - score));
}

export function urlVerdictCopy(verdict: UrlVerdict): { label: string; labelAr: string; desc: string; descAr: string } {
  switch (verdict) {
    case 'safe':
      return {
        label: 'SAFE',
        labelAr: 'آمن',
        desc: 'No threats detected. This URL appears safe based on our analysis.',
        descAr: 'لم يتم اكتشاف تهديدات. هذا الرابط يبدو آمناً بناءً على فحوصاتنا.',
      };
    case 'suspicious':
      return {
        label: 'SUSPICIOUS',
        labelAr: 'مشبوه',
        desc: 'Suspicious indicators detected. Exercise caution and verify this URL before submitting any data.',
        descAr: 'تم اكتشاف عوامل مشبوهة. توخَّ الحذر وتحقق من الرابط قبل إدخال أي بيانات.',
      };
    case 'dangerous':
      return {
        label: 'DANGEROUS',
        labelAr: 'خطير',
        desc: '⚠️ Critical threats detected! Do NOT enter personal data or download files from this URL.',
        descAr: '⚠️ تم اكتشاف تهديدات خطيرة! لا تدخل أي بيانات شخصية ولا تحمّل أي ملفات من هذا الرابط.',
      };
    default:
      return {
        label: 'INCOMPLETE',
        labelAr: 'غير مكتمل',
        desc: 'Assessment incomplete. URLhaus did not finish, so this result is unknown.',
        descAr: 'التقييم غير مكتمل. لم ينته فحص URLhaus، لذلك هذه النتيجة غير معروفة.',
      };
  }
}
