'use client';
import { formatNumber } from '@/canvas/displays/draw';
import { docActions } from '@/store/docSlice';
import { engineActions } from '@/store/engineSlice';
import { useAppDispatch, useAppSelector } from '@/store/store';
import { uiActions } from '@/store/uiSlice';
import { useEditor, useRuntimeSnapshot } from './EditorContext';
import styles from './editor.module.css';

/** Train / pause / step / reset / generate, with progress and the current loss. */
export function RunBar() {
  const { engine } = useEditor();
  const dispatch = useAppDispatch();
  const { state, step, notice, error } = useAppSelector((s) => s.engine);
  const steps = useAppSelector((s) => s.doc.present.training.steps);
  const generateSteps = useAppSelector((s) => s.doc.present.generate.steps);
  const hasFeedback = useAppSelector((s) => Object.values(s.doc.present.edges).some((e) => e.kind === 'feedback'));
  const hasMinimize = useAppSelector((s) => Object.values(s.doc.present.nodes).some((n) => n.type === 'minimize'));
  const showGradients = useAppSelector((s) => s.ui.showGradients);
  const snap = useRuntimeSnapshot();
  const training = state === 'training';
  const shownStep = snap?.step ?? step;

  const saveTrained = async () => {
    const values = await engine.current?.params();
    if (values && Object.keys(values).length) {
      dispatch(docActions.setTrainedValues(values));
      dispatch(uiActions.showToast('Trained values saved into the Parameter nodes.'));
    }
  };

  return (
    <div className={styles.runbar} data-testid="runbar">
      <div className={styles.runButtons}>
        {training ? (
          <button className={styles.primary} onClick={() => engine.current?.pause()}>
            ❚❚ Pause
          </button>
        ) : (
          <button className={styles.primary} onClick={() => engine.current?.train()} disabled={!hasMinimize} title={hasMinimize ? '' : 'Add a Minimize node to train'}>
            ▶ Train
          </button>
        )}
        <button className={styles.button} onClick={() => engine.current?.step(1)} disabled={training || !hasMinimize}>
          Step
        </button>
        <button className={styles.button} onClick={() => engine.current?.reset()} title="Start over with fresh starting values">
          Reset
        </button>
        {hasFeedback && (
          <button className={styles.button} onClick={() => engine.current?.generate(generateSteps)}>
            Generate
          </button>
        )}
      </div>
      <div className={styles.progress}>
        <div className={styles.bar}>
          <div style={{ width: `${Math.min(100, (shownStep / steps) * 100)}%` }} />
        </div>
        <span>
          step {shownStep} / {steps}
          {snap?.loss != null && <> · loss {formatNumber(snap.loss)}</>}
        </span>
      </div>
      <div className={styles.runButtons}>
        <label className={styles.toggle} title="Color connections by the size of their gradients">
          <input type="checkbox" checked={showGradients} onChange={() => dispatch(uiActions.toggleGradients())} />
          <span>Gradients</span>
        </label>
        {shownStep > 0 && !training && (
          <button className={styles.linkButton} onClick={saveTrained} title="Keep the trained numbers in the project">
            Save trained values
          </button>
        )}
      </div>
      {(notice || error) && (
        <div className={error ? styles.error : styles.notice} role="status">
          {error ?? notice}
          <button className={styles.linkButton} onClick={() => (error ? dispatch(engineActions.error(null)) : dispatch(engineActions.dismissNotice()))}>
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
