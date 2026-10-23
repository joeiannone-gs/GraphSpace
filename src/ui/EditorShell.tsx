'use client';
import { useAppDispatch, useAppSelector } from '@/store/store';
import { uiActions } from '@/store/uiSlice';
import { Breadcrumb } from './Breadcrumb';
import { CanvasHost } from './CanvasHost';
import { useEditor } from './EditorContext';
import { Header } from './Header';
import { Inspector } from './Inspector';
import { Palette } from './Palette';
import { RunBar } from './RunBar';
import { Toast } from './Toast';
import styles from './editor.module.css';

/** The editor layout: palette on the left, canvas in the middle, inspector on the right. */
export function EditorShell({
  headerRight,
  headerCenter,
  left,
  right,
  overlay,
  paletteFilter,
}: {
  headerRight?: React.ReactNode;
  headerCenter?: React.ReactNode;
  left?: React.ReactNode;
  right?: React.ReactNode;
  /** Extra things drawn over the canvas (tabs, banners). */
  overlay?: React.ReactNode;
  paletteFilter?: readonly string[];
}) {
  const { leftOpen, rightOpen } = useAppSelector((s) => s.ui);
  const dispatch = useAppDispatch();
  const { canvas } = useEditor();
  return (
    <div className={styles.shell}>
      <Header right={headerRight} center={headerCenter} />
      <div className={styles.body} data-left={leftOpen} data-right={rightOpen}>
        {leftOpen && (
          <aside className={`${styles.side} modern-scroll`}>
            {left}
            <div className={styles.panel}>
              <div className={styles.panelHeader}>
                <span>HUB</span>
                <button className={styles.iconButton} onClick={() => dispatch(uiActions.togglePanel('left'))} aria-label="Hide panel">
                  «
                </button>
              </div>
              <Palette allowed={paletteFilter} />
            </div>
          </aside>
        )}
        <main className={styles.center}>
          <CanvasHost />
          <div className={styles.topLeft}>
            {!leftOpen && (
              <button className={styles.iconButton} onClick={() => dispatch(uiActions.togglePanel('left'))} aria-label="Show nodes">
                »
              </button>
            )}
            <Breadcrumb />
          </div>
          <RunBar />
          <div className={styles.zoom}>
            <button className={styles.iconButton} onClick={() => canvas.current?.zoomBy(1.25)} aria-label="Zoom in">
              +
            </button>
            <button className={styles.iconButton} onClick={() => canvas.current?.zoomBy(0.8)} aria-label="Zoom out">
              −
            </button>
            <button className={styles.iconButton} onClick={() => canvas.current?.fitScope(true)} aria-label="Fit to screen" title="Fit (F)">
              ⤢
            </button>
          </div>
          {!rightOpen && (
            <button className={`${styles.iconButton} ${styles.topRight}`} onClick={() => dispatch(uiActions.togglePanel('right'))} aria-label="Show info">
              «
            </button>
          )}
          {overlay}
          <Toast />
        </main>
        {rightOpen && (
          <aside className={`${styles.side} modern-scroll`}>
            <div className={styles.panel}>
              <div className={styles.panelHeader}>
                <span>Info</span>
                <button className={styles.iconButton} onClick={() => dispatch(uiActions.togglePanel('right'))} aria-label="Hide panel">
                  »
                </button>
              </div>
              <Inspector />
            </div>
            {right}
          </aside>
        )}
      </div>
    </div>
  );
}
