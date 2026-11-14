/** Approximate Google-style snippet limits. Real truncation depends on pixel width and device. */
export const SERP_LIMITS = { titleChars: 60, descriptionChars: 160 } as const;

export function truncate(text: string, max: number): { text: string; truncated: boolean } {
  const t = text.trim();
  if (t.length <= max) return { text: t, truncated: false };
  return { text: `${t.slice(0, max - 1).trimEnd()}…`, truncated: true };
}

/** "example.com › guides › home-coffee" */
export function breadcrumbUrl(url: string): string {
  try {
    const u = new URL(url);
    const parts = u.pathname
      .split('/')
      .filter(Boolean)
      .map((p) => decodeURIComponent(p));
    return [u.host, ...parts].join(' › ');
  } catch {
    return url;
  }
}
