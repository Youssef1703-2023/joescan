import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { assertBundleContainsProxyUrl, assertNotIndexable404, collectJavaScript } from './production-build-checks.mjs';

const dirs: string[] = [];

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('production build checks', () => {
  it('rejects an indexable 404 and a homepage copied over it', () => {
    const indexable = '<html><meta name="robots" content="index, follow"></html>';
    const homepage = '<html><meta name="robots" content="index, follow"><div id="root"></div></html>';
    expect(() => assertNotIndexable404(indexable, homepage)).toThrow(/index/i);
    expect(() => assertNotIndexable404(homepage, homepage)).toThrow(/copy of index.html/);
    const copiedNoindex = '<html><meta name="robots" content="noindex, nofollow"></html>';
    expect(() => assertNotIndexable404(copiedNoindex, copiedNoindex)).toThrow(/copy of index.html/);
  });

  it('accepts the generated noindex 404', () => {
    const page = '<html><title>Page not found | JoeScan</title><meta name="robots" content="noindex, nofollow"></html>';
    const homepage = '<html><meta name="robots" content="index, follow"></html>';
    expect(() => assertNotIndexable404(page, homepage)).not.toThrow();
  });

  it('fails when the configured proxy URL is missing from the JavaScript bundle', () => {
    const proxyUrl = 'https://proxy.example.test';
    expect(() => assertBundleContainsProxyUrl('var api=""', proxyUrl)).toThrow(/VITE_AI_PROXY_URL/);
    expect(() => assertBundleContainsProxyUrl(`const url="${proxyUrl}"`, proxyUrl)).not.toThrow();

    const dir = mkdtempSync(join(tmpdir(), 'joescan-bundle-'));
    dirs.push(dir);
    mkdirSync(join(dir, 'assets'));
    writeFileSync(join(dir, 'assets', 'app.js'), 'console.log("built without proxy")');
    expect(() => assertBundleContainsProxyUrl(collectJavaScript(dir), proxyUrl)).toThrow(/VITE_AI_PROXY_URL/);
  });

  it('fails closed when the production proxy URL is missing', () => {
    expect(() => assertBundleContainsProxyUrl('const url="https://proxy.example.test"', undefined)).toThrow(/not set/);
    expect(() => assertBundleContainsProxyUrl('const url="https://proxy.example.test"', '')).toThrow(/empty/);
    expect(() => assertBundleContainsProxyUrl('const url="https://proxy.example.test"', '   ')).toThrow(/empty/);
    const verifier = readFileSync('scripts/verify-public-seo.mjs', 'utf8');
    expect(verifier).toContain('assertBundleContainsProxyUrl(collectJavaScript');
    expect(verifier).not.toMatch(/if\s*\(\s*proxyUrl\s*\)/);
  });
});
