// Privacy and permissions audit of the built extension. Run after `npm run build`.
// Exits non-zero when a rule is violated.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = resolve(root, process.argv[2] ?? 'dist');
const problems = [];
const fail = (msg) => problems.push(msg);

function walk(dir) {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}
const files = walk(dist);
const text = (f) => readFileSync(f, 'utf8');
const isText = (f) => /\.(js|css|html|json|svg|map|txt)$/i.test(f);

// 1. Manifest: least privilege, no remote surface.
const manifest = JSON.parse(text(join(dist, 'manifest.json')));
const expected = ['activeTab', 'scripting', 'storage'];
if (JSON.stringify([...(manifest.permissions ?? [])].sort()) !== JSON.stringify(expected))
  fail(
    `permissions must be exactly ${expected.join(', ')}; found ${JSON.stringify(manifest.permissions)}`,
  );
for (const key of [
  'host_permissions',
  'optional_host_permissions',
  'content_scripts',
  'externally_connectable',
  'web_accessible_resources',
  'update_url',
]) {
  if (
    manifest[key] !== undefined &&
    !(key === 'host_permissions' && process.argv.includes('--allow-test-hosts'))
  )
    fail(`manifest must not declare ${key}`);
}
const csp = manifest.content_security_policy?.extension_pages ?? '';
if (!/script-src 'self'/.test(csp) || /unsafe-eval|unsafe-inline|https?:/.test(csp))
  fail(`unexpected extension_pages CSP: ${csp}`);

// 2. Remote URLs: only namespace identifiers / inert strings are allowed anywhere in dist.
const ALLOWED = [
  /^https?:\/\/www\.w3\.org\//, // XML/SVG/MathML namespace identifiers
  /^https?:\/\/schema\.org\b/, // schema.org vocabulary string literals
  /^https:\/\/react\.dev\/errors/, // error-message pointer text in React production builds (never fetched)
  /^http:\/\/jspdf\.default\.namespaceuri\//, // internal jsPDF XMP namespace identifier
];
const urlRe = /https?:\/\/[^\s"'`<>)\\]+/g;
const seen = new Map();
for (const f of files.filter(isText)) {
  for (const u of text(f).match(urlRe) ?? []) {
    if (ALLOWED.some((a) => a.test(u))) continue;
    seen.set(u, relative(dist, f));
  }
}
for (const [u, f] of seen) fail(`unexpected remote URL ${u} in ${f}`);

// 3. Pages must not load remote scripts, styles, fonts or frames.
for (const f of files.filter((x) => x.endsWith('.html'))) {
  const html = text(f);
  if (/(?:src|href)\s*=\s*["']\s*(?:https?:)?\/\//i.test(html))
    fail(`${relative(dist, f)} references a remote resource`);
  if (/<iframe|<object|<embed/i.test(html)) fail(`${relative(dist, f)} embeds external content`);
}
for (const f of files.filter((x) => x.endsWith('.css'))) {
  if (/@import|url\(\s*["']?(?:https?:)?\/\//i.test(text(f)))
    fail(`${relative(dist, f)} imports a remote stylesheet or font`);
}

// 4. Own source: the only network code is the same-origin robots.txt/sitemap fetch in the content script.
const srcFiles = walk(join(root, 'src')).filter((f) => /\.(ts|tsx)$/.test(f));
for (const f of srcFiles) {
  const rel = relative(root, f);
  const src = text(f).replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
  if (
    /XMLHttpRequest|WebSocket|sendBeacon|EventSource|importScripts|navigator\.connection/.test(src)
  )
    fail(`${rel} uses a network API that is not allowed`);
  if (/\bfetch\s*\(|globalThis\.fetch|window\.fetch/.test(src) && !rel.startsWith('src/content/'))
    fail(`${rel} calls fetch outside the content script`);
  if (/\beval\s*\(|new Function\s*\(/.test(src)) fail(`${rel} evaluates dynamic code`);
}
const net = text(join(root, 'src/content/network.ts'));
if (!/origin/.test(net) || !/another origin/.test(net))
  fail('src/content/network.ts must enforce same-origin requests');

// 5. Fonts: system stacks only.
for (const f of files)
  if (/\.(woff2?|ttf|otf|eot)$/i.test(f)) fail(`font file shipped: ${relative(dist, f)}`);

if (problems.length) {
  console.error(`Audit FAILED (${problems.length}):\n - ${problems.join('\n - ')}`);
  process.exit(1);
}
console.log(
  `Audit passed: ${files.length} files, permissions = ${expected.join(', ')}, no remote URLs, no remote fonts/scripts.`,
);
