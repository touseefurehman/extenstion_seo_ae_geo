import { useState } from 'react';

const MAX_ITEMS = 100;

function Primitive({ value }: { value: unknown }) {
  if (value === null) return <span className="nr-json-null">null</span>;
  if (typeof value === 'string') return <span className="nr-json-str">&quot;{value}&quot;</span>;
  if (typeof value === 'number') return <span className="nr-json-num">{value}</span>;
  return <span className="nr-json-bool">{String(value)}</span>;
}

function Node({ name, value, depth }: { name?: string; value: unknown; depth: number }) {
  const isObj = typeof value === 'object' && value !== null;
  const [open, setOpen] = useState(depth < 2);
  const key = name !== undefined ? <span className="nr-json-key">{name}: </span> : null;
  if (!isObj) {
    return (
      <div className="nr-json-line">
        {key}
        <Primitive value={value} />
      </div>
    );
  }
  const entries = Array.isArray(value)
    ? value.map((v, i) => [String(i), v] as const)
    : Object.entries(value as Record<string, unknown>);
  const summary = Array.isArray(value) ? `[${entries.length}]` : `{${entries.length}}`;
  return (
    <div className="nr-json-node">
      <button
        type="button"
        className="nr-json-toggle"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <span aria-hidden>{open ? '▾' : '▸'}</span> {key}
        <span className="nr-muted">{summary}</span>
      </button>
      {open && (
        <div className="nr-json-children">
          {entries.slice(0, MAX_ITEMS).map(([k, v]) => (
            <Node key={k} name={k} value={v} depth={depth + 1} />
          ))}
          {entries.length > MAX_ITEMS && (
            <div className="nr-muted small">… {entries.length - MAX_ITEMS} more not shown</div>
          )}
        </div>
      )}
    </div>
  );
}

/** Collapsible, read-only JSON tree. */
export function JsonViewer({ value }: { value: unknown }) {
  return (
    <div className="nr-json" role="tree" aria-label="JSON viewer">
      <Node value={value} depth={0} />
    </div>
  );
}
