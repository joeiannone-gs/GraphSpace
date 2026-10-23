'use client';
import { getBuiltin } from '@/library/builtin';
import { useAppDispatch, useAppSelector } from '@/store/store';
import { uiActions } from '@/store/uiSlice';
import styles from './editor.module.css';

/** Where you are inside nested groups; click a level to go back out. */
export function Breadcrumb() {
  const scope = useAppSelector((s) => s.ui.scope);
  const nodes = useAppSelector((s) => s.doc.present.nodes);
  const dispatch = useAppDispatch();
  const path: { id: string | null; label: string }[] = [];
  for (let s = scope; s !== null && nodes[s]; s = nodes[s].parent) {
    const n = nodes[s];
    path.unshift({ id: s, label: n.label ?? (n.source ? getBuiltin(n.source.id)?.label : undefined) ?? 'Group' });
  }
  path.unshift({ id: null, label: 'Project' });
  return (
    <nav className={styles.breadcrumb} aria-label="Group path">
      {path.map((p, i) => (
        <span key={p.id ?? 'root'}>
          {i > 0 && <span className={styles.muted}> › </span>}
          {i === path.length - 1 ? (
            <strong>{p.label}</strong>
          ) : (
            <button className={styles.linkButton} onClick={() => dispatch(uiActions.setScope(p.id))}>
              {p.label}
            </button>
          )}
        </span>
      ))}
      {scope !== null && <span className={styles.muted}> · Esc to go back</span>}
    </nav>
  );
}
