'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { PaletteItem } from '@/canvas/controller';
import type { Thumb } from '@/doc/thumb';
import { api } from '@/lib/api';
import { PALETTE_MIME } from './CanvasHost';
import { DocThumbnail } from './DocThumbnail';
import { useEditor } from './EditorContext';
import { useLibrary } from './LibraryContext';
import styles from './editor.module.css';

interface ProjectSummary {
  id: string;
  title: string;
  thumb: Thumb | null;
}

/** Left panel from the mockup: the user's Graphs (projects) and Nodes (saved groups). */
export function MyGraphSpace({ currentProjectId, refreshKey }: { currentProjectId: string; refreshKey: number }) {
  const router = useRouter();
  const library = useLibrary();
  const { canvas } = useEditor();
  const [projects, setProjects] = useState<ProjectSummary[]>([]);

  useEffect(() => {
    let live = true;
    void api<{ projects: ProjectSummary[] }>('/api/projects').then((r) => live && setProjects(r.projects), () => undefined);
    return () => {
      live = false;
    };
  }, [refreshKey]);

  return (
    <div className={styles.panel}>
      <div className={styles.panelHeader}>
        <Link href="/" style={{ textDecoration: 'none' }}>
          My GraphSpace
        </Link>
      </div>
      <h3 className={styles.sectionTitle} style={{ margin: '0 0 6px', display: 'flex', justifyContent: 'space-between' }}>
        <span>Graphs</span>
        <button
          className={styles.linkButton}
          aria-label="New project"
          onClick={async () => {
            const { id } = await api<{ id: string }>('/api/projects', { body: { from: { kind: 'blank' } } });
            router.push(`/p/${id}`);
          }}
        >
          + New
        </button>
      </h3>
      <div className={styles.tiles} style={{ padding: '0 12px 8px' }}>
        {projects.map((p) => (
          <Link key={p.id} href={`/p/${p.id}`} className={styles.tile} style={p.id === currentProjectId ? { borderColor: 'var(--gs-accent)' } : undefined} title={p.title}>
            <DocThumbnail thumb={p.thumb} size={48} />
            <span className={styles.tileLabel}>{p.title}</span>
          </Link>
        ))}
      </div>
      <h3 className={styles.sectionTitle} style={{ margin: '0 0 6px' }}>
        Nodes
      </h3>
      <div style={{ padding: '0 12px 12px' }}>
        {!library?.nodes.length ? (
          <p className={styles.muted}>Select a group and choose “Save as node” to reuse it in any project.</p>
        ) : (
          <div className={styles.tiles}>
            {library.nodes.map((n) => {
              const item: PaletteItem = { kind: 'subtree', sub: n.subtree };
              return (
                <button
                  key={n.id}
                  className={styles.tile}
                  draggable
                  title={n.description || n.name}
                  onDragStart={(e) => {
                    e.dataTransfer.setData(PALETTE_MIME, JSON.stringify(item));
                    e.dataTransfer.effectAllowed = 'copy';
                  }}
                  onClick={() => canvas.current?.addAtCenter(item)}
                  onContextMenu={async (e) => {
                    e.preventDefault();
                    if (confirm(`Delete “${n.name}” from your nodes?`)) await library.remove(n.id);
                  }}
                >
                  <span className={styles.tileIcon} style={{ borderColor: '#009aa6' }}>
                    <span style={{ color: '#009aa6' }}>{n.name.slice(0, 2)}</span>
                  </span>
                  <span className={styles.tileLabel}>{n.name}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
