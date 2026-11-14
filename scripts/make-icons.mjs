// Generates extension/icons/*.png from an inline SVG. Run manually: node scripts/make-icons.mjs
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#4f8cff"/><stop offset="1" stop-color="#8b5cf6"/></linearGradient></defs>
  <rect width="128" height="128" rx="28" fill="#0f172a"/>
  <path d="M34 96V32h14l32 40V32h14v64H80L48 56v40z" fill="url(#g)"/>
</svg>`;

mkdirSync('extension/icons', { recursive: true });
for (const size of [16, 32, 48, 128]) {
  await sharp(Buffer.from(svg)).resize(size, size).png().toFile(`extension/icons/icon${size}.png`);
}
console.log('icons written');
