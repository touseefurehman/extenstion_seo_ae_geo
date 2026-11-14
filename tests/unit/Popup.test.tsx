import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Popup } from '../../src/popup/Popup';

function stubChrome(url: string, response: unknown) {
  vi.stubGlobal('chrome', {
    tabs: { query: vi.fn().mockResolvedValue([{ id: 7, url }]) },
    runtime: { sendMessage: vi.fn().mockResolvedValue(response) },
  });
}

describe('Popup', () => {
  beforeEach(() => vi.spyOn(console, 'info').mockImplementation(() => {}));
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('shows the product name and analyzes the page', async () => {
    stubChrome('https://example.com/', {
      ok: true,
      snapshot: {
        schemaVersion: 1,
        url: 'https://example.com/',
        title: 'Example',
        capturedAt: 'now',
      },
    });
    render(<Popup />);
    expect(screen.getByText('NexusRank')).toBeTruthy();
    const button = await screen.findByRole('button', { name: /analyze page/i });
    await waitFor(() => expect((button as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(button);
    expect(await screen.findByText('Example')).toBeTruthy();
    expect(screen.getByRole('button', { name: /re-analyze/i })).toBeTruthy();
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
    const button = await screen.findByRole('button', { name: /analyze page/i });
    await waitFor(() => expect((button as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(button);
    expect(await screen.findByText('Boom')).toBeTruthy();
    expect(screen.getByRole('button', { name: /re-analyze/i })).toBeTruthy();
  });
});
