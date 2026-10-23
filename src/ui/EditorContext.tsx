'use client';
/** Shared editor services: the Redux store, live engine results, the engine worker and the canvas. */
import { createContext, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { Provider } from 'react-redux';
import type { CanvasController } from '@/canvas/controller';
import { RuntimeStore } from '@/runtime/runtimeStore';
import { engineActions } from '@/store/engineSlice';
import { AppStore, makeStore } from '@/store/store';
import { EngineClient } from '@/worker/client';

interface EditorServices {
  store: AppStore;
  runtime: RuntimeStore;
  engine: React.RefObject<EngineClient | null>;
  canvas: React.RefObject<CanvasController | null>;
}

const EditorContext = createContext<EditorServices | null>(null);

export function useEditor(): EditorServices {
  const ctx = useContext(EditorContext);
  if (!ctx) throw new Error('useEditor must be used inside <EditorProvider>');
  return ctx;
}

export function useRuntimeSnapshot() {
  const { runtime } = useEditor();
  return useSyncExternalStore(runtime.subscribe, runtime.getSnapshot, () => null);
}

export function EditorProvider({ children }: { children: React.ReactNode }) {
  const [store] = useState(makeStore);
  const [runtime] = useState(() => new RuntimeStore());
  const engine = useRef<EngineClient | null>(null);
  const canvas = useRef<CanvasController | null>(null);

  // Send each new document version to the engine worker (skipping positions mid-drag).
  useEffect(() => {
    const client = new EngineClient({
      snapshot: (version, snapshot) => runtime.set(version, snapshot),
      status: (state, step, notice) => store.dispatch(engineActions.status({ state, step, notice })),
      error: (message) => store.dispatch(engineActions.error(message)),
    });
    engine.current = client;
    let lastSent: unknown = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const push = () => {
      const { present, version, gestureBase } = store.getState().doc;
      if (present === lastSent || gestureBase) return;
      clearTimeout(timer);
      timer = setTimeout(() => {
        lastSent = present;
        client.load(present, version);
      }, 120);
    };
    const unsubscribe = store.subscribe(push);
    push();
    return () => {
      unsubscribe();
      clearTimeout(timer);
      client.dispose();
      engine.current = null;
    };
  }, [store, runtime]);

  const value = useMemo(() => ({ store, runtime, engine, canvas }), [store, runtime]);
  return (
    <Provider store={store}>
      <EditorContext.Provider value={value}>{children}</EditorContext.Provider>
    </Provider>
  );
}
