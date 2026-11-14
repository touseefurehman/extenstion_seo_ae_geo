// Generates tests/fixtures/very-large.html (deterministic). The file is git-ignored.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const WORDS =
  'coffee roast bean grind brew water filter pour bloom extract acidity aroma body finish origin farm process wash natural honey espresso drip cold steep ratio scale kettle temperature'.split(
    ' ',
  );

export function generateLargeFixture(outFile) {
  let seed = 42;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
  const sentence = (n) =>
    Array.from({ length: n }, () => WORDS[Math.floor(rand() * WORDS.length)]).join(' ');

  const out = [];
  out.push(
    '<!doctype html><html lang="en"><head><meta charset="utf-8">',
    '<title>Very large page used to test extraction limits and truncation</title>',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
  );
  for (let i = 0; i < 350; i++) out.push(`<link rel="stylesheet" href="/css/s${i}.css">`);
  for (let i = 0; i < 350; i++) out.push(`<script src="/js/s${i}.js" async></script>`);
  out.push(
    `<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@type': 'WebPage', name: 'Large' })}</script>`,
    '</head><body><main><h1>Very large page</h1>',
  );
  for (let i = 0; i < 4000; i++) {
    if (i % 7 === 0) out.push(`<h${2 + (i % 2)}>Section ${i / 7}</h${2 + (i % 2)}>`);
    out.push(`<p>${sentence(80)}</p>`);
  }
  for (let i = 0; i < 120; i++) {
    out.push(
      `<ul>${Array.from({ length: 40 }, (_, j) => `<li>Item ${i}.${j} ${sentence(4)}</li>`).join('')}</ul>`,
    );
    out.push(
      `<table><caption>Table ${i}</caption><tr><th>A</th><th>B</th></tr><tr><td>1</td><td>2</td></tr></table>`,
    );
  }
  for (let i = 0; i < 1100; i++)
    out.push(`<img src="/img/photo-${i}.jpg" alt="Photo ${i}" width="400" height="300">`);
  for (let i = 0; i < 3200; i++) {
    const href =
      i % 4 === 0
        ? `https://other.example.org/page-${i}`
        : i % 4 === 1
          ? `#sec-${i}`
          : `/internal/page-${i}`;
    out.push(`<a href="${href}">Link number ${i}</a>`);
  }
  out.push('</main></body></html>');
  const html = out.join('\n');
  mkdirSync(dirname(outFile), { recursive: true });
  writeFileSync(outFile, html);
  return html.length;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const size = generateLargeFixture(resolve(root, 'tests/fixtures/very-large.html'));
  console.log(`very-large.html written (${size} characters)`);
}
