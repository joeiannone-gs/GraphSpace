/**
 * Drives a Session in response to protocol messages, training in short time slices so pause and
 * new documents are handled promptly. Independent of the worker global so tests can run it directly.
 */
import type { ProjectDoc } from '@/doc/types';
import type { FetchBytes } from '@/engine/datasets';
import { Session } from '@/engine/session';
import { getLesson } from '@/lessons';
import { runChecks } from '@/lessons/runner';
import { EngineState, FromWorker, ToWorker, modelSignature } from './protocol';

const SLICE_MS = 12;
const SNAPSHOT_EVERY_MS = 100;

export class EngineHost {
  private session: Session;
  private state: EngineState = 'idle';
  private doc: ProjectDoc | null = null;
  private version = 0;
  private signature = '';
  private lastSnapshot = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private queue: Promise<void> = Promise.resolve();

  constructor(
    private readonly fetchBytes: FetchBytes,
    private readonly post: (msg: FromWorker) => void,
    private readonly now: () => number = () => performance.now(),
  ) {
    this.session = new Session(fetchBytes);
  }

  /** Messages are handled one at a time, in order. */
  handle(msg: ToWorker): Promise<void> {
    this.queue = this.queue.then(() => this.process(msg)).catch((err) => {
      this.post({ t: 'error', message: err instanceof Error ? err.message : String(err) });
    });
    return this.queue;
  }

  private async process(msg: ToWorker) {
    switch (msg.t) {
      case 'load': {
        const sig = modelSignature(msg.doc);
        const changed = sig !== this.signature;
        this.doc = msg.doc;
        this.version = msg.version;
        this.session.setTraining(msg.doc.training);
        if (!changed) return;
        this.signature = sig;
        await this.session.load(msg.doc);
        if (this.state === 'training') {
          this.setState('paused', 'Training paused because the model changed.');
        } else if (this.state === 'done') {
          this.setState('paused');
        }
        this.session.evaluate();
        this.sendSnapshot();
        return;
      }
      case 'train':
        if (!this.doc) return;
        if (this.session.step >= this.doc.training.steps) {
          this.setState('done', 'Already trained for the configured number of steps.');
          return;
        }
        this.setState('training');
        this.schedule();
        return;
      case 'pause':
        if (this.state === 'training') this.setState('paused');
        this.cancel();
        this.session.evaluate();
        this.sendSnapshot();
        return;
      case 'step':
        if (!this.doc) return;
        this.cancel();
        for (let i = 0; i < msg.n; i++) this.session.trainStep();
        this.setState('paused');
        this.sendSnapshot();
        return;
      case 'reset':
        this.cancel();
        this.session.resetTraining();
        this.setState('idle');
        if (this.doc) {
          this.session.evaluate();
          this.sendSnapshot();
        }
        return;
      case 'generate':
        if (!this.doc) return;
        this.cancel();
        if (this.state === 'training') this.setState('paused');
        this.session.generate(msg.steps);
        this.sendSnapshot();
        return;
      case 'getParams':
        this.post({ t: 'params', requestId: msg.requestId, values: this.session.paramValues() });
        return;
      case 'runChecks': {
        const step = getLesson(msg.lessonId)?.steps[msg.step];
        const results = step ? await runChecks(step, msg.doc, this.fetchBytes) : [];
        this.post({ t: 'checkResults', requestId: msg.requestId, results });
        return;
      }
    }
  }

  private setState(state: EngineState, notice?: string) {
    this.state = state;
    this.post({ t: 'status', state, step: this.session.step, notice });
  }

  private cancel() {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
  }

  private schedule() {
    this.cancel();
    this.timer = setTimeout(() => {
      this.timer = null;
      this.queue = this.queue.then(() => this.trainSlice());
    }, 0);
  }

  private trainSlice() {
    if (this.state !== 'training' || !this.doc) return;
    const end = this.now() + SLICE_MS;
    const target = this.doc.training.steps;
    let progressed = false;
    do {
      const loss = this.session.trainStep();
      if (loss === null) {
        this.setState('paused', this.lossProblem());
        this.sendSnapshot();
        return;
      }
      progressed = true;
    } while (this.now() < end && this.session.step < target);
    if (this.session.step >= target) {
      this.setState('done');
      this.sendSnapshot();
      return;
    }
    if (progressed && this.now() - this.lastSnapshot >= SNAPSHOT_EVERY_MS) this.sendSnapshot();
    this.schedule();
  }

  private lossProblem(): string {
    const compiled = this.session.compiledGraph;
    if (!compiled?.minimize) return 'Add a Minimize node and connect your loss to it to train.';
    return 'The loss could not be computed — check the nodes marked with errors.';
  }

  private sendSnapshot() {
    this.lastSnapshot = this.now();
    const wideNodes = new Set(
      Object.values(this.doc?.nodes ?? {})
        .filter((n) => n.type === 'image' || n.type === 'network_plot' || n.type === 'graph_data')
        .map((n) => n.id),
    );
    this.post({ t: 'snapshot', version: this.version, snapshot: this.session.snapshot({ wideNodes }) });
    if (this.state === 'training') this.post({ t: 'status', state: 'training', step: this.session.step });
  }
}
