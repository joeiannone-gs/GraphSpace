/**
 * Latest engine results (values, gradients, errors). Kept outside Redux: snapshots arrive ~10×
 * per second, hold typed arrays and are never undone or saved.
 */
import type { SessionSnapshot } from '@/engine/session';

type Listener = () => void;

export class RuntimeStore {
  private snapshot: SessionSnapshot | null = null;
  private docVersion = 0;
  private listeners = new Set<Listener>();
  /** Increases with every new snapshot. */
  revision = 0;

  get(): SessionSnapshot | null {
    return this.snapshot;
  }

  /** Document version the current snapshot was computed from. */
  get version(): number {
    return this.docVersion;
  }

  set(version: number, snapshot: SessionSnapshot | null) {
    this.snapshot = snapshot;
    this.docVersion = version;
    this.revision++;
    for (const l of this.listeners) l();
  }

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): SessionSnapshot | null => this.snapshot;
}
