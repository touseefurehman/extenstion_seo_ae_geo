// Builds the extension into dist/. Separate Vite builds are needed because the content script and
// service worker must be self-contained files, while the popup/dashboard are HTML apps.
import { build } from 'vite';
import react from '@vitejs/plugin-react';
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const watch = process.argv.includes('--watch');
// --e2e adds localhost-only host access so automated tests can analyze pages without clicking the
// toolbar icon (which is what grants activeTab). Never used for the shipped build.
const e2e = process.argv.includes('--e2e');
const dist = resolve(root, e2e ? 'dist-e2e' : 'dist');

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });
const manifest = JSON.parse(readFileSync(resolve(root, 'extension/manifest.json'), 'utf8'));
if (e2e) manifest.host_permissions = ['http://localhost/*', 'http://127.0.0.1/*'];
writeFileSync(resolve(dist, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
cpSync(resolve(root, 'extension/icons'), resolve(dist, 'icons'), { recursive: true });

const common = {
  configFile: false,
  logLevel: 'warn',
  build: { outDir: dist, emptyOutDir: false, minify: !watch, watch: watch ? {} : null },
};

/** A single-file script bundle (classic script, no imports at runtime). */
function scriptConfig(name, entry, { exports, footer } = {}) {
  return {
    ...common,
    build: {
      ...common.build,
      lib: { entry: resolve(root, entry), formats: ['iife'], name, fileName: () => `${name}.js` },
      rollupOptions: { output: { exports: exports ?? 'none' } },
    },
    plugins: footer
      ? [
          {
            // output.footer is not honored by this Vite version, so append it explicitly.
            name: 'nexusrank-footer',
            generateBundle(_options, bundle) {
              for (const file of Object.values(bundle)) {
                if (file.type === 'chunk') file.code += `\n${footer}\n`;
              }
            },
          },
        ]
      : [],
  };
}

const configs = [
  {
    ...common,
    root: resolve(root, 'src'),
    base: './',
    plugins: [
      react(),
      {
        // jsPDF carries a CDN fallback URL for its pdfobject output mode, which NexusRank never uses.
        // Remove it so no remote script location exists anywhere in the bundle.
        name: 'nexusrank-strip-remote-urls',
        transform(code, id) {
          if (!/jspdf/i.test(id)) return null;
          const cleaned = code.replace(/https?:\/\/cdnjs\.cloudflare\.com\/[^"'`\s)]*/g, '');
          return cleaned === code ? null : { code: cleaned, map: null };
        },
      },
    ],
    resolve: {
      alias: {
        html2canvas: resolve(root, 'scripts/empty-module.js'),
        dompurify: resolve(root, 'scripts/empty-module.js'),
        canvg: resolve(root, 'scripts/empty-module.js'),
      },
    },
    build: {
      ...common.build,
      rollupOptions: {
        input: {
          popup: resolve(root, 'src/popup/popup.html'),
          dashboard: resolve(root, 'src/dashboard/dashboard.html'),
        },
      },
    },
  },
  scriptConfig('background', 'src/background/index.ts'),
  // Footer makes the IIFE's value the script's completion value (what executeScript returns).
  scriptConfig('content', 'src/content/index.ts', { exports: 'default', footer: 'content;' }),
];

if (watch) {
  await Promise.all(configs.map((c) => build(c)));
} else {
  for (const c of configs) await build(c);
  console.log(
    `NexusRank built into ${e2e ? 'dist-e2e/ (test variant with localhost host access)' : 'dist/'}`,
  );
}
