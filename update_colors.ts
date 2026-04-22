import fs from 'fs';
import path from 'path';

const files = [
  'src/components/EmailAnalyzer.tsx',
  'src/components/Auth.tsx',
  'src/App.tsx'
];

const replacements = [
  { from: /bg-\[#FF3B3B\]\/10/g, to: 'bg-error/10' },
  { from: /border-\[#FF3B3B\]\/30/g, to: 'border-error/30' },
  { from: /border-\[#FF3B3B\]\/50/g, to: 'border-error/50' },
  { from: /text-\[#FF3B3B\]/g, to: 'text-error' },
  { from: /text-\[#FF9F0A\]/g, to: 'text-warning' },
];

files.forEach(file => {
  const filePath = path.join(process.cwd(), file);
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf-8');
    replacements.forEach(({ from, to }) => {
      content = content.replace(from, to);
    });
    fs.writeFileSync(filePath, content);
    console.log(`Updated ${file}`);
  }
});
