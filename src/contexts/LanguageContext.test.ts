import { describe, expect, it } from 'vitest';
import { translations } from './LanguageContext';

// The email report card in EmailAnalyzer renders these keys directly.
// `t()` silently falls back to English when a locale is missing, so a
// half-translated key would ship unnoticed: pin every locale instead.
const EMAIL_REPORT_KEYS = [
  'email_report_score_label',
  'email_report_score_note',
  'email_report_assessment',
  'email_report_verdict_incomplete',
  'email_report_verdict_high',
  'email_report_verdict_medium',
  'email_report_verdict_low',
  'email_report_verdict_note_incomplete',
  'email_report_verdict_note',
  'email_report_how_scored',
  'email_report_section_evidence',
  'email_report_section_steps',
  'email_report_coverage_note',
  'email_report_legacy_notice',
] as const;

const LOCALES = ['en', 'ar', 'fr', 'de', 'es', 'tr', 'ru'] as const;

describe('email report card translations', () => {
  it.each(EMAIL_REPORT_KEYS)('%s has a value in every locale', (key) => {
    const entry = (translations as unknown as Record<string, Record<string, string>>)[key];
    expect(entry, `missing translations.${key}`).toBeTruthy();
    for (const locale of LOCALES) {
      expect((entry[locale] || '').trim(), `translations.${key}.${locale}`).not.toBe('');
    }
    // The card is bilingual in practice: Arabic must not be an English copy.
    expect(entry.ar, `translations.${key}.ar is still English`).not.toBe(entry.en);
  });
});
