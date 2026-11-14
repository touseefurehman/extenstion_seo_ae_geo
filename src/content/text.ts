/** Small pure helpers shared by the extraction modules. */

export class Truncations {
  private readonly names = new Set<string>();
  mark(name: string): void {
    this.names.add(name);
  }
  list(): string[] {
    return [...this.names].sort();
  }
}

export function norm(s: string | null | undefined): string {
  return (s ?? '').replace(/\s+/g, ' ').trim();
}

export function countWords(s: string): number {
  const t = s.trim();
  return t === '' ? 0 : t.split(/\s+/).length;
}

export function clip(s: string, max: number, t?: Truncations, name?: string): string {
  if (s.length <= max) return s;
  if (t && name) t.mark(name);
  return s.slice(0, max);
}

export function parseDimension(v: string | null): number | null {
  if (v === null) return null;
  if (!/^\s*\d+(\.\d+)?\s*(px)?\s*$/i.test(v)) return null;
  return Math.round(parseFloat(v));
}

export function safeUrl(href: string, base: string): URL | null {
  try {
    return new URL(href, base);
  } catch {
    return null;
  }
}

export function filenameFromUrl(u: URL): string | null {
  const last = u.pathname.split('/').filter(Boolean).pop();
  if (!last) return null;
  try {
    return decodeURIComponent(last);
  } catch {
    return last;
  }
}

export function relTokens(rel: string | null): string[] {
  return (rel ?? '').toLowerCase().split(/\s+/).filter(Boolean);
}
