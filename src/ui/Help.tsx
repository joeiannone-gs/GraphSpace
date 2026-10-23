'use client';
import { useState } from 'react';
import styles from './editor.module.css';

/** The "?" button: how to use the editor. */
export function HelpButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className={styles.iconButton} onClick={() => setOpen(true)} aria-label="Help" title="Help">
        ?
      </button>
      {open && (
        <div className={styles.modalBackdrop} onClick={() => setOpen(false)}>
          <div className={styles.modal} role="dialog" aria-label="How to use GraphSpace" onClick={(e) => e.stopPropagation()}>
            <h2>How GraphSpace works</h2>
            <p>
              A model is a graph: <strong>values</strong> flow along the green connections from the bottom up, and every node does one small calculation. Click a node to see its
              value, its explanation and its settings on the right.
            </p>
            <h3>Building</h3>
            <ul>
              <li>Drag nodes from the HUB onto the canvas (or click one to add it in the middle).</li>
              <li>Connect by dragging from a node’s green dot (an output, on top) to another node’s dot (an input, at the bottom). Dragging from a connected input picks the wire up again.</li>
              <li>
                Drag the background to pan, scroll to zoom, <kbd>Shift</kbd>-drag to select several nodes, <kbd>F</kbd> to fit everything in view.
              </li>
            </ul>
            <h3>Groups</h3>
            <ul>
              <li>
                Select nodes and press <kbd>Ctrl</kbd>+<kbd>G</kbd> to group them; <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>G</kbd> ungroups.
              </li>
              <li>
                Double-click a group to step inside; <kbd>Esc</kbd> or the path at the top left takes you back out.
              </li>
              <li>Layers like Linear and losses like MSE are groups too: open them to see how they work.</li>
            </ul>
            <h3>Training</h3>
            <ul>
              <li>Parameters are the numbers training may change. A <strong>Minimize</strong> node marks the loss to make smaller.</li>
              <li>
                <strong>Train</strong> runs the configured number of steps (settings are in Info when nothing is selected). <strong>Step</strong> runs one; <strong>Reset</strong> starts
                over from fresh random values.
              </li>
              <li>The cyan glow shows the size of the gradients flowing back from the loss.</li>
              <li>
                A connection into a <strong>Previous Value</strong> node is a feedback loop: each step it gets the value from the step before. Use <strong>Generate</strong> to run
                loops.
              </li>
            </ul>
            <h3>Undo and saving</h3>
            <ul>
              <li>
                <kbd>Ctrl</kbd>+<kbd>Z</kbd> undoes, <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>Z</kbd> redoes. Projects save automatically; <strong>Commit</strong> saves a checkpoint you
                can compare with or go back to.
              </li>
            </ul>
            <button className={styles.button} onClick={() => setOpen(false)}>
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}
