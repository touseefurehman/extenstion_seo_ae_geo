import { THRESHOLDS } from '../../scoring/config';
import type { CheckResult } from '../../types/check';
import type { PageSnapshot } from '../../types/snapshot';
import { check, ev, notApplicable, notTested, OK, partialNote, samePageUrl } from '../common';

/** True when the `User-agent: *` group contains a bare `Disallow: /`. */
export function robotsBlocksEverything(body: string): boolean {
  let agents: string[] = [];
  let inRules = false;
  let blocked = false;
  let allowRoot = false;
  const flush = () => {
    if (agents.includes('*') && blocked && !allowRoot) return true;
    return false;
  };
  for (const raw of body.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, '').trim();
    const m = /^([a-z-]+)\s*:\s*(.*)$/i.exec(line);
    if (!m) continue;
    const key = m[1]!.toLowerCase();
    const value = m[2]!.trim();
    if (key === 'user-agent') {
      if (inRules) {
        if (flush()) return true;
        agents = [];
        blocked = false;
        allowRoot = false;
        inRules = false;
      }
      agents.push(value.toLowerCase());
    } else if (key === 'disallow' || key === 'allow') {
      inRules = true;
      if (key === 'disallow' && value === '/') blocked = true;
      if (key === 'allow' && value === '/') allowRoot = true;
    }
  }
  return flush();
}

export function analyzeTechnical(s: PageSnapshot): CheckResult[] {
  const out: CheckResult[] = [];

  // ---- HTTPS ----
  const protocol = URL.canParse(s.url) ? new URL(s.url).protocol : '';
  if (protocol === 'https:') {
    out.push(
      check('tech.https', 'passed', {
        evidence: [ev('URL', s.url)],
        explanation: 'The page is served over HTTPS.',
        recommendation: OK,
      }),
    );
  } else if (protocol === 'http:') {
    out.push(
      check('tech.https', 'failed', {
        evidence: [ev('URL', s.url)],
        explanation: 'The page is served over plain HTTP. Browsers mark it as not secure.',
        recommendation: 'Serve the site over HTTPS and redirect HTTP to HTTPS.',
      }),
    );
  } else {
    out.push(notApplicable('tech.https', 'the page is not an http(s) page.'));
  }

  // ---- canonical ----
  const canon = s.head.canonicals;
  const inHead = canon.filter((c) => c.inHead);
  if (inHead.length === 0) {
    out.push(
      check('tech.canonical.present', 'warning', {
        evidence: [ev('Canonical tags in <head>', 0), ev('Canonical tags elsewhere', canon.length)],
        explanation:
          'No canonical link was found in the <head>. Without one, search engines choose the preferred URL themselves.',
        recommendation: 'Add <link rel="canonical" href="..."> to the <head>.',
      }),
    );
    out.push(notApplicable('tech.canonical.conflict', 'there is no canonical URL to compare.'));
  } else {
    out.push(
      check('tech.canonical.present', 'passed', {
        evidence: [ev('Canonical', inHead[0]!.resolved ?? inHead[0]!.href)],
        explanation: 'A canonical URL is declared in the <head>.',
        recommendation: OK,
      }),
    );
    const resolved = inHead.map((c) => c.resolved);
    const distinct = new Set(resolved.filter((r): r is string => r !== null).map((r) => r));
    const ogUrl = (s.head.og['og:url'] ?? '').trim();
    if (resolved.some((r) => r === null)) {
      out.push(
        check('tech.canonical.conflict', 'failed', {
          evidence: inHead.map((c, i) => ev(`Canonical #${i + 1}`, c.href)),
          explanation: 'A canonical URL could not be parsed as a valid URL.',
          recommendation: 'Use a full, valid URL in the canonical link.',
        }),
      );
    } else if (distinct.size > 1) {
      out.push(
        check('tech.canonical.conflict', 'failed', {
          evidence: [...distinct].map((u, i) => ev(`Canonical #${i + 1}`, u)),
          explanation:
            'Multiple different canonical URLs are declared; search engines may ignore all of them.',
          recommendation: 'Declare a single canonical URL.',
        }),
      );
    } else if (ogUrl !== '' && !samePageUrl(ogUrl, [...distinct][0]!)) {
      out.push(
        check('tech.canonical.conflict', 'warning', {
          evidence: [ev('Canonical', [...distinct][0]!), ev('og:url', ogUrl)],
          explanation:
            'The canonical URL and og:url differ, which sends mixed signals about the preferred URL.',
          recommendation: 'Make og:url match the canonical URL.',
        }),
      );
    } else {
      out.push(
        check('tech.canonical.conflict', 'passed', {
          evidence: [
            ev('Canonical', [...distinct][0]!),
            ev('Page URL', s.url),
            ev('og:url', ogUrl || '(not set)'),
          ],
          explanation:
            'There is one canonical URL and it does not conflict with og:url. A canonical that differs from the page URL can be intentional; that is not flagged.',
          recommendation: OK,
        }),
      );
    }
  }

  // ---- robots meta (indexability signals) ----
  const robotsMetas = s.head.metas.filter(
    (m) => m.name !== null && ['robots', 'googlebot', 'bingbot'].includes(m.name),
  );
  const directives = robotsMetas.flatMap((m) =>
    (m.content ?? '')
      .toLowerCase()
      .split(',')
      .map((d) => d.trim())
      .filter(Boolean),
  );
  const noindex = directives.includes('noindex') || directives.includes('none');
  const nofollow = directives.includes('nofollow') || directives.includes('none');
  out.push(
    noindex || nofollow
      ? check('tech.robots.meta', 'warning', {
          evidence: [ev('Robots directives', directives.join(', '))],
          explanation: `${noindex ? 'noindex asks search engines to keep this page out of their index. ' : ''}${nofollow ? 'nofollow asks them not to follow its links. ' : ''}This may be intentional.`,
          recommendation:
            'If the page should be searchable, remove the noindex/nofollow directive. The X-Robots-Tag HTTP header is not visible to NexusRank.',
        })
      : check('tech.robots.meta', 'passed', {
          evidence: [ev('Robots directives', directives.join(', ') || 'none (defaults apply)')],
          explanation:
            'No noindex or nofollow directive was found in meta tags. HTTP headers such as X-Robots-Tag cannot be read from the page.',
          recommendation: OK,
        }),
  );

  // ---- viewport ----
  const viewport = s.head.metas.find((m) => m.name === 'viewport')?.content?.toLowerCase() ?? null;
  if (viewport === null) {
    out.push(
      check('tech.viewport', 'failed', {
        explanation:
          'No viewport meta tag was found, so mobile browsers may render the desktop layout scaled down.',
        recommendation: 'Add <meta name="viewport" content="width=device-width, initial-scale=1">.',
      }),
    );
  } else if (viewport.replace(/\s/g, '').includes(THRESHOLDS.viewport.requiredToken)) {
    out.push(
      check('tech.viewport', 'passed', {
        evidence: [ev('Viewport', viewport)],
        explanation: 'A responsive viewport is declared.',
        recommendation: OK,
      }),
    );
  } else {
    out.push(
      check('tech.viewport', 'warning', {
        evidence: [ev('Viewport', viewport)],
        explanation: 'A viewport tag exists but does not use width=device-width.',
        recommendation: 'Use width=device-width in the viewport tag.',
      }),
    );
  }

  // ---- lang ----
  const lang = s.head.lang;
  if (lang === null) {
    out.push(
      check('tech.lang', 'warning', {
        explanation: 'The <html> element has no lang attribute.',
        recommendation: 'Set lang on <html>, e.g. <html lang="en">.',
      }),
    );
  } else if (THRESHOLDS.langPattern.test(lang)) {
    out.push(
      check('tech.lang', 'passed', {
        evidence: [ev('lang', lang)],
        explanation: 'A language code is declared.',
        recommendation: OK,
      }),
    );
  } else {
    out.push(
      check('tech.lang', 'warning', {
        evidence: [ev('lang', lang)],
        explanation: 'The lang value does not look like a valid language tag.',
        recommendation: 'Use a BCP 47 tag such as "en" or "en-GB".',
      }),
    );
  }

  // ---- hreflang ----
  const hl = s.head.hreflang;
  if (hl.length === 0) {
    out.push(notApplicable('tech.hreflang.valid', 'the page declares no hreflang alternates.'));
  } else {
    const invalidCodes = hl.filter((h) => !THRESHOLDS.hreflangPattern.test(h.lang));
    const relative = hl.filter((h) => h.resolved === null || !/^https?:\/\//i.test(h.href));
    const codes = hl.map((h) => h.lang.toLowerCase());
    const dupes = codes.filter((c, i) => codes.indexOf(c) !== i);
    const canonical = canon.find((c) => c.inHead)?.resolved ?? s.url;
    const hasSelf = hl.some((h) => h.resolved !== null && samePageUrl(h.resolved, canonical));
    if (invalidCodes.length > 0 || relative.length > 0) {
      out.push(
        check('tech.hreflang.valid', 'failed', {
          evidence: [
            ...invalidCodes.map((h) => ev('Invalid hreflang code', h.lang)),
            ...relative.map((h) => ev('Non-absolute hreflang URL', h.href)),
          ],
          explanation: 'Some hreflang entries use an invalid language code or a non-absolute URL.',
          recommendation: 'Use valid codes (en, en-GB, x-default) and absolute URLs.',
        }),
      );
    } else if (dupes.length > 0 || !hasSelf) {
      out.push(
        check('tech.hreflang.valid', 'warning', {
          evidence: [
            ev('Entries', hl.length),
            ev('Duplicate codes', [...new Set(dupes)].join(', ') || 'none'),
            ev('Self-reference present', hasSelf),
          ],
          explanation:
            dupes.length > 0
              ? 'Some language codes are declared more than once.'
              : 'The page does not list itself among its hreflang alternates.',
          recommendation: 'List each language once, including a self-referencing entry.',
        }),
      );
    } else {
      out.push(
        check('tech.hreflang.valid', 'passed', {
          evidence: [ev('Entries', hl.length)],
          explanation:
            'hreflang entries use valid codes and absolute URLs, and include the page itself. Reciprocal links on the other pages cannot be verified from here.',
          recommendation: OK,
        }),
      );
    }
  }

  // ---- robots.txt / sitemap ----
  const r = s.robotsTxt;
  if (r.status === 'found') {
    const blocksAll = robotsBlocksEverything(r.body ?? '');
    out.push(
      blocksAll
        ? check('tech.robotstxt', 'warning', {
            evidence: [ev('URL', r.url), ev('Rule', 'User-agent: * with Disallow: /')],
            explanation:
              'robots.txt asks all crawlers to stay away from the entire site. This may be intentional (e.g. staging).',
            recommendation: 'Remove "Disallow: /" if the site should be crawlable.',
          })
        : check('tech.robotstxt', 'passed', {
            evidence: [ev('URL', r.url), ev('Sitemap lines', r.sitemapUrls.length)],
            explanation: 'robots.txt is available and does not block the whole site.',
            recommendation: OK,
          }),
    );
  } else if (r.status === 'not_found') {
    out.push(
      check('tech.robotstxt', 'warning', {
        evidence: [ev('URL', r.url), ev('Reason', r.reason)],
        explanation:
          'No robots.txt file was found at the site root. Crawlers will assume everything may be crawled.',
        recommendation:
          'Add a robots.txt file (it can be minimal) and reference your sitemap in it.',
      }),
    );
  } else {
    out.push(
      notTested('tech.robotstxt', r.reason ?? 'robots.txt could not be read from this page.'),
    );
  }

  const m = s.sitemap;
  if (m.status === 'found') {
    out.push(
      check('tech.sitemap', 'passed', {
        evidence: [
          ev('URL', m.url),
          ev('Type', m.kind),
          ev('Entries', m.entryCount),
          ev('Declared in robots.txt', s.robotsTxt.sitemapUrls.length > 0),
        ],
        explanation: 'An XML sitemap is available.',
        recommendation: OK,
      }),
    );
  } else if (m.status === 'not_found') {
    out.push(
      check('tech.sitemap', 'warning', {
        evidence: [ev('URL', m.url), ev('Reason', m.reason)],
        explanation:
          'No XML sitemap was found at the declared or default location. Other locations are not checked.',
        recommendation: 'Publish an XML sitemap and list it in robots.txt.',
      }),
    );
  } else {
    out.push(
      notTested('tech.sitemap', m.reason ?? 'the sitemap could not be read from this page.'),
    );
  }

  // ---- structured data syntax ----
  const blocks = s.structuredData.jsonld;
  if (blocks.length === 0) {
    out.push(notApplicable('tech.structured.validjson', 'the page has no JSON-LD blocks.'));
  } else {
    const bad = blocks.filter((b) => b.error !== null);
    out.push(
      bad.length === 0
        ? check('tech.structured.validjson', 'passed', {
            evidence: [ev('JSON-LD blocks', blocks.length)],
            explanation:
              'Every JSON-LD block is syntactically valid JSON. Schema content is reviewed in the schema inspector.',
            recommendation: OK,
          })
        : check('tech.structured.validjson', 'failed', {
            evidence: bad.map((b) => ev(`Block #${b.index + 1} error`, b.error)),
            explanation: `${bad.length} of ${blocks.length} JSON-LD blocks cannot be parsed, so their data is ignored.`,
            recommendation: 'Fix the JSON syntax (trailing commas, quotes, empty blocks).',
          }),
    );
  }

  // ---- invalid link destinations ----
  const total = s.links.length;
  if (total === 0) {
    out.push(notApplicable('tech.links.invalidscheme', 'the page has no links.'));
  } else {
    const bad = s.links.filter((l) => l.invalidScheme);
    out.push(
      bad.length === 0
        ? check('tech.links.invalidscheme', 'passed', {
            evidence: [ev('Links', total), ...partialNote(s.totals.links, total)],
            explanation: 'No links use javascript:, empty or unsupported destinations.',
            recommendation: OK,
          })
        : check('tech.links.invalidscheme', 'warning', {
            evidence: bad
              .slice(0, 5)
              .map((l, i) =>
                ev(`Link #${i + 1}`, `${l.kind}: "${l.href}" (${l.text || 'no text'})`),
              ),
            explanation: `${bad.length} link(s) use a javascript:, empty or unsupported destination that crawlers cannot follow.`,
            recommendation:
              'Use real URLs in href attributes and attach behaviour with JavaScript event handlers.',
          }),
    );
  }
  return out;
}
