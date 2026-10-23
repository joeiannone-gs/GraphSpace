/** Finite-difference gradient checking, used by the op tests. */
import { Tape, Var } from './tape';
import { Tensor, tensor } from './tensor';
import { Rng } from './rng';

export interface GradcheckResult {
  maxError: number;
  worst: { input: number; index: number; analytic: number; numeric: number } | null;
}

/**
 * Compares the tape's gradient of L = sum(f(x) * W) (W random) against central differences
 * for every element of every input in `wrt`.
 */
export function gradcheck(
  f: (t: Tape, xs: Var[]) => Var,
  inputs: Tensor[],
  wrt: number[] = inputs.map((_, i) => i),
  eps = 1e-6,
  seed = 7,
): GradcheckResult {
  const rng = new Rng(seed);
  const tape = new Tape();
  const vars = inputs.map((x, i) => (wrt.includes(i) ? tape.leaf(x) : tape.constant(x)));
  const out = f(tape, vars);
  const W = tensor(
    out.value.shape,
    Array.from(out.value.data, () => rng.normal()),
  );
  const grads = tape.backward(out, W);

  const loss = (xs: Tensor[]) => {
    const t = new Tape();
    const v = xs.map((x) => t.constant(x));
    const o = f(t, v).value;
    let s = 0;
    for (let i = 0; i < o.data.length; i++) s += o.data[i] * W.data[i];
    return s;
  };

  let maxError = 0;
  let worst: GradcheckResult['worst'] = null;
  for (const i of wrt) {
    const g = grads.get(vars[i].id);
    for (let j = 0; j < inputs[i].data.length; j++) {
      const plus = inputs.map((x) => ({ shape: x.shape, data: new Float64Array(x.data) }));
      const minus = inputs.map((x) => ({ shape: x.shape, data: new Float64Array(x.data) }));
      plus[i].data[j] += eps;
      minus[i].data[j] -= eps;
      const numeric = (loss(plus) - loss(minus)) / (2 * eps);
      const analytic = g ? g.data[j] : 0;
      const err = Math.abs(numeric - analytic) / Math.max(1, Math.abs(numeric), Math.abs(analytic));
      if (err > maxError) {
        maxError = err;
        worst = { input: i, index: j, analytic, numeric };
      }
    }
  }
  return { maxError, worst };
}
