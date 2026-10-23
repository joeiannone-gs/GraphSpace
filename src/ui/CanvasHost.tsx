'use client';
import { useEffect, useRef } from 'react';
import { CanvasController, type PaletteItem } from '@/canvas/controller';
import { useEditor } from './EditorContext';
import styles from './editor.module.css';

export const PALETTE_MIME = 'application/x-graphspace-item';

/** The pixi canvas. One controller per mount; palette items can be dropped onto it. */
export function CanvasHost() {
  const host = useRef<HTMLDivElement>(null);
  const { store, runtime, canvas } = useEditor();

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let controller: CanvasController | null = null;
    let cancelled = false;
    void CanvasController.create(el, store, runtime).then((c) => {
      if (cancelled) c.destroy();
      else {
        controller = c;
        canvas.current = c;
        // A handle for browser tests and debugging.
        (window as unknown as { __graphspace?: unknown }).__graphspace = { store, canvas: c };
      }
    });
    return () => {
      cancelled = true;
      controller?.destroy();
      canvas.current = null;
    };
  }, [store, runtime, canvas]);

  return (
    <div
      ref={host}
      className={styles.canvas}
      data-testid="canvas"
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes(PALETTE_MIME)) {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'copy';
        }
      }}
      onDrop={(e) => {
        const raw = e.dataTransfer.getData(PALETTE_MIME);
        if (!raw) return;
        e.preventDefault();
        canvas.current?.dropAt(e.clientX, e.clientY, JSON.parse(raw) as PaletteItem);
      }}
    />
  );
}
