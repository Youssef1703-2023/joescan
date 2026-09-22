import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import assert from 'node:assert/strict';

function robotsDirectives(html) {
  return [...html.matchAll(/<meta\b[^>]*>/gi)]
    .map((match) => match[0])
    .filter((tag) => /name=["']robots["']/i.test(tag))
    .map((tag) => {
      const content = /content=["']([^"']*)["']/i.exec(tag);
      return content ? content[1] : '';
    });
}

/** Fail when the generated 404 is missing noindex or is a copy of the indexable homepage. */
export function assertNotIndexable404(html, indexHtml) {
  assert.notEqual(html, indexHtml, 'dist/404.html must not be a copy of index.html');
  const directives = robotsDirectives(html);
  assert.ok(directives.length > 0, 'dist/404.html has no robots meta');
  for (const directive of directives) {
    assert.match(directive, /noindex/i, 'dist/404.html robots meta is missing noindex');
    assert.doesNotMatch(directive, /(^|[,\s])index\b/i, 'dist/404.html robots meta allows indexing');
  }
  assert.notEqual(html, indexHtml, 'dist/404.html must not be a copy of index.html');
}

/** Fail when a configured proxy URL was not compiled into the production JavaScript. */
export function assertBundleContainsProxyUrl(bundleText, proxyUrl) {
  assert.equal(typeof proxyUrl, 'string', 'VITE_AI_PROXY_URL is not set for production verification');
  assert.ok(proxyUrl.trim().length > 0, 'VITE_AI_PROXY_URL is empty');
  assert.ok(
    bundleText.includes(proxyUrl),
    'Production JavaScript does not contain the configured VITE_AI_PROXY_URL',
  );
}

export function collectJavaScript(dir) {
  const chunks = [];
  const walk = (current) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const full = join(current, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.js')) chunks.push(readFileSync(full, 'utf8'));
    }
  };
  walk(dir);
  return chunks.join('\n');
}
