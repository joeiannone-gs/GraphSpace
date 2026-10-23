'use client';
import { useEffect } from 'react';
import { migrate } from '@/doc/migrate';
import type { ProjectDoc } from '@/doc/types';
import { docActions } from '@/store/docSlice';
import { useAppStore } from '@/store/store';

/** Keep the open document in localStorage (the sandbox, before accounts exist). */
export function useLocalPersistence(key: string, fallback: () => ProjectDoc) {
  const store = useAppStore();
  useEffect(() => {
    let doc: ProjectDoc;
    try {
      const raw = localStorage.getItem(key);
      doc = raw ? migrate(JSON.parse(raw)) : fallback();
    } catch {
      doc = fallback();
    }
    store.dispatch(docActions.replaceDoc({ doc }));
    let saved = store.getState().doc.present;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const save = () => {
      try {
        localStorage.setItem(key, JSON.stringify(saved));
      } catch {
        // Storage can be full or blocked (private mode); the editor keeps working without it.
      }
    };
    const unsubscribe = store.subscribe(() => {
      const { present, gestureBase } = store.getState().doc;
      if (present === saved || gestureBase) return;
      saved = present;
      clearTimeout(timer);
      timer = setTimeout(save, 500);
    });
    window.addEventListener('pagehide', save);
    return () => {
      unsubscribe();
      clearTimeout(timer);
      window.removeEventListener('pagehide', save);
      save();
    };
  }, [store, key, fallback]);
}
