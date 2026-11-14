import { describe, expect, it } from 'vitest';
import { analyzeAeo, detectQuestions } from '../../src/analyzers/aeo/aeo';
import { countSyllables, fleschReadingEase } from '../../src/analyzers/text';
import {
  blank,
  heading,
  link,
  list,
  para,
  statusOf,
  table,
  withHead,
  withJsonLd,
  words,
} from './snapshotFactory';

const run = (s: ReturnType<typeof blank>, id: string) => statusOf(analyzeAeo(s), id);
const body = (n = 400) => ({ bodyWordCount: n });

describe('detectQuestions', () => {
  it('finds ? headings, opener headings, question paragraphs and FAQ questions; skips nav/footer', () => {
    const q = detectQuestions(
      blank({
        headings: [
          heading(2, 'What is cold brew?', 0),
          heading(2, 'How to brew at home', 1),
          heading(2, 'Brewing', 2),
          heading(2, 'Is it ok?', 3, { region: 'footer' }),
          heading(2, 'Go', 4),
        ],
        paragraphs: [
          para('Why does it taste sweet? Because of low acidity.'),
          para('Plain statement.'),
        ],
        faqBlocks: [{ source: 'details', question: 'Can I freeze it?', answer: 'Yes.' }],
      }),
    );
    expect(q.map((x) => `${x.source}:${x.text}`)).toEqual([
      'heading:What is cold brew?',
      'heading:How to brew at home',
      'paragraph:Why does it taste sweet?',
      'faq:Can I freeze it?',
    ]);
  });
});

describe('analyzeAeo', () => {
  const q = (n: number, answered = true) => ({
    headings: [heading(2, 'What is it?', 0), heading(2, 'Why use it?', 1)].slice(0, n),
    paragraphs: answered
      ? [
          para('It is a thing.', { afterHeadingIndex: 0 }),
          para('Because.', { afterHeadingIndex: 1 }),
        ]
      : [],
  });

  it.each([
    ['questions found', blank(q(1)), 'aeo.questions.detected', 'passed'],
    ['no questions', blank(), 'aeo.questions.detected', 'warning'],
    ['answer distance: all answered', blank(q(2)), 'aeo.answer.distance', 'passed'],
    ['answer distance: none answered', blank(q(2, false)), 'aeo.answer.distance', 'failed'],
    [
      'answer distance: half answered',
      blank({ headings: q(2).headings, paragraphs: [para('Answer', { afterHeadingIndex: 0 })] }),
      'aeo.answer.distance',
      'warning',
    ],
    ['answer distance: no questions', blank(), 'aeo.answer.distance', 'not_applicable'],
    [
      'question paragraph answered by the next',
      blank({ paragraphs: [para('What is this thing about?'), para('It is about stuff.')] }),
      'aeo.answer.distance',
      'passed',
    ],
    [
      'faq section via details',
      blank({ faqBlocks: [{ source: 'details', question: 'Q?', answer: 'A' }] }),
      'aeo.faq.section',
      'passed',
    ],
    [
      'faq section via heading',
      blank({ headings: [heading(2, 'Frequently asked questions', 0)] }),
      'aeo.faq.section',
      'passed',
    ],
    ['no faq', blank(), 'aeo.faq.section', 'not_applicable'],
    [
      'faq schema + content',
      withJsonLd([{ '@type': 'FAQPage', mainEntity: [] }], {
        faqBlocks: [{ source: 'details', question: 'Q?', answer: 'A' }],
      }),
      'aeo.faq.schema',
      'passed',
    ],
    [
      'faq schema without visible faq',
      withJsonLd([{ '@type': 'FAQPage' }]),
      'aeo.faq.schema',
      'warning',
    ],
    [
      'faq content without schema',
      blank({ faqBlocks: [{ source: 'details', question: 'Q?', answer: 'A' }] }),
      'aeo.faq.schema',
      'warning',
    ],
    ['no faq at all (schema)', blank(), 'aeo.faq.schema', 'not_applicable'],
    [
      'definition found',
      blank({ paragraphs: [para('Cold brew is a method of steeping coffee in cold water.')] }),
      'aeo.definition.patterns',
      'passed',
    ],
    [
      '"means" definition',
      blank({ paragraphs: [para('Bloom means the release of gas from fresh grounds.')] }),
      'aeo.definition.patterns',
      'passed',
    ],
    [
      'no definition',
      blank({ paragraphs: [para('Brewing coffee at home is easier than most people think.')] }),
      'aeo.definition.patterns',
      'warning',
    ],
    [
      'direct answer in range',
      blank({
        headings: [heading(2, 'Topic', 0)],
        paragraphs: [para(words(50), { afterHeadingIndex: 0 })],
      }),
      'aeo.direct.answer',
      'passed',
    ],
    [
      'direct answer 40 words (lower bound)',
      blank({
        headings: [heading(2, 'Topic', 0)],
        paragraphs: [para(words(40), { afterHeadingIndex: 0 })],
      }),
      'aeo.direct.answer',
      'passed',
    ],
    [
      'direct answer 61 words',
      blank({
        headings: [heading(2, 'Topic', 0)],
        paragraphs: [para(words(61), { afterHeadingIndex: 0 })],
      }),
      'aeo.direct.answer',
      'warning',
    ],
    [
      'direct answer too short',
      blank({
        headings: [heading(2, 'Topic', 0)],
        paragraphs: [para(words(10), { afterHeadingIndex: 0 })],
      }),
      'aeo.direct.answer',
      'warning',
    ],
    ['direct answer: no pairs', blank(), 'aeo.direct.answer', 'not_applicable'],
    ['lists present', blank({ ...body(), lists: [list(3)] }), 'aeo.structure.lists', 'passed'],
    ['long page without lists', blank(body()), 'aeo.structure.lists', 'warning'],
    ['short page without lists', blank(body(100)), 'aeo.structure.lists', 'not_applicable'],
    [
      'nav lists do not count',
      blank({ ...body(), lists: [list(5, { region: 'nav' })] }),
      'aeo.structure.lists',
      'warning',
    ],
    ['table with headers', blank({ tables: [table()] }), 'aeo.structure.tables', 'passed'],
    [
      'table without headers',
      blank({ tables: [table({ hasHeader: false })] }),
      'aeo.structure.tables',
      'warning',
    ],
    ['no tables', blank(), 'aeo.structure.tables', 'not_applicable'],
    [
      'steps via ordered list',
      blank({ lists: [list(3, { ordered: true })] }),
      'aeo.structure.steps',
      'passed',
    ],
    ['steps via HowTo schema', withJsonLd([{ '@type': 'HowTo' }]), 'aeo.structure.steps', 'passed'],
    [
      'how-to title without steps',
      withHead({ title: 'How to brew coffee', titleCount: 1 }),
      'aeo.structure.steps',
      'warning',
    ],
    ['not a how-to', blank(), 'aeo.structure.steps', 'not_applicable'],
    [
      'short paragraphs',
      blank({ paragraphs: [para(words(30)), para(words(40)), para(words(50))] }),
      'aeo.paragraph.length',
      'passed',
    ],
    [
      'one long paragraph of four',
      blank({ paragraphs: [para(words(130)), para(words(30)), para(words(40)), para(words(50))] }),
      'aeo.paragraph.length',
      'warning',
    ],
    [
      'mostly long paragraphs',
      blank({ paragraphs: [para(words(130)), para(words(150)), para(words(30))] }),
      'aeo.paragraph.length',
      'failed',
    ],
    [
      'too few paragraphs',
      blank({ paragraphs: [para(words(130))] }),
      'aeo.paragraph.length',
      'not_applicable',
    ],
    [
      'author via meta',
      blank({ signals: { ...blank().signals, authors: [{ source: 'meta', text: 'Ann' }] } }),
      'aeo.author',
      'passed',
    ],
    [
      'author via schema',
      withJsonLd([{ '@type': 'Article', author: { '@type': 'Person', name: 'Bo' } }]),
      'aeo.author',
      'passed',
    ],
    ['no author', blank(), 'aeo.author', 'warning'],
    [
      'published + modified',
      withJsonLd([{ '@type': 'Article', datePublished: '2026-01-01', dateModified: '2026-02-01' }]),
      'aeo.dates',
      'passed',
    ],
    [
      'only published',
      withJsonLd([{ '@type': 'Article', datePublished: '2026-01-01' }]),
      'aeo.dates',
      'warning',
    ],
    ['no dates', blank(), 'aeo.dates', 'warning'],
    [
      'citations via references heading',
      blank({ headings: [heading(2, 'References', 0)] }),
      'aeo.citations',
      'passed',
    ],
    [
      'citations via 2 external links',
      blank({ links: [link({ internal: false }), link({ internal: false })] }),
      'aeo.citations',
      'passed',
    ],
    [
      'citations via blockquote cite',
      blank({
        signals: {
          ...blank().signals,
          citations: { blockquotes: [{ cite: 'https://x.org', text: 'q' }], citeElements: 0 },
        },
      }),
      'aeo.citations',
      'passed',
    ],
    [
      'one external link only',
      blank({ links: [link({ internal: false })] }),
      'aeo.citations',
      'warning',
    ],
    [
      'external footer links do not count',
      blank({
        links: [
          link({ internal: false, region: 'footer' }),
          link({ internal: false, region: 'footer' }),
        ],
      }),
      'aeo.citations',
      'warning',
    ],
    [
      'conversational: 3 openers',
      blank({
        headings: [
          heading(2, 'What is X?', 0),
          heading(2, 'How does X work?', 1),
          heading(2, 'Why use X?', 2),
        ],
      }),
      'aeo.conversational',
      'passed',
    ],
    [
      'conversational: 1 opener',
      blank({ headings: [heading(2, 'What is X?', 0)] }),
      'aeo.conversational',
      'warning',
    ],
    ['conversational: none', blank(), 'aeo.conversational', 'not_applicable'],
  ] as [string, ReturnType<typeof blank>, string, string][])('%s', (_n, s, id, expected) => {
    expect(run(s, id)).toBe(expected);
  });

  describe('readability', () => {
    const easy =
      'The cat sat on the mat. The dog ran to the park. We like to play. It is fun to run. '.repeat(
        8,
      );
    const hard =
      'Notwithstanding considerable epistemological complications, interdisciplinary methodological frameworks necessitate comprehensive institutional collaboration. '.repeat(
        12,
      );
    const en = (text: string) => withHead({ lang: 'en' }, { paragraphs: [para(text)] });
    it('passed for plain English', () => expect(run(en(easy), 'aeo.readability')).toBe('passed'));
    it('failed for dense English', () => expect(run(en(hard), 'aeo.readability')).toBe('failed'));
    it('not applicable with too little text', () =>
      expect(run(en('Short text here.'), 'aeo.readability')).toBe('not_applicable'));
    it('not_tested for other languages, with a reason', () => {
      const r = analyzeAeo(withHead({ lang: 'de' }, { paragraphs: [para(easy)] })).find(
        (c) => c.id === 'aeo.readability',
      )!;
      expect(r.status).toBe('not_tested');
      expect(r.notTestedReason).toMatch(/English/);
    });
    it('not_tested when no language is declared', () =>
      expect(run(blank({ paragraphs: [para(easy)] }), 'aeo.readability')).toBe('not_tested'));
  });

  it('shows actual evidence and never claims guaranteed selection', () => {
    const r = analyzeAeo(blank(q(2)));
    const found = r.find((c) => c.id === 'aeo.questions.detected')!;
    expect(found.evidence.some((e) => e.value === 'What is it?')).toBe(true);
    expect(found.evidenceKind).toBe('detected');
    expect(found.explanation).toMatch(/does not mean/);
    for (const c of r)
      expect(`${c.explanation} ${c.recommendation}`).not.toMatch(
        /will (rank|be selected|be cited)|guarantee/i,
      );
  });
});

describe('text helpers', () => {
  it('counts syllables roughly', () => {
    expect(['cat', 'table', 'beautiful', 'the'].map(countSyllables)).toEqual([1, 2, 3, 1]);
  });
  it('computes Flesch Reading Ease in a sane range and null for empty', () => {
    const score = fleschReadingEase('The cat sat on the mat. The dog ran far.')!;
    expect(score).toBeGreaterThan(80);
    expect(fleschReadingEase('')).toBeNull();
  });
});
