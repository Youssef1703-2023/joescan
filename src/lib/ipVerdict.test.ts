import { describe, expect, it } from 'vitest';
import { deriveIpVerdict, isPrivateOrReservedIp, isValidIp } from './ipVerdict';

describe('isValidIp', () => {
  it('accepts valid IPv4 addresses', () => {
    expect(isValidIp('8.8.8.8')).toBe(true);
    expect(isValidIp('1.1.1.1')).toBe(true);
    expect(isValidIp('0.0.0.0')).toBe(true);
    expect(isValidIp('255.255.255.255')).toBe(true);
    expect(isValidIp('192.168.1.1')).toBe(true);
    expect(isValidIp('  93.184.216.34  ')).toBe(true);
  });

  it('accepts valid IPv6 addresses (full, compressed, loopback, and IPv4-mapped)', () => {
    expect(isValidIp('2001:4860:4860::8888')).toBe(true);
    expect(isValidIp('2606:4700:4700::1111')).toBe(true);
    expect(isValidIp('::1')).toBe(true);
    expect(isValidIp('::')).toBe(true);
    expect(isValidIp('fe80::1ff:fe23:4567:890a')).toBe(true);
    expect(isValidIp('2001:0db8:85a3:0000:0000:8a2e:0370:7334')).toBe(true);
    expect(isValidIp('::ffff:192.0.2.128')).toBe(true);
  });

  it('rejects IPv4 addresses with leading zeros or out-of-range octets', () => {
    expect(isValidIp('01.1.1.1')).toBe(false);
    expect(isValidIp('192.168.01.1')).toBe(false);
    expect(isValidIp('10.0.0.00')).toBe(false);
    expect(isValidIp('256.0.0.1')).toBe(false);
    expect(isValidIp('1.2.3.256')).toBe(false);
    expect(isValidIp('999.999.999.999')).toBe(false);
    expect(isValidIp('-1.0.0.1')).toBe(false);
  });

  it('rejects empty inputs, hostnames, URLs, CIDR blocks, ports, and malformed IPv6', () => {
    expect(isValidIp('')).toBe(false);
    expect(isValidIp('   ')).toBe(false);
    expect(isValidIp('example.com')).toBe(false);
    expect(isValidIp('localhost')).toBe(false);
    expect(isValidIp('https://8.8.8.8')).toBe(false);
    expect(isValidIp('8.8.8.8/32')).toBe(false);
    expect(isValidIp('8.8.8.8:8080')).toBe(false);
    expect(isValidIp('8.8.8')).toBe(false);
    expect(isValidIp('8.8.8.8.8')).toBe(false);
    expect(isValidIp('2001:::1')).toBe(false);
    expect(isValidIp('2001::85a3::7334')).toBe(false);
    expect(isValidIp('1:2:3:4:5:6:7:8:9')).toBe(false);
    expect(isValidIp('gggg::1')).toBe(false);
    expect(isValidIp('[::1]')).toBe(false);
  });
});

describe('isPrivateOrReservedIp', () => {
  it('identifies private, loopback, link-local, CGNAT, and reserved addresses', () => {
    expect(isPrivateOrReservedIp('10.0.0.1')).toBe(true);
    expect(isPrivateOrReservedIp('172.16.0.1')).toBe(true);
    expect(isPrivateOrReservedIp('172.31.255.254')).toBe(true);
    expect(isPrivateOrReservedIp('192.168.1.1')).toBe(true);
    expect(isPrivateOrReservedIp('127.0.0.1')).toBe(true);
    expect(isPrivateOrReservedIp('169.254.10.20')).toBe(true);
    expect(isPrivateOrReservedIp('100.64.0.1')).toBe(true);
    expect(isPrivateOrReservedIp('::1')).toBe(true);
    expect(isPrivateOrReservedIp('fc00::1')).toBe(true);
    expect(isPrivateOrReservedIp('fd12:3456:789a::1')).toBe(true);
    expect(isPrivateOrReservedIp('fe80::1')).toBe(true);
    expect(isPrivateOrReservedIp('::ffff:192.168.1.50')).toBe(true);
  });

  it('returns false for public routable IPv4 and IPv6 addresses', () => {
    expect(isPrivateOrReservedIp('8.8.8.8')).toBe(false);
    expect(isPrivateOrReservedIp('1.1.1.1')).toBe(false);
    expect(isPrivateOrReservedIp('172.15.0.1')).toBe(false);
    expect(isPrivateOrReservedIp('172.32.0.1')).toBe(false);
    expect(isPrivateOrReservedIp('2001:4860:4860::8888')).toBe(false);
    expect(isPrivateOrReservedIp('2606:4700:4700::1111')).toBe(false);
  });
});

describe('deriveIpVerdict', () => {
  it('returns High risk and threat_match with bilingual copy when URLhaus matches', () => {
    const verdict = deriveIpVerdict({
      isPrivate: false,
      urlhausState: 'match',
      urlhausThreat: 'botnet_cc',
    });

    expect(verdict.riskLevel).toBe('High');
    expect(verdict.category).toBe('threat_match');
    expect(verdict.geoOnly).toBe(false);
    expect(verdict.labelEn).toBeTruthy();
    expect(verdict.labelAr).toBeTruthy();
    expect(verdict.evidenceEn).toContain('URLhaus');
    expect(verdict.evidenceEn).toContain('botnet_cc');
    expect(verdict.evidenceAr).toContain('URLhaus');
    expect(verdict.evidenceAr).toContain('botnet_cc');
  });

  it('returns Low risk and private_network with bilingual copy for private/reserved IPs', () => {
    const verdict = deriveIpVerdict({
      isPrivate: true,
      urlhausState: 'no_match',
    });

    expect(verdict.riskLevel).toBe('Low');
    expect(verdict.category).toBe('private_network');
    expect(verdict.geoOnly).toBe(false);
    expect(verdict.labelEn).toContain('PRIVATE');
    expect(verdict.labelAr).toContain('محلي');
    expect(verdict.evidenceEn).toMatch(/private or reserved/i);
    expect(verdict.evidenceAr).toContain('Private/Reserved');
  });

  it('returns Low risk flagged as geoOnly with honest bilingual copy when URLhaus is no_match or unavailable', () => {
    const noMatchVerdict = deriveIpVerdict({
      isPrivate: false,
      urlhausState: 'no_match',
    });
    expect(noMatchVerdict.riskLevel).toBe('Low');
    expect(noMatchVerdict.category).toBe('geo_only');
    expect(noMatchVerdict.geoOnly).toBe(true);
    expect(noMatchVerdict.labelEn).toMatch(/geolocation only/i);
    expect(noMatchVerdict.labelAr).toContain('فحص جغرافي فقط');
    expect(noMatchVerdict.evidenceEn).toMatch(/geolocation lookup only/i);
    expect(noMatchVerdict.evidenceEn).toContain('No active malware-hosting match in URLhaus');
    expect(noMatchVerdict.evidenceAr).toContain('نتيجة تحديد موقع جغرافي فقط');

    const unavailableVerdict = deriveIpVerdict({
      isPrivate: false,
      urlhausState: 'unavailable',
    });
    expect(unavailableVerdict.riskLevel).toBe('Low');
    expect(unavailableVerdict.category).toBe('geo_only');
    expect(unavailableVerdict.geoOnly).toBe(true);
    expect(unavailableVerdict.evidenceEn).toMatch(/unavailable/i);
    expect(unavailableVerdict.evidenceAr).toContain('لم تكن متاحة');
  });
});
