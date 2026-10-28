// Email-domain MX check, extracted from EmailAnalyzer's inline DNS lookup.
//
// The analyzer used to run this check AFTER consuming a scan attempt, so an
// email with a valid format but a non-existent domain (no MX records) burned
// one of the user's 12/minute attempts and only then showed the
// invalid-domain error. Callers must run this BEFORE consumeScanAttempt().
// Semantics are preserved exactly from the inline version:
//   - Google DNS returns Status 0 with a non-empty Answer array => 'has_mx'
//   - Any other parsed answer (Status != 0, or no/empty Answer) => 'no_mx'
//   - Any fetch/parse failure => 'unknown' (the caller falls back to letting
//     the scan proceed, exactly as the old code did when its DNS fetch threw)
// The domain is encoded into the query string; the old code interpolated it
// raw, so a domain containing '&' or '?' could corrupt the DNS query.
export type EmailDomainMxResult = 'has_mx' | 'no_mx' | 'unknown';

type DnsResponse = {
  json: () => Promise<unknown>;
};

export async function checkEmailDomainMx(
  domain: string,
  fetchImpl: (input: string) => Promise<DnsResponse> = globalThis.fetch,
): Promise<EmailDomainMxResult> {
  try {
    const response = await fetchImpl(
      `https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=MX`,
    );
    const data = (await response.json()) as Record<string, unknown>;
    if (
      data.Status === 0 &&
      Array.isArray(data.Answer) &&
      data.Answer.length > 0
    ) {
      return 'has_mx';
    }
    return 'no_mx';
  } catch (err) {
    // Preserves the old inline check's behaviour (and its log): a blocked
    // DNS lookup falls back to letting the scan proceed.
    console.log('DNS Check failed/blocked:', err);
    return 'unknown';
  }
}
