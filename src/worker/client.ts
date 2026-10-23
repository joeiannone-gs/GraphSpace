/** Main-thread handle on the engine worker. */
import type { Id, ProjectDoc, TensorJSON } from '@/doc/types';
import type { SessionSnapshot } from '@/engine/session';
import type { CheckResult } from '@/lessons/types';
import type { EngineState, FromWorker, ToWorker } from './protocol';

export interface EngineEvents {
  snapshot(version: number, snapshot: SessionSnapshot): void;
  status(state: EngineState, step: number, notice?: string): void;
  error(message: string): void;
}

export class EngineClient {
  private worker: Worker;
  private nextRequest = 1;
  private pending = new Map<number, (values: Record<Id, TensorJSON>) => void>();
  private pendingChecks = new Map<number, (results: CheckResult[]) => void>();
  private latestVersion = 0;

  constructor(private readonly events: EngineEvents) {
    this.worker = new Worker(new URL('./engine.worker.ts', import.meta.url), { type: 'module' });
    this.worker.onmessage = (e: MessageEvent<FromWorker>) => this.receive(e.data);
    this.worker.onerror = (e) => this.events.error(e.message || 'The engine crashed');
  }

  private send(msg: ToWorker) {
    this.worker.postMessage(msg);
  }

  private receive(msg: FromWorker) {
    switch (msg.t) {
      case 'snapshot':
        // Results for an older document are dropped: the next one is on its way.
        if (msg.version >= this.latestVersion) this.events.snapshot(msg.version, msg.snapshot);
        return;
      case 'status':
        this.events.status(msg.state, msg.step, msg.notice);
        return;
      case 'params':
        this.pending.get(msg.requestId)?.(msg.values);
        this.pending.delete(msg.requestId);
        return;
      case 'checkResults':
        this.pendingChecks.get(msg.requestId)?.(msg.results);
        this.pendingChecks.delete(msg.requestId);
        return;
      case 'error':
        this.events.error(msg.message);
        return;
    }
  }

  load(doc: ProjectDoc, version: number) {
    this.latestVersion = version;
    this.send({ t: 'load', version, doc });
  }

  train() {
    this.send({ t: 'train' });
  }

  pause() {
    this.send({ t: 'pause' });
  }

  step(n = 1) {
    this.send({ t: 'step', n });
  }

  reset() {
    this.send({ t: 'reset' });
  }

  generate(steps: number) {
    this.send({ t: 'generate', steps });
  }

  params(): Promise<Record<Id, TensorJSON>> {
    const requestId = this.nextRequest++;
    return new Promise((resolve) => {
      this.pending.set(requestId, resolve);
      this.send({ t: 'getParams', requestId });
    });
  }

  runChecks(lessonId: string, step: number, doc: ProjectDoc): Promise<CheckResult[]> {
    const requestId = this.nextRequest++;
    return new Promise((resolve) => {
      this.pendingChecks.set(requestId, resolve);
      this.send({ t: 'runChecks', requestId, lessonId, step, doc });
    });
  }

  dispose() {
    this.worker.terminate();
    this.pending.clear();
  }
}
