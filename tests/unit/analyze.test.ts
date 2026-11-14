import { describe, expect, it, vi } from 'vitest';
import { analyzeTab, type AnalyzeDeps } from '../../src/background/analyze';
import { blank } from './snapshotFactory';

const snapshot = blank({ title: 'Example', url: 'https://example.com/' });

function deps(over: Partial<AnalyzeDeps> = {}): AnalyzeDeps {
  return {
    getTab: vi.fn().mockResolvedValue({ id: 1, url: 'https://example.com/' }),
    executeContentScript: vi.fn().mockResolvedValue(snapshot),
    saveReport: vi.fn().mockResolvedValue(undefined),
    ...over,
  };
}

describe('analyzeTab', () => {
  it('analyzes the snapshot, scores it and saves the report locally', async () => {
    const d = deps();
    const res = await analyzeTab(1, d);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.saved).toBe(true);
    expect(res.report.url).toBe('https://example.com/');
    expect(res.report.checks.length).toBeGreaterThan(30);
    expect(d.saveReport).toHaveBeenCalledWith(res.report);
  });

  it('still returns the report when saving fails, and says why', async () => {
    const res = await analyzeTab(
      1,
      deps({ saveReport: vi.fn().mockRejectedValue(new Error('QUOTA')) }),
    );
    expect(res).toMatchObject({ ok: true, saved: false, saveError: 'QUOTA' });
  });

  it('refuses restricted pages without injecting', async () => {
    const d = deps({ getTab: vi.fn().mockResolvedValue({ id: 1, url: 'chrome://extensions' }) });
    expect(await analyzeTab(1, d)).toMatchObject({ ok: false, code: 'unsupported_page' });
    expect(d.executeContentScript).not.toHaveBeenCalled();
    expect(d.saveReport).not.toHaveBeenCalled();
  });

  it('reports a missing tab', async () => {
    expect(
      await analyzeTab(1, deps({ getTab: vi.fn().mockRejectedValue(new Error('x')) })),
    ).toMatchObject({ ok: false, code: 'no_tab' });
    expect(
      await analyzeTab(1, deps({ getTab: vi.fn().mockResolvedValue(undefined) })),
    ).toMatchObject({ ok: false, code: 'no_tab' });
  });

  it('reports injection failures', async () => {
    const res = await analyzeTab(
      1,
      deps({ executeContentScript: vi.fn().mockRejectedValue(new Error('Cannot access')) }),
    );
    expect(res).toMatchObject({ ok: false, code: 'injection_failed' });
  });

  it('reports a missing or malformed result', async () => {
    expect(
      await analyzeTab(1, deps({ executeContentScript: vi.fn().mockResolvedValue(null) })),
    ).toMatchObject({ ok: false, code: 'no_result' });
    expect(
      await analyzeTab(1, deps({ executeContentScript: vi.fn().mockResolvedValue({ foo: 1 }) })),
    ).toMatchObject({ ok: false, code: 'no_result' });
  });

  it('turns an analyzer crash into a friendly error instead of throwing', async () => {
    const broken = { schemaVersion: 1, url: 'https://example.com/' }; // missing fields
    expect(
      await analyzeTab(1, deps({ executeContentScript: vi.fn().mockResolvedValue(broken) })),
    ).toMatchObject({ ok: false, code: 'analysis_failed' });
  });
});
