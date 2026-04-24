// Auto-translate daily news articles to all supported languages
// Uses free Google Translate API (unofficial endpoint, no API key needed)
import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const NEWS_PATH = path.join(__dirname, '..', 'src', 'data', 'dailyNews.json');

// All target languages (skip 'en' as it's the source)
const LANGS = ['ar', 'fr', 'de', 'es', 'tr', 'ru'];

// Language names for logging
const LANG_NAMES = { ar: 'Arabic', fr: 'French', de: 'German', es: 'Spanish', tr: 'Turkish', ru: 'Russian' };

// Google Translate free endpoint
function translate(text, targetLang) {
  return new Promise((resolve, reject) => {
    if (!text || text.trim().length === 0) return resolve('');

    // Chunk large texts (Google limits ~5000 chars per request)
    const MAX_CHUNK = 4500;
    if (text.length > MAX_CHUNK) {
      // Split by double newlines or sentences
      const chunks = [];
      let current = '';
      const lines = text.split('\n');
      for (const line of lines) {
        if ((current + '\n' + line).length > MAX_CHUNK && current.length > 0) {
          chunks.push(current);
          current = line;
        } else {
          current = current ? current + '\n' + line : line;
        }
      }
      if (current) chunks.push(current);

      // Translate each chunk sequentially
      const translateChunks = async () => {
        const results = [];
        for (const chunk of chunks) {
          const result = await translate(chunk, targetLang);
          results.push(result);
          await sleep(300); // Rate limit between chunks
        }
        return results.join('\n');
      };
      return translateChunks().then(resolve).catch(reject);
    }

    const encodedText = encodeURIComponent(text);
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${targetLang}&dt=t&q=${encodedText}`;

    const req = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
      },
      timeout: 30000,
    }, (res) => {
      let data = '';
      res.setEncoding('utf-8');
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          // Response is [ [ [translated, original], ... ] ]
          if (json && json[0]) {
            const translated = json[0]
              .filter(part => part && part[0])
              .map(part => part[0])
              .join('');
            resolve(translated);
          } else {
            resolve(text); // Fallback to original
          }
        } catch (err) {
          console.warn(`    ⚠️ Parse error for ${targetLang}: ${err.message}`);
          resolve(text); // Fallback to original
        }
      });
      res.on('error', (err) => {
        console.warn(`    ⚠️ Response error: ${err.message}`);
        resolve(text);
      });
    });
    req.on('error', (err) => {
      console.warn(`    ⚠️ Request error: ${err.message}`);
      resolve(text);
    });
    req.on('timeout', () => {
      req.destroy();
      console.warn(`    ⚠️ Timeout for ${targetLang}`);
      resolve(text);
    });
  });
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function main() {
  console.log('🌍 JoeScan — Auto Translation Engine\n');

  // Read the current news file
  let data;
  try {
    const raw = fs.readFileSync(NEWS_PATH, 'utf-8');
    data = JSON.parse(raw);
  } catch (err) {
    console.error('❌ Could not read dailyNews.json:', err.message);
    process.exit(1);
  }

  const articles = data.articles || [];
  if (articles.length === 0) {
    console.log('  ℹ️ No articles to translate.');
    process.exit(0);
  }

  // Find articles that haven't been translated yet
  const untranslated = articles.filter(a => !a.translations || Object.keys(a.translations).length < LANGS.length);

  if (untranslated.length === 0) {
    console.log('  ✅ All articles are already translated.');
    process.exit(0);
  }

  console.log(`  📰 Found ${untranslated.length} articles needing translation\n`);

  let translated = 0;

  for (const article of untranslated) {
    console.log(`  📄 "${article.title.slice(0, 60)}..."`);

    if (!article.translations) {
      article.translations = {};
    }

    for (const lang of LANGS) {
      // Skip if this language is already translated
      if (article.translations[lang] && article.translations[lang].title) {
        continue;
      }

      console.log(`    🔤 → ${LANG_NAMES[lang]}...`);

      try {
        // Translate title
        const translatedTitle = await translate(article.title, lang);
        await sleep(200);

        // Translate summary (shorter text)
        const translatedSummary = article.summary ? await translate(article.summary, lang) : '';
        await sleep(200);

        // Translate content (longer text, chunked automatically)
        let translatedContent = '';
        if (article.content && article.content.length > 0) {
          // For content, preserve markdown structure
          // Split by markdown headers and translate blocks
          translatedContent = await translateMarkdown(article.content, lang);
          await sleep(300);
        }

        article.translations[lang] = {
          title: translatedTitle,
          summary: translatedSummary,
          content: translatedContent,
        };

        console.log(`      ✅ ${LANG_NAMES[lang]} done (title: ${translatedTitle.length} chars)`);
      } catch (err) {
        console.log(`      ❌ ${LANG_NAMES[lang]} failed: ${err.message}`);
        // Store partial translation with original for fallback
        if (!article.translations[lang]) {
          article.translations[lang] = {
            title: article.title,
            summary: article.summary || '',
            content: article.content || '',
          };
        }
      }

      // Rate limit between languages
      await sleep(500);
    }

    translated++;
    console.log(`    ✅ Article translated to ${LANGS.length} languages\n`);

    // Rate limit between articles
    await sleep(1000);
  }

  // Save back
  fs.writeFileSync(NEWS_PATH, JSON.stringify(data, null, 2), 'utf-8');

  console.log(`\n✅ Translation complete: ${translated} articles translated to ${LANGS.length} languages`);
  console.log(`   Total articles with translations: ${articles.filter(a => a.translations && Object.keys(a.translations).length > 0).length}/${articles.length}`);
}

// Translate markdown content preserving structure
async function translateMarkdown(content, lang) {
  // Split into blocks by double newlines
  const blocks = content.split(/\n\n+/);
  const translatedBlocks = [];

  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed) continue;

    // Preserve markdown headers
    if (trimmed.startsWith('## ') || trimmed.startsWith('### ')) {
      const prefix = trimmed.startsWith('### ') ? '### ' : '## ';
      const headerText = trimmed.replace(/^#{2,3}\s+/, '');
      const translated = await translate(headerText, lang);
      translatedBlocks.push(`${prefix}${translated}`);
      await sleep(150);
    }
    // Preserve list items
    else if (trimmed.startsWith('- ')) {
      const items = trimmed.split('\n').filter(l => l.trim());
      const translatedItems = [];
      for (const item of items) {
        const text = item.replace(/^-\s+/, '');
        const translated = await translate(text, lang);
        translatedItems.push(`- ${translated}`);
        await sleep(100);
      }
      translatedBlocks.push(translatedItems.join('\n'));
    }
    // Preserve blockquotes
    else if (trimmed.startsWith('> ')) {
      const text = trimmed.replace(/^>\s+/, '');
      const translated = await translate(text, lang);
      translatedBlocks.push(`> ${translated}`);
      await sleep(150);
    }
    // Preserve separators
    else if (trimmed === '---') {
      translatedBlocks.push('---');
    }
    // Regular paragraphs
    else {
      const translated = await translate(trimmed, lang);
      translatedBlocks.push(translated);
      await sleep(150);
    }
  }

  return translatedBlocks.join('\n\n');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
