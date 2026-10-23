'use client';
import { useState } from 'react';
import { parseTensorText } from '@/nodes/defs/data';
import { parseSlice } from '@/nodes/defs/linalg';
import type { FieldSpec } from '@/nodes/types';
import { toNested, tensor } from '@/engine/tensor';
import styles from './editor.module.css';

function toText(spec: FieldSpec, value: unknown): string {
  if (value === undefined || value === null) return '';
  switch (spec.kind) {
    case 'shape':
    case 'axes':
      return Array.isArray(value) ? value.join(', ') : '';
    case 'tensor': {
      const t = value as { shape: number[]; data: number[] };
      try {
        return JSON.stringify(toNested(tensor(t.shape, t.data)));
      } catch {
        return '';
      }
    }
    default:
      return String(value);
  }
}

/** Parse what the learner typed; throws with a readable message. */
function fromText(spec: FieldSpec, text: string): unknown {
  const t = text.trim();
  const ints = (s: string) =>
    s
      .split(/[,\s]+/)
      .filter(Boolean)
      .map((x) => {
        const n = Number(x);
        if (!Number.isInteger(n)) throw new Error(`"${x}" isn't a whole number`);
        return n;
      });
  switch (spec.kind) {
    case 'number': {
      const n = Number(t);
      if (t === '' || !Number.isFinite(n)) throw new Error('Enter a number');
      return n;
    }
    case 'int': {
      const n = Number(t);
      if (!Number.isInteger(n)) throw new Error('Enter a whole number');
      if (spec.min !== undefined && n < spec.min) throw new Error(`At least ${spec.min}`);
      if (spec.max !== undefined && n > spec.max) throw new Error(`At most ${spec.max}`);
      return n;
    }
    case 'shape': {
      const s = ints(t);
      if (!s.length) throw new Error('Enter sizes like 2, 3');
      return s;
    }
    case 'axes':
      return t === '' ? null : ints(t);
    case 'tensor':
      try {
        return parseTensorText(t);
      } catch (e) {
        throw new Error(e instanceof SyntaxError ? 'Use a number like 3 or an array like [[1, 2], [3, 4]]' : (e as Error).message);
      }
    case 'slice':
      parseSlice(t);
      return t;
    default:
      return t;
  }
}

/** One parameter editor. Text fields commit on Enter or when focus leaves. */
export function Field({ spec, value, onChange }: { spec: FieldSpec; value: unknown; onChange: (v: unknown) => void }) {
  const [text, setText] = useState(() => toText(spec, value));
  const [error, setError] = useState<string | null>(null);
  // When the value changes from outside (undo, another edit), show it.
  const [shown, setShown] = useState(value);
  if (shown !== value) {
    setShown(value);
    setText(toText(spec, value));
    setError(null);
  }

  const commit = () => {
    try {
      const v = fromText(spec, text);
      setError(null);
      if (JSON.stringify(v) !== JSON.stringify(value)) onChange(v);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  let control: React.ReactNode;
  if (spec.kind === 'bool') {
    control = <input type="checkbox" checked={Boolean(value)} onChange={(e) => onChange(e.target.checked)} />;
  } else if (spec.kind === 'select') {
    control = (
      <select value={String(value)} onChange={(e) => onChange(e.target.value)}>
        {spec.options?.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    );
  } else if (spec.kind === 'longtext') {
    control = (
      <>
        <textarea rows={5} value={text} spellCheck={false} onChange={(e) => setText(e.target.value)} onBlur={commit} />
        <input
          type="file"
          accept=".csv,.txt,.tsv,text/plain,text/csv"
          aria-label={`Load ${spec.label} from a file`}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            if (file.size > 200_000) {
              setError('That file is too big (200 KB at most).');
              return;
            }
            const content = await file.text();
            setText(content);
            setError(null);
            onChange(content);
          }}
        />
      </>
    );
  } else if (spec.kind === 'tensor') {
    control = (
      <textarea
        rows={Math.min(6, Math.max(1, text.length / 28))}
        value={text}
        spellCheck={false}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            commit();
          }
        }}
      />
    );
  } else {
    control = (
      <input
        value={text}
        inputMode={spec.kind === 'number' || spec.kind === 'int' ? 'decimal' : undefined}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && commit()}
      />
    );
  }

  return (
    <label className={styles.field}>
      <span className={styles.fieldLabel}>{spec.label}</span>
      {control}
      {error ? <span className={styles.fieldError}>{error}</span> : spec.help ? <span className={styles.fieldHelp}>{spec.help}</span> : null}
    </label>
  );
}
