export interface EmailBreach {
  name: string; date: string; dataExposed: string; recordCount?: string; description?: string;
}
export class EmailSourceError extends Error {
  constructor(public status = 0) { super(status === 429 ? 'The breach data provider is rate-limiting requests. Please try again later.' : 'The breach data provider could not complete this check. No result has been saved. Please try again.'); }
}
export function assessEmailBreaches(breaches: EmailBreach[]) {
  const sensitive = breaches.some(b => /password|stealer|credential/i.test(b.dataExposed + ' ' + b.name));
  const riskLevel: 'Low' | 'Medium' | 'High' = !breaches.length ? 'Low' : sensitive ? 'High' : 'Medium';
  // A transparent local priority estimate, not a probability of being secure.
  const securityScore = !breaches.length ? 95 : Math.max(5, (sensitive ? 45 : 70) - Math.min(breaches.length, 20) * 2);
  return { riskLevel, securityScore };
}
export function parseEmailBreaches(data: any): EmailBreach[] {
  if (data?.Error === 'Not found') return [];
  if (data?.ExposedBreaches === null && data?.BreachMetrics === null && data?.BreachesSummary?.site === '') return [];
  const details = data?.ExposedBreaches?.breaches_details;
  if (!Array.isArray(details) || data?.Error) throw new EmailSourceError();
  if (!details.length && data?.BreachesSummary?.site) throw new EmailSourceError();
  return details.map((b: any) => {
    if (!b || typeof b.breach !== 'string' || !b.breach.trim()) throw new EmailSourceError();
    return {
      name: b.breach, date: typeof b.xposed_date === 'string' ? b.xposed_date : 'Unknown',
      dataExposed: typeof b.xposed_data === 'string' ? b.xposed_data.replace(/;/g, ', ') : 'Not provided',
      recordCount: Number.isFinite(Number(b.xposed_records)) && b.xposed_records != null ? Number(b.xposed_records).toLocaleString('en-US') : '—',
      description: typeof b.details === 'string' ? b.details : '',
    };
  });
}
export async function fetchEmailExposure(email: string, language: string) {
  let response: Response;
  let data: any;
  try {
    response = await fetch('https://api.xposedornot.com/v1/breach-analytics?email=' + encodeURIComponent(email), { signal: AbortSignal.timeout(20000) });
    data = await response.json();
  } catch { throw new EmailSourceError(); }
  if (!response.ok && !(response.status === 404 && data?.Error === 'Not found')) throw new EmailSourceError(response.status);
  const breaches = parseEmailBreaches(data);
  const ar = language === 'ar';
  const coverage = ar ? 'المصدر: XposedOrNot فقط. التغطية محدودة وقد تختلف عن HIBP؛ عدم وجود نتيجة لا يثبت الأمان.' : 'Source: XposedOrNot only. Coverage is limited and may differ from HIBP. No match does not prove that an account is secure.';
  const reportText = (breaches.length
    ? (ar ? 'ظهر هذا الإيميل في ' + breaches.length + ' تسريبات مسجلة لدى المصدر.' : 'This email appears in ' + breaches.length + ' breaches returned by the provider.')
    : (ar ? 'لم يعثر المصدر على تسريبات لهذا الإيميل.' : 'No breach matches were returned by this provider.')) + '\n\n' + coverage;
  const steps = ar ? ['غيّر كلمات المرور المعاد استخدامها أو المكشوفة.', 'فعّل التحقق بخطوتين واستخدم مدير كلمات مرور.', 'لو ظهرت سجلات سرقة بيانات، افحص الجهاز وأنهِ الجلسات المشبوهة.'] : ['Change exposed or reused passwords.', 'Enable two-factor authentication and use a password manager.', 'If stealer logs are listed, check your device for malware and revoke suspicious sessions.'];
  return { ...assessEmailBreaches(breaches), breaches, reportText, actionPlan: steps.map((s,i) => (i+1) + '. ' + s).join('\n'),
    scoreFactors: [ar ? 'التسريبات لدى المصدر: ' + breaches.length : 'Provider breach matches: ' + breaches.length, ar ? 'التقييم تقدير محلي للأولوية، وليس ضمان أمان.' : 'Score is a local prioritization estimate, not a security guarantee.'], scoreImprovement: steps,
    source: 'XposedOrNot', checkedAt: new Date().toISOString(), assessmentVersion: 2 };
}
