import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (name: string) => readFileSync(`.github/workflows/${name}`, 'utf8');

describe('production deployment workflows', () => {
  it('deploys daily news through the shared Cloudflare workflow', () => {
    const daily = read('daily-news.yml');
    const caller = read('deploy-pages.yml');
    const cloudflare = read('deploy-cloudflare.yml');
    const legacy = read('deploy.yml');

    expect(daily).toContain('deploy-cloudflare.yml');
    expect(daily).toContain('ref: ${{ needs.update.outputs.sha }}');
    expect(daily).toContain('secrets: inherit');
    expect(daily).not.toContain('deploy-pages@');
    expect(daily).not.toContain('upload-pages-artifact');
    expect(daily).not.toMatch(/cp\s+dist\/index\.html/);
    expect(caller).toContain('deploy-cloudflare.yml');
    expect(caller).toContain('secrets: inherit');
    expect(caller).not.toContain('upload-pages-artifact');
    expect(caller).not.toContain('deploy-pages@');
    expect(caller).not.toContain('actions/configure-pages');

    expect(cloudflare).toContain('ref: ${{ inputs.ref || github.sha }}');
    expect(cloudflare).toContain('fetch-depth: 0');
    expect(cloudflare).toContain('npm ci --legacy-peer-deps');
    expect(cloudflare).toContain('npm run lint');
    expect(cloudflare).toContain('npm test');
    expect(cloudflare).toContain('npm audit --omit=dev --audit-level=low');
    expect(cloudflare).toContain('npm run build');
    expect(cloudflare).toContain('node scripts/verify-public-seo.mjs');
    expect(cloudflare).toContain('VITE_AI_PROXY_URL');
    expect(cloudflare).toContain('secrets.CLOUDFLARE_API_TOKEN');
    expect(cloudflare).toContain('secrets.CLOUDFLARE_ACCOUNT_ID');
    expect(cloudflare).not.toContain('cloudflare/wrangler-action');
    expect(cloudflare).toContain(
      'npx --yes wrangler@4.136.2 pages deploy dist --project-name=joescan --branch=main --commit-dirty=true',
    );
    const beforeInstall = cloudflare.slice(0, cloudflare.indexOf('Install dependencies'));
    expect(beforeInstall).toContain('test -n "$VITE_AI_PROXY_URL"');
    expect(beforeInstall).toContain('CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}');
    expect(beforeInstall).toContain('CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}');
    expect(beforeInstall).toContain('-z "$CLOUDFLARE_API_TOKEN"');
    expect(beforeInstall).toContain('-z "$CLOUDFLARE_ACCOUNT_ID"');
    const deployStep = cloudflare.slice(cloudflare.indexOf('Deploy to Cloudflare Pages'));
    expect(deployStep).toContain('CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}');
    expect(deployStep).toContain('CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}');
    expect(cloudflare).not.toMatch(/run:\s*node scripts\/prerender-seo\.mjs/);
    expect(cloudflare).not.toMatch(/cp\s+dist\/index\.html/);
    expect(cloudflare).not.toContain('npm install');

    expect(legacy).toContain('npm ci --legacy-peer-deps');
    expect(legacy).toContain('VITE_AI_PROXY_URL');
    expect(legacy).not.toMatch(/cp\s+dist\/index\.html/);
    expect(legacy).not.toMatch(/^\s*push:/m);
  });
});
