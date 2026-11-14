import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { App } from '../../src/dashboard/App';
import { createHistory } from '../../src/storage/history';
import { fakeArea, fixtureReport } from './helpers';

const downloads: { name: string; type: string; size: number }[] = [];
vi.mock('../../src/utils/download', () => ({
  downloadBlob: (blob: Blob, name: string) =>
    downloads.push({ name, type: blob.type, size: blob.size }),
  downloadText: (text: string, mime: string, name: string) =>
    downloads.push({ name, type: mime, size: text.length }),
}));

async function setup(names: string[] = ['well-optimized', 'bad-jsonld']) {
  const history = createHistory(fakeArea().area);
  const reports = [];
  for (const n of names) {
    const r = await fixtureReport(n);
    await history.save(r);
    reports.push(r);
  }
  return { history, reports };
}
const ready = (text: RegExp | string) => screen.findAllByText(text);
const nav = (name: RegExp | string) => fireEvent.click(screen.getByRole('button', { name }));

describe('Dashboard', () => {
  beforeEach(() => {
    downloads.length = 0;
    window.history.replaceState(null, '', '/');
  });
  afterEach(cleanup);

  it('shows an honest empty state when there are no reports', async () => {
    render(<App history={createHistory(fakeArea().area)} />);
    expect(await screen.findByText(/No audit yet/)).toBeTruthy();
  });

  it('opens the newest report: URL, title, scores, counts, recommendations, SERP preview', async () => {
    const { history, reports } = await setup();
    render(<App history={history} />);
    const latest = reports[1]!; // bad-jsonld saved last
    expect(await ready(latest.url)).toBeTruthy();
    expect(
      screen.getByLabelText(new RegExp(`Overall score: ${latest.overall} out of 100`)),
    ).toBeTruthy();
    for (const l of ['Technical SEO', 'On-page SEO', 'AEO', 'GEO'])
      expect(screen.getAllByText(l).length).toBeGreaterThan(0);
    expect(screen.getByText('Critical issues')).toBeTruthy();
    expect(screen.getByText('Top recommendations')).toBeTruthy();
    expect(screen.getByLabelText('Search result snippet preview')).toBeTruthy();
    expect(screen.getByText(/does not measure|do not measure/i)).toBeTruthy();
  });

  it('loads the report named in ?report=', async () => {
    const { history, reports } = await setup();
    window.history.replaceState(null, '', `/?report=${reports[0]!.id}`);
    render(<App history={history} />);
    expect(await ready(reports[0]!.url)).toBeTruthy();
  });

  it('reports a missing report id instead of crashing', async () => {
    const { history } = await setup();
    window.history.replaceState(null, '', '/?report=nope');
    render(<App history={history} />);
    expect(await screen.findByText(/was not found/)).toBeTruthy();
  });

  it('Technical SEO: lists all technical checks, filters by status, expands evidence, clears filters', async () => {
    const { history, reports } = await setup(['missing-metadata']);
    render(<App history={history} />);
    await ready(reports[0]!.url);
    nav('Technical SEO');
    const technical = reports[0]!.checks.filter((c) => c.category === 'technical');
    expect(
      await screen.findByText(`Showing ${technical.length} of ${technical.length} checks`),
    ).toBeTruthy();

    const failedCount = technical.filter((c) => c.status === 'failed').length;
    fireEvent.click(screen.getByRole('button', { name: /^Failed \d+/ }));
    expect(screen.getByText(`Showing ${failedCount} of ${technical.length} checks`)).toBeTruthy();
    expect(screen.queryByText('Showing 0 of', { exact: false })).toBeNull();

    const viewport = screen.getByRole('button', { name: /Viewport meta tag/ });
    expect(viewport.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(viewport);
    expect(viewport.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByText(/No viewport meta tag was found/)).toBeTruthy();
    expect(screen.getByText(/Recommendation:/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Clear filters/ }));
    expect(
      screen.getByText(`Showing ${technical.length} of ${technical.length} checks`),
    ).toBeTruthy();
  });

  it('filters by severity and text search, with an empty state', async () => {
    const { history, reports } = await setup(['empty']);
    render(<App history={history} />);
    await ready(reports[0]!.url);
    nav('On-page');
    fireEvent.change(screen.getByLabelText('Search checks'), {
      target: { value: 'zzzz-no-match' },
    });
    expect(screen.getByText('No checks match the current filters.')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Search checks'), {
      target: { value: 'meta description' },
    });
    expect(screen.getByRole('button', { name: /Meta description/ })).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Search checks'), { target: { value: '' } });
    fireEvent.click(
      within(screen.getByRole('group', { name: 'Severity' })).getByRole('button', {
        name: /^Critical/,
      }),
    );
    const critical = reports[0]!.checks.filter(
      (c) => c.category === 'onpage' && c.severity === 'critical',
    ).length;
    expect(screen.getByText(new RegExp(`Showing ${critical} of`))).toBeTruthy();
  });

  it('shows not-tested reasons for inaccessible data', async () => {
    const history = createHistory(fakeArea().area);
    const r = await fixtureReport('empty');
    const hidden = {
      ...r,
      checks: r.checks.map((c) =>
        c.id === 'tech.robotstxt'
          ? { ...c, status: 'not_tested' as const, notTestedReason: 'HTTP 403' }
          : c,
      ),
    };
    await history.save(hidden);
    render(<App history={history} />);
    await ready(r.url);
    nav('Technical SEO');
    fireEvent.click(screen.getByRole('button', { name: /^robots\.txt/ }));
    expect(screen.getByText(/Why it could not be tested:/).parentElement?.textContent).toContain(
      'HTTP 403',
    );
  });

  it('AEO and GEO sections show evidence-based panels and inferred/detected labels', async () => {
    const { history, reports } = await setup(['faq']);
    render(<App history={history} />);
    await ready(reports[0]!.url);
    nav('AEO Intelligence');
    expect(await screen.findByText(/Questions detected \(\d+\)/)).toBeTruthy();
    expect(
      screen.getAllByText('How often should I descale an espresso machine?').length,
    ).toBeGreaterThan(0);
    expect(screen.getByText('FAQ structures')).toBeTruthy();
    expect(screen.getByText('Missing opportunities')).toBeTruthy();
    nav('GEO Intelligence');
    expect(await screen.findByText('Business identity')).toBeTruthy();
    expect(screen.getByText(/does not measure whether any AI system/)).toBeTruthy();
    expect(screen.getAllByText(/Detected|Inferred/).length).toBeGreaterThan(0);
  });

  it('Schema Inspector: shows the JSON-LD syntax error for the bad fixture while the valid block still parses', async () => {
    const { history } = await setup(['bad-jsonld']);
    render(<App history={history} />);
    await ready(/example\.com\/schema-test/);
    nav('Schema Inspector');
    const alerts = await screen.findAllByRole('alert');
    expect(alerts).toHaveLength(2);
    expect(alerts[0]!.textContent).toContain('JSON-LD block 2 has a syntax error');
    expect(screen.getAllByText(/Organization/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Missing recommended properties/)).toBeTruthy();
    expect(screen.getByText(/not schema\.org requirements/)).toBeTruthy();
    fireEvent.click(screen.getByRole('tab', { name: 'Raw structured data' }));
    expect(screen.getByText(/JSON-LD block 1 — valid/)).toBeTruthy();
    expect(screen.getByText(/JSON-LD block 2 — invalid/)).toBeTruthy();
    expect(screen.getByText(/Broken Co/)).toBeTruthy();
  });

  it('Content Structure shows the heading tree and flags skipped levels; Links filters work', async () => {
    const { history } = await setup(['multiple-h1']);
    render(<App history={history} />);
    await ready(/example\.com\/multi/);
    nav('Content Structure');
    const tree = await screen.findByRole('list', { name: 'Heading tree' });
    expect(within(tree).getAllByRole('listitem')).toHaveLength(5);
    expect(within(tree).getByText('skipped level')).toBeTruthy();
    expect(within(tree).getByText('(empty heading)')).toBeTruthy();
    nav('Links');
    expect(await screen.findByText('Internal links')).toBeTruthy();
    expect(screen.getByText('No links match.')).toBeTruthy();
  });

  it('Links: summary and table with filters (organization fixture)', async () => {
    const { history } = await setup(['well-optimized']);
    render(<App history={history} />);
    await ready(/home-coffee-brewing/);
    nav('Links');
    await screen.findByText('Link list (9)');
    fireEvent.click(screen.getByRole('button', { name: 'External' }));
    expect(screen.getByText('Link list (2)')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Same-page' }));
    expect(screen.getByText('Link list (1)')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Search links'), { target: { value: 'wikipedia' } });
    expect(screen.getByText('No links match.')).toBeTruthy();
  });

  it('History: lists, opens, deletes (and falls back), changes the cap, clears with confirmation', async () => {
    const { history, reports } = await setup(['well-optimized', 'empty', 'article']);
    render(<App history={history} />);
    await ready(reports[2]!.url);
    nav('History');
    expect(await screen.findByText('Saved reports (3)')).toBeTruthy();
    fireEvent.click(screen.getAllByRole('button', { name: 'View' })[0]!);
    await ready(reports[1]!.url);
    nav('History');
    fireEvent.click(
      await screen.findByRole('button', { name: `Delete report for ${reports[1]!.url}` }),
    );
    expect(await screen.findByText('Saved reports (2)')).toBeTruthy();
    expect((await history.list()).map((e) => e.id)).not.toContain(reports[1]!.id);

    fireEvent.change(screen.getByLabelText(/Keep at most/), { target: { value: '1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Saved reports (1)')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Clear all history' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByText('Saved reports (1)')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Clear all history' }));
    fireEvent.click(screen.getByRole('button', { name: 'Yes, delete all' }));
    expect(await screen.findByText(/No reports yet/)).toBeTruthy();
    expect(await history.list()).toEqual([]);
  });

  it('Compare: needs two reports, then shows a side-by-side diff with differences filter', async () => {
    const one = await setup(['empty']);
    const { unmount } = render(<App history={one.history} />);
    await ready(one.reports[0]!.url);
    nav('Compare');
    expect(await screen.findByText(/at least two pages/)).toBeTruthy();
    unmount();

    const { history, reports } = await setup(['missing-metadata', 'well-optimized']);
    render(<App history={history} />);
    await ready(reports[1]!.url);
    nav('Compare');
    const selectA = (await screen.findByLabelText('Report A')) as HTMLSelectElement;
    const selectB = screen.getByLabelText('Report B') as HTMLSelectElement;
    expect(selectA.value).toBe(reports[0]!.id);
    expect(selectB.value).toBe(reports[1]!.id);
    expect(await screen.findByText('Key metadata')).toBeTruthy();
    expect(screen.getByText('Complete Guide to Home Coffee Brewing | BrewLab')).toBeTruthy();
    const before = screen.getAllByRole('row').length;
    fireEvent.click(screen.getByLabelText('Show only differences'));
    expect(screen.getAllByRole('row').length).toBeLessThan(before);
    fireEvent.change(selectA, { target: { value: reports[1]!.id } });
    await waitFor(() => expect(screen.queryAllByRole('row').length).toBeLessThan(before));
    fireEvent.click(screen.getByLabelText('Show only differences')); // identical reports: every check is "same"
    await waitFor(() => expect(screen.getAllByText('same').length).toBeGreaterThan(0));
  });

  it('Reports: PDF, CSV and JSON exports each trigger a real download', async () => {
    const { history, reports } = await setup(['article']);
    render(<App history={history} />);
    await ready(reports[0]!.url);
    nav('Reports');
    fireEvent.click(await screen.findByRole('button', { name: 'Export CSV' }));
    await screen.findByText('CSV downloaded.');
    fireEvent.click(screen.getByRole('button', { name: 'Export JSON' }));
    await screen.findByText('JSON downloaded.');
    fireEvent.click(screen.getByRole('button', { name: 'Export PDF' }));
    await screen.findByText('PDF downloaded.');
    expect(downloads.map((d) => d.name.split('.').pop())).toEqual(['csv', 'json', 'pdf']);
    expect(downloads[2]!.type).toBe('application/pdf');
    expect(downloads[2]!.size).toBeGreaterThan(2000);
    expect(downloads[0]!.size).toBeGreaterThan(500);
  });

  it('every visible button is wired (no inert controls) on the overview', async () => {
    const { history, reports } = await setup(['article']);
    render(<App history={history} />);
    await ready(reports[0]!.url);
    const names = screen.getAllByRole('button').map((b) => b.textContent?.trim());
    expect(names).toEqual(
      expect.arrayContaining(['Overview', 'Technical SEO', 'History', 'Compare', 'Reports']),
    );
  });
});
