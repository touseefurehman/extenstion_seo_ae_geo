import { readFileSync } from 'node:fs';
import { expect, test } from './fixtures';

test.afterEach(({ extensionErrors }) => {
  // Fail the run on any console error from the extension itself.
  expect(extensionErrors, 'console errors in extension pages / service worker').toEqual([]);
});

test('popup: analyzes a real page and shows scores, category scores and top issues', async ({
  analyze,
  baseUrl,
}) => {
  const popup = await analyze('missing-metadata');
  await expect(popup.locator('h1')).toHaveText('NexusRank');
  await expect(popup.getByText(`${baseUrl}/missing-metadata.html`)).toBeVisible();
  for (const label of ['Technical SEO', 'On-page SEO', 'AEO', 'GEO'])
    await expect(popup.getByText(label, { exact: true })).toBeVisible();
  await expect(popup.getByText('Top issues')).toBeVisible();
  await expect(popup.getByRole('listitem')).toHaveCount(3);
  await expect(popup.getByRole('button', { name: 'Re-analyze' })).toBeEnabled();
  await expect(popup.getByRole('button', { name: 'Open dashboard' })).toBeEnabled();
});

test('popup: restricted pages get a friendly message instead of an error', async ({
  context,
  extensionId,
  serviceWorker,
}) => {
  const blank = await context.newPage();
  await blank.goto('about:blank');
  const tabId = await serviceWorker.evaluate(
    async () => (await chrome.tabs.query({ url: 'about:blank' }))[0]?.id ?? null,
  );
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup/popup.html?tabId=${tabId ?? 0}`);
  await expect(popup.getByText(/can.t analyze this page/i)).toBeVisible();
  await expect(popup.getByRole('button', { name: 'Analyze page' })).toBeDisabled();
});

test('popup: re-analyze runs again and the dashboard opens with the report', async ({
  analyze,
  context,
  baseUrl,
}) => {
  const popup = await analyze('well-optimized');
  await popup.getByRole('button', { name: 'Re-analyze' }).click();
  await expect(popup.getByLabel(/Overall score/)).toBeVisible();
  const [dash] = await Promise.all([
    context.waitForEvent('page'),
    popup.getByRole('button', { name: 'Open dashboard' }).click(),
  ]);
  await dash.waitForLoadState();
  expect(dash.url()).toMatch(/dashboard\/dashboard\.html\?report=/);
  await expect(dash.getByRole('heading', { name: 'Overview' })).toBeVisible();
  await expect(dash.getByText(`${baseUrl}/well-optimized.html`).first()).toBeVisible();
  await expect(dash.getByText('Critical issues')).toBeVisible();
  await expect(dash.getByText('Top recommendations')).toBeVisible();
  await expect(dash.getByLabel('Search result snippet preview')).toBeVisible();
  await expect(dash.getByLabel(/Overall score: \d+ out of 100/)).toBeVisible();
});

test('dashboard: filters, expandable evidence, schema inspector, structure and links', async ({
  analyze,
  context,
}) => {
  const popup = await analyze('bad-jsonld');
  const [dash] = await Promise.all([
    context.waitForEvent('page'),
    popup.getByRole('button', { name: 'Open dashboard' }).click(),
  ]);
  await dash.waitForLoadState();

  await dash.getByRole('button', { name: 'Technical SEO' }).click();
  const total = await dash.getByText(/Showing \d+ of \d+ checks/).textContent();
  const n = Number(total?.match(/of (\d+)/)?.[1]);
  await dash
    .getByRole('group', { name: 'Status' })
    .getByRole('button', { name: /^Failed/ })
    .click();
  const filtered = Number(
    (await dash.getByText(/Showing \d+ of \d+ checks/).textContent())?.match(/Showing (\d+)/)?.[1],
  );
  expect(filtered).toBeLessThan(n);
  await dash.getByRole('button', { name: /JSON-LD syntax/ }).click();
  await expect(dash.getByText(/cannot be parsed/)).toBeVisible();
  await expect(dash.getByText(/Block #2 error/)).toBeVisible();
  await dash.getByRole('button', { name: 'Clear filters' }).click();
  await expect(dash.getByText(`Showing ${n} of ${n} checks`)).toBeVisible();

  await dash.getByRole('button', { name: 'Schema Inspector' }).click();
  await expect(dash.getByRole('alert').first()).toContainText('syntax error');
  await dash.getByRole('tab', { name: 'Raw structured data' }).click();
  await expect(dash.getByText('JSON-LD block 1 — valid')).toBeVisible();
  await expect(dash.getByText('Valid Co')).toBeVisible();

  await dash.getByRole('button', { name: 'Content Structure' }).click();
  await expect(dash.getByRole('list', { name: 'Heading tree' })).toContainText(
    'Structured data test',
  );
  await dash.getByRole('button', { name: 'Links', exact: true }).click();
  await expect(dash.getByText('Internal links')).toBeVisible();
});

test('history and compare: two analyses are saved, compared, deleted and cleared', async ({
  analyze,
  context,
  extensionId,
}) => {
  await analyze('missing-metadata');
  const popup2 = await analyze('well-optimized');
  const [dash] = await Promise.all([
    context.waitForEvent('page'),
    popup2.getByRole('button', { name: 'Open dashboard' }).click(),
  ]);
  await dash.waitForLoadState();

  await dash.getByRole('button', { name: 'History' }).click();
  await expect(dash.getByText('Saved reports (2)')).toBeVisible();

  await dash.getByRole('button', { name: 'Compare' }).click();
  await expect(dash.getByText('Key metadata')).toBeVisible();
  await expect(
    dash.getByRole('cell', { name: 'Complete Guide to Home Coffee Brewing | BrewLab' }).first(),
  ).toBeVisible();
  const rowsBefore = await dash.getByRole('row').count();
  await dash.getByLabel('Show only differences').check();
  expect(await dash.getByRole('row').count()).toBeLessThan(rowsBefore);

  await dash.getByRole('button', { name: 'History' }).click();
  await dash.getByRole('button', { name: /^Delete report for .*missing-metadata/ }).click();
  await expect(dash.getByText('Saved reports (1)')).toBeVisible();

  // History persists across a fresh dashboard load (chrome.storage.local).
  await dash.goto(`chrome-extension://${extensionId}/dashboard/dashboard.html#history`);
  await expect(dash.getByText('Saved reports (1)')).toBeVisible();
  await dash.getByRole('button', { name: 'Clear all history' }).click();
  await dash.getByRole('button', { name: 'Yes, delete all' }).click();
  await expect(dash.getByText(/No reports yet/)).toBeVisible();
});

test('reports: PDF, CSV and JSON exports download real files', async ({ analyze, context }) => {
  const popup = await analyze('article');
  const [dash] = await Promise.all([
    context.waitForEvent('page'),
    popup.getByRole('button', { name: 'Open dashboard' }).click(),
  ]);
  await dash.waitForLoadState();
  await dash.getByRole('button', { name: 'Reports' }).click();

  const grab = async (label: string) => {
    const [download] = await Promise.all([
      dash.waitForEvent('download'),
      dash.getByRole('button', { name: label }).click(),
    ]);
    const path = await download.path();
    return { name: download.suggestedFilename(), data: readFileSync(path) };
  };

  const csv = await grab('Export CSV');
  expect(csv.name).toMatch(/^nexusrank-127-0-0-1-\d{8}-\d{4}\.csv$/);
  const csvText = csv.data.toString('utf8');
  expect(csvText.startsWith('﻿URL,')).toBe(true);
  expect(csvText.split('\r\n').filter(Boolean).length).toBeGreaterThan(40);
  expect(csvText).toContain('seo.title.present');

  const json = await grab('Export JSON');
  const report = JSON.parse(json.data.toString('utf8'));
  expect(report).toMatchObject({ version: 1, url: expect.stringContaining('/article.html') });
  expect(report.checks.length).toBeGreaterThan(40);

  const pdf = await grab('Export PDF');
  expect(pdf.name).toMatch(/\.pdf$/);
  expect(pdf.data.subarray(0, 5).toString()).toBe('%PDF-');
  expect(pdf.data.length).toBeGreaterThan(5000);
  await expect(dash.getByText('PDF downloaded.')).toBeVisible();
});
