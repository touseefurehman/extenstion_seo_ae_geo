import { describe, expect, it } from 'vitest';
import { analyzeLinks } from '../../src/analyzers/links/links';
import { blank, link, statusOf } from './snapshotFactory';

const snap = (links: ReturnType<typeof link>[]) =>
  blank({ links, totals: { ...blank().totals, links: links.length } });
const internals = (n: number) =>
  Array.from({ length: n }, (_, i) => link({ href: `/p${i}`, text: `Page ${i}` }));

describe('analyzeLinks', () => {
  const cases: [string, ReturnType<typeof snap>, string, string][] = [
    ['enough internal links', snap(internals(3)), 'links.internal.count', 'passed'],
    ['few internal links', snap(internals(2)), 'links.internal.count', 'warning'],
    [
      'external links do not count as internal',
      snap([link({ internal: false })]),
      'links.internal.count',
      'warning',
    ],
    ['anchors with text', snap(internals(3)), 'links.anchor.empty', 'passed'],
    [
      'one empty anchor of ten',
      snap([...internals(9), link({ text: '' })]),
      'links.anchor.empty',
      'warning',
    ],
    [
      'image link is not empty',
      snap([link({ text: '', hasImage: true })]),
      'links.anchor.empty',
      'passed',
    ],
    [
      'aria-label is not empty',
      snap([link({ text: '', ariaLabel: 'Home' })]),
      'links.anchor.empty',
      'passed',
    ],
    [
      'many empty anchors',
      snap([link({ text: '' }), link({ text: '' }), link()]),
      'links.anchor.empty',
      'failed',
    ],
    ['empty check: no links', snap([]), 'links.anchor.empty', 'not_applicable'],
    [
      'empty check: only mailto',
      snap([link({ kind: 'mailto', internal: null, text: '' })]),
      'links.anchor.empty',
      'not_applicable',
    ],
    ['descriptive anchors', snap(internals(3)), 'links.anchor.generic', 'passed'],
    [
      'one generic anchor of five',
      snap([...internals(4), link({ text: 'Click here' })]),
      'links.anchor.generic',
      'warning',
    ],
    [
      'generic with trailing punctuation',
      snap([...internals(4), link({ text: 'Read more »' })]),
      'links.anchor.generic',
      'warning',
    ],
    [
      'mostly generic',
      snap([link({ text: 'here' }), link({ text: 'read more' }), link()]),
      'links.anchor.generic',
      'failed',
    ],
    ['generic check: no links', snap([]), 'links.anchor.generic', 'not_applicable'],
    ['nofollow: none', snap(internals(3)), 'links.nofollow.ratio', 'passed'],
    [
      'nofollow: minority',
      snap([link({ rel: ['nofollow'] }), ...internals(2)]),
      'links.nofollow.ratio',
      'passed',
    ],
    [
      'nofollow: most internal links',
      snap([link({ rel: ['nofollow'] }), link({ rel: ['nofollow'] }), link()]),
      'links.nofollow.ratio',
      'warning',
    ],
    [
      'nofollow: no internal links',
      snap([link({ internal: false })]),
      'links.nofollow.ratio',
      'not_applicable',
    ],
  ];
  it.each(cases)('%s', (_n, s, id, expected) => {
    expect(statusOf(analyzeLinks(s), id)).toBe(expected);
  });

  it('counts nofollow, sponsored, ugc and same-page anchors in evidence', () => {
    const r = analyzeLinks(
      snap([
        link({ rel: ['nofollow'] }),
        link({ rel: ['sponsored'], internal: false }),
        link({ rel: ['ugc'], internal: false }),
        link({ kind: 'hash', internal: null, samePageHash: true, text: 'Top' }),
      ]),
    ).find((c) => c.id === 'links.internal.count')!;
    const get = (label: string) => r.evidence.find((e) => e.label === label)?.value;
    expect([
      get('rel=nofollow'),
      get('rel=sponsored'),
      get('rel=ugc'),
      get('Same-page anchors'),
    ]).toEqual([1, 1, 1, 1]);
  });
});
