import { queryUrlhaus, type UrlhausResult, type UrlhausState } from './urlhausCheck';

export type MessageRiskLevel = 'Low' | 'Medium' | 'High';
export type MessageSignalStatus = 'pass' | 'warn' | 'fail' | 'info' | 'unknown';

export interface MessageSignalCheck {
  id: string;
  name: string;
  nameAr: string;
  status: MessageSignalStatus;
  detail: string;
  detailAr: string;
  weight: number;
}

export interface ExtractedUrlSignal {
  rawUrl: string;
  normalizedUrl: string;
  hostname: string;
  isIp: boolean;
  isPunycode: boolean;
  isShortener: boolean;
  isSuspiciousTld: boolean;
  urlhaus: UrlhausResult;
  dangerous: boolean;
}

export interface LexiconGroupMatch {
  id: string;
  name: string;
  nameAr: string;
  weight: 1 | 2 | 3;
  matchedTerms: string[];
}

export interface MessageSignalsResult {
  extractedUrls: string[];
  urlSignals: ExtractedUrlSignal[];
  lexiconMatches: LexiconGroupMatch[];
  patternScore: number;
  hasHighWeightLexiconHit: boolean;
  urlhausMatch: boolean;
  dangerousUrlSignal: boolean;
  checks: MessageSignalCheck[];
}

export interface CombinedMessageRisk {
  finalRisk: MessageRiskLevel;
  signals: MessageSignalsResult;
  floorApplied: boolean;
}

const SUSPICIOUS_TLDS = new Set([
  'tk', 'ml', 'ga', 'cf', 'gq', 'buzz', 'top', 'xyz', 'work', 'click',
  'link', 'icu', 'cam', 'monster', 'rest', 'boats', 'beauty', 'hair',
  'quest', 'sbs', 'cfd', 'autos', 'wiki', 'zip', 'mov',
]);

const KNOWN_SHORTENERS = new Set([
  'bit.ly', 'tinyurl.com', 't.co', 'goo.gl', 'ow.ly', 'is.gd', 'buff.ly',
  'adf.ly', 'shorte.st', 'cutt.ly', 'rb.gy', 'shorturl.at', 'v.gd',
  'tiny.cc', 'lnkd.in', 'yourls.org', 'rebrand.ly', 'bl.ink',
]);

const COMMON_TLDS = new Set([
  'com', 'org', 'net', 'edu', 'gov', 'mil', 'int', 'io', 'co', 'me', 'ai',
  'app', 'dev', 'info', 'biz', 'online', 'site', 'store', 'tech', 'cloud',
  'eg', 'sa', 'ae', 'uk', 'us', 'de', 'fr', 'es', 'ru', 'tr', 'ca', 'au',
  ...SUSPICIOUS_TLDS,
]);

interface LexiconGroupDef {
  id: string;
  name: string;
  nameAr: string;
  weight: 1 | 2 | 3;
  detailEn: string;
  detailAr: string;
  patterns: RegExp[];
}

export const LEXICON_GROUPS: LexiconGroupDef[] = [
  {
    id: 'credential_verification',
    name: 'Credential / Account Verification Request',
    nameAr: 'طلب بيانات الدخول أو تأكيد الحساب',
    weight: 3,
    detailEn: 'Requests passwords, PINs, OTPs, or urgent account login verification.',
    detailAr: 'يطلب كلمة المرور أو الرقم السري أو رمز التحقق (OTP) أو تسجيل الدخول لتأكيد الحساب.',
    patterns: [
      /\b(?:verify|confirm|validate|reactivate|restore|unlock)\s+(?:your\s+)?(?:account|identity|credentials|password|login|security|bank\s+account)\b/i,
      /\b(?:enter|share|send|provide|confirm)\s+(?:your\s+)?(?:otp|pin|password|passcode|verification\s+code|security\s+code|cvv|2fa)\b/i,
      /\b(?:login|sign\s*in)\s+(?:to\s+)?(?:verify|restore|unlock|confirm|secure)\b/i,
      /(?:تأكيد|تحديث|تفعيل|استعادة|فك\s+حظر)\s+(?:بيانات\s+)?(?:حسابك|الحساب|هويتك|بطاقتك)/i,
      /(?:أدخل|ادخل|إرسال|ارسل|مشاركة|تأكيد)\s+(?:كلمة\s+المرور|الرقم\s+السري|رمز\s+التحقق|كود\s+التفعيل|كود\s+التحقق|الرمز\s+السري|OTP)/i,
    ],
  },
  {
    id: 'gift_cards_crypto',
    name: 'Gift Cards / Crypto Payment Demand',
    nameAr: 'طلب بطاقات هدايا أو عملات رقمية',
    weight: 3,
    detailEn: 'Demands irreversible payment via gift cards, vouchers, or cryptocurrency wallets.',
    detailAr: 'يطلب الدفع عبر بطاقات الهدايا أو القسائم أو محافظ العملات الرقمية المشفرة.',
    patterns: [
      /\b(?:gift\s*card|itunes\s*card|steam\s*card|google\s*play\s*card|amazon\s*card|apple\s*card|prepaid\s*voucher)\b/i,
      /\b(?:bitcoin|btc|usdt|ethereum|crypto\s*wallet|cryptocurrency|wallet\s*address|seed\s*phrase|recovery\s*phrase)\b/i,
      /(?:بطاقة\s+هدايا|بطاقات\s+هدايا|بطاقة\s+آيتونز|ايتونز|جوجل\s+بلاي|ستيم|قسيمة\s+شراء)/i,
      /(?:بيتكوين|عملة\s+مشفرة|عملات\s+رقمية|محفظة\s+رقمية|أيثيريوم|USDT|تعدين)/i,
    ],
  },
  {
    id: 'urgency_threats',
    name: 'Urgency & Suspension Threats',
    nameAr: 'التهديد بإيقاف الحساب والاستعجال',
    weight: 2,
    detailEn: 'Uses artificial time pressure or threats of account suspension/closure to force quick action.',
    detailAr: 'يستخدم ضغط الوقت أو التهديد بتجميد وإغلاق الحساب لدفعك للتصرف بسرعة دون تفكير.',
    patterns: [
      /\b(?:urgent|immediately|immediate\s+action|within\s+\d+\s*hours?|act\s+now|final\s+notice|last\s+warning)\b/i,
      /\b(?:account|card|service)\s+(?:has\s+been\s+|will\s+be\s+|is\s+)?(?:suspended|locked|terminated|frozen|deactivated|restricted|closed)\b/i,
      /\b(?:unauthorized\s+login|suspicious\s+activity\s+detected|security\s+alert)\b/i,
      /(?:عاجل|فوراً|بشكل\s+فوري|خلال\s+\d+\s*ساعة|خلال\s+24\s+ساعة|إشعار\s+نهائي|تحذير\s+أخير)/i,
      /(?:تم\s+إيقاف|سيتم\s+إيقاف|تعليق\s+حسابك|تجميد\s+حسابك|إغلاق\s+حسابك|حظر\s+بطاقتك|نشاط\s+مشبوه)/i,
    ],
  },
  {
    id: 'money_transfer_fees',
    name: 'Money Transfer & Upfront Fees',
    nameAr: 'تحويلات مالية أو رسوم مسبقة',
    weight: 2,
    detailEn: 'Solicits wire transfers, mobile wallet transfers, or advance processing/clearance fees.',
    detailAr: 'يطلب تحويل أموال أو دفع رسوم إدارية أو رسوم تخليص مسبقة.',
    patterns: [
      /\b(?:wire\s+transfer|western\s+union|moneygram|upfront\s+fee|advance\s+fee|processing\s+fee|clearance\s+fee|transfer\s+fee|send\s+money)\b/i,
      /\b(?:vodafone\s+cash|instapay|bank\s+transfer)\b/i,
      /(?:تحويل\s+بنكي|تحويل\s+مالي|ويسترن\s+يونيون|فودافون\s+كاش|انستا\s*باي|رسوم\s+إدارية|رسوم\s+تخليص|دفع\s+مقدم|حول\s+مبلغ)/i,
    ],
  },
  {
    id: 'authority_impersonation',
    name: 'Authority / Brand Impersonation',
    nameAr: 'انتحال صفة جهة رسمية أو بنك',
    weight: 2,
    detailEn: 'Claims to represent a bank, government agency, tax authority, or official security team.',
    detailAr: 'يدعي تمثيل بنك أو جهة حكومية أو مصلحة الضرائب أو فريق الدعم الأمني.',
    patterns: [
      /\b(?:central\s+bank|tax\s+authority|internal\s+revenue|\birs\b|ministry\s+of\s+interior|law\s+enforcement|bank\s+security\s+department|official\s+security\s+team|customer\s+support\s+team)\b/i,
      /(?:البنك\s+المركزي|مصلحة\s+الضرائب|وزارة\s+الداخلية|الشرطة|إدارة\s+أمن\s+البنك|خدمة\s+عملاء\s+البنك|الدعم\s+الفني\s+الرسمي)/i,
    ],
  },
  {
    id: 'prize_lottery',
    name: 'Prize / Lottery Lure',
    nameAr: 'خدعة الجوائز والسحوبات الوهمية',
    weight: 1,
    detailEn: 'Promises unexpected lottery winnings, cash rewards, or free giveaways.',
    detailAr: 'يعد بجوائز مالية غير متوقعة أو الفوز في سحب عشوائي أو هدايا مجانية.',
    patterns: [
      /\b(?:you\s+have\s+won|lottery\s+winner|lucky\s+winner|cash\s+prize|claim\s+your\s+(?:prize|reward)|selected\s+as\s+a\s+winner|free\s+iphone)\b/i,
      /(?:مبروك\s+لقد\s+فزت|مبروك\s+كسبت|فزت\s+بجائزة|جائزة\s+مالية|سحب\s+عشوائي|استلم\s+جائزتك|الفائز\s+المحظوظ)/i,
    ],
  },
  {
    id: 'delivery_customs',
    name: 'Delivery / Customs Scam',
    nameAr: 'خدعة الشحنات والرسوم الجمركية',
    weight: 1,
    detailEn: 'Claims a parcel or shipment is detained pending address confirmation or customs fees.',
    detailAr: 'يدعي تعليق شحنة أو طرد بريدي لحين تأكيد العنوان أو سداد رسوم جمركية.',
    patterns: [
      /\b(?:package\s+(?:is\s+)?on\s+hold|delivery\s+(?:attempt\s+)?failed|customs\s+fee|shipping\s+fee|parcel\s+detained|undelivered\s+package|confirm\s+delivery\s+address)\b/i,
      /(?:شحنتك\s+معلقة|تعذر\s+تسليم\s+الشحنة|رسوم\s+جمركية|رسوم\s+الشحن|طرد\s+بريدي|تأكيد\s+عنوان\s+التسليم)/i,
    ],
  },
];

function stripTrailingPunctuation(token: string): string {
  return token.replace(/[.,!?;:)'"\]}>،؛؟]+$/g, '').replace(/^[<([{"']+/, '');
}

export function isIpHostname(hostname: string): boolean {
  const clean = hostname.trim().replace(/^\[|\]$/g, '');
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(clean)) {
    return clean.split('.').every((octet) => {
      const n = Number(octet);
      return n >= 0 && n <= 255;
    });
  }
  return false;
}

export function isPunycode(hostname: string): boolean {
  const lower = hostname.trim().toLowerCase();
  return lower.startsWith('xn--') || lower.includes('.xn--');
}

export function isKnownShortener(hostname: string): boolean {
  const lower = hostname.trim().toLowerCase().replace(/^www\./, '');
  return KNOWN_SHORTENERS.has(lower);
}

export function isSuspiciousTld(hostname: string): boolean {
  if (isIpHostname(hostname)) return false;
  const parts = hostname.trim().toLowerCase().split('.');
  if (parts.length < 2) return false;
  const tld = parts[parts.length - 1];
  return SUSPICIOUS_TLDS.has(tld);
}

export function extractUrls(text: string): string[] {
  if (!text || !text.trim()) return [];

  // Mask out email addresses first so user@domain.com is not treated as a bare domain URL
  const maskedText = text.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, ' ');

  const pattern =
    /\b(?:https?:\/\/[^\s<>"{}|\\^`[\]]+|(?:(?:\d{1,3}\.){3}\d{1,3}|(?:[a-zA-Z0-9-]+\.)+(?:xn--[a-zA-Z0-9]+|[a-zA-Z]{2,15}))(?::\d{2,5})?(?:\/[^\s<>"{}|\\^`[\]]*)?)/gi;

  const matches = maskedText.match(pattern) || [];
  const results: string[] = [];
  const seen = new Set<string>();

  for (const raw of matches) {
    const cleaned = stripTrailingPunctuation(raw.trim());
    if (!cleaned) continue;

    const hasScheme = /^https?:\/\//i.test(cleaned);
    const candidateUrl = hasScheme ? cleaned : `http://${cleaned}`;

    let parsed: URL;
    try {
      parsed = new URL(candidateUrl);
    } catch {
      continue;
    }

    const host = parsed.hostname.toLowerCase();
    if (!host) continue;

    if (!hasScheme && !isIpHostname(host) && !isPunycode(host) && !isKnownShortener(host)) {
      const parts = host.split('.');
      const tld = parts[parts.length - 1] || '';
      const hasPath = parsed.pathname && parsed.pathname !== '/';
      if (!COMMON_TLDS.has(tld) && !hasPath) {
        continue;
      }
    }

    const dedupeKey = cleaned.toLowerCase();
    if (!seen.has(dedupeKey)) {
      seen.add(dedupeKey);
      results.push(cleaned);
    }
  }

  return results;
}

export function evaluateLexicon(text: string): LexiconGroupMatch[] {
  if (!text || !text.trim()) return [];

  const matches: LexiconGroupMatch[] = [];
  for (const group of LEXICON_GROUPS) {
    const matchedTerms: string[] = [];
    for (const regex of group.patterns) {
      const m = text.match(regex);
      if (m && m[0]) {
        matchedTerms.push(m[0].trim());
      }
    }
    if (matchedTerms.length > 0) {
      matches.push({
        id: group.id,
        name: group.name,
        nameAr: group.nameAr,
        weight: group.weight,
        matchedTerms,
      });
    }
  }
  return matches;
}

export function buildMessageSignals(
  text: string,
  urlhausByHost: Record<string, UrlhausResult> = {},
): MessageSignalsResult {
  const extractedUrls = extractUrls(text);
  const lexiconMatches = evaluateLexicon(text);
  const hasHighWeightLexiconHit = lexiconMatches.some((m) => m.weight === 3);

  let patternScore = lexiconMatches.reduce((sum, m) => sum + m.weight, 0);
  let urlhausMatch = false;
  let dangerousUrlSignal = false;
  let shortenerWarningAdded = false;
  let suspiciousTldWarningAdded = false;

  const urlSignals: ExtractedUrlSignal[] = [];

  for (const rawUrl of extractedUrls) {
    const normalizedUrl = /^https?:\/\//i.test(rawUrl) ? rawUrl : `http://${rawUrl}`;
    let hostname = '';
    try {
      hostname = new URL(normalizedUrl).hostname.toLowerCase();
    } catch {
      continue;
    }

    const isIp = isIpHostname(hostname);
    const puny = isPunycode(hostname);
    const shortener = isKnownShortener(hostname);
    const susTld = isSuspiciousTld(hostname);
    const urlhaus = urlhausByHost[hostname] ?? { state: 'no_match' as UrlhausState, tags: [] };

    if (urlhaus.state === 'match') {
      urlhausMatch = true;
    }

    const isDangerousHeuristics =
      isIp ||
      puny ||
      (hasHighWeightLexiconHit && (shortener || susTld));

    if (isDangerousHeuristics) {
      dangerousUrlSignal = true;
    } else {
      if (shortener && !shortenerWarningAdded) {
        patternScore += 1;
        shortenerWarningAdded = true;
      }
      if (susTld && !suspiciousTldWarningAdded) {
        patternScore += 1;
        suspiciousTldWarningAdded = true;
      }
    }

    urlSignals.push({
      rawUrl,
      normalizedUrl,
      hostname,
      isIp,
      isPunycode: puny,
      isShortener: shortener,
      isSuspiciousTld: susTld,
      urlhaus,
      dangerous: isDangerousHeuristics || urlhaus.state === 'match',
    });
  }

  const checks: MessageSignalCheck[] = [];

  // 1. URL Extraction & Heuristics check
  if (urlSignals.length === 0) {
    checks.push({
      id: 'url_presence',
      name: 'Embedded Links & Domains',
      nameAr: 'الروابط والنطاقات المدمجة',
      status: 'pass',
      detail: 'No embedded links or bare domains detected in this message.',
      detailAr: 'لم يتم رصد أي روابط أو نطاقات مدمجة داخل نص الرسالة.',
      weight: 0,
    });
  } else {
    for (const u of urlSignals) {
      if (u.urlhaus.state === 'match') {
        checks.push({
          id: `urlhaus_${u.hostname}`,
          name: `URLhaus Threat Match (${u.hostname})`,
          nameAr: `تطابق خبيث في قاعدة URLhaus (${u.hostname})`,
          status: 'fail',
          detail: `Host "${u.hostname}" is listed in URLhaus malware intelligence${u.urlhaus.threat ? ` (${u.urlhaus.threat})` : ''}.`,
          detailAr: `النطاق "${u.hostname}" مدرج في قاعدة بيانات URLhaus للروابط الخبيثة.`,
          weight: 3,
        });
      } else if (u.urlhaus.state === 'unavailable') {
        checks.push({
          id: `urlhaus_${u.hostname}`,
          name: `URLhaus Threat Check (${u.hostname})`,
          nameAr: `فحص قاعدة URLhaus (${u.hostname})`,
          status: 'unknown',
          detail: `URLhaus lookup for "${u.hostname}" was unavailable.`,
          detailAr: `فحص URLhaus للنطاق "${u.hostname}" غير متاح حالياً.`,
          weight: 0,
        });
      }

      if (u.isIp || u.isPunycode) {
        checks.push({
          id: `url_danger_${u.hostname}`,
          name: `High-Risk URL Structure (${u.hostname})`,
          nameAr: `بنية رابط عالية الخطورة (${u.hostname})`,
          status: 'fail',
          detail: u.isIp
            ? `Link uses a raw IP address (${u.hostname}) instead of a standard domain.`
            : `Link uses IDN/punycode encoding (${u.hostname}) often used in lookalike phishing attacks.`,
          detailAr: u.isIp
            ? `الرابط يستخدم عنوان IP مباشر (${u.hostname}) بدلاً من اسم نطاق رسمي.`
            : `الرابط يستخدم ترميز Punycode (${u.hostname}) المرتبط بهجمات انتحال النطاقات.`,
          weight: 3,
        });
      } else if (u.isShortener || u.isSuspiciousTld) {
        const escalated = hasHighWeightLexiconHit;
        checks.push({
          id: `url_heur_${u.hostname}`,
          name: `Suspicious Link Indicator (${u.hostname})`,
          nameAr: `مؤشر رابط مشبوه (${u.hostname})`,
          status: escalated ? 'fail' : 'warn',
          detail: u.isShortener
            ? `Link uses a URL shortener (${u.hostname}) that hides the true destination${escalated ? ' alongside a high-risk credential/payment demand.' : '.'}`
            : `Link uses a high-abuse TLD (${u.hostname})${escalated ? ' alongside a high-risk credential/payment demand.' : '.'}`,
          detailAr: u.isShortener
            ? `الرابط يستخدم خدمة اختصار روابط (${u.hostname}) تخفي الوجهة الحقيقية${escalated ? ' مع طلب حساس لبيانات أو أموال.' : '.'}`
            : `الرابط يستخدم امتداد نطاق مشبوه (${u.hostname})${escalated ? ' مع طلب حساس لبيانات أو أموال.' : '.'}`,
          weight: escalated ? 3 : 1,
        });
      } else if (u.urlhaus.state === 'no_match') {
        checks.push({
          id: `url_clean_${u.hostname}`,
          name: `Extracted Link Check (${u.hostname})`,
          nameAr: `فحص الرابط المستخرج (${u.hostname})`,
          status: 'pass',
          detail: `Detected link to "${u.hostname}" — no URLhaus listing or dangerous hostname structure found.`,
          detailAr: `تم رصد رابط إلى "${u.hostname}" — لا يوجد تطابق في URLhaus أو بنية نطاق خطيرة.`,
          weight: 0,
        });
      }
    }
  }

  // 2. Lexicon pattern checks
  if (lexiconMatches.length === 0) {
    checks.push({
      id: 'lexicon_clean',
      name: 'Phishing & Scam Language Patterns',
      nameAr: 'أنماط لغة التصيد والاحتيال',
      status: 'pass',
      detail: 'No known phishing, coercion, or payment-scam keyword patterns matched.',
      detailAr: 'لم يتم رصد عبارات معروفة للتصيد أو التهديد أو طلبات الدفع الاحتيالية.',
      weight: 0,
    });
  } else {
    for (const match of lexiconMatches) {
      const def = LEXICON_GROUPS.find((g) => g.id === match.id);
      checks.push({
        id: `lexicon_${match.id}`,
        name: match.name,
        nameAr: match.nameAr,
        status: match.weight === 3 ? 'fail' : 'warn',
        detail: `${def?.detailEn || match.name} (Matched: "${match.matchedTerms.join('", "')}")`,
        detailAr: `${def?.detailAr || match.nameAr} (تطابق: "${match.matchedTerms.join('"، "')}")`,
        weight: match.weight,
      });
    }
  }

  return {
    extractedUrls,
    urlSignals,
    lexiconMatches,
    patternScore,
    hasHighWeightLexiconHit,
    urlhausMatch,
    dangerousUrlSignal,
    checks,
  };
}

export async function analyzeMessageSignals(
  text: string,
  fetchImpl?: typeof globalThis.fetch,
): Promise<MessageSignalsResult> {
  const urls = extractUrls(text);
  const hostnames = Array.from(
    new Set(
      urls
        .map((raw) => {
          try {
            const norm = /^https?:\/\//i.test(raw) ? raw : `http://${raw}`;
            return new URL(norm).hostname.toLowerCase();
          } catch {
            return '';
          }
        })
        .filter(Boolean),
    ),
  );

  const urlhausByHost: Record<string, UrlhausResult> = {};
  await Promise.all(
    hostnames.map(async (host) => {
      urlhausByHost[host] = await queryUrlhaus(host, fetchImpl as never);
    }),
  );

  return buildMessageSignals(text, urlhausByHost);
}

const RISK_RANK: Record<MessageRiskLevel, number> = {
  Low: 1,
  Medium: 2,
  High: 3,
};

function normalizeRiskLevel(level: string | undefined | null): MessageRiskLevel {
  const upper = (level || '').trim().toUpperCase();
  if (upper === 'HIGH') return 'High';
  if (upper === 'MEDIUM') return 'Medium';
  return 'Low';
}

export function combineMessageRisk(
  signals: MessageSignalsResult,
  aiRisk?: string | null,
): CombinedMessageRisk {
  const normalizedAi = normalizeRiskLevel(aiRisk);

  let floor: MessageRiskLevel | null = null;
  if (signals.urlhausMatch || signals.dangerousUrlSignal) {
    floor = 'High';
  } else if (signals.patternScore >= 4) {
    floor = 'Medium';
  }

  if (!floor) {
    return {
      finalRisk: normalizedAi,
      signals,
      floorApplied: false,
    };
  }

  const aiRank = RISK_RANK[normalizedAi];
  const floorRank = RISK_RANK[floor];

  if (floorRank > aiRank) {
    return {
      finalRisk: floor,
      signals,
      floorApplied: true,
    };
  }

  return {
    finalRisk: normalizedAi,
    signals,
    floorApplied: floorRank === aiRank,
  };
}

export function adjustSecurityScoreForFloor(
  aiScore: number | undefined,
  finalRisk: MessageRiskLevel,
  floorApplied: boolean,
): number | undefined {
  if (!floorApplied) return aiScore;
  const base = typeof aiScore === 'number' && Number.isFinite(aiScore) ? aiScore : 50;
  if (finalRisk === 'High') {
    return Math.min(base, 20);
  }
  if (finalRisk === 'Medium') {
    return Math.min(base, 50);
  }
  return aiScore;
}
