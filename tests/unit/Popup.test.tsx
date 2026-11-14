import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Popup } from '../../src/popup/Popup';
import { buildReport } from '../../src/reports/build';
import { withHead } from './snapshotFactory';

const report = buildReport(
  withHead({ title: 'Example page title for testing popup', titleCount: 1, lang: 'en' }),
  { id: 'rep1' },
);

function stubChrome(url: string, response: unknown, extra: Record<string, unknown> = {}) {
  const create = vi.fn();
  vi.stubGlobal('chrome', {
    tabs: {
      query: vi.fn().mockResolvedValue([{ id: 7, url }]),
      get: vi.fn().mockResolvedValue({ id: 9, url }),
      create,
    },
    runtime: {
      sendMessage: vi.fn().mockResolvedValue(response),
      getURL: (p: string) => `chrome-extension://abc/${p}`,
    },
    ...extra,
  });
  return { create };
}

async function analyzeClick() {
  const button = await screen.findByRole('button', { name: /analyze page/i });
  await waitFor(() => expect((button as HTMLButtonElement).disabled).toBe(false));
  fireEvent.click(button);
}

describe('Popup', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    window.history.replaceState({}, '', '/');
  });

  it('shows the product name and, after analysis, scores, categories, top issues and dashboard button', async () => {
    const { create } = stubChrome('https://example.com/', { ok: true, report, saved: true });
    render(<Popup />);
    expect(screen.getByText('NexusRank')).toBeTruthy();
    await analyzeClick();
    expect(await screen.findByLabelText(/overall score: \d+ out of 100/i)).toBeTruthy();
    for (const label of ['Technical SEO', 'On-page SEO', 'AEO', 'GEO'])
      expect(screen.getByText(label)).toBeTruthy();
    expect(screen.getByText('Top issues')).toBeTruthy();
    expect(screen.getByRole('button', { name: /re-analyze/i })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /open dashboard/i }));
    expect(create).toHaveBeenCalledWith({
      url: 'chrome-extension://abc/dashboard/dashboard.html?report=rep1',
    });
  });

  it('lists at most three issues, worst first', async () => {
    stubChrome('https://example.com/', { ok: true, report, saved: true });
    render(<Popup />);
    await analyzeClick();
    const items = (await screen.findAllByRole('listitem')).length;
    expect(items).toBe(3);
  });

  it('disables the dashboard button and explains when the report was not saved', async () => {
    stubChrome('https://example.com/', { ok: true, report, saved: false, saveError: 'QUOTA' });
    render(<Popup />);
    await analyzeClick();
    expect(
      ((await screen.findByRole('button', { name: /open dashboard/i })) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(screen.getByText(/could not be saved.*QUOTA/)).toBeTruthy();
  });

  it('shows a friendly message on restricted pages and disables Analyze', async () => {
    stubChrome('chrome://extensions', undefined);
    render(<Popup />);
    expect(await screen.findByText(/can.t analyze this page/i)).toBeTruthy();
    expect((screen.getByRole('button') as HTMLButtonElement).disabled).toBe(true);
  });

  it('shows an error state with a retry button', async () => {
    stubChrome('https://example.com/', { ok: false, code: 'injection_failed', message: 'Boom' });
    render(<Popup />);
    await analyzeClick();
    expect(await screen.findByText('Boom')).toBeTruthy();
    expect(screen.getByRole('button', { name: /re-analyze/i })).toBeTruthy();
  });

  it('analyzes the tab given by ?tabId= instead of the active tab', async () => {
    stubChrome('https://example.com/', { ok: true, report, saved: true });
    window.history.replaceState({}, '', '/?tabId=9');
    render(<Popup />);
    await analyzeClick();
    await screen.findByLabelText(/overall score/i);
    expect((chrome.runtime.sendMessage as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]).toEqual({
      type: 'nexusrank:analyze',
      tabId: 9,
    });
  });
});
