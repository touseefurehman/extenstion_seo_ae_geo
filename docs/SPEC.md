# Build NexusRank — SEO, AEO & GEO Intelligence Chrome Extension

Act as a senior Chrome Extension engineer, React developer, SEO specialist, product designer and software architect.

Build a production-quality Chrome Extension named **NexusRank**, developed by WebsNexus.

## 1. Product objective

Create a powerful SEO, AEO (Answer Engine Optimization) and GEO (Generative Engine Optimization) analyzer that evaluates the currently open webpage.

The extension must work without paid APIs, AI APIs, external SEO APIs or mandatory backend services.

All initial analysis must be performed locally using JavaScript, browser APIs, DOM inspection, HTML metadata and custom analysis rules.

This must be a functional product, not a static UI prototype.

## 2. Technology stack

- Chrome Extension Manifest V3
- React.js
- TypeScript
- Vite
- Bootstrap 5
- Custom CSS
- Lucide icons
- Chrome Storage API
- JavaScript DOM APIs
- Vitest for unit testing
- Playwright for browser testing where applicable
- jsPDF for PDF export

Avoid unnecessary dependencies.

## 3. Extension architecture

Organize the project into separate modules:

- extension/
- popup/
- dashboard/
- content/
- background/
- analyzers/
  - seo/
  - aeo/
  - geo/
  - schema/
  - content/
  - links/
- scoring/
- reports/
- storage/
- components/
- hooks/
- utils/
- types/
- tests/

Use a clean modular architecture. Analysis rules must be independent, reusable and testable.

## 4. SEO analyzer

Implement the following checks:

### Metadata

- Page title presence and length.
- Meta description presence and length.
- Canonical URL.
- Robots meta directives.
- Meta keywords detection.
- Duplicate title/description within the same page where applicable.

### Headings

- H1 presence.
- Multiple H1 detection.
- H1–H6 hierarchy.
- Empty headings.
- Heading structure visualization.

### Images

- Missing alt attributes.
- Empty alt attributes.
- Image dimensions where available.
- Large image indicators where measurable.
- Image filename analysis.

### Links

- Internal and external link counts.
- Empty anchor text.
- Missing descriptive anchor text indicators.
- Nofollow, sponsored and ugc attributes.
- Links with invalid or unsupported destinations.
- Same-page anchors.

### Technical SEO

- HTTPS detection.
- Canonical conflicts.
- Indexability signals.
- Noindex/nofollow directives.
- Robots.txt availability when accessible.
- Sitemap references.
- Viewport meta tag.
- Language attribute.
- Hreflang tags.
- Open Graph metadata.
- Twitter Card metadata.

### Performance indicators

- DOM element count.
- HTML document size where measurable.
- Image count.
- Script count.
- Stylesheet count.
- Lazy-loading attributes.
- Resource loading indicators where accessible.

Do not present these lightweight browser measurements as a replacement for Lighthouse or Core Web Vitals testing.

## 5. AEO analyzer

Analyze answer-engine readiness.

Implement:

- Question phrase detection.
- Question and answer proximity.
- FAQ section detection.
- FAQPage structured data detection.
- Definition-style content detection.
- Direct answer paragraph detection.
- Lists and tables detection.
- Step-by-step content detection.
- Paragraph length analysis.
- Readability indicators.
- Author information detection.
- Published and modified dates.
- Citations and external source references.
- Conversational question coverage.

Show actual evidence for each finding.

Do not claim that detecting a question automatically means a search engine will select the answer.

## 6. GEO analyzer

Analyze signals that help generative search systems understand website content.

Implement:

- Organization entity detection.
- Person entity detection.
- Product and service entity detection.
- Organization schema.
- Article schema.
- Person schema.
- SameAs profile links.
- Brand identity signals.
- Business contact information.
- Author and expertise indicators.
- Topical coverage indicators.
- Internal contextual links.
- Factual claims and reference indicators.
- Content clarity and entity consistency.

Distinguish detected evidence from inferred recommendations.

Do not claim to measure actual ChatGPT, Gemini, Claude or Perplexity citation rankings.

## 7. Structured data inspector

Build a dedicated schema inspector.

Support:

- JSON-LD.
- Microdata.
- RDFa.
- Organization.
- LocalBusiness.
- Person.
- Article.
- Product.
- Service.
- FAQPage.
- BreadcrumbList.
- WebSite.
- WebPage.

Display:

- Schema type.
- Detected properties.
- Missing recommended properties.
- Invalid JSON-LD syntax.
- Nested objects.
- Raw structured data.

Do not incorrectly label recommended properties as mandatory schema requirements.

## 8. Scoring engine

Create four independent scores:

- Technical SEO: 35% of overall score.
- On-page SEO: 25%.
- AEO: 20%.
- GEO: 20%.

Calculate scores from actual checks.

Every check must have:

- Unique ID.
- Category.
- Severity.
- Status.
- Weight.
- Evidence.
- Explanation.
- Recommendation.

Statuses:

- Passed.
- Warning.
- Failed.
- Not applicable.
- Not tested.

Do not penalize a page for checks that are genuinely not applicable.

Use transparent weighted calculations. Keep all scoring rules configurable.

## 9. Dashboard UI

Create a premium, modern, professional dashboard.

Design direction:

- Dark navy/charcoal interface.
- Subtle blue and purple accents.
- Clean typography.
- Minimal gradients.
- Professional charts.
- Rounded cards.
- Consistent spacing.
- Responsive layouts.
- Clear visual hierarchy.

Dashboard sections:

### Overview

- Website URL.
- Page title.
- Overall score.
- Technical SEO score.
- On-page SEO score.
- AEO score.
- GEO score.
- Critical issues.
- Warnings.
- Passed checks.
- Top recommendations.

### Technical SEO

Display all checks with filters and expandable evidence.

### AEO Intelligence

Display questions, answer coverage, FAQ structures, content organization and missing opportunities.

### GEO Intelligence

Display entities, schema signals, authorship, business identity and topical signals.

### Schema Inspector

Provide an interactive schema explorer.

### Content Structure

Show heading hierarchy, paragraph analysis, questions, lists and tables.

### Reports

Allow users to export PDF, CSV and JSON.

## 10. Chrome extension functionality

Use Manifest V3.

Implement:

- Extension icon.
- Compact popup.
- Analyze current page button.
- Dedicated dashboard tab.
- Content script for DOM inspection.
- Background service worker where necessary.
- Chrome Storage API for local history.
- Reanalysis button.
- Loading and error states.
- Permissions only when necessary.

Use least-privilege permissions.

Never request access to all websites unless genuinely required.

The extension must not collect browsing history, send page content to external servers or inject advertisements.

Do not load remote JavaScript or remote fonts.

## 11. Advanced features

Include:

- SERP snippet preview.
- Heading tree viewer.
- Metadata preview.
- Schema JSON viewer.
- Internal/external link summary.
- Page comparison interface.
- Local audit history.
- PDF export.
- CSV export.
- JSON export.

For competitor comparison, allow users to analyze two pages separately and compare their collected data.

Do not attempt to bypass website access controls.

## 12. Accuracy and privacy

This is a critical requirement.

- Every finding must be based on measurable evidence.
- Do not fabricate data.
- Distinguish missing information from inaccessible information.
- Do not claim actual Google rankings.
- Do not claim actual AI search visibility.
- Do not claim backlink profiles can be measured without backlink data.
- Do not claim keyword search volume can be measured without keyword data sources.
- Clearly explain limitations of browser-based analysis.
- Keep page analysis local.
- Store reports locally by default.

## 13. Testing

Create test fixtures containing:

- Well-optimized webpage.
- Missing metadata webpage.
- Multiple H1 webpage.
- Missing image alt webpage.
- Incorrect JSON-LD webpage.
- FAQ webpage.
- Article webpage.
- Organization webpage.
- Empty webpage.
- Very large webpage.

Write unit tests for every scoring rule.

Test:

- Popup.
- Dashboard.
- DOM extraction.
- Analysis engine.
- Schema parsing.
- Score calculations.
- Local storage.
- Report exports.

Ensure there are no broken buttons, fake interactions, placeholder results or console errors.

## 14. Development workflow

Work in the following order:

1. Initialize the project.
2. Configure Vite and React.
3. Configure Manifest V3.
4. Build the extension architecture.
5. Implement DOM extraction.
6. Implement SEO analysis.
7. Implement AEO analysis.
8. Implement GEO analysis.
9. Implement structured data inspection.
10. Implement scoring.
11. Build the dashboard.
12. Integrate all analysis modules.
13. Implement local history.
14. Implement PDF, CSV and JSON exports.
15. Write tests.
16. Fix all bugs.
17. Build the production extension.

Do not try to build everything in one unverified step.

After each stage:

- Run the project.
- Test the implemented functionality.
- Fix errors.
- Continue only after the stage works.

## 15. Deliverables

Provide:

1. Complete source code.
2. Clean project structure.
3. Working Chrome extension.
4. Manifest V3 configuration.
5. Installation instructions.
6. Developer documentation.
7. Testing instructions.
8. Production build instructions.
9. List of permissions and why they are required.
10. Known limitations.

The final extension must be loadable through Chrome's Developer Mode using Load unpacked.

## Final instruction

Prioritize real functionality, analysis accuracy, privacy and professional UI.

Do not replace functionality with hardcoded sample data.

Do not introduce paid APIs or mandatory external services.

Build NexusRank as a real, extensible product that can eventually support commercial subscriptions and agency features.
