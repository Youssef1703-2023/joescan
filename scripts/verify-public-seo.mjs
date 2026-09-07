import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
const tools=JSON.parse(readFileSync('src/data/publicTools.json','utf8'));
const titles=new Set();const sitemap=readFileSync('dist/sitemap.xml','utf8');
for(const t of tools){const path='/tools/'+t.slug+'/';const html=readFileSync('dist'+path+'index.html','utf8');assert(html.includes('https://joescan.me'+path));assert.equal((html.match(/rel="canonical"/g)||[]).length,1);assert.equal((html.match(/<h1>/g)||[]).length,1);assert(!html.includes('noindex'));assert(!html.includes('location.replace'));assert(!html.includes('type="module"'));assert(html.includes('What it cannot tell you'));assert(html.includes('Know what you share.'));assert(html.includes(t.appPath+'?start=1'));assert(sitemap.includes('https://joescan.me'+path));const title=html.match(/<title>(.*?)<\/title>/)[1];assert(!titles.has(title));titles.add(title);const structured=JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);assert.equal(structured.url,'https://joescan.me'+path);for(const [,href] of html.matchAll(/href="(\/[^"?#]*)/g)){assert(existsSync('dist'+href)||existsSync('dist'+href+'.html'),'Broken local link: '+href);}const app=readFileSync('dist'+t.appPath+'/index.html','utf8');assert(app.includes('content="noindex, nofollow"'));assert(!sitemap.includes('<loc>https://joescan.me'+t.appPath+'</loc>'));}
for(const path of ['/admin','/history','/support','/api-keys']){assert(readFileSync('dist'+path+'/index.html','utf8').includes('noindex'));assert(!sitemap.includes('<loc>https://joescan.me'+path+'</loc>'));}
assert(readFileSync('dist/404.html','utf8').includes('noindex'));
assert(readFileSync('dist/index.html','utf8').includes('href="/tools/"'));
assert.equal((sitemap.match(/<loc>/g)||[]).length,tools.length+4);
console.log('SEO checks passed: '+tools.length+' public tool pages, internal links, metadata, structured data, sitemap and private route noindex.');
