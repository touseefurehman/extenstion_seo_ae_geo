import { describe, expect, it, vi } from 'vitest';
import { analyzeTab, type AnalyzeDeps } from '../../src/background/analyze';

const snapshot = {
  schemaVersion: 1,
  url: 'https://example.com/',
  title: 'Example',
  capturedAt: '2026-01-01T00:00:00.000Z',
};

function deps(over: Partial<AnalyzeDeps> = {}): AnalyzeDeps {
  return {
    getTab: vi.fn().mockResolvedValue({ id: 1, url: 'https://example.com/' }),
    executeContentScript: vi.fn().mockResolvedValue(snapshot),
    ...over,
  };
}

describe('analyzeTab', () => {
  it('returns the snapshot from the content script', async () => {
    expect(await analyzeTab(1, deps())).toEqual({ ok: true, snapshot });
  });

  it('refuses restricted pages without injecting', async () => {
    const d = deps({ getTab: vi.fn().mockResolvedValue({ id: 1, url: 'chrome://extensions' }) });
    const res = await analyzeTab(1, d);
    expect(res).toMatchObject({ ok: false, code: 'unsupported_page' });
    expect(d.executeContentScript).not.toHaveBeenCalled();
  });

  it('reports a missing tab', async () => {
    const res = await analyzeTab(1, deps({ getTab: vi.fn().mockRejectedValue(new Error('x')) }));
    expect(res).toMatchObject({ ok: false, code: 'no_tab' });
  });

  it('reports injection failures', async () => {
    const res = await analyzeTab(
      1,
      deps({ executeContentScript: vi.fn().mockRejectedValue(new Error('Cannot access')) }),
    );
    expect(res).toMatchObject({ ok: false, code: 'injection_failed' });
  });

  it('reports a missing or malformed result', async () => {
    const res = await analyzeTab(
      1,
      deps({ executeContentScript: vi.fn().mockResolvedValue(null) }),
    );
    expect(res).toMatchObject({ ok: false, code: 'no_result' });
  });
});
