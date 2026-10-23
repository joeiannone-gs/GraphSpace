'use client';
import { useMemo, useState } from 'react';
import type { PaletteItem } from '@/canvas/controller';
import { categoryColor, GROUP_COLOR } from '@/canvas/theme';
import { builtinGroups } from '@/library/builtin';
import { nodeDefs } from '@/nodes/registry';
import type { Category } from '@/nodes/types';
import { useAppSelector } from '@/store/store';
import { PALETTE_MIME } from './CanvasHost';
import { useEditor } from './EditorContext';
import styles from './editor.module.css';

const ORDER: Category[] = ['Data', 'Math', 'Activations', 'Linear algebra', 'Loss', 'Training', 'Display', 'Structure'];

const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`;
const plain = (md: string) => md.replace(/[*`_]/g, '');

interface Entry {
  key: string;
  label: string;
  explanation: string;
  icon?: string;
  color: number;
  item: PaletteItem;
}

/** The HUB: every node type and built-in group, searchable, drag or click to add. */
export function Palette({ allowed }: { allowed?: readonly string[] }) {
  const [query, setQuery] = useState('');
  const scope = useAppSelector((s) => s.ui.scope);
  const { canvas } = useEditor();

  const sections = useMemo(() => {
    const ok = (key: string) => !allowed || allowed.includes(key);
    const q = query.trim().toLowerCase();
    const match = (e: Entry) => !q || e.label.toLowerCase().includes(q) || e.explanation.toLowerCase().includes(q);
    const out: { title: string; entries: Entry[] }[] = [];
    const groups: Entry[] = builtinGroups
      .filter((g) => ok(`group:${g.id}`))
      .map((g) => ({ key: `group:${g.id}`, label: g.label, explanation: g.explanation, color: GROUP_COLOR, item: { kind: 'builtin', id: g.id } }));
    if (groups.filter(match).length) out.push({ title: 'Layers & losses', entries: groups.filter(match) });
    for (const cat of ORDER) {
      const entries: Entry[] = nodeDefs
        .filter((d) => d.category === cat && !d.hidden && ok(d.type))
        // Input/Output only make sense inside a group.
        .filter((d) => scope !== null || (d.type !== 'input' && d.type !== 'output'))
        .map((d) => ({ key: d.type, label: d.label, explanation: d.explanation, icon: d.icon, color: categoryColor(d.category), item: { kind: 'node', type: d.type } }));
      const shown = entries.filter(match);
      if (shown.length) out.push({ title: cat, entries: shown });
    }
    return out;
  }, [query, scope, allowed]);

  return (
    <div className={styles.palette}>
      <input
        className={styles.search}
        placeholder="Search nodes…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label="Search nodes"
      />
      {sections.map((section) => (
        <section key={section.title}>
          <h3 className={styles.sectionTitle}>{section.title}</h3>
          <div className={styles.tiles}>
            {section.entries.map((e) => (
              <button
                key={e.key}
                className={styles.tile}
                draggable
                title={plain(e.explanation)}
                data-testid={`palette-${e.key}`}
                onDragStart={(ev) => {
                  ev.dataTransfer.setData(PALETTE_MIME, JSON.stringify(e.item));
                  ev.dataTransfer.effectAllowed = 'copy';
                }}
                onClick={() => canvas.current?.addAtCenter(e.item)}
              >
                <span className={styles.tileIcon} style={{ borderColor: hex(e.color) }}>
                  {e.icon ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={e.icon} alt="" />
                  ) : (
                    <span style={{ color: hex(e.color) }}>{e.label.slice(0, 2)}</span>
                  )}
                </span>
                <span className={styles.tileLabel}>{e.label}</span>
              </button>
            ))}
          </div>
        </section>
      ))}
      {sections.length === 0 && <p className={styles.muted}>Nothing matches “{query}”.</p>}
      <p className={styles.hint}>Drag onto the canvas or click to add. Drag from a green dot to another to connect.</p>
    </div>
  );
}
