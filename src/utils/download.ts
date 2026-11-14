/** Starts a browser download from a Blob URL (no `downloads` permission needed). */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function downloadText(text: string, mime: string, filename: string, bom = false): void {
  downloadBlob(new Blob([bom ? '﻿' : '', text], { type: `${mime};charset=utf-8` }), filename);
}
