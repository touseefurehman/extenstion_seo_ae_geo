import { describe, expect, it } from 'vitest';
import { checkPageSupport } from '../../src/utils/pageSupport';

describe('checkPageSupport', () => {
  it.each(['https://example.com/', 'http://example.com/a?b=1', 'https://chrome.google.com/other'])(
    'supports %s',
    (url) => {
      expect(checkPageSupport(url)).toEqual({ supported: true });
    },
  );

  it.each([
    undefined,
    '',
    'not a url',
    'chrome://extensions',
    'chrome-extension://abc/page.html',
    'about:blank',
    'file:///tmp/a.html',
    'https://chromewebstore.google.com/detail/x',
    'https://chrome.google.com/webstore/detail/x',
    'https://example.com/doc.pdf',
  ])('rejects %s', (url) => {
    const result = checkPageSupport(url);
    expect(result.supported).toBe(false);
    if (!result.supported) expect(result.reason.length).toBeGreaterThan(5);
  });
});
