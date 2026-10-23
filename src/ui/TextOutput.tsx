'use client';
import { useState } from 'react';
import { useAppSelector } from '@/store/store';
import { useRuntimeSnapshot } from './EditorContext';
import styles from './editor.module.css';

/** Readable text from Text Data nodes (the generated text after Generate). */
export function TextOutput() {
  const snap = useRuntimeSnapshot();
  const nodes = useAppSelector((s) => s.doc.present.nodes);
  const [hidden, setHidden] = useState<string | null>(null);
  const entries = Object.entries(snap?.texts ?? {}).filter(([id]) => nodes[id]?.type === 'text_data');
  if (!entries.length) return null;
  const key = entries.map(([, t]) => t).join('\u0000');
  if (hidden === key) return null;
  return (
    <div className={styles.textOutput} data-testid="text-output">
      <div className={styles.row} style={{ margin: 0, justifyContent: 'space-between' }}>
        <strong>{entries.length === 1 ? (nodes[entries[0][0]].label ?? 'Text') : 'Text'}</strong>
        <button className={styles.linkButton} onClick={() => setHidden(key)} aria-label="Hide text">
          ✕
        </button>
      </div>
      {entries.map(([id, text]) => (
        <pre key={id}>{text}</pre>
      ))}
    </div>
  );
}
