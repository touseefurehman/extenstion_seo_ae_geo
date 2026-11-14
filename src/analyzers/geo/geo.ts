import { THRESHOLDS } from '../../scoring/config';
import type { CheckResult } from '../../types/check';
import type { PageSnapshot } from '../../types/snapshot';
import { check, ev, notApplicable, OK } from '../common';
import {
  collectEntities,
  entitiesOfType,
  hasValue,
  valuesOf,
  valueText,
} from '../schema/normalize';
import { clipText, normalizeName } from '../text';

const G = THRESHOLDS.geo;
const NOTE =
  'This measures on-page signals only; it says nothing about whether any AI system uses or cites the page.';

const ORG_TYPES = [
  'Organization',
  'LocalBusiness',
  'Corporation',
  'NGO',
  'OnlineStore',
  'Restaurant',
  'Store',
  'NewsMediaOrganization',
  'EducationalOrganization',
];

function isUrl(v: unknown): v is string {
  return typeof v === 'string' && /^https?:\/\//i.test(v.trim());
}

/** Distinct brand-name candidates from structured data and meta tags. */
export function brandNames(s: PageSnapshot): { source: string; name: string }[] {
  const out: { source: string; name: string }[] = [];
  const og = (s.head.og['og:site_name'] ?? '').trim();
  if (og) out.push({ source: 'og:site_name', name: og });
  const app = s.head.metas.find((m) => m.name === 'application-name')?.content?.trim();
  if (app) out.push({ source: 'application-name', name: app });
  const ents = entitiesOfType(collectEntities(s), ...ORG_TYPES, 'WebSite');
  for (const e of ents) {
    const n = valueText(e.node['name']);
    if (n) out.push({ source: `schema ${e.types[0]}`, name: n });
  }
  return out;
}

export function analyzeGeo(s: PageSnapshot): CheckResult[] {
  const out: CheckResult[] = [];
  const entities = collectEntities(s);
  const orgs = entitiesOfType(entities, ...ORG_TYPES);
  const people = entitiesOfType(entities, 'Person');
  const products = entitiesOfType(
    entities,
    'Product',
    'Service',
    'IndividualProduct',
    'ProductModel',
  );
  const thin = s.bodyWordCount < G.minWordsForAnalysis;

  // ---- organization ----
  const orgSignals = [
    (s.head.og['og:site_name'] ?? '') !== '' && 'og:site_name',
    s.signals.addresses.length > 0 && '<address>',
    s.signals.telLinks.length > 0 && 'tel: link',
    s.signals.mailtoLinks.length > 0 && 'mailto: link',
  ].filter((x): x is string => typeof x === 'string');
  if (orgs.length > 0) {
    out.push(
      check('geo.entity.organization', 'passed', {
        evidenceKind: 'detected',
        evidence: orgs
          .slice(0, 4)
          .map((o) =>
            ev(`Schema ${o.types[0]} (${o.syntax})`, valueText(o.node['name']) ?? '(no name)'),
          ),
        explanation: `An Organization-type entity is declared in structured data. ${NOTE}`,
        recommendation: OK,
      }),
    );
  } else if (orgSignals.length > 0) {
    out.push(
      check('geo.entity.organization', 'warning', {
        evidenceKind: 'inferred',
        evidence: orgSignals.map((x) => ev('On-page signal', x)),
        explanation:
          'Organization signals exist on the page, but no Organization structured data declares the entity explicitly.',
        recommendation:
          'Add Organization (or LocalBusiness) JSON-LD with name, url, logo and sameAs.',
      }),
    );
  } else {
    out.push(
      check('geo.entity.organization', 'warning', {
        evidenceKind: 'detected',
        explanation:
          'No Organization entity or on-page organization signals were found, so the publisher is not clearly identified.',
        recommendation:
          'Identify the organization with Organization JSON-LD and visible name/contact details.',
      }),
    );
  }

  // ---- person ----
  if (people.length > 0) {
    out.push(
      check('geo.entity.person', 'passed', {
        evidenceKind: 'detected',
        evidence: people
          .slice(0, 4)
          .map((p) => ev(`Schema Person (${p.syntax})`, valueText(p.node['name']) ?? '(no name)')),
        explanation: 'A Person entity is declared in structured data.',
        recommendation: OK,
      }),
    );
  } else if (s.signals.authors.length > 0) {
    out.push(
      check('geo.entity.person', 'warning', {
        evidenceKind: 'inferred',
        evidence: s.signals.authors.map((a) => ev(`Author (${a.source})`, a.text)),
        explanation: 'An author is named on the page but not declared as a Person entity.',
        recommendation: 'Declare the author as a Person in the Article markup.',
      }),
    );
  } else {
    out.push(notApplicable('geo.entity.person', 'no person or author was detected.'));
  }

  // ---- product / service ----
  out.push(
    products.length > 0
      ? check('geo.entity.product', 'passed', {
          evidenceKind: 'detected',
          evidence: products
            .slice(0, 4)
            .map((p) => ev(`Schema ${p.types[0]}`, valueText(p.node['name']) ?? '(no name)')),
          explanation: 'A Product or Service entity is declared.',
          recommendation: OK,
        })
      : notApplicable(
          'geo.entity.product',
          'no Product or Service markup was found (not every page offers one).',
        ),
  );

  // ---- sameAs ----
  const subjects = [...orgs, ...people];
  if (subjects.length === 0) {
    out.push(
      notApplicable(
        'geo.sameas',
        'there is no Organization or Person entity to carry sameAs links.',
      ),
    );
  } else {
    const links = [
      ...new Set(
        subjects.flatMap((e) =>
          valuesOf(e.node['sameAs'])
            .filter(isUrl)
            .map((u) => u.trim()),
        ),
      ),
    ];
    out.push(
      links.length >= G.minSameAs
        ? check('geo.sameas', 'passed', {
            evidenceKind: 'detected',
            evidence: links.slice(0, 8).map((u) => ev('sameAs', u)),
            explanation:
              'The entity links to its profiles elsewhere, which helps systems reconcile it with known entities.',
            recommendation: OK,
          })
        : check('geo.sameas', 'warning', {
            evidenceKind: 'detected',
            evidence: [ev('sameAs links', links.length), ...links.map((u) => ev('sameAs', u))],
            explanation:
              links.length === 0
                ? 'The entity has no sameAs links.'
                : 'Only one sameAs link was found.',
            recommendation:
              'Add sameAs links to official profiles (social accounts, Wikipedia/Wikidata, directories).',
          }),
    );
  }

  // ---- brand consistency ----
  const names = brandNames(s);
  if (names.length === 0) {
    out.push(
      notApplicable(
        'geo.brand.consistency',
        'no brand name source (og:site_name, schema name) was found.',
      ),
    );
  } else {
    const norm = names
      .map((n) => ({ ...n, key: normalizeName(n.name) }))
      .filter((n) => n.key !== '');
    const base = norm[0]!;
    const mismatches = norm.filter((n) => !(n.key.includes(base.key) || base.key.includes(n.key)));
    const title = normalizeName(s.head.title ?? '');
    const inTitle = norm.some((n) => title.includes(n.key));
    const evidence = [...names.map((n) => ev(n.source, n.name)), ev('Title', s.head.title)];
    if (mismatches.length > 0) {
      out.push(
        check('geo.brand.consistency', 'warning', {
          evidenceKind: 'detected',
          evidence,
          explanation:
            'The brand name differs between sources, which makes the entity harder to reconcile.',
          recommendation:
            'Use one consistent brand name in og:site_name, structured data and the title.',
        }),
      );
    } else if (!inTitle) {
      out.push(
        check('geo.brand.consistency', 'warning', {
          evidenceKind: 'detected',
          evidence,
          explanation:
            'The brand name is consistent across metadata but does not appear in the page title.',
          recommendation: 'Include the brand name in the title (for example as a suffix).',
        }),
      );
    } else {
      out.push(
        check('geo.brand.consistency', 'passed', {
          evidenceKind: 'detected',
          evidence,
          explanation: 'The brand name is consistent across metadata and appears in the title.',
          recommendation: OK,
        }),
      );
    }
  }

  // ---- contact ----
  const schemaPhone = entities.some(
    (e) => hasValue(e.node['telephone']) || hasValue(e.node['contactPoint']),
  );
  const schemaEmail = entities.some((e) => hasValue(e.node['email']));
  const schemaAddress = entities.some((e) => hasValue(e.node['address']));
  const kinds = [
    s.signals.telLinks.length > 0 || schemaPhone ? 'phone' : null,
    s.signals.mailtoLinks.length > 0 || schemaEmail ? 'email' : null,
    s.signals.addresses.length > 0 || schemaAddress ? 'address' : null,
  ].filter((k): k is string => k !== null);
  const contactEvidence = [
    ...s.signals.telLinks.map((t) => ev('Phone link', t)),
    ...s.signals.mailtoLinks.map((m) => ev('Email link', m)),
    ...s.signals.addresses.map((a) => ev('<address>', clipText(a))),
    ev('Contact in structured data', schemaPhone || schemaEmail || schemaAddress),
  ];
  out.push(
    kinds.length >= G.minContactKinds
      ? check('geo.contact', 'passed', {
          evidenceKind: 'detected',
          evidence: contactEvidence,
          explanation: `Contact details were found (${kinds.join(', ')}).`,
          recommendation: OK,
        })
      : check('geo.contact', 'warning', {
          evidenceKind: 'detected',
          evidence: contactEvidence,
          explanation: `Only ${kinds.length} kind(s) of contact detail found. Pages can legitimately link to a separate contact page.`,
          recommendation:
            'Expose at least two of phone, email and postal address on the page or in markup.',
        }),
  );

  // ---- authorship & expertise ----
  const authorNames = s.signals.authors.map((a) => a.text);
  const schemaAuthors = entities.filter((e) => hasValue(e.node['author']));
  const hasAuthor = authorNames.length > 0 || schemaAuthors.length > 0;
  const expertise = [
    s.signals.authors.some((a) => a.source === 'rel-author') && 'author profile link (rel=author)',
    people.some((p) => hasValue(p.node['jobTitle'])) && 'Person.jobTitle',
    people.some((p) => hasValue(p.node['sameAs'])) && 'Person.sameAs',
    people.some((p) => hasValue(p.node['knowsAbout']) || hasValue(p.node['description'])) &&
      'Person.knowsAbout/description',
    s.signals.authors.some((a) => a.source === 'byline-class' && /,\s*\S+/.test(a.text)) &&
      'byline mentions a role',
  ].filter((x): x is string => typeof x === 'string');
  if (!hasAuthor) {
    out.push(
      check('geo.authorship', 'warning', {
        evidenceKind: 'detected',
        explanation: 'No author was detected, so expertise and accountability signals are missing.',
        recommendation:
          'Name the author and link to a biography page that states relevant credentials.',
      }),
    );
  } else if (expertise.length === 0) {
    out.push(
      check('geo.authorship', 'warning', {
        evidenceKind: 'inferred',
        evidence: authorNames.map((a) => ev('Author', a)),
        explanation:
          'An author is named, but no expertise indicators (profile link, job title, sameAs, role in byline) were found.',
        recommendation: 'Add a short author bio, role or credentials, and link to a profile.',
      }),
    );
  } else {
    out.push(
      check('geo.authorship', 'passed', {
        evidenceKind: 'inferred',
        evidence: [
          ...authorNames.map((a) => ev('Author', a)),
          ...expertise.map((x) => ev('Expertise indicator', x)),
        ],
        explanation: `An author with supporting expertise indicators was found. Indicators are signals; they do not verify credentials. ${NOTE}`,
        recommendation: OK,
      }),
    );
  }

  // ---- topical coverage ----
  const secs = s.headings.filter(
    (h) =>
      G.sectionHeadingLevels.includes(h.level) && !h.empty && !G.ignoredRegions.includes(h.region),
  );
  if (thin && secs.length === 0) {
    out.push(
      notApplicable(
        'geo.topical.coverage',
        'the page has too little content to assess topical coverage.',
      ),
    );
  } else {
    const counts = new Map<string, number>();
    for (const h of secs) {
      for (const w of new Set(h.text.toLowerCase().match(/[\p{L}][\p{L}'-]{2,}/gu) ?? [])) {
        if (!G.stopwords.includes(w)) counts.set(w, (counts.get(w) ?? 0) + 1);
      }
    }
    const top = [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([w, n]) => `${w} (${n})`);
    out.push(
      secs.length >= G.minSections
        ? check('geo.topical.coverage', 'passed', {
            evidenceKind: 'inferred',
            evidence: [
              ev('Section headings (H2-H4)', secs.length),
              ev('Most frequent heading terms', top.join(', ') || 'none'),
            ],
            explanation:
              'The page covers its topic across several sections. This counts headings only and does not judge accuracy or completeness.',
            recommendation: OK,
          })
        : check('geo.topical.coverage', 'warning', {
            evidenceKind: 'inferred',
            evidence: [
              ev('Section headings (H2-H4)', secs.length),
              ev('Most frequent heading terms', top.join(', ') || 'none'),
            ],
            explanation: `Only ${secs.length} section heading(s) found; the topic may be covered shallowly or without clear structure.`,
            recommendation:
              'Break the topic into clearly named sections covering the questions readers have.',
          }),
    );
  }

  // ---- contextual internal links ----
  if (thin) {
    out.push(
      notApplicable(
        'geo.links.contextual',
        'the page has too little text for contextual linking to apply.',
      ),
    );
  } else {
    const generic = THRESHOLDS.links.genericAnchorTexts;
    const ctx = s.links.filter(
      (l) =>
        l.kind === 'http' &&
        l.internal === true &&
        (l.region === 'main' || l.region === 'other') &&
        l.text !== '' &&
        !generic.includes(l.text.toLowerCase()),
    );
    out.push(
      ctx.length >= G.minContextualLinks
        ? check('geo.links.contextual', 'passed', {
            evidenceKind: 'detected',
            evidence: [
              ev('Contextual internal links', ctx.length),
              ...ctx.slice(0, 4).map((l) => ev(l.text, l.href)),
            ],
            explanation:
              'The content links to related pages on the same site with descriptive anchors.',
            recommendation: OK,
          })
        : check('geo.links.contextual', 'warning', {
            evidenceKind: 'detected',
            evidence: [ev('Contextual internal links', ctx.length)],
            explanation:
              'Few descriptive internal links appear inside the main content (navigation and footer links are not counted).',
            recommendation: 'Link related concepts to your own pages with descriptive anchor text.',
          }),
    );
  }

  // ---- factual claims vs references ----
  const claims = s.paragraphs.filter(
    (p) => !G.ignoredRegions.includes(p.region) && G.claimPattern.test(p.text),
  );
  const refs =
    s.links.filter(
      (l) => l.kind === 'http' && l.internal === false && !G.ignoredRegions.includes(l.region),
    ).length +
    s.signals.citations.blockquotes.filter((b) => b.cite).length +
    s.signals.citations.citeElements +
    s.headings.filter((h) => THRESHOLDS.aeo.referencesHeading.test(h.text)).length;
  if (claims.length < G.claimMinCount) {
    out.push(
      notApplicable(
        'geo.claims.references',
        'few paragraphs contain figures, dates or study references, so no claim/source comparison applies.',
      ),
    );
  } else {
    out.push(
      refs > 0
        ? check('geo.claims.references', 'passed', {
            evidenceKind: 'inferred',
            evidence: [
              ev('Paragraphs with figures/dates/study wording', claims.length),
              ev('Reference indicators', refs),
              ...claims.slice(0, 3).map((c) => ev('Claim-like text', clipText(c.text))),
            ],
            explanation:
              'Claim-like statements appear alongside outbound references. Whether the sources support the claims is not checked.',
            recommendation: OK,
          })
        : check('geo.claims.references', 'warning', {
            evidenceKind: 'inferred',
            evidence: [
              ev('Paragraphs with figures/dates/study wording', claims.length),
              ev('Reference indicators', 0),
              ...claims.slice(0, 3).map((c) => ev('Claim-like text', clipText(c.text))),
            ],
            explanation:
              'The page makes claim-like statements but has no outbound references or citations. This is a heuristic based on wording.',
            recommendation: 'Cite primary sources for statistics and factual statements.',
          }),
    );
  }
  return out;
}
