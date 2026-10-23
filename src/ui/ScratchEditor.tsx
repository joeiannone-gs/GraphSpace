'use client';
import { useEffect } from 'react';
import type { ProjectDoc } from '@/doc/types';
import { docActions } from '@/store/docSlice';
import { useAppStore } from '@/store/store';
import { EditorProvider } from './EditorContext';
import { EditorShell } from './EditorShell';
import styles from './editor.module.css';

function Load({ doc }: { doc: ProjectDoc }) {
  const store = useAppStore();
  useEffect(() => {
    store.dispatch(docActions.replaceDoc({ doc }));
  }, [store, doc]);
  return null;
}

/** A fully working editor whose changes aren't saved anywhere (shared links, gallery examples). */
export function ScratchEditor({ doc, title, banner, headerRight }: { doc: ProjectDoc; title: string; banner: React.ReactNode; headerRight?: React.ReactNode }) {
  return (
    <EditorProvider>
      <Load doc={doc} />
      <EditorShell
        headerCenter={<span style={{ fontSize: 16 }}>{title}</span>}
        headerRight={headerRight}
        overlay={
          <div className={styles.banner} style={{ top: 'auto', bottom: 10, left: 10, transform: 'none', maxWidth: 'min(440px, calc(100% - 20px))' }} role="note">
            {banner}
          </div>
        }
      />
    </EditorProvider>
  );
}
