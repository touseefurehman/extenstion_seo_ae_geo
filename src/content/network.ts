import type { RobotsTxtInfo, SitemapInfo } from '../types/snapshot';
import { LIMITS } from './limits';

/** Minimal slice of the Fetch API so tests can supply a stub. */
export interface ResponseLike {
  status: number;
  url: string;
  headers: { get(name: string): string | null };
  text(): Promise<string>;
}
export type FetchLike = (
  url: string,
  init?: { signal?: AbortSignal; credentials?: 'omit'; redirect?: 'follow' },
) => Promise<ResponseLike>;

type Fetched =
  | { ok: true; status: number; contentType: string; finalUrl: string; body: string }
  | { ok: false; reason: string };

/** Same-origin GET with a timeout. Never throws. */
async function fetchSameOrigin(
  url: string,
  origin: string,
  fetchImpl: FetchLike,
  timeoutMs: number,
): Promise<Fetched> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<'timeout'>((resolve) => {
    timer = setTimeout(() => {
      controller.abort();
      resolve('timeout');
    }, timeoutMs);
  });
  try {
    const work = (async () => {
      const res = await fetchImpl(url, {
        signal: controller.signal,
        credentials: 'omit',
        redirect: 'follow',
      });
      const body = await res.text();
      return { res, body };
    })();
    work.catch(() => undefined); // avoid an unhandled rejection if the timeout wins
    const result = await Promise.race([work, timeout]);
    if (result === 'timeout') return { ok: false, reason: `timed out after ${timeoutMs} ms` };
    const finalUrl = result.res.url || url;
    let finalOrigin = origin;
    try {
      finalOrigin = new URL(finalUrl).origin;
    } catch {
      /* keep the requested origin */
    }
    if (finalOrigin !== origin) {
      return { ok: false, reason: 'the request was redirected to another origin' };
    }
    return {
      ok: true,
      status: result.res.status,
      contentType: (result.res.headers.get('content-type') ?? '').toLowerCase(),
      finalUrl,
      body: result.body,
    };
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    return { ok: false, reason: `the request failed or was blocked (${detail})` };
  } finally {
    clearTimeout(timer);
  }
}

export function parseSitemapLines(robotsBody: string): string[] {
  const urls: string[] = [];
  for (const line of robotsBody.split(/\r?\n/)) {
    const m = /^\s*sitemap\s*:\s*(\S+)/i.exec(line);
    if (m?.[1]) urls.push(m[1]);
  }
  return urls;
}

const EMPTY_ROBOTS: RobotsTxtInfo = {
  status: 'inaccessible',
  url: null,
  httpStatus: null,
  reason: null,
  body: null,
  bodyTruncated: false,
  sitemapUrls: [],
};

export async function fetchRobotsTxt(
  origin: string,
  fetchImpl: FetchLike,
  timeoutMs: number = LIMITS.fetchTimeoutMs,
): Promise<RobotsTxtInfo> {
  const url = `${origin}/robots.txt`;
  const r = await fetchSameOrigin(url, origin, fetchImpl, timeoutMs);
  if (!r.ok) return { ...EMPTY_ROBOTS, url, reason: r.reason };
  const base = { ...EMPTY_ROBOTS, url, httpStatus: r.status };
  if (r.status === 404 || r.status === 410) {
    return { ...base, status: 'not_found', reason: `HTTP ${r.status}` };
  }
  if (r.status < 200 || r.status >= 300) {
    return { ...base, status: 'inaccessible', reason: `HTTP ${r.status}` };
  }
  if (r.contentType.includes('html')) {
    return {
      ...base,
      status: 'not_found',
      reason: 'the server returned an HTML page instead of a text file',
    };
  }
  return {
    ...base,
    status: 'found',
    body: r.body.slice(0, LIMITS.robotsBodyChars),
    bodyTruncated: r.body.length > LIMITS.robotsBodyChars,
    sitemapUrls: parseSitemapLines(r.body),
  };
}

const EMPTY_SITEMAP: SitemapInfo = {
  status: 'inaccessible',
  url: null,
  source: null,
  httpStatus: null,
  reason: null,
  kind: null,
  entryCount: null,
  entryCountApproximate: false,
};

export async function fetchSitemap(
  origin: string,
  robots: RobotsTxtInfo,
  fetchImpl: FetchLike,
  timeoutMs: number = LIMITS.fetchTimeoutMs,
): Promise<SitemapInfo> {
  const declared = robots.sitemapUrls;
  const sameOrigin = declared.find((u) => {
    try {
      return new URL(u).origin === origin;
    } catch {
      return false;
    }
  });
  if (declared.length > 0 && !sameOrigin) {
    const anyValid = declared.some((u) => URL.canParse(u));
    return {
      ...EMPTY_SITEMAP,
      url: declared[0] ?? null,
      source: 'robots',
      reason: anyValid
        ? 'the sitemap declared in robots.txt is on another origin and was not fetched'
        : 'the Sitemap line in robots.txt is not a valid absolute URL, so it was not fetched',
    };
  }
  const url = sameOrigin ?? `${origin}/sitemap.xml`;
  const source = sameOrigin ? 'robots' : 'default';
  const base = { ...EMPTY_SITEMAP, url, source } as SitemapInfo;
  if (/\.gz(\?|$)/i.test(url)) {
    return { ...base, reason: 'compressed sitemaps are not read' };
  }
  const r = await fetchSameOrigin(url, origin, fetchImpl, timeoutMs);
  if (!r.ok) return { ...base, reason: r.reason };
  const withStatus = { ...base, httpStatus: r.status };
  if (r.status === 404 || r.status === 410) {
    return { ...withStatus, status: 'not_found', reason: `HTTP ${r.status}` };
  }
  if (r.status < 200 || r.status >= 300) {
    return { ...withStatus, status: 'inaccessible', reason: `HTTP ${r.status}` };
  }
  const approx = r.body.length > LIMITS.sitemapReadChars;
  const text = approx ? r.body.slice(0, LIMITS.sitemapReadChars) : r.body;
  const isIndex = /<sitemapindex[\s>]/i.test(text);
  const isUrlset = /<urlset[\s>]/i.test(text);
  if (!isIndex && !isUrlset) {
    return {
      ...withStatus,
      status: 'not_found',
      reason: 'the response is not a sitemap XML document',
    };
  }
  return {
    ...withStatus,
    status: 'found',
    kind: isIndex ? 'index' : 'urlset',
    entryCount: (text.match(/<loc[\s>]/gi) ?? []).length,
    entryCountApproximate: approx,
  };
}

export function networkUnavailable(reason: string): {
  robots: RobotsTxtInfo;
  sitemap: SitemapInfo;
} {
  return {
    robots: { ...EMPTY_ROBOTS, reason },
    sitemap: { ...EMPTY_SITEMAP, reason },
  };
}
