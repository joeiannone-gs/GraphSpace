'use client';
import { emptyDoc } from '@/doc/types';
import { examples, fitALine } from '@/gallery/examples';
import { docActions } from '@/store/docSlice';
import { useAppDispatch } from '@/store/store';
import { uiActions } from '@/store/uiSlice';
import { EditorProvider } from '@/ui/EditorContext';
import { EditorShell } from '@/ui/EditorShell';
import { useLocalPersistence } from '@/ui/useLocalPersistence';
import styles from '@/ui/editor.module.css';

const fallback = () => fitALine.build();

function ExamplePicker() {
  const dispatch = useAppDispatch();
  return (
    <select
      className={styles.button}
      value=""
      aria-label="Open an example"
      onChange={(e) => {
        const slug = e.target.value;
        if (!slug) return;
        const doc = slug === 'blank' ? emptyDoc() : examples.find((x) => x.slug === slug)!.build();
        dispatch(docActions.replaceDoc({ doc, keepHistory: true }));
        dispatch(uiActions.setScope(null));
      }}
    >
      <option value="">Open example…</option>
      <option value="blank">Blank project</option>
      {examples.map((x) => (
        <option key={x.slug} value={x.slug}>
          {x.title}
        </option>
      ))}
    </select>
  );
}

function Sandbox() {
  useLocalPersistence('graphspace:sandbox', fallback);
  return <EditorShell headerRight={<ExamplePicker />} />;
}

export function SandboxEditor() {
  return (
    <EditorProvider>
      <Sandbox />
    </EditorProvider>
  );
}
