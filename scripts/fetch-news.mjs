// Fetch Arabic cybersecurity news from Google News RSS (FREE - no API key needed)
import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = path.join(__dirname, '..', 'src', 'data', 'dailyNews.json');

// Multiple Arabic cyber security search queries for variety
const QUERIES = [
  'أمن سيبراني',
  'اختراق بيانات',
  'تسريب بيانات',
  'هجوم إلكتروني',
  'ثغرة أمنية',
  'احتيال إلكتروني',
  'حماية الخصوصية',
];

function fetchRSS(query) {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=ar&gl=EG&ceid=EG:ar`;
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
      res.on('error', reject);
    }).on('error', reject);
  });
}

function parseRSSItems(xml) {
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;
  while ((match = itemRegex.exec(xml)) !== null) {
    const itemXml = match[1];
    const title = (itemXml.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || '';
    const link = (itemXml.match(/<link>([\s\S]*?)<\/link>/) || [])[1] || '';
    const pubDate = (itemXml.match(/<pubDate>([\s\S]*?)<\/pubDate>/) || [])[1] || '';
    const source = (itemXml.match(/<source[^>]*>([\s\S]*?)<\/source>/) || [])[1] || 'مصدر إخباري';
    const description = (itemXml.match(/<description>([\s\S]*?)<\/description>/) || [])[1] || '';

    // Clean HTML from description
    const cleanDesc = description.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').trim();
    const cleanTitle = title.replace(/<!\[CDATA\[|\]\]>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').trim();

    if (cleanTitle && cleanTitle.length > 10) {
      items.push({
        title: cleanTitle,
        link,
        date: pubDate ? new Date(pubDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        source: source.replace(/<!\[CDATA\[|\]\]>/g, '').trim(),
        summary: cleanDesc.slice(0, 200) || cleanTitle,
      });
    }
  }
  return items;
}

async function main() {
  console.log('🔍 Fetching Arabic cybersecurity news...');
  const allItems = [];
  const seenTitles = new Set();

  // Pick 3 random queries for variety
  const shuffled = QUERIES.sort(() => Math.random() - 0.5).slice(0, 3);

  for (const query of shuffled) {
    try {
      console.log(`  📡 Query: "${query}"`);
      const xml = await fetchRSS(query);
      const items = parseRSSItems(xml);
      for (const item of items) {
        if (!seenTitles.has(item.title)) {
          seenTitles.add(item.title);
          allItems.push(item);
        }
      }
    } catch (err) {
      console.error(`  ❌ Error fetching "${query}":`, err.message);
    }
  }

  // Sort by date (newest first) and take top 10
  allItems.sort((a, b) => new Date(b.date) - new Date(a.date));
  const topNews = allItems.slice(0, 10);

  // Load existing daily news (keep last 30 days)
  let existing = [];
  try {
    const raw = fs.readFileSync(OUTPUT_PATH, 'utf-8');
    const parsed = JSON.parse(raw);
    existing = Array.isArray(parsed) ? parsed : (parsed.articles || []);
  } catch {}

  // Merge: add new, remove duplicates, keep max 30
  const existingTitles = new Set(existing.map(e => e.title));
  const merged = [...topNews.filter(n => !existingTitles.has(n.title)), ...existing].slice(0, 30);

  // Add metadata
  const output = {
    lastUpdated: new Date().toISOString(),
    articles: merged,
  };

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2), 'utf-8');
  console.log(`✅ Saved ${merged.length} articles (${topNews.filter(n => !existingTitles.has(n.title)).length} new)`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
