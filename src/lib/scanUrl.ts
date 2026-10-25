// Parse a user-entered URL for the URL Analyzer, mirroring exactly what
// UrlAnalyzer used to do inline: trim, prepend `http://` when no http(s)
// scheme is present, then `new URL()`. Returns `null` when the input is
// unparseable, so callers can reject it BEFORE consuming a scan attempt
// (the same validate-before-rate-limit order Email, Domain and IP use).
// Any scheme `new URL` accepts still passes here, as before — this helper
// only separates "parseable" from "unparseable", it does not add new
// scheme or host restrictions.
export interface ParsedScanUrl {
  targetUrl: string;
  urlObj: URL;
}

export function parseScanUrl(raw: string): ParsedScanUrl | null {
  let targetUrl = raw.trim();
  if (!/^https?:\/\//i.test(targetUrl)) targetUrl = 'http://' + targetUrl;

  try {
    return { targetUrl, urlObj: new URL(targetUrl) };
  } catch {
    return null;
  }
}
