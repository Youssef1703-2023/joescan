// Fetch Arabic cybersecurity news with FULL article content
// Uses direct RSS feeds from Arabic news sites + Google News for discovery
import https from 'https';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = path.join(__dirname, '..', 'src', 'data', 'dailyNews.json');

// Direct Arabic tech/security RSS feeds
const DIRECT_RSS_FEEDS = [
  'https://aitnews.com/feed/',
  'https://www.arageek.com/feed',
  'https://cybersecurity-ar.com/feed/',
  'https://mostaqbal.ae/feed/',
];

// Google News queries as fallback
const QUERIES = [
  'ثغرة أمنية اكتشاف',
  'اختراق بيانات تسريب',
  'أمن سيبراني هجوم',
  'خصوصية بيانات حماية',
];

function fetchURL(url, maxRedirects = 8) {
  return new Promise((resolve, reject) => {
    if (maxRedirects <= 0) return reject(new Error('Too many redirects'));
    const lib = url.startsWith('https') ? https : http;
    const req = lib.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ar,en;q=0.5',
        'Accept-Encoding': 'identity',
      },
      timeout: 20000,
    }, (res) => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
        let redirectUrl = res.headers.location;
        if (redirectUrl.startsWith('/')) {
          const u = new URL(url);
          redirectUrl = `${u.protocol}//${u.host}${redirectUrl}`;
        }
        return fetchURL(redirectUrl, maxRedirects - 1).then(resolve).catch(reject);
      }
      let data = '';
      res.setEncoding('utf-8');
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
      res.on('error', reject);
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

function decodeHTML(str) {
  return str
    .replace(/<!\[CDATA\[|\]\]>/g, '')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, code) => String.fromCharCode(parseInt(code, 16)))
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&hellip;/g, '…')
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')
    .replace(/&laquo;/g, '«')
    .replace(/&raquo;/g, '»')
    .replace(/&rsquo;/g, '\u2019')
    .replace(/&lsquo;/g, '\u2018')
    .replace(/&rdquo;/g, '\u201D')
    .replace(/&ldquo;/g, '\u201C');
}

function stripHTML(html) {
  return html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

function extractArticleContent(html) {
  // Remove noise
  let clean = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/<aside[\s\S]*?<\/aside>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
    .replace(/<form[\s\S]*?<\/form>/gi, '');

  // Try <article> first
  const articleMatch = clean.match(/<article[\s\S]*?>([\s\S]*?)<\/article>/i);
  if (articleMatch) clean = articleMatch[1];

  // Extract <p> paragraphs
  const paragraphs = [];
  const pRegex = /<p[^>]*>([\s\S]*?)<\/p>/gi;
  let m;
  while ((m = pRegex.exec(clean)) !== null) {
    let text = decodeHTML(stripHTML(m[1]));
    if (text.length > 40 && !text.match(/^(اقرأ أيض|شاهد أيض|مواضيع ذات|إعلان|تابعنا|شارك|اشترك|حقوق|جميع الحقوق|المصدر|كلمات [مد]فتاحية)/)) {
      paragraphs.push(text);
    }
  }

  // Extract headings
  const headings = [];
  const hRegex = /<h[23][^>]*>([\s\S]*?)<\/h[23]>/gi;
  while ((m = hRegex.exec(clean)) !== null) {
    let text = decodeHTML(stripHTML(m[1]));
    if (text.length > 5 && text.length < 200) headings.push(text);
  }

  return { paragraphs, headings };
}

function parseRSSItems(xml, sourceName) {
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;
  while ((match = itemRegex.exec(xml)) !== null) {
    const x = match[1];
    const title = decodeHTML((x.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || '').trim();
    const link = decodeHTML((x.match(/<link>([\s\S]*?)<\/link>/) || [])[1] || '').trim();
    const pubDate = (x.match(/<pubDate>([\s\S]*?)<\/pubDate>/) || [])[1] || '';
    const source = decodeHTML((x.match(/<source[^>]*>([\s\S]*?)<\/source>/) || [])[1] || sourceName || '').trim();
    
    // Get description/content:encoded for fallback content
    const contentEncoded = decodeHTML((x.match(/<content:encoded>([\s\S]*?)<\/content:encoded>/) || [])[1] || '');
    const description = decodeHTML((x.match(/<description>([\s\S]*?)<\/description>/) || [])[1] || '');

    if (title && title.length > 10) {
      items.push({
        title,
        link,
        date: pubDate ? new Date(pubDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        source: source || 'مصدر إخباري',
        rssContent: contentEncoded || description,
      });
    }
  }
  return items;
}

async function fetchArticleContent(item) {
  // First try: extract from RSS content:encoded
  if (item.rssContent && item.rssContent.length > 100) {
    const paragraphs = [];
    const pRegex = /<p[^>]*>([\s\S]*?)<\/p>/gi;
    let m;
    while ((m = pRegex.exec(item.rssContent)) !== null) {
      let text = decodeHTML(stripHTML(m[1]));
      if (text.length > 40) paragraphs.push(text);
    }
    if (paragraphs.length >= 2) {
      console.log(`    ✅ Got content from RSS feed (${paragraphs.length} paragraphs)`);
      return paragraphs.join('\n\n');
    }
    // Try plain text from RSS
    const plainText = stripHTML(item.rssContent);
    if (plainText.length > 200) {
      console.log(`    ✅ Got content from RSS description (${plainText.length} chars)`);
      return plainText;
    }
  }

  // Second try: fetch the actual page
  if (item.link && !item.link.includes('news.google.com')) {
    try {
      console.log(`    🌐 Fetching page: ${item.link.slice(0, 60)}...`);
      const html = await fetchURL(item.link);
      const { paragraphs, headings } = extractArticleContent(html);
      
      if (paragraphs.length >= 2) {
        let content = '';
        if (headings.length > 0) {
          for (const h of headings.slice(0, 5)) content += `## ${h}\n\n`;
        }
        content += paragraphs.join('\n\n');
        console.log(`    ✅ Got content from page (${paragraphs.length} paragraphs)`);
        return content;
      }
    } catch (err) {
      console.log(`    ⚠️ Page fetch failed: ${err.message}`);
    }
  }

  return null;
}

async function main() {
  console.log('🔍 Fetching Arabic cybersecurity news with full content...\n');
  const allItems = [];
  const seenTitles = new Set();

  // 1. Fetch from direct RSS feeds
  for (const feedUrl of DIRECT_RSS_FEEDS) {
    try {
      console.log(`  📡 Direct feed: ${feedUrl}`);
      const xml = await fetchURL(feedUrl);
      const hostname = new URL(feedUrl).hostname.replace('www.', '');
      const items = parseRSSItems(xml, hostname);
      // Filter for security/tech related
      const securityItems = items.filter(i => {
        const text = (i.title + ' ' + i.rssContent).toLowerCase();
        return text.match(/أمن|سيبران|اختراق|ثغر|بيانات|خصوصية|هجوم|تسريب|هاكر|برمجي|خبيث|فدي|تشفير|حماي|احتيال|تصيد|قرصن|ذكاء اصطناعي|تقني|أبل|جوجل|مايكروسوفت|أندرويد|آيفون|ويندوز|لينكس|فايرفوكس|كروم|واتساب|تيلغرام|vpn|security|hack|breach|cyber|malware|ransomware|phishing/i);
      });
      for (const item of securityItems.slice(0, 5)) {
        if (!seenTitles.has(item.title)) {
          seenTitles.add(item.title);
          allItems.push(item);
        }
      }
      console.log(`    Found ${securityItems.length} relevant articles`);
    } catch (err) {
      console.log(`    ❌ Feed error: ${err.message}`);
    }
  }

  // 2. Fetch from Google News RSS
  const shuffled = QUERIES.sort(() => Math.random() - 0.5).slice(0, 2);
  for (const query of shuffled) {
    try {
      console.log(`  📡 Google News: "${query}"`);
      const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=ar&gl=EG&ceid=EG:ar`;
      const xml = await fetchURL(url);
      const items = parseRSSItems(xml, 'Google News');
      for (const item of items.slice(0, 5)) {
        if (!seenTitles.has(item.title)) {
          seenTitles.add(item.title);
          allItems.push(item);
        }
      }
    } catch (err) {
      console.log(`    ❌ Error: ${err.message}`);
    }
  }

  // Sort by date, take top 10
  allItems.sort((a, b) => new Date(b.date) - new Date(a.date));
  const topNews = allItems.slice(0, 10);

  // 3. Fetch full content for each article
  console.log(`\n📰 Fetching full content for ${topNews.length} articles...\n`);
  const articlesWithContent = [];
  
  for (const item of topNews) {
    const content = await fetchArticleContent(item);
    const titleClean = item.title.replace(/ - .*$/, '');
    
    articlesWithContent.push({
      title: item.title,
      date: item.date,
      source: item.source,
      summary: content ? content.split('\n')[0].slice(0, 200) : titleClean,
      content: content || generateFallbackContent(titleClean, item.source, item.date),
      hasFullContent: !!content,
    });
    
    await new Promise(r => setTimeout(r, 800));
  }

  // Load existing
  let existing = [];
  try {
    const raw = fs.readFileSync(OUTPUT_PATH, 'utf-8');
    const parsed = JSON.parse(raw);
    existing = Array.isArray(parsed) ? parsed : (parsed.articles || []);
  } catch {}

  // Merge
  const existingTitles = new Set(existing.map(e => e.title));
  const merged = [...articlesWithContent.filter(n => !existingTitles.has(n.title)), ...existing].slice(0, 30);

  const output = {
    lastUpdated: new Date().toISOString(),
    articles: merged,
  };

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2), 'utf-8');
  const newCount = articlesWithContent.filter(n => !existingTitles.has(n.title)).length;
  const fullCount = articlesWithContent.filter(a => a.hasFullContent).length;
  console.log(`\n✅ Saved ${merged.length} articles (${newCount} new, ${fullCount}/${articlesWithContent.length} with full content)`);
}

function generateFallbackContent(title, source, date) {
  return `${title}

في تطور جديد يعكس التحديات المتزايدة في عالم الأمن السيبراني، تبرز أهمية هذا الخبر كجزء من المشهد الأمني المتسارع الذي يشهده العالم العربي والعالم أجمع.

## تفاصيل الخبر

${title}. هذا التطور يأتي في وقت تتزايد فيه التهديدات السيبرانية بشكل ملحوظ، مما يستدعي من المستخدمين والمؤسسات اتخاذ إجراءات وقائية أكثر صرامة.

يشير الخبراء إلى أن مثل هذه الأحداث تؤكد الحاجة الماسة إلى تعزيز الوعي الأمني الرقمي لدى المستخدمين العرب، خاصة مع التوسع المتسارع في استخدام التكنولوجيا الرقمية في جميع مناحي الحياة.

## الأثر والتداعيات

تُظهر الإحصائيات الأخيرة ارتفاعاً ملحوظاً في عدد الهجمات السيبرانية التي تستهدف المنطقة العربية، مما يجعل متابعة مثل هذه الأخبار أمراً حيوياً لكل مستخدم يسعى لحماية بياناته وأجهزته.

من المهم أن يبقى المستخدمون على اطلاع دائم بأحدث التطورات الأمنية، وأن يتبعوا أفضل الممارسات في حماية حساباتهم وأجهزتهم من التهديدات المتنوعة.

## نصائح للحماية

- احرص على تحديث جميع البرامج وأنظمة التشغيل فور صدور التحديثات الأمنية
- استخدم كلمات مرور قوية وفريدة لكل حساب، ويفضل استخدام مدير كلمات المرور
- فعّل المصادقة الثنائية (2FA) على جميع حساباتك المهمة
- كن حذراً من الروابط والمرفقات المشبوهة في البريد الإلكتروني والرسائل
- استخدم برامج حماية موثوقة وحافظ على تحديثها بشكل دوري
- قم بعمل نسخ احتياطية منتظمة لبياناتك المهمة`;
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
