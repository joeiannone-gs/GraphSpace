'use client';
import { useEffect, useRef, useState } from 'react';
import type { ProjectDoc } from '@/doc/types';
import { api, ApiError } from '@/lib/api';
import { docActions } from '@/store/docSlice';
import { useAppStore } from '@/store/store';

export type SaveStatus = 'saved' | 'saving' | 'unsaved' | 'conflict' | 'offline';

export interface Conflict {
  doc: ProjectDoc;
  version: number;
}

/**
 * Autosave a branch's working copy. Saves are debounced, never overlap, and carry the version
 * they were based on; if someone else saved in between, the server answers 409 and the user
 * chooses which copy to keep. Edits made while a save is in flight are saved next.
 */
export function useServerPersistence(opts: { projectId: string; branchId: string; initialDoc: ProjectDoc; initialVersion: number }) {
  const store = useAppStore();
  const [status, setStatus] = useState<SaveStatus>('saved');
  const [conflict, setConflict] = useState<Conflict | null>(null);
  const actions = useRef<{ keepMine(): void; loadTheirs(): void; flush(): Promise<void> }>({
    keepMine: () => undefined,
    loadTheirs: () => undefined,
    flush: async () => undefined,
  });
  const { projectId, branchId, initialDoc, initialVersion } = opts;

  useEffect(() => {
    const url = `/api/projects/${projectId}/branches/${branchId}/working`;
    store.dispatch(docActions.replaceDoc({ doc: initialDoc }));
    let version = initialVersion;
    let saved = store.getState().doc.present;
    let inflight: Promise<void> | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let blocked: Conflict | null = null;
    let stopped = false;

    const save = async (force = false): Promise<void> => {
      if (stopped || (blocked && !force)) return;
      if (inflight) {
        await inflight;
        return save(force);
      }
      const { present, gestureBase } = store.getState().doc;
      if (present === saved || gestureBase) {
        setStatus('saved');
        return;
      }
      setStatus('saving');
      inflight = (async () => {
        try {
          const res = await api<{ version: number }>(url, { method: 'PUT', body: { doc: present, baseVersion: version, force } });
          version = res.version;
          saved = present;
          setStatus(store.getState().doc.present === saved ? 'saved' : 'unsaved');
        } catch (e) {
          if (e instanceof ApiError && e.status === 409) {
            blocked = { doc: e.body.doc as ProjectDoc, version: Number(e.body.version) };
            setConflict(blocked);
            setStatus('conflict');
          } else {
            setStatus('offline');
            timer = setTimeout(() => void save(), 5000);
          }
        }
      })();
      await inflight;
      inflight = null;
      if (!blocked && store.getState().doc.present !== saved) schedule();
    };

    const schedule = () => {
      clearTimeout(timer);
      timer = setTimeout(() => void save(), 1500);
    };

    const unsubscribe = store.subscribe(() => {
      if (blocked) return;
      const { present, gestureBase } = store.getState().doc;
      if (present !== saved && !gestureBase) {
        setStatus((s) => (s === 'saving' ? s : 'unsaved'));
        schedule();
      }
    });

    const flushOnLeave = () => {
      const { present } = store.getState().doc;
      if (present === saved || blocked) return;
      void fetch(url, {
        method: 'PUT',
        keepalive: true,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ doc: present, baseVersion: version }),
      });
    };
    window.addEventListener('pagehide', flushOnLeave);

    actions.current = {
      keepMine: () => {
        if (!blocked) return;
        version = blocked.version;
        blocked = null;
        setConflict(null);
        void save(true);
      },
      loadTheirs: () => {
        if (!blocked) return;
        version = blocked.version;
        saved = blocked.doc;
        store.dispatch(docActions.replaceDoc({ doc: blocked.doc }));
        saved = store.getState().doc.present;
        blocked = null;
        setConflict(null);
        setStatus('saved');
      },
      flush: () => save(),
    };

    return () => {
      stopped = true;
      unsubscribe();
      clearTimeout(timer);
      window.removeEventListener('pagehide', flushOnLeave);
      flushOnLeave();
    };
  }, [store, projectId, branchId, initialDoc, initialVersion]);

  return { status, conflict, actions };
}
