/** Optimizers update parameter tensors in place from their gradients. */
import type { Tensor } from './tensor';

export interface OptimizerConfig {
  optimizer: 'sgd' | 'adam';
  lr: number;
  momentum: number;
}

interface SlotState {
  m: Float64Array;
  v: Float64Array;
  t: number;
}

export class Optimizer {
  private slots = new Map<string, SlotState>();

  constructor(public config: OptimizerConfig) {}

  /** Forget state for one parameter (after it is re-initialized). */
  reset(key?: string) {
    if (key === undefined) this.slots.clear();
    else this.slots.delete(key);
  }

  step(key: string, param: Tensor, grad: Tensor) {
    const { lr, momentum, optimizer } = this.config;
    let s = this.slots.get(key);
    if (!s || s.m.length !== param.data.length) {
      s = { m: new Float64Array(param.data.length), v: new Float64Array(param.data.length), t: 0 };
      this.slots.set(key, s);
    }
    s.t++;
    const p = param.data;
    const g = grad.data;
    if (optimizer === 'sgd') {
      for (let i = 0; i < p.length; i++) {
        s.m[i] = momentum * s.m[i] + g[i];
        p[i] -= lr * s.m[i];
      }
      return;
    }
    const b1 = 0.9;
    const b2 = 0.999;
    const eps = 1e-8;
    const c1 = 1 - Math.pow(b1, s.t);
    const c2 = 1 - Math.pow(b2, s.t);
    for (let i = 0; i < p.length; i++) {
      s.m[i] = b1 * s.m[i] + (1 - b1) * g[i];
      s.v[i] = b2 * s.v[i] + (1 - b2) * g[i] * g[i];
      p[i] -= (lr * (s.m[i] / c1)) / (Math.sqrt(s.v[i] / c2) + eps);
    }
  }
}
