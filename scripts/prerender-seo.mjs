/**
 * Pre-render SEO pages for blog articles and academy lessons.
 * Generates static HTML files into dist/ during build so Google can index
 * the actual content (crawlers get real content immediately).
 *
 * Each generated page:
 *   - Full article/lesson content in semantic HTML (EN + AR variants)
 *   - Proper title, description, canonical, OG/Twitter tags, JSON-LD, hreflang
 *   - Tiny script bounces humans into the React app (crawlers ignore it)
 *
 * Run: node scripts/prerender-seo.mjs   (after `vite build`, dist/ must exist)
 */
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DIST = join(ROOT, 'dist');

const blogSrc = readFileSync(join(ROOT, 'src/data/blogArticles.ts'), 'utf8');
const lessonsSrc = readFileSync(join(ROOT, 'src/data/lessons/index.ts'), 'utf8');

const SITE = 'https://joescan.me';
const BRAND = 'JoeScan';

function unescape(s) {
  return s
    .replace(/\\'/g, "'")
    .replace(/\\`/g, '`')
    .replace(/\\\$/g, '$')
    .replace(/\\\\/g, '\\')
    .replace(/\\"/g, '"');
}

function extractArticles(src) {
  const articles = [];
  const re = /id:\s*'([^']+)'[\s\S]*?title:\s*'((?:[^'\\]|\\.)*)'[\s\S]*?titleAr:\s*'((?:[^'\\]|\\.)*)'[\s\S]*?summary:\s*'((?:[^'\\]|\\.)*)'[\s\S]*?summaryAr:\s*'((?:[^'\\]|\\.)*)'[\s\S]*?content:\s*`([\s\S]*?)`[\s\S]*?contentAr:\s*`([\s\S]*?)`[\s\S]*?category:\s*'([^']*)'[\s\S]*?categoryAr:\s*'([^']*)'[\s\S]*?date:\s*'([^']*)'[\s\S]*?readTime:\s*'([^']*)'[\s\S]*?readTimeAr:\s*'([^']*)'/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    articles.push({
      id: m[1], title: unescape(m[2]), titleAr: unescape(m[3]),
      summary: unescape(m[4]), summaryAr: unescape(m[5]),
      content: m[6], contentAr: m[7],
      category: m[8], categoryAr: m[9], date: m[10],
      readTime: m[11], readTimeAr: m[12],
    });
  }
  return articles;
}

function extractLessons(src) {
  const lessons = [];
  const re = /id:\s*'([^']+)',\s*\r?\n\s*title:\s*'((?:[^'\\]|\\.)*)',\s*\r?\n\s*titleAr:\s*'((?:[^'\\]|\\.)*)',[\s\S]*?summary:\s*'((?:[^'\\]|\\.)*)',\s*\r?\n\s*summaryAr:\s*'((?:[^'\\]|\\.)*)',/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    lessons.push({ id: m[1], title: unescape(m[2]), titleAr: unescape(m[3]), summary: unescape(m[4]), summaryAr: unescape(m[5]) });
  }
  return lessons;
}

function md2html(md) {
  const esc = md.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return esc
    .split(/\n{2,}/)
    .map((block) => {
      const t = block.trim();
      if (!t) return '';
      if (t.startsWith('### ')) return `<h3>${t.slice(4)}</h3>`;
      if (t.startsWith('## ')) return `<h2>${t.slice(3)}</h2>`;
      if (t.startsWith('# ')) return `<h1>${t.slice(2)}</h1>`;
      if (/^([-*]|\d+\.)\s/.test(t)) {
        const items = t.split('\n').map((l) => `<li>${l.replace(/^([-*]|\d+\.)\s+/, '')}</li>`).join('');
        return `<ul>${items}</ul>`;
      }
      return `<p>${t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>')}</p>`;
    })
    .join('\n');
}

function shell({ lang, title, description, canonical, alternates, jsonLd, bodyHtml, appUrl }) {
  const altLinks = alternates.map(a => `<link rel="alternate" hreflang="${a.lang}" href="${a.href}">`).join('\n  ');
  return `<!DOCTYPE html>
<html lang="${lang}" dir="${lang === 'ar' ? 'rtl' : 'ltr'}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <meta name="description" content="${description.replace(/"/g, '&quot;')}">
  <link rel="canonical" href="${canonical}">
  ${altLinks}
  <meta property="og:type" content="article">
  <meta property="og:title" content="${title.replace(/"/g, '&quot;')}">
  <meta property="og:description" content="${description.replace(/"/g, '&quot;')}">
  <meta property="og:url" content="${canonical}">
  <meta property="og:site_name" content="${BRAND}">
  <meta property="og:image" content="${SITE}/og-image.png">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${title.replace(/"/g, '&quot;')}">
  <meta name="twitter:description" content="${description.replace(/"/g, '&quot;')}">
  <meta name="twitter:image" content="${SITE}/og-image.png">
  <meta name="robots" content="index, follow, max-image-preview:large">
  <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
  <style>
    :root{color-scheme:dark}
    body{margin:0;background:#0b0f14;color:#dbe4ee;font-family:"Segoe UI",Tahoma,Arial,sans-serif;line-height:1.8;padding:24px}
    main{max-width:820px;margin:0 auto}
    a{color:#4cc9f0}
    h1,h2,h3{color:#fff;line-height:1.4}
    .meta{color:#8ba0b5;font-size:14px;margin-bottom:28px}
    .badge{display:inline-block;border:1px solid #1f2b3a;background:#0e141d;border-radius:999px;padding:2px 12px;font-size:12px;color:#00ff88;margin-left:8px}
    [dir=rtl] .badge{margin-right:8px;margin-left:0}
    footer{margin-top:40px;border-top:1px solid #1f2b3a;padding-top:16px;color:#8ba0b5;font-size:13px}
    .cta{display:inline-block;margin-top:10px;background:#00ff88;color:#000;font-weight:700;padding:10px 22px;border-radius:10px;text-decoration:none}
  </style>
  <script>
    (function(){var s=new URLSearchParams(window.location.search);if(!s.has('seo')){window.location.replace('${appUrl}');}})();
  </script>
</head>
<body>
  <main>
    ${bodyHtml}
    <footer>
      <p>${BRAND} — AI Cybersecurity &amp; OSINT Intelligence Platform</p>
      <a class="cta" href="${appUrl}">Open JoeScan App →</a>
    </footer>
  </main>
</body>
</html>`;
}

const articles = extractArticles(blogSrc);
console.log('articles extracted:', articles.length);
const lessons = extractLessons(lessonsSrc);
console.log('lessons extracted:', lessons.length);

const sitemapEntries = [];

for (const a of articles) {
  const appUrl = `${SITE}/blog`;
  const enBody = `
    <div><span class="badge">${a.category}</span><span class="badge">${a.readTime}</span><span class="badge">${a.date}</span></div>
    <h1>${a.title}</h1>
    <p class="meta">${a.summary}</p>
    ${md2html(a.content)}
    <p>العربية: <a href="${SITE}/blog/article-${a.id}.ar.html" hreflang="ar">${a.titleAr}</a></p>`;
  const enHtml = shell({
    lang: 'en',
    title: `${a.title} | ${BRAND}`,
    description: a.summary,
    canonical: `${SITE}/blog/article-${a.id}.html`,
    alternates: [
      { lang: 'en', href: `${SITE}/blog/article-${a.id}.html` },
      { lang: 'ar', href: `${SITE}/blog/article-${a.id}.ar.html` },
      { lang: 'x-default', href: `${SITE}/blog/article-${a.id}.html` },
    ],
    jsonLd: {
      '@context': 'https://schema.org', '@type': 'Article',
      headline: a.title, description: a.summary,
      datePublished: a.date, inLanguage: 'en',
      author: { '@type': 'Organization', name: 'JoeTech', url: SITE },
      publisher: { '@type': 'Organization', name: BRAND, url: SITE },
      mainEntityOfPage: `${SITE}/blog/article-${a.id}.html`,
    },
    bodyHtml: enBody,
    appUrl,
  });
  const enPath = join(DIST, 'blog', `article-${a.id}.html`);
  mkdirSync(dirname(enPath), { recursive: true });
  writeFileSync(enPath, enHtml);

  const arBody = `
    <div><span class="badge">${a.categoryAr}</span><span class="badge">${a.readTimeAr}</span><span class="badge">${a.date}</span></div>
    <h1>${a.titleAr}</h1>
    <p class="meta">${a.summaryAr}</p>
    ${md2html(a.contentAr)}
    <p>English: <a href="${SITE}/blog/article-${a.id}.html" hreflang="en">${a.title}</a></p>`;
  const arHtml = shell({
    lang: 'ar',
    title: `${a.titleAr} | ${BRAND}`,
    description: a.summaryAr,
    canonical: `${SITE}/blog/article-${a.id}.ar.html`,
    alternates: [
      { lang: 'en', href: `${SITE}/blog/article-${a.id}.html` },
      { lang: 'ar', href: `${SITE}/blog/article-${a.id}.ar.html` },
      { lang: 'x-default', href: `${SITE}/blog/article-${a.id}.html` },
    ],
    jsonLd: {
      '@context': 'https://schema.org', '@type': 'Article',
      headline: a.titleAr, description: a.summaryAr,
      datePublished: a.date, inLanguage: 'ar',
      author: { '@type': 'Organization', name: 'JoeTech', url: SITE },
      publisher: { '@type': 'Organization', name: BRAND, url: SITE },
      mainEntityOfPage: `${SITE}/blog/article-${a.id}.ar.html`,
    },
    bodyHtml: arBody,
    appUrl,
  });
  writeFileSync(join(DIST, 'blog', `article-${a.id}.ar.html`), arHtml);

  sitemapEntries.push(
    { loc: `/blog/article-${a.id}.html`, priority: '0.6' },
    { loc: `/blog/article-${a.id}.ar.html`, priority: '0.6' }
  );
}

for (const l of lessons) {
  const appUrl = `${SITE}/academy`;
  const enBody = `
    <h1>${l.title}</h1>
    <p class="meta">${l.summary}</p>
    <p>Full interactive lesson with a quiz is available in the <a href="${appUrl}">JoeScan Cyber Academy</a>.</p>`;
  const enHtml = shell({
    lang: 'en',
    title: `${l.title} | ${BRAND} Cyber Academy`,
    description: l.summary,
    canonical: `${SITE}/academy/lesson-${l.id}.html`,
    alternates: [
      { lang: 'en', href: `${SITE}/academy/lesson-${l.id}.html` },
      { lang: 'ar', href: `${SITE}/academy/lesson-${l.id}.ar.html` },
    ],
    jsonLd: {
      '@context': 'https://schema.org', '@type': 'LearningResource',
      name: l.title, description: l.summary, inLanguage: 'en',
      learningResourceType: 'Lesson',
      provider: { '@type': 'Organization', name: BRAND, url: SITE },
    },
    bodyHtml: enBody,
    appUrl,
  });
  const p1 = join(DIST, 'academy', `lesson-${l.id}.html`);
  mkdirSync(dirname(p1), { recursive: true });
  writeFileSync(p1, enHtml);

  const arBody = `
    <h1>${l.titleAr}</h1>
    <p class="meta">${l.summaryAr}</p>
    <p>الدرس التفاعلي الكامل مع الاختبار متاح في <a href="${appUrl}">أكاديمية JoeScan</a>.</p>`;
  const arHtml = shell({
    lang: 'ar',
    title: `${l.titleAr} | أكاديمية ${BRAND}`,
    description: l.summaryAr,
    canonical: `${SITE}/academy/lesson-${l.id}.ar.html`,
    alternates: [
      { lang: 'en', href: `${SITE}/academy/lesson-${l.id}.html` },
      { lang: 'ar', href: `${SITE}/academy/lesson-${l.id}.ar.html` },
    ],
    jsonLd: {
      '@context': 'https://schema.org', '@type': 'LearningResource',
      name: l.titleAr, description: l.summaryAr, inLanguage: 'ar',
      learningResourceType: 'Lesson',
      provider: { '@type': 'Organization', name: BRAND, url: SITE },
    },
    bodyHtml: arBody,
    appUrl,
  });
  writeFileSync(join(DIST, 'academy', `lesson-${l.id}.ar.html`), arHtml);

  sitemapEntries.push(
    { loc: `/academy/lesson-${l.id}.html`, priority: '0.6' },
    { loc: `/academy/lesson-${l.id}.ar.html`, priority: '0.6' }
  );
}

// ─── Update sitemap.xml with the new URLs ───
const sitemapPath = join(DIST, 'sitemap.xml');
const today = new Date().toISOString().slice(0, 10);
let sitemap = readFileSync(sitemapPath, 'utf8');
const newUrls = sitemapEntries
  .map((e) => `  <url>\n    <loc>${SITE}${e.loc}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>${e.priority}</priority>\n  </url>`)
  .join('\n');
sitemap = sitemap.replace('</urlset>', newUrls + '\n</urlset>');
writeFileSync(sitemapPath, sitemap);
console.log('sitemap updated: +' + sitemapEntries.length + ' URLs');
console.log('PRERENDER DONE: ' + (articles.length * 2 + lessons.length * 2) + ' pages');
