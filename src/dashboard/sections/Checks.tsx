import { CheckList } from '../../components/CheckList';
import { MetadataPreview, SerpPreview } from '../../components/Previews';
import type { AuditReport } from '../../types/report';
import { Panel, Section } from './common';

const perfNote =
  'Performance items are lightweight browser-side indicators. They are not a replacement for Lighthouse or Core Web Vitals testing.';

export function Technical({ report }: { report: AuditReport }) {
  const checks = report.checks.filter((c) => c.category === 'technical');
  const { robotsTxt, sitemap } = report.page;
  return (
    <Section
      title="Technical SEO"
      subtitle="Crawlability, indexability, structured data syntax and lightweight performance indicators."
    >
      <div className="row g-3 mb-3">
        <div className="col-md-6">
          <Panel title="robots.txt">
            <dl className="nr-dl">
              <dt>Status</dt>
              <dd>{robotsTxt.status.replace('_', ' ')}</dd>
              <dt>URL</dt>
              <dd className="nr-url">{robotsTxt.url ?? '—'}</dd>
              {robotsTxt.reason && (
                <>
                  <dt>Detail</dt>
                  <dd>{robotsTxt.reason}</dd>
                </>
              )}
              <dt>Sitemap lines</dt>
              <dd>{robotsTxt.sitemapUrls.length ? robotsTxt.sitemapUrls.join(', ') : 'none'}</dd>
            </dl>
          </Panel>
        </div>
        <div className="col-md-6">
          <Panel title="Sitemap">
            <dl className="nr-dl">
              <dt>Status</dt>
              <dd>{sitemap.status.replace('_', ' ')}</dd>
              <dt>URL</dt>
              <dd className="nr-url">{sitemap.url ?? '—'}</dd>
              {sitemap.reason && (
                <>
                  <dt>Detail</dt>
                  <dd>{sitemap.reason}</dd>
                </>
              )}
              {sitemap.entryCount !== null && (
                <>
                  <dt>Entries</dt>
                  <dd>
                    {sitemap.entryCount}
                    {sitemap.entryCountApproximate ? '+' : ''} ({sitemap.kind})
                  </dd>
                </>
              )}
            </dl>
          </Panel>
        </div>
      </div>
      <CheckList checks={checks} />
      <p className="nr-muted small mt-3">
        {perfNote} HTTP status codes and response headers are not visible to a browser extension
        content script.
      </p>
    </Section>
  );
}

export function OnPage({ report }: { report: AuditReport }) {
  const checks = report.checks.filter((c) => c.category === 'onpage');
  return (
    <Section title="On-page SEO" subtitle="Metadata, headings, images and links.">
      <SerpPreview page={report.page} />
      <Panel title="Metadata preview">
        <MetadataPreview page={report.page} />
      </Panel>
      <CheckList checks={checks} />
    </Section>
  );
}
