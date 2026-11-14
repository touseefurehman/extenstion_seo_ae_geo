/** Pure text helpers shared by AEO/GEO analyzers. */

export function firstSentence(text: string): string {
  const m = /^.*?[.!?](?=\s|$)/.exec(text);
  return (m ? m[0] : text).trim();
}

export function sentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function clipText(s: string, max = 140): string {
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

/** Rough English syllable counter (vowel groups with common adjustments). */
export function countSyllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, '');
  if (w === '') return 0;
  if (w.length <= 3) return 1;
  const trimmed = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '').replace(/^y/, '');
  const groups = trimmed.match(/[aeiouy]{1,3}/g);
  return Math.max(1, groups ? groups.length : 1);
}

/** Flesch Reading Ease, or null when there is not enough text. */
export function fleschReadingEase(text: string): number | null {
  const words = text.match(/[A-Za-z][A-Za-z'’-]*/g) ?? [];
  const sents = sentences(text).length;
  if (words.length === 0 || sents === 0) return null;
  const syll = words.reduce((n, w) => n + countSyllables(w), 0);
  return 206.835 - 1.015 * (words.length / sents) - 84.6 * (syll / words.length);
}

export function normalizeName(s: string): string {
  return s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
}
