import { describe, expect, it } from 'vitest';
import { analyzeMetadata } from '../../src/analyzers/seo/metadata';
import { meta, statusOf, withHead } from './snapshotFactory';

const s30 = 'x'.repeat(30);
const s60 = 'x'.repeat(60);
type Case = [string, ReturnType<typeof withHead>, string, string];

describe('analyzeMetadata', () => {
  const cases: Case[] = [
    [
      'title present',
      withHead({ title: 'Hello world title', titleCount: 1 }),
      'seo.title.present',
      'passed',
    ],
    ['title missing', withHead({}), 'seo.title.present', 'failed'],
    [
      'title length at lower bound',
      withHead({ title: s30, titleCount: 1 }),
      'seo.title.length',
      'passed',
    ],
    [
      'title length at upper bound',
      withHead({ title: s60, titleCount: 1 }),
      'seo.title.length',
      'passed',
    ],
    [
      'title too short',
      withHead({ title: s30.slice(1), titleCount: 1 }),
      'seo.title.length',
      'warning',
    ],
    [
      'title too long',
      withHead({ title: s60 + 'x', titleCount: 1 }),
      'seo.title.length',
      'warning',
    ],
    ['title length without title', withHead({}), 'seo.title.length', 'not_applicable'],
    [
      'single title element',
      withHead({ title: s30, titleCount: 1 }),
      'seo.title.duplicate',
      'passed',
    ],
    [
      'two title elements',
      withHead({ title: s30, titleCount: 2 }),
      'seo.title.duplicate',
      'warning',
    ],
    ['title duplicate without title', withHead({}), 'seo.title.duplicate', 'not_applicable'],
    [
      'description present',
      withHead({ metas: [meta('description', 'd'.repeat(100))] }),
      'seo.description.present',
      'passed',
    ],
    ['description missing', withHead({}), 'seo.description.present', 'failed'],
    [
      'description blank',
      withHead({ metas: [meta('description', '  ')] }),
      'seo.description.present',
      'failed',
    ],
    [
      'description length ok (70)',
      withHead({ metas: [meta('description', 'd'.repeat(70))] }),
      'seo.description.length',
      'passed',
    ],
    [
      'description length ok (160)',
      withHead({ metas: [meta('description', 'd'.repeat(160))] }),
      'seo.description.length',
      'passed',
    ],
    [
      'description too short',
      withHead({ metas: [meta('description', 'd'.repeat(69))] }),
      'seo.description.length',
      'warning',
    ],
    [
      'description too long',
      withHead({ metas: [meta('description', 'd'.repeat(161))] }),
      'seo.description.length',
      'warning',
    ],
    [
      'description length without description',
      withHead({}),
      'seo.description.length',
      'not_applicable',
    ],
    [
      'one description tag',
      withHead({ metas: [meta('description', 'd'.repeat(100))] }),
      'seo.description.duplicate',
      'passed',
    ],
    [
      'two description tags',
      withHead({
        metas: [meta('description', 'd'.repeat(100)), meta('description', 'e'.repeat(100))],
      }),
      'seo.description.duplicate',
      'warning',
    ],
    [
      'description duplicate without description',
      withHead({}),
      'seo.description.duplicate',
      'not_applicable',
    ],
    ['no keywords tag', withHead({}), 'seo.metakeywords', 'passed'],
    [
      'keywords tag present',
      withHead({ metas: [meta('keywords', 'a, b')] }),
      'seo.metakeywords',
      'warning',
    ],
    [
      'og complete',
      withHead({ og: { 'og:title': 'a', 'og:description': 'b', 'og:image': 'c' } }),
      'seo.og.present',
      'passed',
    ],
    ['og partial', withHead({ og: { 'og:title': 'a' } }), 'seo.og.present', 'warning'],
    ['og missing', withHead({}), 'seo.og.present', 'failed'],
    [
      'twitter card',
      withHead({ twitter: { 'twitter:card': 'summary' } }),
      'seo.twitter.present',
      'passed',
    ],
    ['twitter missing', withHead({}), 'seo.twitter.present', 'warning'],
  ];
  it.each(cases)('%s', (_name, snap, id, expected) => {
    expect(statusOf(analyzeMetadata(snap), id)).toBe(expected);
  });

  it('shows the real title and lengths as evidence', () => {
    const r = analyzeMetadata(withHead({ title: s30, titleCount: 1 }));
    expect(r.find((c) => c.id === 'seo.title.present')?.evidence[0]).toEqual({
      label: 'Title',
      value: s30,
    });
    expect(r.find((c) => c.id === 'seo.title.length')?.evidence[0]).toEqual({
      label: 'Length (characters)',
      value: 30,
    });
  });
});
