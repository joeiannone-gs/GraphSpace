/**
 * Reverse-mode autodiff. Every op records its output, inputs and a vector-Jacobian product;
 * backward() walks the records in reverse and accumulates a gradient for every Var, so the
 * gradient of any intermediate node is available for display.
 */
import { add as addK } from './kernels';
import { Tensor, full, sameShape, shapeStr } from './tensor';

export interface Var {
  readonly id: number;
  readonly value: Tensor;
  readonly needsGrad: boolean;
}

/** Maps the gradient of an op's output to the gradients of its inputs (null = no gradient). */
export type Vjp = (g: Tensor) => (Tensor | null)[];

interface Entry {
  out: Var;
  inputs: readonly Var[];
  vjp: Vjp;
}

export class Tape {
  private nextId = 1;
  private entries: Entry[] = [];

  /** A value that never needs a gradient (data, constants). */
  constant(value: Tensor): Var {
    return { id: this.nextId++, value, needsGrad: false };
  }

  /** A leaf we want gradients for (parameters). */
  leaf(value: Tensor): Var {
    return { id: this.nextId++, value, needsGrad: true };
  }

  record(value: Tensor, inputs: readonly Var[], vjp: Vjp): Var {
    const needsGrad = inputs.some((v) => v.needsGrad);
    const out: Var = { id: this.nextId++, value, needsGrad };
    if (needsGrad) this.entries.push({ out, inputs, vjp });
    return out;
  }

  /** Gradients of `root` (seeded with ones, or `seed`) with respect to every Var that needs one. */
  backward(root: Var, seed?: Tensor): Map<number, Tensor> {
    const grads = new Map<number, Tensor>();
    if (!root.needsGrad) return grads;
    const s = seed ?? full(root.value.shape, 1);
    if (!sameShape(s.shape, root.value.shape)) {
      throw new Error(`Seed ${shapeStr(s.shape)} doesn't match output ${shapeStr(root.value.shape)}`);
    }
    grads.set(root.id, s);
    for (let i = this.entries.length - 1; i >= 0; i--) {
      const { out, inputs, vjp } = this.entries[i];
      const g = grads.get(out.id);
      if (!g) continue;
      const inGrads = vjp(g);
      inputs.forEach((input, k) => {
        const ig = inGrads[k];
        if (!ig || !input.needsGrad) return;
        if (!sameShape(ig.shape, input.value.shape)) {
          throw new Error(
            `Internal error: gradient ${shapeStr(ig.shape)} doesn't match input ${shapeStr(input.value.shape)}`,
          );
        }
        const prev = grads.get(input.id);
        grads.set(input.id, prev ? addK(prev, ig) : ig);
      });
    }
    return grads;
  }
}
