import {
  test as base,
  chromium,
  expect,
  type BrowserContext,
  type Page,
  type Worker,
} from '@playwright/test';
import { createServer, type Server } from 'node:http';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

export { expect };

const EXTENSION_PATH = resolve(import.meta.dirname, '../../dist-e2e');
const FIXTURES = resolve(import.meta.dirname, '../fixtures');

const SITEMAP =
  '<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>http://x/</loc></url><url><loc>http://x/a</loc></url></urlset>';

/** Serves tests/fixtures/*.html plus robots.txt and a sitemap, on a random localhost port. */
function startServer(): Promise<{ server: Server; baseUrl: string }> {
  return new Promise((done) => {
    const server = createServer((req, res) => {
      const path = (req.url ?? '/').split('?')[0]!;
      const send = (status: number, type: string, body: string) => {
        res.writeHead(status, { 'content-type': type });
        res.end(body);
      };
      if (path === '/robots.txt')
        return send(
          200,
          'text/plain',
          'User-agent: *\nAllow: /\nSitemap: /sitemap.xml\n'.replace(
            '/sitemap.xml',
            `http://127.0.0.1:${(server.address() as { port: number }).port}/sitemap.xml`,
          ),
        );
      if (path === '/sitemap.xml') return send(200, 'application/xml', SITEMAP);
      if (path.startsWith('/assets/'))
        return send(200, path.endsWith('.css') ? 'text/css' : 'text/javascript', '');
      if (/\.(jpg|png|svg)$/.test(path))
        return send(
          200,
          'image/svg+xml',
          '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>',
        );
      const name = path.replace(/^\//, '').replace(/\.html$/, '') || 'well-optimized';
      const file = join(FIXTURES, `${name}.html`);
      if (/^[a-z-]+$/.test(name) && existsSync(file))
        return send(200, 'text/html', readFileSync(file, 'utf8'));
      return send(404, 'text/plain', 'not found');
    });
    server.listen(0, '127.0.0.1', () =>
      done({ server, baseUrl: `http://127.0.0.1:${(server.address() as { port: number }).port}` }),
    );
  });
}

interface Fixtures {
  context: BrowserContext;
  extensionId: string;
  serviceWorker: Worker;
  baseUrl: string;
  /** Console errors from extension pages and the service worker (fixture pages are ignored). */
  extensionErrors: string[];
  /** Opens a fixture page, then analyzes it through the real popup. Returns the popup page. */
  analyze: (fixture: string) => Promise<Page>;
}

export const test = base.extend<Fixtures, { server: { baseUrl: string } }>({
  server: [
    async ({}, use) => {
      const { server, baseUrl } = await startServer();
      await use({ baseUrl });
      server.close();
    },
    { scope: 'worker' },
  ],
  baseUrl: async ({ server }, use) => use(server.baseUrl),

  context: async ({}, use) => {
    const profile = mkdtempSync(join(tmpdir(), 'nexusrank-e2e-'));
    const context = await chromium.launchPersistentContext(profile, {
      ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}),
      headless: true,
      args: [
        '--headless=new',
        '--no-sandbox',
        `--disable-extensions-except=${EXTENSION_PATH}`,
        `--load-extension=${EXTENSION_PATH}`,
      ],
      acceptDownloads: true,
    });
    await use(context);
    await context.close();
    rmSync(profile, { recursive: true, force: true });
  },

  serviceWorker: async ({ context }, use) => {
    let [sw] = context.serviceWorkers();
    if (!sw) sw = await context.waitForEvent('serviceworker');
    await use(sw);
  },

  extensionId: async ({ serviceWorker }, use) => use(serviceWorker.url().split('/')[2]!),

  extensionErrors: async ({ context, serviceWorker }, use) => {
    const errors: string[] = [];
    const watch = (page: Page) => {
      if (!page.url().startsWith('chrome-extension://') && page.url() !== 'about:blank') return;
      page.on('console', (m) => m.type() === 'error' && errors.push(`console: ${m.text()}`));
      page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    };
    context.on('page', (p) => {
      // The URL is only known after navigation starts; attach listeners to every page and filter by origin.
      p.on(
        'console',
        (m) =>
          m.type() === 'error' &&
          p.url().startsWith('chrome-extension://') &&
          errors.push(`console: ${m.text()}`),
      );
      p.on(
        'pageerror',
        (e) => p.url().startsWith('chrome-extension://') && errors.push(`pageerror: ${e.message}`),
      );
    });
    context.pages().forEach(watch);
    serviceWorker.on(
      'console',
      (m) => m.type() === 'error' && errors.push(`service worker: ${m.text()}`),
    );
    await use(errors);
  },

  analyze: async ({ context, serviceWorker, extensionId, baseUrl, extensionErrors }, use) => {
    void extensionErrors;
    await use(async (fixture) => {
      const url = `${baseUrl}/${fixture}.html`;
      const page = await context.newPage();
      await page.goto(url);
      const tabId = await serviceWorker.evaluate(async (target) => {
        const tabs = await chrome.tabs.query({});
        return tabs.find((t) => t.url === target)?.id ?? null;
      }, url);
      expect(tabId, `tab for ${url}`).not.toBeNull();
      const popup = await context.newPage();
      await popup.goto(`chrome-extension://${extensionId}/popup/popup.html?tabId=${tabId}`);
      await popup.getByRole('button', { name: 'Analyze page' }).click();
      await expect(popup.getByLabel(/Overall score: \d+ out of 100/)).toBeVisible();
      return popup;
    });
  },
});
