// Builds the extension into dist/. Separate Vite builds are needed because the content script and
// service worker must be self-contained files, while the popup/dashboard are HTML apps.
import { build } from 'vite';
import react from '@vitejs/plugin-react';
import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const watch = process.argv.includes('--watch');
const dist = resolve(root, 'dist');

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });
cpSync(resolve(root, 'extension/manifest.json'), resolve(dist, 'manifest.json'));
cpSync(resolve(root, 'extension/icons'), resolve(dist, 'icons'), { recursive: true });

const common = {
  configFile: false,
  logLevel: 'warn',
  build: { outDir: dist, emptyOutDir: false, minify: false, watch: watch ? {} : null },
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
    plugins: [react()],
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
  console.log('NexusRank built into dist/');
}
