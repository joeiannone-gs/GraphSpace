'use client';
import { useState } from 'react';
import { cloneSubtree } from '@/doc/clone';
import { newId } from '@/doc/ids';
import type { DocNode, Id, ProjectDoc } from '@/doc/types';
import { formatNumber, shapeLabel } from '@/canvas/displays/draw';
import type { SessionSnapshot } from '@/engine/session';
import { getBuiltin } from '@/library/builtin';
import { getDef, parseParams, portsOf } from '@/nodes/registry';
import type { FieldSpec } from '@/nodes/types';
import { docActions } from '@/store/docSlice';
import { useAppDispatch, useAppSelector } from '@/store/store';
import { uiActions } from '@/store/uiSlice';
import { useRuntimeSnapshot } from './EditorContext';
import { Field } from './fields';
import { Markdown } from './Markdown';
import styles from './editor.module.css';

function NoteEditor({ value, onSave, placeholder }: { value: string; onSave: (v: string) => void; placeholder: string }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(value);
  if (!editing) {
    return (
      <div className={styles.note}>
        {value ? <Markdown>{value}</Markdown> : <p className={styles.muted}>{placeholder}</p>}
        <button
          className={styles.linkButton}
          onClick={() => {
            setText(value);
            setEditing(true);
          }}
        >
          {value ? 'Edit' : 'Add notes'}
        </button>
      </div>
    );
  }
  return (
    <div className={styles.note}>
      <textarea rows={6} value={text} onChange={(e) => setText(e.target.value)} autoFocus />
      <div className={styles.row}>
        <button
          className={styles.button}
          onClick={() => {
            onSave(text);
            setEditing(false);
          }}
        >
          Save
        </button>
        <button className={styles.linkButton} onClick={() => setEditing(false)}>
          Cancel
        </button>
      </div>
    </div>
  );
}

function ValueSummary({ node, snap }: { node: DocNode; snap: SessionSnapshot | null }) {
  const ns = snap?.nodes[node.id];
  if (!snap || !ns) return null;
  const rows = [...Object.entries(ns.inputs).map(([p, k]) => ['in', p, k] as const), ...Object.entries(ns.outputs).map(([p, k]) => ['out', p, k] as const)];
  if (!rows.length) return null;
  return (
    <table className={styles.values}>
      <thead>
        <tr>
          <th></th>
          <th>shape</th>
          <th>mean</th>
          <th>gradient</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(([dir, port, key]) => {
          const t = snap.tensors[key];
          const g = snap.grads[key];
          return (
            <tr key={`${dir}${port}`}>
              <td>
                {dir === 'in' ? '→' : '←'} {port}
              </td>
              <td>{t ? shapeLabel(t.shape) : '—'}</td>
              <td>{t ? (t.data.length === 1 ? formatNumber(t.data[0]) : formatNumber(t.stats.mean)) : '—'}</td>
              <td title="average size of the gradient">{g ? formatNumber(g.stats.absMean) : '—'}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function NodeInspector({ doc, node }: { doc: ProjectDoc; node: DocNode }) {
  const dispatch = useAppDispatch();
  const snap = useRuntimeSnapshot();
  const def = getDef(node.type);
  const parsed = parseParams(node);
  const params = parsed.ok ? parsed.params : node.params;
  const builtin = node.source?.kind === 'builtin' ? getBuiltin(node.source.id) : undefined;
  const [sizes, setSizes] = useState<Record<string, number>>(() => ({ ...(builtin?.defaults ?? {}), ...(node.source?.params ?? {}) }));
  const error = snap?.nodes[node.id]?.error;
  const ports = portsOf(doc, node);
  const isGroup = node.type === 'composite';
  const explanation = builtin?.explanation ?? def?.explanation ?? '';

  return (
    <div className={styles.inspector}>
      <input
        key={node.id + (node.label ?? '')}
        className={styles.titleInput}
        defaultValue={node.label ?? def?.label ?? node.type}
        aria-label="Name"
        onBlur={(e) => {
          if (e.target.value !== (node.label ?? def?.label)) dispatch(docActions.setLabel({ id: node.id, label: e.target.value }));
        }}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      />
      <p className={styles.subtitle}>
        {builtin ? `${builtin.label} (built-in group)` : isGroup ? 'Group' : def?.label}
        {ports.inputs.length + ports.outputs.length > 0 && (
          <>
            {' · '}
            {ports.inputs.map((p) => p.name).join(', ') || 'no inputs'} → {ports.outputs.map((p) => p.name).join(', ') || 'no outputs'}
          </>
        )}
      </p>
      {error && <div className={styles.error}>{error.message}</div>}
      {explanation && <Markdown>{explanation}</Markdown>}
      {def?.fields.map((spec: FieldSpec) => (
        <Field key={spec.key} spec={spec} value={params[spec.key]} onChange={(v) => dispatch(docActions.setParams({ id: node.id, patch: { [spec.key]: v } }))} />
      ))}
      {builtin && builtin.fields.length > 0 && (
        <div className={styles.box}>
          {builtin.fields.map((spec) => (
            <Field key={spec.key} spec={spec} value={sizes[spec.key]} onChange={(v) => setSizes((s) => ({ ...s, [spec.key]: Number(v) }))} />
          ))}
          <button
            className={styles.button}
            onClick={() => {
              const sub = cloneSubtree(builtin.build({ ...builtin.defaults, ...sizes }), node.parent, node.pos);
              dispatch(docActions.replaceGroupContents({ id: node.id, sub }));
            }}
          >
            Rebuild with these sizes
          </button>
        </div>
      )}
      {isGroup && (
        <div className={styles.row}>
          <button className={styles.button} onClick={() => dispatch(uiActions.setScope(node.id))}>
            Open group
          </button>
          <button
            className={styles.linkButton}
            onClick={() => {
              dispatch(docActions.ungroup(node.id));
              dispatch(uiActions.clearSelection());
            }}
          >
            Ungroup
          </button>
        </div>
      )}
      <ValueSummary node={node} snap={snap} />
      <h4 className={styles.sectionTitle}>Notes</h4>
      <NoteEditor value={node.note ?? ''} placeholder="No notes yet." onSave={(note) => dispatch(docActions.setNote({ id: node.id, note }))} />
    </div>
  );
}

const trainingFields: FieldSpec[] = [
  {
    key: 'optimizer',
    label: 'Optimizer',
    kind: 'select',
    options: [
      { value: 'adam', label: 'Adam' },
      { value: 'sgd', label: 'Gradient descent (SGD)' },
    ],
  },
  { key: 'lr', label: 'Learning rate', kind: 'number', help: 'How big each update step is.' },
  { key: 'steps', label: 'Training steps', kind: 'int', min: 1 },
  { key: 'momentum', label: 'Momentum (SGD)', kind: 'number' },
  { key: 'seed', label: 'Random seed', kind: 'int', help: 'Same seed, same starting values.' },
];

function ProjectInspector({ doc }: { doc: ProjectDoc }) {
  const dispatch = useAppDispatch();
  return (
    <div className={styles.inspector}>
      <h3 className={styles.panelHeading}>About this project</h3>
      <NoteEditor value={doc.info.description} placeholder="Describe what this model does." onSave={(d) => dispatch(docActions.setDescription(d))} />
      <h4 className={styles.sectionTitle}>Training</h4>
      {trainingFields.map((spec) => (
        <Field
          key={spec.key}
          spec={spec}
          value={doc.training[spec.key as keyof ProjectDoc['training']]}
          onChange={(v) => dispatch(docActions.setTraining({ [spec.key]: v }))}
        />
      ))}
      <Field
        spec={{
          key: 'direction',
          label: 'Flow direction',
          kind: 'select',
          options: [
            { value: 'up', label: 'Bottom to top' },
            { value: 'right', label: 'Left to right' },
          ],
        }}
        value={doc.layout.direction}
        onChange={(v) => dispatch(docActions.setDirection(v as 'up' | 'right'))}
      />
    </div>
  );
}

function SelectionInspector({ nodes, edges }: { nodes: Id[]; edges: Id[] }) {
  const dispatch = useAppDispatch();
  return (
    <div className={styles.inspector}>
      <p>
        {nodes.length} node{nodes.length === 1 ? '' : 's'}
        {edges.length ? `, ${edges.length} connection${edges.length === 1 ? '' : 's'}` : ''} selected
      </p>
      <div className={styles.row}>
        {nodes.length > 0 && (
          <button className={styles.button} onClick={() => dispatch(docActions.group({ ids: nodes, groupId: newId(), label: 'Group' }))}>
            Group (Ctrl+G)
          </button>
        )}
        <button
          className={styles.linkButton}
          onClick={() => {
            dispatch(docActions.removeSelection({ nodes, edges }));
            dispatch(uiActions.clearSelection());
          }}
        >
          Delete
        </button>
      </div>
    </div>
  );
}

export function Inspector() {
  const doc = useAppSelector((s) => s.doc.present);
  const { selectedNodes, selectedEdges } = useAppSelector((s) => s.ui);
  const nodes = selectedNodes.filter((id) => doc.nodes[id]);
  const edges = selectedEdges.filter((id) => doc.edges[id]);
  if (nodes.length === 1 && edges.length === 0) return <NodeInspector key={nodes[0]} doc={doc} node={doc.nodes[nodes[0]]} />;
  if (nodes.length || edges.length) return <SelectionInspector nodes={nodes} edges={edges} />;
  return <ProjectInspector doc={doc} />;
}
