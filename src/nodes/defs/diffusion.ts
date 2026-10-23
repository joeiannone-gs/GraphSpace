import { z } from 'zod';
import { ShapeError, shapeStr, tensor } from '@/engine/tensor';
import { defineNode } from '../types';
import { need } from './helpers';

/** Cosine noise schedule (Nichol & Dhariwal): ᾱ for t = 0…K and β, α for t = 1…K. */
export function cosineSchedule(K: number) {
  const s = 0.008;
  const f = (t: number) => Math.cos(((t / K + s) / (1 + s)) * (Math.PI / 2)) ** 2;
  const alphaBar = Array.from({ length: K + 1 }, (_, t) => f(t) / f(0));
  const beta = alphaBar.map((ab, t) => (t === 0 ? 0 : Math.min(0.999, 1 - ab / alphaBar[t - 1])));
  const alpha = beta.map((b) => 1 - b);
  return { alphaBar, beta, alpha };
}

const stepsParam = z.number().int().min(2).max(500).default(50);

interface NoiseState {
  x: Float64Array | null;
}

export const diffusionNoise = defineNode({
  type: 'diffusion_noise',
  label: 'Diffusion Noise',
  category: 'Diffusion',
  explanation:
    'Training: blends each clean example `x` with random noise by a random amount `t` (0 = clean, 1 = pure noise) and outputs the noisy points, `t`, and the exact `noise` added — the model learns to predict that noise. Generating: starts from pure noise and, through a **feedback** connection into `prev`, receives each slightly cleaner version from a DDPM Step.',
  display: 'points',
  inputs: [
    { name: 'x', doc: 'clean examples [batch, features]' },
    { name: 'prev', feedback: true, optional: true, doc: 'feedback: the previous, less noisy samples while generating' },
  ],
  outputs: [
    { name: 'xt', doc: 'noisy examples' },
    { name: 't', doc: 'noise level for each row, 0…1' },
    { name: 'noise', doc: 'the noise that was added (the target)' },
  ],
  params: z.object({ steps: stepsParam, samples: z.number().int().min(1).max(2000).default(300) }),
  fields: [
    { key: 'steps', label: 'Noise steps', kind: 'int', min: 2, max: 500, help: 'Use the same number on the DDPM Step, and as the Generate steps.' },
    { key: 'samples', label: 'Points to generate', kind: 'int', min: 1, max: 2000 },
  ],
  differentiable: false,
  forward: ({ tape, nodeId, p, env, in: inputs }) => {
    const x0 = need({ tape, nodeId, p, env, in: inputs }, 'x').value;
    if (x0.shape.length !== 2) throw new ShapeError(`x should be [batch, features], got ${shapeStr(x0.shape)}`);
    const [B, D] = x0.shape;
    const K = p.steps;
    const { alphaBar } = cosineSchedule(K);
    if (env.mode === 'generate') {
      const st = env.state<NoiseState>(nodeId, () => ({ x: null }));
      const t = Math.max(1, K - env.iter);
      if (env.iter === 0 || !inputs.prev) {
        st.x = Float64Array.from({ length: p.samples * D }, () => env.rng.normal());
      } else {
        st.x = Float64Array.from(inputs.prev.value.data);
      }
      const M = st.x.length / D;
      return {
        xt: tape.constant({ shape: [M, D], data: st.x }),
        t: tape.constant(tensor([M, 1], new Array(M).fill(t / K))),
        noise: tape.constant(tensor([M, D])),
      };
    }
    const xt = new Float64Array(B * D);
    const noise = new Float64Array(B * D);
    const tt = new Float64Array(B);
    for (let b = 0; b < B; b++) {
      const t = 1 + env.rng.int(K);
      tt[b] = t / K;
      const a = Math.sqrt(alphaBar[t]);
      const s = Math.sqrt(1 - alphaBar[t]);
      for (let d = 0; d < D; d++) {
        const e = env.rng.normal();
        noise[b * D + d] = e;
        xt[b * D + d] = a * x0.data[b * D + d] + s * e;
      }
    }
    return {
      xt: tape.constant({ shape: [B, D], data: xt }),
      t: tape.constant({ shape: [B, 1], data: tt }),
      noise: tape.constant({ shape: [B, D], data: noise }),
    };
  },
});

export const ddpmStep = defineNode({
  type: 'ddpm_step',
  label: 'DDPM Step',
  category: 'Diffusion',
  explanation:
    'One step of denoising: removes the predicted noise from `xt` (the DDPM update) and adds a little fresh noise, giving slightly cleaner points. Feed its output back into Diffusion Noise’s `prev` and Generate as many steps as there are noise steps.',
  display: 'points',
  inputs: [
    { name: 'xt', doc: 'current noisy points' },
    { name: 'eps', doc: 'the model’s predicted noise' },
    { name: 't', doc: 'noise level 0…1' },
  ],
  outputs: [{ name: 'out', doc: 'less noisy points' }],
  params: z.object({ steps: stepsParam }),
  fields: [{ key: 'steps', label: 'Noise steps', kind: 'int', min: 2, max: 500 }],
  differentiable: false,
  forward: (ctx) => {
    const xt = need(ctx, 'xt').value;
    const eps = need(ctx, 'eps').value;
    const tIn = need(ctx, 't').value;
    if (xt.data.length !== eps.data.length) throw new ShapeError(`xt ${shapeStr(xt.shape)} and eps ${shapeStr(eps.shape)} must have the same shape`);
    const K = ctx.p.steps;
    const { alphaBar, beta, alpha } = cosineSchedule(K);
    const t = Math.min(K, Math.max(1, Math.round(tIn.data[0] * K)));
    const coef = beta[t] / Math.sqrt(1 - alphaBar[t]);
    const sigma = t > 1 ? Math.sqrt(beta[t]) : 0;
    const out = new Float64Array(xt.data.length);
    for (let i = 0; i < out.length; i++) {
      out[i] = (xt.data[i] - coef * eps.data[i]) / Math.sqrt(alpha[t]) + (sigma ? sigma * ctx.env.rng.normal() : 0);
    }
    return { out: ctx.tape.constant({ shape: [...xt.shape], data: out }) };
  },
});

export const randn = defineNode({
  type: 'randn',
  label: 'Random Normal',
  category: 'Diffusion',
  explanation: 'Fresh random numbers from a bell curve (mean 0, spread 1) every step.',
  display: 'tensor',
  inputs: [],
  outputs: [{ name: 'out' }],
  params: z.object({ shape: z.array(z.number().int().min(1)).max(4).default([4]) }),
  fields: [{ key: 'shape', label: 'Shape', kind: 'shape' }],
  differentiable: false,
  forward: ({ tape, p, env }) => {
    const n = p.shape.reduce((a, b) => a * b, 1);
    return { out: tape.constant(tensor(p.shape, Array.from({ length: n }, () => env.rng.normal()))) };
  },
});
