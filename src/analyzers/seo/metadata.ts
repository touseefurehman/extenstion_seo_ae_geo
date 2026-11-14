import { THRESHOLDS } from '../../scoring/config';
import type { CheckResult } from '../../types/check';
import type { PageSnapshot } from '../../types/snapshot';
import { check, ev, notApplicable, OK } from '../common';

const metaContent = (s: PageSnapshot, name: string): string[] =>
  s.head.metas.filter((m) => m.name === name).map((m) => (m.content ?? '').trim());

/** Title, description, keywords and social tags. */
export function analyzeMetadata(s: PageSnapshot): CheckResult[] {
  const out: CheckResult[] = [];
  const T = THRESHOLDS.title;
  const D = THRESHOLDS.description;

  // ---- title ----
  const title = s.head.title;
  out.push(
    title
      ? check('seo.title.present', 'passed', {
          evidence: [ev('Title', title)],
          explanation: 'The page has a <title> element.',
          recommendation: OK,
        })
      : check('seo.title.present', 'failed', {
          evidence: [ev('Title elements', s.head.titleCount)],
          explanation:
            'No non-empty <title> was found. Search results and browser tabs rely on it.',
          recommendation: 'Add a unique, descriptive <title> in the page <head>.',
        }),
  );
  if (!title) {
    out.push(notApplicable('seo.title.length', 'the page has no title to measure.'));
    out.push(notApplicable('seo.title.duplicate', 'the page has no title.'));
  } else {
    const len = title.length;
    const ok = len >= T.minChars && len <= T.maxChars;
    out.push(
      check('seo.title.length', ok ? 'passed' : 'warning', {
        evidence: [
          ev('Length (characters)', len),
          ev('Recommended range', `${T.minChars}-${T.maxChars}`),
        ],
        explanation: ok
          ? 'The title length is within the range that commonly displays fully in search results.'
          : `The title is ${len < T.minChars ? 'short' : 'long'} and may be ${len < T.minChars ? 'under-descriptive' : 'truncated in search results'}. Display widths vary, so this is a guideline.`,
        recommendation: ok ? OK : `Aim for roughly ${T.minChars}-${T.maxChars} characters.`,
      }),
    );
    out.push(
      s.head.titleCount > 1
        ? check('seo.title.duplicate', 'warning', {
            evidence: [ev('Title elements in <head>', s.head.titleCount)],
            explanation: 'More than one <title> element was found; only one is used.',
            recommendation: 'Keep a single <title> element.',
          })
        : check('seo.title.duplicate', 'passed', {
            evidence: [ev('Title elements in <head>', s.head.titleCount)],
            explanation: 'There is exactly one <title> element.',
            recommendation: OK,
          }),
    );
  }

  // ---- description ----
  const descs = metaContent(s, 'description');
  const desc = descs.find((d) => d !== '') ?? null;
  out.push(
    desc
      ? check('seo.description.present', 'passed', {
          evidence: [ev('Description', desc)],
          explanation: 'A meta description is present.',
          recommendation: OK,
        })
      : check('seo.description.present', 'failed', {
          evidence: [ev('Description tags', descs.length)],
          explanation:
            'No non-empty meta description was found. Search engines may generate their own snippet instead.',
          recommendation: 'Add a concise meta description summarising the page.',
        }),
  );
  if (!desc) {
    out.push(
      notApplicable('seo.description.length', 'the page has no meta description to measure.'),
    );
    out.push(notApplicable('seo.description.duplicate', 'the page has no meta description.'));
  } else {
    const len = desc.length;
    const ok = len >= D.minChars && len <= D.maxChars;
    out.push(
      check('seo.description.length', ok ? 'passed' : 'warning', {
        evidence: [
          ev('Length (characters)', len),
          ev('Recommended range', `${D.minChars}-${D.maxChars}`),
        ],
        explanation: ok
          ? 'The description length is within the commonly displayed range.'
          : `The description is ${len < D.minChars ? 'short' : 'long'}; snippet length varies by device, so this is a guideline.`,
        recommendation: ok ? OK : `Aim for roughly ${D.minChars}-${D.maxChars} characters.`,
      }),
    );
    out.push(
      descs.length > 1
        ? check('seo.description.duplicate', 'warning', {
            evidence: [ev('Description tags', descs.length)],
            explanation: 'More than one meta description tag was found.',
            recommendation: 'Keep a single meta description tag.',
          })
        : check('seo.description.duplicate', 'passed', {
            evidence: [ev('Description tags', descs.length)],
            explanation: 'There is exactly one meta description tag.',
            recommendation: OK,
          }),
    );
  }

  // ---- meta keywords ----
  const kw = metaContent(s, 'keywords').filter((k) => k !== '');
  out.push(
    kw.length > 0
      ? check('seo.metakeywords', 'warning', {
          evidence: [ev('Keywords tag', kw.join('; '))],
          explanation:
            'A meta keywords tag is present. Major search engines are documented to ignore it, and it exposes your keyword list to competitors.',
          recommendation: 'Remove the meta keywords tag; it provides no known benefit.',
        })
      : check('seo.metakeywords', 'passed', {
          explanation: 'No meta keywords tag is present (it is ignored by major search engines).',
          recommendation: OK,
        }),
  );

  // ---- Open Graph / Twitter ----
  const ogWanted = ['og:title', 'og:description', 'og:image'];
  const ogHave = ogWanted.filter((k) => (s.head.og[k] ?? '').trim() !== '');
  const ogStatus =
    ogHave.length === ogWanted.length ? 'passed' : ogHave.length === 0 ? 'failed' : 'warning';
  out.push(
    check('seo.og.present', ogStatus, {
      evidence: [
        ev('Present', ogHave.join(', ') || 'none'),
        ev('Missing', ogWanted.filter((k) => !ogHave.includes(k)).join(', ') || 'none'),
      ],
      explanation:
        ogStatus === 'passed'
          ? 'og:title, og:description and og:image are set, which controls how the page is previewed when shared.'
          : 'Open Graph tags control link previews on social platforms and messengers.',
      recommendation: ogStatus === 'passed' ? OK : 'Add the missing Open Graph tags.',
    }),
  );
  const card = (s.head.twitter['twitter:card'] ?? '').trim();
  out.push(
    card
      ? check('seo.twitter.present', 'passed', {
          evidence: [ev('twitter:card', card)],
          explanation: 'A Twitter Card type is declared.',
          recommendation: OK,
        })
      : check('seo.twitter.present', 'warning', {
          evidence: [ev('Twitter tags found', Object.keys(s.head.twitter).length)],
          explanation:
            'No twitter:card tag was found, so link previews on X/Twitter may use defaults.',
          recommendation:
            'Add <meta name="twitter:card" content="summary_large_image"> (or another card type).',
        }),
  );
  return out;
}
