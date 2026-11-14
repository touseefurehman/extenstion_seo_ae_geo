import { THRESHOLDS } from '../../scoring/config';
import type { CheckResult } from '../../types/check';
import type { LinkInfo, PageSnapshot } from '../../types/snapshot';
import { check, ev, notApplicable, OK, partialNote } from '../common';

const hasNoText = (l: LinkInfo) => l.text === '' && !l.hasImage && !(l.ariaLabel ?? '').trim();

export function analyzeLinks(s: PageSnapshot): CheckResult[] {
  const out: CheckResult[] = [];
  const L = THRESHOLDS.links;
  const links = s.links;
  const partial = partialNote(s.totals.links, links.length);
  const http = links.filter((l) => l.kind === 'http');
  const internal = http.filter((l) => l.internal === true);
  const external = http.filter((l) => l.internal === false);
  const samePage = links.filter((l) => l.samePageHash);
  const rel = (token: string) => links.filter((l) => l.rel.includes(token)).length;

  out.push(
    check('links.internal.count', internal.length >= L.minInternal ? 'passed' : 'warning', {
      evidence: [
        ev('Internal links', internal.length),
        ev('External links', external.length),
        ev('Same-page anchors', samePage.length),
        ev('rel=nofollow', rel('nofollow')),
        ev('rel=sponsored', rel('sponsored')),
        ev('rel=ugc', rel('ugc')),
        ...partial,
      ],
      explanation:
        internal.length >= L.minInternal
          ? 'The page links to other pages on the same host, giving crawlers and visitors paths onward.'
          : 'The page has few internal links, which limits discovery of related pages.',
      recommendation:
        internal.length >= L.minInternal
          ? OK
          : 'Add contextual links to related pages on your site.',
    }),
  );

  const textual = links.filter((l) => l.kind === 'http' || l.kind === 'hash');
  if (textual.length === 0) {
    out.push(notApplicable('links.anchor.empty', 'the page has no navigable links.'));
    out.push(notApplicable('links.anchor.generic', 'the page has no navigable links.'));
  } else {
    const empty = textual.filter(hasNoText);
    const emptyRatio = empty.length / textual.length;
    out.push(
      check(
        'links.anchor.empty',
        empty.length === 0 ? 'passed' : emptyRatio > L.emptyAnchorFailRatio ? 'failed' : 'warning',
        {
          evidence: [
            ev('Links without text, image or aria-label', empty.length),
            ev('Links checked', textual.length),
            ...empty.slice(0, 5).map((l, i) => ev(`Empty anchor #${i + 1}`, l.href)),
            ...partial,
          ],
          explanation:
            empty.length === 0
              ? 'Every link has anchor text, an image or an aria-label.'
              : 'Links with no accessible text give users and crawlers no hint about the destination.',
          recommendation: empty.length === 0 ? OK : 'Give each link descriptive anchor text.',
        },
      ),
    );

    const withText = textual.filter((l) => l.text !== '');
    const generic = withText.filter((l) =>
      L.genericAnchorTexts.includes(
        l.text
          .toLowerCase()
          .replace(/[.!»›>]+$/g, '')
          .trim(),
      ),
    );
    const genericRatio = withText.length ? generic.length / withText.length : 0;
    out.push(
      check(
        'links.anchor.generic',
        generic.length === 0
          ? 'passed'
          : genericRatio > L.genericAnchorFailRatio
            ? 'failed'
            : 'warning',
        {
          evidence: [
            ev('Generic anchor texts', generic.length),
            ev('Links with text', withText.length),
            ...generic
              .slice(0, 5)
              .map((l, i) => ev(`Generic anchor #${i + 1}`, `"${l.text}" → ${l.href}`)),
            ...partial,
          ],
          explanation:
            generic.length === 0
              ? 'No generic anchors such as "click here" were found.'
              : 'Generic anchors ("click here", "read more") say nothing about the target page.',
          recommendation:
            generic.length === 0
              ? OK
              : 'Replace generic anchors with text that describes the destination.',
        },
      ),
    );
  }

  if (internal.length === 0) {
    out.push(notApplicable('links.nofollow.ratio', 'the page has no internal links.'));
  } else {
    const nf = internal.filter((l) => l.rel.includes('nofollow'));
    const bad = nf.length / internal.length > L.internalNofollowWarnRatio;
    out.push(
      check('links.nofollow.ratio', bad ? 'warning' : 'passed', {
        evidence: [
          ev('Internal links with rel=nofollow', nf.length),
          ev('Internal links', internal.length),
        ],
        explanation: bad
          ? 'Most internal links are nofollow, which asks crawlers not to follow your own site structure.'
          : 'Internal links are not broadly marked nofollow.',
        recommendation: bad
          ? 'Remove rel="nofollow" from internal links unless there is a specific reason.'
          : OK,
      }),
    );
  }
  return out;
}
