import { THRESHOLDS } from '../../scoring/config';
import type { CheckResult } from '../../types/check';
import type { PageSnapshot } from '../../types/snapshot';
import { check, ev, notApplicable, notTested, OK, partialNote } from '../common';
import { collectEntities, entitiesOfType, hasValue, valueText } from '../schema/normalize';
import { clipText, firstSentence, fleschReadingEase } from '../text';

const A = THRESHOLDS.aeo;
const NOTE =
  'Detecting this does not mean any search or answer engine will select or cite the page.';

interface Question {
  text: string;
  source: 'heading' | 'paragraph' | 'faq';
  /** For headings: the heading order. For paragraphs: the paragraph index. */
  ref: number;
  opener: string | null;
}

export function openerOf(text: string): string | null {
  const first =
    text
      .trim()
      .split(/\s+/)[0]
      ?.toLowerCase()
      .replace(/[^a-z]/g, '') ?? '';
  return A.questionOpeners.includes(first) ? first : null;
}

/** Question-style headings and paragraphs plus FAQ questions, ignoring nav/footer/aside. */
export function detectQuestions(s: PageSnapshot): Question[] {
  const out: Question[] = [];
  for (const h of s.headings) {
    if (A.ignoredRegions.includes(h.region) || h.empty) continue;
    const opener = openerOf(h.text);
    if (
      h.text.trim().endsWith('?') ||
      (opener !== null && h.text.trim().split(/\s+/).length >= 3)
    ) {
      out.push({ text: h.text, source: 'heading', ref: h.order, opener });
    }
  }
  s.paragraphs.forEach((p, i) => {
    if (A.ignoredRegions.includes(p.region)) return;
    const sentence = firstSentence(p.text);
    if (sentence.endsWith('?') && sentence.split(/\s+/).length >= 3) {
      out.push({ text: sentence, source: 'paragraph', ref: i, opener: openerOf(sentence) });
    }
  });
  for (const f of s.faqBlocks) {
    if (f.question.trim().endsWith('?')) {
      out.push({ text: f.question, source: 'faq', ref: -1, opener: openerOf(f.question) });
    }
  }
  return out;
}

const hasFaqPage = (s: PageSnapshot) => entitiesOfType(collectEntities(s), 'FAQPage').length > 0;

export function analyzeAeo(s: PageSnapshot): CheckResult[] {
  const out: CheckResult[] = [];
  const questions = detectQuestions(s);
  const partial = partialNote(s.totals.paragraphs, s.paragraphs.length);
  const entities = collectEntities(s);

  // ---- questions ----
  out.push(
    questions.length > 0
      ? check('aeo.questions.detected', 'passed', {
          evidenceKind: 'detected',
          evidence: [
            ev('Questions found', questions.length),
            ...questions.slice(0, 8).map((q) => ev(`Question (${q.source})`, clipText(q.text))),
          ],
          explanation: `Question-style headings or sentences were found. ${NOTE}`,
          recommendation: OK,
        })
      : check('aeo.questions.detected', 'warning', {
          evidenceKind: 'detected',
          evidence: [
            ev('Headings checked', s.headings.length),
            ev('Paragraphs checked', s.paragraphs.length),
          ],
          explanation: `No question-style headings or sentences were found. Pages that answer real user questions often phrase them explicitly. ${NOTE}`,
          recommendation:
            'If the page answers common questions, consider using the question as a heading followed by a direct answer.',
        }),
  );

  // ---- question → answer proximity ----
  const pairs: { q: Question; answer: string | null }[] = [];
  for (const q of questions) {
    if (q.source === 'heading') {
      const p = s.paragraphs.find((x) => x.afterHeadingIndex === q.ref);
      pairs.push({ q, answer: p?.text ?? null });
    } else if (q.source === 'paragraph') {
      const cur = s.paragraphs[q.ref];
      const next = s.paragraphs[q.ref + 1];
      pairs.push({
        q,
        answer: cur && next && next.afterHeadingIndex === cur.afterHeadingIndex ? next.text : null,
      });
    }
  }
  if (pairs.length === 0) {
    out.push(
      notApplicable(
        'aeo.answer.distance',
        'no question headings or question paragraphs were found.',
      ),
    );
  } else {
    const answered = pairs.filter((p) => p.answer !== null);
    const ratio = answered.length / pairs.length;
    const status = ratio === 1 ? 'passed' : ratio >= 0.5 ? 'warning' : 'failed';
    out.push(
      check('aeo.answer.distance', status, {
        evidenceKind: 'detected',
        evidence: [
          ev(
            'Questions with an answer paragraph right after them',
            `${answered.length} of ${pairs.length}`,
          ),
          ...pairs
            .slice(0, 6)
            .map((p) =>
              ev(
                clipText(p.q.text, 80),
                p.answer ? clipText(p.answer, 100) : '(no paragraph follows)',
              ),
            ),
          ...partial,
        ],
        explanation:
          'For each question heading, the first paragraph under it is treated as the answer; for question paragraphs, the next paragraph in the same section. Whether it actually answers the question is not judged.',
        recommendation:
          status === 'passed'
            ? OK
            : 'Place a concise answer paragraph immediately after each question.',
      }),
    );
  }

  // ---- FAQ section / schema ----
  const faqHeadings = s.headings.filter((h) => A.faqHeading.test(h.text));
  const faqSection =
    s.faqBlocks.length > 0 || faqHeadings.length > 0 || s.faqContainerHints.length > 0;
  out.push(
    faqSection
      ? check('aeo.faq.section', 'passed', {
          evidenceKind: 'detected',
          evidence: [
            ev('FAQ blocks (details, definition lists, microdata)', s.faqBlocks.length),
            ...faqHeadings.map((h) => ev('FAQ heading', h.text)),
            ...s.faqContainerHints.map((h) => ev('FAQ container', h)),
          ],
          explanation: 'The page has FAQ-style content.',
          recommendation: OK,
        })
      : notApplicable('aeo.faq.section', 'no FAQ-style content was detected on the page.'),
  );
  const schemaFaq = hasFaqPage(s);
  if (schemaFaq && faqSection) {
    out.push(
      check('aeo.faq.schema', 'passed', {
        evidenceKind: 'detected',
        evidence: [ev('FAQPage entities', entitiesOfType(entities, 'FAQPage').length)],
        explanation: 'FAQPage structured data is present alongside visible FAQ content.',
        recommendation: OK,
      }),
    );
  } else if (schemaFaq) {
    out.push(
      check('aeo.faq.schema', 'warning', {
        evidenceKind: 'detected',
        explanation:
          'FAQPage structured data exists but no matching visible FAQ content was detected. Markup should reflect content users can see.',
        recommendation: 'Show the questions and answers on the page, or remove the FAQPage markup.',
      }),
    );
  } else if (faqSection) {
    out.push(
      check('aeo.faq.schema', 'warning', {
        evidenceKind: 'detected',
        evidence: [ev('FAQ blocks', s.faqBlocks.length)],
        explanation:
          'The page has FAQ content but no FAQPage structured data. Note that major search engines have restricted FAQ rich results to a few site types.',
        recommendation: 'Consider adding FAQPage JSON-LD that mirrors the visible questions.',
      }),
    );
  } else {
    out.push(
      notApplicable('aeo.faq.schema', 'the page has neither FAQ content nor FAQPage markup.'),
    );
  }

  // ---- definitions ----
  const defs = s.paragraphs
    .filter((p) => !A.ignoredRegions.includes(p.region))
    .map((p) => firstSentence(p.text))
    .filter((t) => A.definitionPattern.test(t));
  out.push(
    defs.length > 0
      ? check('aeo.definition.patterns', 'passed', {
          evidenceKind: 'detected',
          evidence: [
            ev('Definition-style sentences', defs.length),
            ...defs.slice(0, 5).map((d) => ev('Sentence', clipText(d))),
          ],
          explanation: `Sentences of the form "X is a …" or "X means …" were found. ${NOTE}`,
          recommendation: OK,
        })
      : check('aeo.definition.patterns', 'warning', {
          evidenceKind: 'detected',
          evidence: [ev('Paragraphs checked', s.paragraphs.length)],
          explanation:
            'No definition-style sentences ("X is a …") were found. Clear definitions can make a topic easier to extract.',
          recommendation: 'If the page explains a concept, open with a one-sentence definition.',
        }),
  );

  // ---- direct answers (40-60 words right after a heading) ----
  const direct: { heading: string; words: number; text: string }[] = [];
  let sections = 0;
  for (const h of s.headings) {
    if (h.empty || A.ignoredRegions.includes(h.region) || h.level === 1) continue;
    const p = s.paragraphs.find((x) => x.afterHeadingIndex === h.order);
    if (!p) continue;
    sections++;
    if (p.wordCount >= A.directAnswerMinWords && p.wordCount <= A.directAnswerMaxWords) {
      direct.push({ heading: h.text, words: p.wordCount, text: p.text });
    }
  }
  if (sections === 0) {
    out.push(notApplicable('aeo.direct.answer', 'no heading is directly followed by a paragraph.'));
  } else {
    out.push(
      direct.length > 0
        ? check('aeo.direct.answer', 'passed', {
            evidenceKind: 'detected',
            evidence: [
              ev(
                'Sections with a direct-answer-sized paragraph',
                `${direct.length} of ${sections}`,
              ),
              ...direct
                .slice(0, 4)
                .map((d) => ev(`${clipText(d.heading, 60)} (${d.words} words)`, clipText(d.text))),
            ],
            explanation: `A paragraph of ${A.directAnswerMinWords}-${A.directAnswerMaxWords} words directly follows a heading. The range is a common guideline, not a rule. ${NOTE}`,
            recommendation: OK,
          })
        : check('aeo.direct.answer', 'warning', {
            evidenceKind: 'detected',
            evidence: [ev('Heading/paragraph pairs checked', sections)],
            explanation: `No heading is followed by a ${A.directAnswerMinWords}-${A.directAnswerMaxWords} word paragraph. Concise lead answers are one way to make content easy to quote.`,
            recommendation: 'Start key sections with a self-contained answer of about 40-60 words.',
          }),
    );
  }

  // ---- lists, tables, steps ----
  const shortPage = s.bodyWordCount < A.minWordsForStructure;
  const contentLists = s.lists.filter(
    (l) => !A.ignoredRegions.includes(l.region) && l.itemCount >= A.listMinItems,
  );
  if (contentLists.length > 0) {
    out.push(
      check('aeo.structure.lists', 'passed', {
        evidenceKind: 'detected',
        evidence: [
          ev('Lists with at least ' + A.listMinItems + ' items', contentLists.length),
          ...contentLists
            .slice(0, 3)
            .map((l) =>
              ev(
                l.ordered ? 'Ordered list' : 'Unordered list',
                clipText(l.items.slice(0, 3).join(' · '), 100),
              ),
            ),
        ],
        explanation: 'The page uses lists to structure information.',
        recommendation: OK,
      }),
    );
  } else if (shortPage) {
    out.push(
      notApplicable('aeo.structure.lists', 'the page is short, so list structure is not expected.'),
    );
  } else {
    out.push(
      check('aeo.structure.lists', 'warning', {
        evidenceKind: 'detected',
        evidence: [ev('Body words', s.bodyWordCount)],
        explanation:
          'A long page without lists. Bulleted or numbered lists make enumerations easier to scan and extract.',
        recommendation: 'Convert enumerations into lists where it helps readers.',
      }),
    );
  }

  const tables = s.tables.filter((t) => !A.ignoredRegions.includes(t.region));
  if (tables.length === 0) {
    out.push(notApplicable('aeo.structure.tables', 'the page has no data tables.'));
  } else {
    const withHeader = tables.filter((t) => t.hasHeader);
    out.push(
      withHeader.length === tables.length
        ? check('aeo.structure.tables', 'passed', {
            evidenceKind: 'detected',
            evidence: [
              ev('Tables', tables.length),
              ev('Tables with header cells', withHeader.length),
            ],
            explanation:
              'Tables use header cells (<th>), which makes their meaning machine-readable.',
            recommendation: OK,
          })
        : check('aeo.structure.tables', 'warning', {
            evidenceKind: 'detected',
            evidence: [
              ev('Tables', tables.length),
              ev('Tables without header cells', tables.length - withHeader.length),
            ],
            explanation: 'Some tables have no <th> header cells.',
            recommendation: 'Mark header rows/columns with <th>.',
          }),
    );
  }

  const orderedSteps = s.lists.filter(
    (l) => l.ordered && l.itemCount >= A.listMinItems && !A.ignoredRegions.includes(l.region),
  );
  const stepHeadings = s.headings.filter((h) => /^(step\s*\d+|\d+[.)])/i.test(h.text));
  const howToSchema = entitiesOfType(entities, 'HowTo').length > 0;
  if (orderedSteps.length > 0 || stepHeadings.length >= 2 || howToSchema) {
    out.push(
      check('aeo.structure.steps', 'passed', {
        evidenceKind: 'detected',
        evidence: [
          ev('Ordered lists with 3+ items', orderedSteps.length),
          ev('Step-style headings', stepHeadings.length),
          ev('HowTo markup', howToSchema),
        ],
        explanation: 'Step-by-step content was detected.',
        recommendation: OK,
      }),
    );
  } else if (
    A.howToTitle.test(`${s.head.title ?? ''} ${s.headings.find((h) => h.level === 1)?.text ?? ''}`)
  ) {
    out.push(
      check('aeo.structure.steps', 'warning', {
        evidenceKind: 'inferred',
        evidence: [ev('Title', s.head.title)],
        explanation: 'The title suggests a guide or how-to, but no numbered steps were detected.',
        recommendation: 'Present procedures as a numbered list or step headings.',
      }),
    );
  } else {
    out.push(
      notApplicable('aeo.structure.steps', 'the page does not look like a how-to or guide.'),
    );
  }

  // ---- paragraph length ----
  const paras = s.paragraphs.filter((p) => !A.ignoredRegions.includes(p.region));
  if (paras.length < A.minParagraphsForLength) {
    out.push(notApplicable('aeo.paragraph.length', 'the page has too few paragraphs to assess.'));
  } else {
    const long = paras.filter((p) => p.wordCount > A.longParagraphWords);
    const ratio = long.length / paras.length;
    const avg = Math.round(paras.reduce((n, p) => n + p.wordCount, 0) / paras.length);
    const status =
      long.length === 0 ? 'passed' : ratio > A.longParagraphFailRatio ? 'failed' : 'warning';
    out.push(
      check('aeo.paragraph.length', status, {
        evidenceKind: 'detected',
        evidence: [
          ev('Average words per paragraph', avg),
          ev(`Paragraphs over ${A.longParagraphWords} words`, long.length),
          ev('Paragraphs checked', paras.length),
          ...partial,
        ],
        explanation:
          status === 'passed'
            ? 'Paragraphs are a scannable length.'
            : 'Long paragraphs are harder to scan and to quote.',
        recommendation: status === 'passed' ? OK : 'Split long paragraphs into focused chunks.',
      }),
    );
  }

  // ---- readability (English only) ----
  const lang = (s.head.lang ?? '').toLowerCase();
  if (!lang.startsWith('en')) {
    out.push(
      notTested(
        'aeo.readability',
        lang === ''
          ? 'the page does not declare a language, so Flesch scoring (English only) was not applied.'
          : `the page language is "${s.head.lang}"; Flesch Reading Ease is only valid for English.`,
      ),
    );
  } else {
    const text = paras.map((p) => p.text).join(' ');
    const words = (text.match(/\S+/g) ?? []).length;
    const score = words >= A.readabilityMinWords ? fleschReadingEase(text) : null;
    if (score === null) {
      out.push(
        notApplicable(
          'aeo.readability',
          `fewer than ${A.readabilityMinWords} words of paragraph text were available.`,
        ),
      );
    } else {
      const R = A.readability;
      const status =
        score >= R.passAtLeast ? 'passed' : score >= R.warnAtLeast ? 'warning' : 'failed';
      out.push(
        check('aeo.readability', status, {
          evidenceKind: 'inferred',
          evidence: [
            ev('Flesch Reading Ease', Math.round(score * 10) / 10),
            ev('Words sampled', words),
            ...(s.truncated.includes('paragraphs.text')
              ? [
                  ev(
                    'Note',
                    'Long paragraphs were shortened in the snapshot; the score uses the available text.',
                  ),
                ]
              : []),
          ],
          explanation:
            'A rough readability indicator (Flesch Reading Ease, English). Technical subjects legitimately score lower.',
          recommendation:
            status === 'passed'
              ? OK
              : 'Use shorter sentences and simpler words where the audience allows.',
        }),
      );
    }
  }

  // ---- author, dates ----
  const personAuthors = entities
    .filter((e) => hasValue(e.node['author']))
    .map((e) => valueText(e.node['author']))
    .filter((x): x is string => x !== null);
  const authorNames = [...s.signals.authors.map((a) => a.text), ...personAuthors];
  out.push(
    authorNames.length > 0
      ? check('aeo.author', 'passed', {
          evidenceKind: 'detected',
          evidence: [
            ...s.signals.authors.map((a) => ev(`Author (${a.source})`, a.text)),
            ...personAuthors.map((n) => ev('Author (schema)', n)),
          ],
          explanation: 'Author information is present.',
          recommendation: OK,
        })
      : check('aeo.author', 'warning', {
          evidenceKind: 'detected',
          explanation:
            'No author information (meta author, rel=author, byline or schema author) was found.',
          recommendation:
            'Show who wrote or reviewed the content, ideally linking to an author page.',
        }),
  );

  const dateKinds = new Set(s.signals.dates.map((d) => d.kind));
  for (const e of entities) {
    if (hasValue(e.node['datePublished'])) dateKinds.add('published');
    if (hasValue(e.node['dateModified'])) dateKinds.add('modified');
  }
  const dateEvidence = [
    ...s.signals.dates.map((d) => ev(`Date (${d.source}, ${d.kind})`, d.value)),
    ...entities.flatMap((e) =>
      ['datePublished', 'dateModified']
        .filter((k) => hasValue(e.node[k]))
        .map((k) => ev(`${k} (schema)`, valueText(e.node[k]))),
    ),
  ];
  const hasPub = dateKinds.has('published');
  const hasMod = dateKinds.has('modified');
  if (hasPub && hasMod)
    out.push(
      check('aeo.dates', 'passed', {
        evidenceKind: 'detected',
        evidence: dateEvidence,
        explanation: 'Both a published and a modified date are present.',
        recommendation: OK,
      }),
    );
  else if (hasPub || hasMod || dateKinds.has('unspecified'))
    out.push(
      check('aeo.dates', 'warning', {
        evidenceKind: 'detected',
        evidence: dateEvidence,
        explanation:
          'Only some date information was found (published, modified, or an unlabeled date).',
        recommendation: 'Expose both published and last-modified dates in markup and on the page.',
      }),
    );
  else
    out.push(
      check('aeo.dates', 'warning', {
        evidenceKind: 'detected',
        explanation:
          'No published or modified date was found. Freshness is hard to judge without one.',
        recommendation:
          'Add visible dates and datePublished/dateModified markup where the content is time-sensitive.',
      }),
    );

  // ---- citations ----
  const refHeadings = s.headings.filter((h) => A.referencesHeading.test(h.text));
  const quotesWithCite = s.signals.citations.blockquotes.filter((b) => b.cite);
  const external = s.links.filter(
    (l) =>
      l.kind === 'http' &&
      l.internal === false &&
      !A.ignoredRegions.includes(l.region) &&
      l.region !== 'header',
  );
  const cited =
    refHeadings.length > 0 ||
    quotesWithCite.length > 0 ||
    s.signals.citations.citeElements > 0 ||
    external.length >= A.minExternalLinksForCitation;
  out.push(
    cited
      ? check('aeo.citations', 'passed', {
          evidenceKind: 'detected',
          evidence: [
            ...refHeadings.map((h) => ev('References heading', h.text)),
            ev('Blockquotes with cite', quotesWithCite.length),
            ev('<cite> elements', s.signals.citations.citeElements),
            ev('External links in content', external.length),
            ...external.slice(0, 4).map((l) => ev('External source', l.resolved ?? l.href)),
          ],
          explanation: 'The page references external sources.',
          recommendation: OK,
        })
      : check('aeo.citations', 'warning', {
          evidenceKind: 'detected',
          evidence: [ev('External links in content', external.length)],
          explanation:
            'No references section, cited quotations or multiple external sources were found.',
          recommendation: 'Link to the primary sources behind factual claims.',
        }),
  );

  // ---- conversational coverage ----
  const openers = new Set(questions.map((q) => q.opener).filter((o): o is string => o !== null));
  if (questions.length === 0) {
    out.push(notApplicable('aeo.conversational', 'no questions were detected.'));
  } else {
    const n = openers.size;
    out.push(
      check('aeo.conversational', n >= A.distinctQuestionTypesPass ? 'passed' : 'warning', {
        evidenceKind: 'inferred',
        evidence: [ev('Distinct question openers', [...openers].join(', ') || 'none')],
        explanation:
          n >= A.distinctQuestionTypesPass
            ? 'Questions cover several conversational angles (what/how/why …).'
            : 'Questions cover few conversational angles. This only counts phrasing on this page, not real search demand.',
        recommendation:
          n >= A.distinctQuestionTypesPass
            ? OK
            : 'Consider the other natural follow-up questions (why, how, when, who) your audience asks.',
      }),
    );
  }
  return out;
}
