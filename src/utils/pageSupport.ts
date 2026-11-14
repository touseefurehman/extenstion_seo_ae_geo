export type PageSupport = { supported: true } | { supported: false; reason: string };

const WEBSTORE_HOSTS = new Set(['chrome.google.com', 'chromewebstore.google.com']);

/** Decides whether a tab URL can be analyzed by an injected content script. */
export function checkPageSupport(url: string | undefined | null): PageSupport {
  if (!url) {
    return { supported: false, reason: 'This tab has no readable address.' };
  }
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { supported: false, reason: 'This tab has an address NexusRank cannot read.' };
  }
  if (parsed.protocol === 'file:') {
    return {
      supported: false,
      reason: 'Local files (file://) are not supported because they need extra site access.',
    };
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return {
      supported: false,
      reason: 'Browser and extension pages (such as chrome://) cannot be analyzed.',
    };
  }
  if (
    WEBSTORE_HOSTS.has(parsed.hostname) &&
    (parsed.hostname === 'chromewebstore.google.com' || parsed.pathname.startsWith('/webstore'))
  ) {
    return { supported: false, reason: 'The Chrome Web Store blocks extensions from reading it.' };
  }
  if (/\.pdf$/i.test(parsed.pathname)) {
    return {
      supported: false,
      reason: 'PDF documents are not analyzed (they are not HTML pages).',
    };
  }
  return { supported: true };
}
