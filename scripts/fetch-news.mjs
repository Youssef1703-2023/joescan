// Fetch FULL cybersecurity articles from multiple trusted sources
// Primary: KrebsOnSecurity (full content in RSS), The Hacker News, Cyber Security News
import https from 'https';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = path.join(__dirname, '..', 'src', 'data', 'dailyNews.json');

const INITIAL_COUNT = 15;
const DAILY_COUNT = 2;

// RSS feeds with FULL article content in RSS content:encoded
const FEEDS = [
  { name: 'KrebsOnSecurity', url: 'https://krebsonsecurity.com/feed/', limit: 10 },
  { name: 'Cyber Security News', url: 'https://cybersecuritynews.com/feed/', limit: 15 },
];

function fetchURL(url, maxRedirects = 8) {
  return new Promise((resolve, reject) => {
    if (maxRedirects <= 0) return reject(new Error('Too many redirects'));
    const lib = url.startsWith('https') ? https : http;
    const req = lib.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'identity',
      },
      timeout: 25000,
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
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/&hellip;/g, '…').replace(/&mdash;/g, '—').replace(/&ndash;/g, '–')
    .replace(/&laquo;/g, '«').replace(/&raquo;/g, '»')
    .replace(/&rsquo;/g, '\u2019').replace(/&lsquo;/g, '\u2018')
    .replace(/&rdquo;/g, '\u201D').replace(/&ldquo;/g, '\u201C');
}

function stripHTML(html) {
  return html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

function htmlToMarkdown(html) {
  let clean = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
    .replace(/<ins[\s\S]*?<\/ins>/gi, '')
    .replace(/<aside[\s\S]*?<\/aside>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<figure[\s\S]*?<\/figure>/gi, '')
    .replace(/<img[^>]*>/gi, '');

  // Extract structured content
  const parts = [];
  
  // Split by headings and paragraphs
  const regex = /<(h[1-6]|p|li|blockquote)[^>]*>([\s\S]*?)<\/\1>/gi;
  let m;
  while ((m = regex.exec(clean)) !== null) {
    const tag = m[1].toLowerCase();
    let text = decodeHTML(stripHTML(m[2])).trim();
    
    if (text.length < 20) continue;
    
    // Filter junk
    if (text.match(/^(Read Also|Found this|Follow us|Subscribe|Share this|SHARE|Related|Advertisement|Sign Up|Click here|Tags:|Category:|Posted in)/i)) continue;
    if (text.includes('newsletter') || text.includes('SUBSCRIBE') || text.includes('Join our')) continue;
    
    if (tag.startsWith('h')) {
      if (text.length > 5 && text.length < 200) {
        parts.push(`\n## ${text}\n`);
      }
    } else if (tag === 'li') {
      parts.push(`- ${text}`);
    } else if (tag === 'blockquote') {
      parts.push(`> ${text}`);
    } else {
      parts.push(`\n${text}\n`);
    }
  }

  return parts.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

function parseRSSItems(xml, feedName) {
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;
  while ((match = itemRegex.exec(xml)) !== null) {
    const x = match[1];
    const title = decodeHTML((x.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || '').trim();
    const link = decodeHTML((x.match(/<link>([\s\S]*?)<\/link>/) || [])[1] || '').trim();
    const pubDate = (x.match(/<pubDate>([\s\S]*?)<\/pubDate>/) || [])[1] || '';
    const contentEncoded = (x.match(/<content:encoded>([\s\S]*?)<\/content:encoded>/) || [])[1] || '';
    const description = (x.match(/<description>([\s\S]*?)<\/description>/) || [])[1] || '';

    const categories = [];
    const catRegex = /<category[^>]*>([\s\S]*?)<\/category>/gi;
    let catMatch;
    while ((catMatch = catRegex.exec(x)) !== null) {
      categories.push(decodeHTML(catMatch[1]).trim());
    }

    if (title && title.length > 10) {
      items.push({
        title,
        link,
        date: pubDate ? new Date(pubDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        source: feedName,
        rssContent: contentEncoded || description,
        categories: categories.slice(0, 5),
      });
    }
  }
  return items;
}

async function scrapeArticlePage(url) {
  try {
    const html = await fetchURL(url);
    if (html.length < 2000) return null;

    // Remove noise
    let clean = html
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<nav[\s\S]*?<\/nav>/gi, '')
      .replace(/<header[\s\S]*?<\/header>/gi, '')
      .replace(/<footer[\s\S]*?<\/footer>/gi, '')
      .replace(/<aside[\s\S]*?<\/aside>/gi, '')
      .replace(/<!--[\s\S]*?-->/g, '');

    // Try to find main content area
    const contentPatterns = [
      /<article[^>]*>([\s\S]*?)<\/article>/i,
      /<div[^>]*class="[^"]*(?:entry|post|article)[_-]?(?:content|body|text)[^"]*"[^>]*>([\s\S]*?)<\/div>\s*(?:<\/div|<div[^>]*class)/i,
      /<div[^>]*class="[^"]*content[_-]?(?:body|area|main)[^"]*"[^>]*>([\s\S]*?)<\/div>\s*(?:<\/div|<div[^>]*class)/i,
    ];

    let articleHtml = '';
    for (const pattern of contentPatterns) {
      const m = clean.match(pattern);
      if (m && m[1] && m[1].length > 500) {
        articleHtml = m[1];
        break;
      }
    }

    if (!articleHtml) {
      // Fallback: get all long paragraphs
      const paragraphs = [];
      const pRegex = /<p[^>]*>([\s\S]*?)<\/p>/gi;
      let pm;
      while ((pm = pRegex.exec(clean)) !== null) {
        const text = decodeHTML(stripHTML(pm[1])).trim();
        if (text.length > 60) paragraphs.push(text);
      }
      if (paragraphs.length >= 3) {
        return paragraphs.join('\n\n');
      }
      return null;
    }

    return htmlToMarkdown(articleHtml);
  } catch (err) {
    return null;
  }
}

async function getFullContent(item) {
  // Method 1: Extract from RSS content:encoded (works great for KrebsOnSecurity)
  if (item.rssContent && item.rssContent.length > 500) {
    const content = htmlToMarkdown(item.rssContent);
    if (content.length > 500) {
      return { content, method: 'RSS content:encoded' };
    }
  }

  // Method 2: Scrape the actual page directly
  if (item.link) {
    console.log(`    🌐 Scraping page...`);
    const content = await scrapeArticlePage(item.link);
    if (content && content.length > 500) {
      return { content, method: 'Page scrape' };
    }
  }

  // Method 3: Use RSS description if available
  if (item.rssContent) {
    const text = decodeHTML(stripHTML(item.rssContent)).trim();
    if (text.length > 100) {
      return { content: text, method: 'RSS description' };
    }
  }

  return null;
}

async function main() {
  console.log('🔒 JoeScan — Fetching Full Cybersecurity Articles\n');

  let existing = [];
  try {
    const raw = fs.readFileSync(OUTPUT_PATH, 'utf-8');
    const parsed = JSON.parse(raw);
    existing = Array.isArray(parsed) ? parsed : (parsed.articles || []);
  } catch {}

  const isInitialRun = existing.length === 0;
  const targetCount = isInitialRun ? INITIAL_COUNT : DAILY_COUNT;
  console.log(`  Mode: ${isInitialRun ? `INITIAL (${INITIAL_COUNT} articles)` : `DAILY UPDATE (${DAILY_COUNT} new articles)`}\n`);

  const allRSSItems = [];
  const seenTitles = new Set(existing.map(e => e.title));

  // Fetch all RSS feeds
  for (const feed of FEEDS) {
    try {
      console.log(`  📡 ${feed.name}...`);
      const xml = await fetchURL(feed.url);
      const items = parseRSSItems(xml, feed.name);
      const newItems = items.filter(i => !seenTitles.has(i.title));
      for (const item of newItems) {
        seenTitles.add(item.title);
        allRSSItems.push(item);
      }
      console.log(`    ${items.length} total, ${newItems.length} new\n`);
    } catch (err) {
      console.log(`    ❌ Error: ${err.message}\n`);
    }
  }

  // Sort by date, take what we need
  allRSSItems.sort((a, b) => new Date(b.date) - new Date(a.date));
  const toProcess = allRSSItems.slice(0, targetCount);

  if (toProcess.length === 0) {
    console.log('  ℹ️  No new articles to add.');
    process.exit(0);
  }

  console.log(`📰 Fetching full content for ${toProcess.length} articles...\n`);
  const results = [];

  for (const item of toProcess) {
    console.log(`  📄 [${item.source}] "${item.title.slice(0, 65)}..."`);
    
    const result = await getFullContent(item);
    
    if (result) {
      const wordCount = result.content.split(/\s+/).length;
      console.log(`    ✅ ${result.content.length} chars, ~${wordCount} words [${result.method}]\n`);
      
      results.push({
        title: item.title,
        date: item.date,
        source: item.source,
        categories: item.categories,
        summary: result.content.split('\n').find(l => l.trim().length > 50 && !l.startsWith('#'))?.slice(0, 250) || item.title,
        content: result.content,
        hasFullContent: result.content.length > 500,
        readTime: `${Math.max(3, Math.ceil(wordCount / 200))} min`,
      });
    } else {
      console.log(`    ⚠️ No content available, skipping\n`);
    }

    await new Promise(r => setTimeout(r, 1500));
  }

  // Merge
  const merged = [...results, ...existing].slice(0, 50);

  const output = {
    lastUpdated: new Date().toISOString(),
    articles: merged,
  };

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2), 'utf-8');
  const fullCount = results.filter(a => a.hasFullContent).length;
  console.log(`\n✅ Total: ${merged.length} articles | New: ${results.length} | Full content: ${fullCount}/${results.length}`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
