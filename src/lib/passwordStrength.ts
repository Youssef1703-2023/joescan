const SEQUENCE = /(123|234|345|456|567|678|789|012|abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz)/i;
const REPEATED_CHAR = /(.)\1{2,}/;
const COMMON_WORDS = /(password|qwerty|admin|login|123456)/i;
const WEAK_SCORE_CEILING = 33;
const PATTERN_SCORE_CEILING = 66;

/**
 * Pattern checks inspect only this prefix. The bound matches the password
 * field limit, so a large paste cannot make repeated-block detection quadratic
 * over the whole value.
 */
export const PATTERN_ANALYSIS_LIMIT = 128;

function patternSample(password: string): string {
  return password.slice(0, PATTERN_ANALYSIS_LIMIT);
}

/** True when a block of two or more characters is repeated back-to-back inside the analysis prefix. */
function hasRepeatedBlock(sample: string): boolean {
  const text = sample.toLowerCase();
  const longest = Math.floor(text.length / 2);
  for (let size = 2; size <= longest; size += 1) {
    const last = text.length - size * 2;
    for (let index = 0; index <= last; index += 1) {
      if (text.startsWith(text.slice(index, index + size), index + size)) return true;
    }
  }
  return false;
}

export interface PasswordStrength {
  reqLength: boolean;
  reqUpper: boolean;
  reqLower: boolean;
  reqNumber: boolean;
  reqSpecial: boolean;
  passedPatterns: boolean;
  met: number;
  /** 0–4 bar used by the existing strength meter. */
  band: 0 | 1 | 2 | 3 | 4;
  /** Criteria completion from 0 to 100. This is not an entropy or crack-time estimate. */
  securityScore: number;
}

const WEAK_BAND: PasswordStrength['band'] = 1;
const PATTERN_BAND: PasswordStrength['band'] = 2;

/** Score the six criteria shown in the password checker. A password that meets all of them scores 100. */
export function assessPasswordStrength(password: string): PasswordStrength {
  const reqLength = password.length >= 8;
  const reqUpper = /[A-Z]/.test(password);
  const reqLower = /[a-z]/.test(password);
  const reqNumber = /[0-9]/.test(password);
  const reqSpecial = /[^A-Za-z0-9]/.test(password);
  const sample = patternSample(password);
  const hasPatterns = SEQUENCE.test(sample) || REPEATED_CHAR.test(sample) || hasRepeatedBlock(sample) || COMMON_WORDS.test(sample);
  const passedPatterns = password.length > 0 && !hasPatterns;
  const met = password.length > 0
    ? [reqLength, reqUpper, reqLower, reqNumber, reqSpecial, passedPatterns].filter(Boolean).length
    : 0;
  let band: PasswordStrength['band'] = met >= 6 ? 4 : met >= 4 ? 3 : met >= 3 ? 2 : met >= 2 ? 1 : 0;
  let securityScore = Math.max(0, Math.min(100, Math.round((met / 6) * 100)));
  if (password.length > 0 && !passedPatterns) {
    if (band > PATTERN_BAND) band = PATTERN_BAND;
    securityScore = Math.min(securityScore, PATTERN_SCORE_CEILING);
  }
  if (password.length > 0 && !reqLength) {
    if (band > WEAK_BAND) band = WEAK_BAND;
    securityScore = Math.min(securityScore, WEAK_SCORE_CEILING);
  }
  return { reqLength, reqUpper, reqLower, reqNumber, reqSpecial, passedPatterns, met, band, securityScore };
}
