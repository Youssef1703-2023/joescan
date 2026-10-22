import { describe, expect, it, vi } from 'vitest';
import {
  adjustSecurityScoreForFloor,
  analyzeMessageSignals,
  buildMessageSignals,
  combineMessageRisk,
  evaluateLexicon,
  extractUrls,
  isIpHostname,
  isKnownShortener,
  isPunycode,
  isSuspiciousTld,
} from './messageSignals';

describe('messageSignals', () => {
  describe('extractUrls', () => {
    it('extracts http/https URLs and bare domains while stripping trailing punctuation', () => {
      const text =
        'Urgent: visit https://secure-login.example.com/verify?user=1, or check bit.ly/3xYz99! Backup portal: (evil-bank.tk/login). Also see 192.168.1.25/auth and xn--pple-43d.com؛';
      const urls = extractUrls(text);
      expect(urls).toEqual([
        'https://secure-login.example.com/verify?user=1',
        'bit.ly/3xYz99',
        'evil-bank.tk/login',
        '192.168.1.25/auth',
        'xn--pple-43d.com',
      ]);
    });

    it('does not extract domains from email addresses', () => {
      const text = 'Contact support@paypal.com or admin@company.org for help.';
      expect(extractUrls(text)).toEqual([]);
    });
  });

  describe('URL heuristics', () => {
    it('identifies IP hostnames, punycode, shorteners, and suspicious TLDs', () => {
      expect(isIpHostname('192.168.1.1')).toBe(true);
      expect(isIpHostname('999.168.1.1')).toBe(false);
      expect(isIpHostname('example.com')).toBe(false);

      expect(isPunycode('xn--pple-43d.com')).toBe(true);
      expect(isPunycode('login.xn--80ak6aa92e.com')).toBe(true);
      expect(isPunycode('apple.com')).toBe(false);

      expect(isKnownShortener('bit.ly')).toBe(true);
      expect(isKnownShortener('tinyurl.com')).toBe(true);
      expect(isKnownShortener('google.com')).toBe(false);

      expect(isSuspiciousTld('verify-account.tk')).toBe(true);
      expect(isSuspiciousTld('bonus-claim.xyz')).toBe(true);
      expect(isSuspiciousTld('github.com')).toBe(false);
    });
  });

  describe('EN + AR pattern lexicon', () => {
    it('matches English lexicon groups with expected weights (once per group)', () => {
      const text =
        'URGENT: Your account has been suspended! Please verify your account and enter your OTP immediately or send a Bitcoin gift card.';
      const matches = evaluateLexicon(text);
      const ids = matches.map((m) => m.id);
      expect(ids).toContain('credential_verification');
      expect(ids).toContain('gift_cards_crypto');
      expect(ids).toContain('urgency_threats');

      const cred = matches.find((m) => m.id === 'credential_verification');
      expect(cred?.weight).toBe(3);
    });

    it('matches Arabic lexicon groups across urgency, authority, credentials, and transfers', () => {
      const text =
        'عاجل من البنك المركزي: تم إيقاف حسابك البنكي. يرجى تأكيد حسابك وإرسال رمز التحقق فوراً أو دفع رسوم إدارية عبر فودافون كاش.';
      const matches = evaluateLexicon(text);
      const ids = matches.map((m) => m.id);
      expect(ids).toContain('credential_verification');
      expect(ids).toContain('urgency_threats');
      expect(ids).toContain('authority_impersonation');
      expect(ids).toContain('money_transfer_fees');

      const signals = buildMessageSignals(text);
      // 3 (credential) + 2 (urgency) + 2 (authority) + 2 (transfer) = 9
      expect(signals.patternScore).toBe(9);
    });
  });

  describe('floor rules & combineMessageRisk', () => {
    it('applies High floor when URLhaus matches', async () => {
      const fetchMock = vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          query_status: 'ok',
          urls: [{ threat: 'malware_download', date_added: '2025-01-01', tags: ['phish'] }],
        }),
      }));

      const signals = await analyzeMessageSignals('Check https://bad.example.com/file', fetchMock as never);
      expect(signals.urlhausMatch).toBe(true);

      const combined = combineMessageRisk(signals, 'Low');
      expect(combined.finalRisk).toBe('High');
      expect(combined.floorApplied).toBe(true);
      expect(adjustSecurityScoreForFloor(88, combined.finalRisk, combined.floorApplied)).toBe(20);
    });

    it('applies High floor for raw IP or punycode URLs even when AI says Low', () => {
      const ipSignals = buildMessageSignals('Hello, visit http://10.20.30.40/portal');
      expect(ipSignals.dangerousUrlSignal).toBe(true);
      expect(combineMessageRisk(ipSignals, 'Low')).toMatchObject({
        finalRisk: 'High',
        floorApplied: true,
      });

      const punySignals = buildMessageSignals('Check https://xn--pple-43d.com/support');
      expect(punySignals.dangerousUrlSignal).toBe(true);
      expect(combineMessageRisk(punySignals, 'Medium')).toMatchObject({
        finalRisk: 'High',
        floorApplied: true,
      });
    });

    it('treats shortener/suspicious TLD as warning alone, but escalates to High floor with weight-3 lexicon hit', () => {
      const warnOnly = buildMessageSignals('Read this article at bit.ly/news123');
      expect(warnOnly.dangerousUrlSignal).toBe(false);
      expect(warnOnly.patternScore).toBe(1);
      expect(combineMessageRisk(warnOnly, 'Low')).toMatchObject({
        finalRisk: 'Low',
        floorApplied: false,
      });

      const escalated = buildMessageSignals('Please verify your account and enter your OTP at bit.ly/verify99');
      expect(escalated.hasHighWeightLexiconHit).toBe(true);
      expect(escalated.dangerousUrlSignal).toBe(true);
      expect(combineMessageRisk(escalated, 'Low')).toMatchObject({
        finalRisk: 'High',
        floorApplied: true,
      });
    });

    it('applies Medium floor when stacked patternScore >= 4, and allows AI to raise to High', () => {
      // urgency (2) + authority (2) = 4
      const signals = buildMessageSignals(
        'Urgent notice from the Central Bank: your account has been suspended within 24 hours.',
      );
      expect(signals.patternScore).toBe(4);
      expect(signals.dangerousUrlSignal).toBe(false);

      const fromLow = combineMessageRisk(signals, 'Low');
      expect(fromLow.finalRisk).toBe('Medium');
      expect(fromLow.floorApplied).toBe(true);

      const raisedByAi = combineMessageRisk(signals, 'High');
      expect(raisedByAi.finalRisk).toBe('High');
      expect(raisedByAi.floorApplied).toBe(false);
    });

    it('leaves a clean no-URL message unaffected', () => {
      const signals = buildMessageSignals('Hey Ahmed, are we still meeting for coffee at 5pm tomorrow?');
      expect(signals.extractedUrls).toEqual([]);
      expect(signals.patternScore).toBe(0);
      expect(signals.urlhausMatch).toBe(false);
      expect(signals.dangerousUrlSignal).toBe(false);

      const combined = combineMessageRisk(signals, 'Low');
      expect(combined.finalRisk).toBe('Low');
      expect(combined.floorApplied).toBe(false);
      expect(adjustSecurityScoreForFloor(95, combined.finalRisk, combined.floorApplied)).toBe(95);
    });
  });
});
