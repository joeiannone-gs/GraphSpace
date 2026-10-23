'use client';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { diffDocs, isEmptyDiff } from '@/doc/diff';
import type { Thumb } from '@/doc/thumb';
import type { ProjectDoc } from '@/doc/types';
import { api, ApiError } from '@/lib/api';
import { getDef } from '@/nodes/registry';
import { docActions } from '@/store/docSlice';
import { useAppDispatch, useAppSelector, useAppStore } from '@/store/store';
import { uiActions } from '@/store/uiSlice';
import { DocThumbnail } from './DocThumbnail';
import styles from './editor.module.css';

interface Commit {
  id: string;
  branchId: string;
  parentId: string | null;
  message: string;
  createdAt: number;
  thumb: Thumb;
}

interface Branch {
  id: string;
  name: string;
  headCommitId: string | null;
}

export interface CommitHistoryProps {
  projectId: string;
  branchId: string;
  /** Saves pending edits and returns the saved version. */
  flush(): Promise<number>;
}

const COL = 92;
const ROW = 74;
const R = 24;

const short = (id: string) => id.slice(0, 7);
const when = (t: number) =>
  new Date(t).toLocaleString(undefined, { month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit' });

/** The mockup's Commit History: a New Commit form and a tree with one column per branch. */
export function CommitHistory({ projectId, branchId, flush }: CommitHistoryProps) {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const store = useAppStore();
  const present = useAppSelector((s) => s.doc.present);
  const diff = useAppSelector((s) => s.ui.diff);
  const [commits, setCommits] = useState<Commit[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [headDoc, setHeadDoc] = useState<ProjectDoc | null>(null);

  const refresh = useCallback(async () => {
    const res = await api<{ commits: Commit[]; branches: Branch[] }>(`/api/projects/${projectId}/commits`);
    setCommits(res.commits);
    setBranches(res.branches);
    return res;
  }, [projectId]);

  const branch = branches.find((b) => b.id === branchId);
  const headId = branch?.headCommitId ?? null;

  useEffect(() => {
    let live = true;
    void api<{ commits: Commit[]; branches: Branch[] }>(`/api/projects/${projectId}/commits`).then(
      (res) => {
        if (!live) return;
        setCommits(res.commits);
        setBranches(res.branches);
      },
      () => undefined,
    );
    return () => {
      live = false;
    };
  }, [projectId]);

  useEffect(() => {
    let live = true;
    if (!headId) return;
    void api<{ doc: ProjectDoc }>(`/api/projects/${projectId}/commits/${headId}`).then((r) => live && setHeadDoc(r.doc), () => undefined);
    return () => {
      live = false;
    };
  }, [projectId, headId]);

  const changed = useMemo(() => !headId || !headDoc || !isEmptyDiff(diffDocs(headDoc, present)), [headId, headDoc, present]);

  async function commit() {
    setBusy(true);
    setError(null);
    try {
      const version = await flush();
      await api(`/api/projects/${projectId}/branches/${branchId}/commits`, { body: { message: message.trim(), expectVersion: version } });
      setMessage('');
      await refresh();
      dispatch(uiActions.showToast('Committed.'));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not commit.');
    } finally {
      setBusy(false);
    }
  }

  async function loadCommit(id: string): Promise<ProjectDoc> {
    return (await api<{ doc: ProjectDoc }>(`/api/projects/${projectId}/commits/${id}`)).doc;
  }

  async function compare(id: string) {
    const before = await loadCommit(id);
    const now = store.getState().doc.present;
    const d = diffDocs(before, now);
    const label = (n: ProjectDoc['nodes'][string]) => n.label ?? getDef(n.type)?.label ?? n.type;
    dispatch(
      uiActions.setDiff({
        against: `commit ${short(id)}`,
        added: d.nodes.added,
        changed: d.nodes.changed.filter((c) => c.fields.some((f) => f !== 'pos')).map((c) => c.id),
        removed: d.nodes.removed.map((rid) => label(before.nodes[rid])),
      }),
    );
  }

  async function restore(id: string) {
    const doc = await loadCommit(id);
    dispatch(docActions.replaceDoc({ doc, keepHistory: true }));
    dispatch(uiActions.setScope(null));
    dispatch(uiActions.showToast(`Restored commit ${short(id)} into your working copy (Ctrl+Z to undo).`));
  }

  async function branchFrom(id: string) {
    const name = prompt('Name for the new branch', `experiment-${branches.length}`);
    if (!name) return;
    try {
      const res = await api<{ branch: { id: string } }>(`/api/projects/${projectId}/branches`, { body: { name, fromCommitId: id } });
      await checkout(res.branch.id);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not create the branch.');
    }
  }

  async function checkout(id: string) {
    if (id === branchId) return;
    await flush();
    await api(`/api/projects/${projectId}`, { method: 'PATCH', body: { defaultBranchId: id } });
    dispatch(uiActions.setDiff(null));
    router.push(`/p/${projectId}?branch=${id}`);
  }

  // Layout: newest at the top, one column per branch.
  const order = [...commits].sort((a, b) => b.createdAt - a.createdAt);
  const col = new Map(branches.map((b, i) => [b.id, i]));
  const pos = new Map(order.map((c, i) => [c.id, { x: (col.get(c.branchId) ?? branches.length) * COL + COL / 2, y: 40 + (i + 1) * ROW }]));
  const width = Math.max(1, branches.length) * COL;
  const height = 40 + (order.length + 1) * ROW + 10;
  const sel = commits.find((c) => c.id === selected);

  return (
    <div className={styles.panel} data-testid="commit-history">
      <div className={styles.panelHeader}>
        <span>Commit History</span>
      </div>
      <h3 className={styles.sectionTitle} style={{ margin: '0 0 6px' }}>
        New Commit
      </h3>
      <div className={styles.inspector}>
        <p className={styles.subtitle}>
          Branch: <strong>{branch?.name ?? '…'}</strong>
          {headId && <> · last commit {short(headId)}</>}
          {!changed && headId && <> · no changes since</>}
        </p>
        <textarea
          className={styles.commitMessage}
          rows={2}
          placeholder="What did you change?"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          aria-label="Commit message"
        />
        <button className={styles.button} disabled={busy || !message.trim() || !changed} onClick={commit}>
          ✓ Commit
        </button>
        {error && <div className={styles.error}>{error}</div>}
      </div>
      <h3 className={styles.sectionTitle} style={{ margin: '0 0 6px' }}>
        Commit Tree
      </h3>
      {diff && (
        <div className={styles.inspector}>
          <div className={styles.notice}>
            <span>
              Comparing with {diff.against}: <span style={{ color: '#4caf50' }}>{diff.added.length} added</span>,{' '}
              <span style={{ color: '#ffb300' }}>{diff.changed.length} changed</span>
              {diff.removed.length > 0 && <>, removed: {diff.removed.join(', ')}</>}
            </span>
            <button className={styles.linkButton} onClick={() => dispatch(uiActions.setDiff(null))}>
              ✕
            </button>
          </div>
        </div>
      )}
      <div className="modern-scroll" style={{ overflowX: 'auto', padding: '0 4px 8px' }}>
        <svg width={width} height={height} role="img" aria-label="Commit tree">
          {branches.map((b, i) => (
            <g key={b.id}>
              {b.id === branchId && (
                <rect x={i * COL + 6} y={26} width={COL - 12} height={height - 30} rx={14} fill="none" stroke="var(--gs-muted)" strokeWidth={1.5} opacity={0.6} />
              )}
              <text
                x={i * COL + COL / 2}
                y={18}
                textAnchor="middle"
                fontSize={14}
                fill="currentColor"
                style={{ cursor: b.id === branchId ? 'default' : 'pointer', textDecoration: b.id === branchId ? 'underline' : 'none' }}
                onClick={() => checkout(b.id)}
              >
                <title>{b.id === branchId ? 'Current branch' : `Switch to ${b.name}`}</title>
                {b.name.length > 11 ? `${b.name.slice(0, 10)}…` : b.name}
              </text>
            </g>
          ))}
          {/* the uncommitted working copy of this branch */}
          {changed && (
            <g>
              <circle cx={(col.get(branchId) ?? 0) * COL + COL / 2} cy={40 + ROW * 0.45} r={R * 0.6} fill="none" stroke="var(--gs-muted)" strokeDasharray="4 3" />
              <text x={(col.get(branchId) ?? 0) * COL + COL / 2} y={40 + ROW * 0.45 + 4} textAnchor="middle" fontSize={9} fill="var(--gs-muted)">
                now
              </text>
            </g>
          )}
          {order.map((c) => {
            const p = pos.get(c.id)!;
            const parent = c.parentId ? pos.get(c.parentId) : undefined;
            return parent ? (
              <path
                key={`e${c.id}`}
                d={`M${parent.x},${parent.y - R} C${parent.x},${(parent.y + p.y) / 2} ${p.x},${(parent.y + p.y) / 2} ${p.x},${p.y + R}`}
                fill="none"
                stroke="#6abf4b"
                strokeWidth={1.5}
                markerEnd="url(#arrow)"
              />
            ) : null;
          })}
          <defs>
            <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#6abf4b" />
            </marker>
          </defs>
          {order.map((c) => {
            const p = pos.get(c.id)!;
            return (
              <g key={c.id} style={{ cursor: 'pointer' }} onClick={() => setSelected(c.id === selected ? null : c.id)} data-testid={`commit-${c.id}`}>
                <title>{`${c.message}\n${short(c.id)} · ${when(c.createdAt)}`}</title>
                <circle cx={p.x} cy={p.y} r={R} fill="var(--gs-workspace)" stroke={c.id === selected ? '#ffd400' : '#f56305'} strokeWidth={c.id === selected ? 3 : 2} />
                <svg x={p.x - R * 0.75} y={p.y - R * 0.75} width={R * 1.5} height={R * 1.5} viewBox="0 0 100 100">
                  <DocThumbnail thumb={c.thumb} size={100} />
                </svg>
                <text x={p.x + R + 3} y={p.y - 3} fontSize={9} fill="var(--gs-muted)">
                  {short(c.id)}
                </text>
                <text x={p.x + R + 3} y={p.y + 9} fontSize={9} fill="var(--gs-muted)">
                  {when(c.createdAt)}
                </text>
              </g>
            );
          })}
        </svg>
        {commits.length === 0 && <p className={styles.muted} style={{ padding: '0 8px' }}>No commits yet. Commit to save a checkpoint you can come back to.</p>}
      </div>
      {sel && (
        <div className={styles.inspector}>
          <p style={{ margin: '4px 0' }}>
            <strong>{sel.message}</strong>
          </p>
          <p className={styles.subtitle}>
            {short(sel.id)} · {when(sel.createdAt)} · on {branches.find((b) => b.id === sel.branchId)?.name ?? 'a deleted branch'}
          </p>
          <div className={styles.row} style={{ flexWrap: 'wrap' }}>
            <button className={styles.button} onClick={() => compare(sel.id)}>
              Compare with now
            </button>
            <button className={styles.button} onClick={() => restore(sel.id)}>
              Restore
            </button>
            <button className={styles.button} onClick={() => branchFrom(sel.id)}>
              New branch here
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
