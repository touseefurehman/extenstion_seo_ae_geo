import { describe, expect, it } from 'vitest';
import {
  fetchRobotsTxt,
  fetchSitemap,
  parseSitemapLines,
  type FetchLike,
} from '../../src/content/network';
import { mockFetch } from './helpers';

const origin = 'https://example.com';

describe('parseSitemapLines', () => {
  it('reads Sitemap lines case-insensitively and ignores other lines', () => {
    expect(
      parseSitemapLines(
        'User-agent: *\r\nsitemap: https://a.test/s.xml\nSITEMAP:https://a.test/t.xml\n# Sitemap: no',
      ),
    ).toEqual(['https://a.test/s.xml', 'https://a.test/t.xml']);
  });
});

describe('fetchRobotsTxt', () => {
  it('found: 200 text/plain', async () => {
    const r = await fetchRobotsTxt(
      origin,
      mockFetch({
        '/robots.txt': { status: 200, contentType: 'text/plain', body: 'User-agent: *' },
      }),
    );
    expect(r).toMatchObject({ status: 'found', httpStatus: 200, body: 'User-agent: *' });
  });

  it.each([404, 410])('not_found: HTTP %i', async (status) => {
    const r = await fetchRobotsTxt(origin, mockFetch({ '/robots.txt': { status } }));
    expect(r.status).toBe('not_found');
  });

  it('not_found: 200 that serves HTML (soft 404)', async () => {
    const r = await fetchRobotsTxt(
      origin,
      mockFetch({
        '/robots.txt': { status: 200, contentType: 'text/html; charset=utf-8', body: '<html>' },
      }),
    );
    expect(r.status).toBe('not_found');
    expect(r.reason).toMatch(/HTML/);
  });

  it.each([401, 403, 429, 500, 503])('inaccessible: HTTP %i', async (status) => {
    const r = await fetchRobotsTxt(origin, mockFetch({ '/robots.txt': { status } }));
    expect(r.status).toBe('inaccessible');
    expect(r.httpStatus).toBe(status);
  });

  it('inaccessible: network error / CSP block', async () => {
    const failing: FetchLike = async () => {
      throw new TypeError('Failed to fetch');
    };
    const r = await fetchRobotsTxt(origin, failing);
    expect(r.status).toBe('inaccessible');
    expect(r.reason).toMatch(/Failed to fetch/);
  });

  it('inaccessible: timeout', async () => {
    const hanging: FetchLike = () => new Promise(() => undefined);
    const r = await fetchRobotsTxt(origin, hanging, 20);
    expect(r.status).toBe('inaccessible');
    expect(r.reason).toMatch(/timed out/);
  });

  it('inaccessible: redirected to another origin', async () => {
    const redirected: FetchLike = async () => ({
      status: 200,
      url: 'https://other.test/robots.txt',
      headers: { get: () => 'text/plain' },
      text: async () => 'x',
    });
    const r = await fetchRobotsTxt(origin, redirected);
    expect(r.status).toBe('inaccessible');
    expect(r.reason).toMatch(/another origin/);
  });

  it('truncates a very large body and says so', async () => {
    const r = await fetchRobotsTxt(
      origin,
      mockFetch({
        '/robots.txt': { status: 200, contentType: 'text/plain', body: 'a'.repeat(150_000) },
      }),
    );
    expect(r.body?.length).toBe(100_000);
    expect(r.bodyTruncated).toBe(true);
  });
});

const robots = (sitemapUrls: string[]) =>
  ({
    status: 'found',
    url: null,
    httpStatus: 200,
    reason: null,
    body: '',
    bodyTruncated: false,
    sitemapUrls,
  }) as const;
const urlset = '<urlset><url><loc>a</loc></url><url><loc>b</loc></url></urlset>';

describe('fetchSitemap', () => {
  it('uses the same-origin sitemap declared in robots.txt', async () => {
    const r = await fetchSitemap(
      origin,
      robots(['https://example.com/map.xml']),
      mockFetch({ '/map.xml': { status: 200, contentType: 'text/xml', body: urlset } }),
    );
    expect(r).toMatchObject({ status: 'found', source: 'robots', kind: 'urlset', entryCount: 2 });
  });

  it('falls back to /sitemap.xml and recognizes a sitemap index', async () => {
    const r = await fetchSitemap(
      origin,
      robots([]),
      mockFetch({
        '/sitemap.xml': {
          status: 200,
          contentType: 'application/xml',
          body: '<sitemapindex><sitemap><loc>x</loc></sitemap></sitemapindex>',
        },
      }),
    );
    expect(r).toMatchObject({ status: 'found', source: 'default', kind: 'index', entryCount: 1 });
  });

  it('does not fetch a cross-origin sitemap and reports why', async () => {
    let called = false;
    const r = await fetchSitemap(origin, robots(['https://cdn.other.com/s.xml']), async () => {
      called = true;
      throw new Error('no');
    });
    expect(called).toBe(false);
    expect(r).toMatchObject({
      status: 'inaccessible',
      source: 'robots',
      url: 'https://cdn.other.com/s.xml',
    });
  });

  it('reports an invalid (relative) Sitemap line accurately instead of calling it cross-origin', async () => {
    const r = await fetchSitemap(origin, robots(['/sitemap.xml']), mockFetch());
    expect(r.status).toBe('inaccessible');
    expect(r.reason).toMatch(/not a valid absolute URL/);
  });

  it('not_found: 404, and 200 that is not sitemap XML', async () => {
    expect((await fetchSitemap(origin, robots([]), mockFetch())).status).toBe('not_found');
    const html = await fetchSitemap(
      origin,
      robots([]),
      mockFetch({
        '/sitemap.xml': { status: 200, contentType: 'text/html', body: '<html></html>' },
      }),
    );
    expect(html.status).toBe('not_found');
  });

  it('inaccessible: 403 and compressed sitemaps', async () => {
    expect(
      (await fetchSitemap(origin, robots([]), mockFetch({ '/sitemap.xml': { status: 403 } })))
        .status,
    ).toBe('inaccessible');
    const gz = await fetchSitemap(origin, robots(['https://example.com/s.xml.gz']), mockFetch());
    expect(gz).toMatchObject({
      status: 'inaccessible',
      reason: expect.stringMatching(/compressed/),
    });
  });
});
