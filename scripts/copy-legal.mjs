/**
 * Copy static legal/trust pages into dist/ after build.
 * Pages: privacy (ar/en), terms (ar/en), security (en/ar), security.txt
 * Called after prerender-seo.mjs in the deploy workflow.
 */
import { copyFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DIST = join(ROOT, 'dist');

const pages = [
  // [source, destination-in-dist]
  ['privacy.ar.html', 'privacy.html'],
  ['privacy.en.html', 'privacy.en.html'],
  ['terms.ar.html', 'terms.html'],
  ['terms.en.html', 'terms.en.html'],
  ['security.ar.html', 'security.html'],
  ['security.en.html', 'security.en.html'],
];

for (const [src, dest] of pages) {
  const srcPath = join(ROOT, 'public', 'legal', src);
  if (!existsSync(srcPath)) {
    console.error('MISSING SOURCE:', srcPath);
    process.exit(1);
  }
  const destPath = join(DIST, dest);
  mkdirSync(dirname(destPath), { recursive: true });
  copyFileSync(srcPath, destPath);
  console.log('copied', src, '->', dest);
}

// security.txt at the well-known location
const wk = join(DIST, '.well-known');
mkdirSync(wk, { recursive: true });
copyFileSync(join(ROOT, 'public', 'legal', 'security.txt'), join(wk, 'security.txt'));
console.log('copied security.txt -> /.well-known/security.txt');
console.log('LEGAL PAGES DONE');
