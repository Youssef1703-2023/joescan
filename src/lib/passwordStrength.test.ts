import { describe, expect, it } from 'vitest';
import { assessPasswordStrength, PATTERN_ANALYSIS_LIMIT } from './passwordStrength';

function patternedPrefix(length: number): string {
  let sample = 'Nimbus-Quartz-47!';
  let code = 0x4e00;
  while (sample.length < length) {
    sample += String.fromCodePoint(code);
    code += 1;
  }
  return sample.slice(0, length);
}

describe('password strength score', () => {
  it('reaches 100 only when every displayed criterion is met and stays inside 0–100', () => {
    const strong = assessPasswordStrength('Nimbus-Quartz-47!');
    expect(strong.met).toBe(6);
    expect(strong.band).toBe(4);
    expect(strong.securityScore).toBe(100);

    const longer = assessPasswordStrength('Nimbus-Quartz-47!Cedar-Window-58?');
    expect(longer.securityScore).toBe(100);
    expect(longer.securityScore).toBeLessThanOrEqual(100);
    expect(assessPasswordStrength('').securityScore).toBe(0);
  });

  it('keeps weak and patterned passwords well below a strong score', () => {
    expect(assessPasswordStrength('password').securityScore).toBe(33);
    expect(assessPasswordStrength('password').band).toBe(1);
    expect(assessPasswordStrength('123').securityScore).toBe(17);
    expect(assessPasswordStrength('123').band).toBe(0);
    expect(assessPasswordStrength('aaa').securityScore).toBeLessThan(50);

    const short = assessPasswordStrength('Aa1!');
    expect(short.reqLength).toBe(false);
    expect(short.reqUpper && short.reqLower && short.reqNumber && short.reqSpecial).toBe(true);
    expect(short.band).toBeLessThanOrEqual(1);
    expect(short.securityScore).toBeLessThanOrEqual(33);
    expect(short.securityScore).not.toBe(100);

    const repeated = assessPasswordStrength('Aa1!Aa1!');
    expect(repeated.reqLength).toBe(true);
    expect(repeated.passedPatterns).toBe(false);
    expect(repeated.band).toBeLessThanOrEqual(2);
    expect(repeated.securityScore).toBeLessThanOrEqual(66);

    const tiled = assessPasswordStrength('Qz7!Qz7!Qz7!Qz7!');
    expect(tiled.passedPatterns).toBe(false);
    expect(tiled.band).toBeLessThanOrEqual(2);
    expect(tiled.securityScore).toBeLessThanOrEqual(66);
    expect(tiled.band).not.toBe(4);

    const boundedRepeat = assessPasswordStrength(`Nimbus-Quartz-47!Nimbus-Quartz-47!${'x'.repeat(100)}`);
    expect(boundedRepeat.passedPatterns).toBe(false);
    expect(boundedRepeat.securityScore).toBeLessThanOrEqual(66);

    const head = patternedPrefix(PATTERN_ANALYSIS_LIMIT);
    expect(assessPasswordStrength(head)).toMatchObject({ band: 4, securityScore: 100, passedPatterns: true });
    const pastTheWindow = `${head}Qz7!Qz7!Qz7!Qz7!${'x'.repeat(20000)}`;
    expect(pastTheWindow.length).toBeGreaterThan(PATTERN_ANALYSIS_LIMIT);
    expect(assessPasswordStrength(pastTheWindow)).toMatchObject({ band: 4, securityScore: 100, passedPatterns: true });

    for (const value of ['', 'a', 'password', '123456', 'Nimbus-Quartz-47!']) {
      const score = assessPasswordStrength(value).securityScore;
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    }
  });
});
