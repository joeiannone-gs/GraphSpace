import { DocBuilder } from '@/doc/builder';
import { syntheticDataset } from '@/engine/datasets';
import { mlp, mse, timestepEmbedding } from '@/library/builtin';
import { extend, find } from '../helpers';
import type { Lesson } from '../types';

/** Mean distance from each generated point to the closest real one. */
function distanceToData(samples: Float64Array): number {
  const data = syntheticDataset('moons')!.train.x.data;
  let total = 0;
  const n = samples.length / 2;
  for (let i = 0; i < n; i++) {
    let best = Infinity;
    for (let j = 0; j < data.length / 2; j++) best = Math.min(best, Math.hypot(samples[2 * i] - data[2 * j], samples[2 * i + 1] - data[2 * j + 1]));
    total += best;
  }
  return total / n;
}

export const diffusionLesson: Lesson = {
  id: 'diffusion',
  title: 'Diffusion: making new data from noise',
  summary: 'The idea behind image generators, on 2-D points: blur data with noise, learn to undo one step, then turn pure noise into new data.',
  minutes: 25,
  palette: ['dataset', 'diffusion_noise', 'ddpm_step', 'concat', 'relu', 'minimize', 'scatter', 'peek', 'group:linear', 'group:mlp', 'group:mse', 'group:timestep_embedding'],
  starter() {
    const b = new DocBuilder();
    b.doc.training = { ...b.doc.training, optimizer: 'adam', lr: 0.01, steps: 1500 };
    b.doc.generate = { steps: 40 };
    b.doc.info.description = 'Points shaped like two moons. The goal: a model that can draw *new* points with the same shape.';
    const data = b.add('dataset', { source: 'moons', batchSize: 128 }, { label: 'Moons', pos: [0, 0] });
    const plot = b.add('scatter', {}, { pos: [-1800, -1100] });
    b.wire([data, 'x'], plot, 'x');
    b.wire([data, 'y'], plot, 'y');
    return b.build();
  },
  steps: [
    {
      title: 'Add noise',
      body:
        'Drag in **Diffusion Noise** and connect the data’s `x`. For each point it picks a noise level `t` between 0 (clean) and 1 (pure noise) and blends in random `noise`. Its picture shows the noisy points: most of the shape is lost.',
      checks: [
        { kind: 'structure', describe: 'Diffusion Noise gets the data', test: ({ q }) => q.nodes('diffusion_noise').some((n) => q.source(n.id, 'x')?.type === 'dataset') || 'Connect the data’s x into Diffusion Noise.' },
        {
          kind: 'value',
          describe: 'Noisy points come out',
          test: ({ q, session }) => {
            const n = q.nodes('diffusion_noise')[0];
            return session?.valueOf(n.id, 'xt')?.shape[1] === 2 || 'Diffusion Noise should output 2-D points.';
          },
        },
      ],
      solve: (doc) =>
        extend(doc, (b, d) => {
          const noise = b.add('diffusion_noise', { steps: 40, samples: 300 }, { label: 'Add noise', pos: [0, -1100] });
          b.wire([find(d, 'dataset').id, 'x'], noise, 'x');
        }),
    },
    {
      title: 'Learn to predict the noise',
      body:
        'The network gets a noisy point **and** its noise level, and guesses the noise that was added. Feed `t` through a **Timestep Embedding**, **Concat** it with `xt` (2 + 16 = 18 numbers per point), and pass that through an **MLP** (Inputs `18`, Hidden `64`, Outputs `2`, then **Rebuild**). Compare the guess with the true `noise` using **MSE**, **Minimize** it and train.',
      hint: 'Concat joins along the last axis: [128, 2] and [128, 16] become [128, 18].',
      checks: [
        { kind: 'structure', describe: 'The network sees xt and t', test: ({ q }) => (q.flows('diffusion_noise', 'concat') && q.flows('timestep_embedding', 'concat')) || 'Concat xt with the Timestep Embedding of t.' },
        {
          kind: 'structure',
          describe: 'Its guess is compared with the true noise',
          test: ({ q }) => q.nodes('mse').some((g) => q.source(g.id, 'target')?.type === 'diffusion_noise' && q.source(g.id, 'prediction') !== undefined) || 'MSE with prediction = the network and target = noise.',
        },
        { kind: 'train', describe: 'Loss below 0.45', steps: 1500, test: (ctx) => (ctx.session?.currentLoss ?? 9) < 0.45 || `The loss reached ${ctx.session?.currentLoss?.toFixed(2)}.` },
      ],
      solve: (doc) =>
        extend(doc, (b, d) => {
          const noise = find(d, 'diffusion_noise').id;
          const temb = b.insert(timestepEmbedding.build({ frequencies: 8 }), { pos: [1100, -2200] });
          b.wire([noise, 't'], temb, 't');
          const cat = b.add('concat', { count: 2, axis: -1 }, { pos: [0, -3300] });
          b.wire([noise, 'xt'], cat, 'in0');
          b.wire([temb, 'y'], cat, 'in1');
          const net = b.insert(mlp.build({ inFeatures: 18, hidden: 64, outFeatures: 2 }), { label: 'noise guess', pos: [0, -4400] });
          b.wire(cat, net, 'x');
          const loss = b.insert(mse.build({}), { pos: [0, -5500] });
          b.wire([net, 'y'], loss, 'prediction');
          b.wire([noise, 'noise'], loss, 'target');
          const min = b.add('minimize', {}, { pos: [0, -6600] });
          b.wire([loss, 'loss'], min, 'loss');
        }),
    },
    {
      title: 'Turn noise into points',
      body:
        'Add a **DDPM Step** fed by `xt`, the network’s guess (`eps`) and `t`. It removes the guessed noise, a little at a time. Connect its output back into Diffusion Noise’s `prev` input (a dashed feedback connection), then press **Generate**: 40 steps walk 300 random points back onto the moons.',
      checks: [
        {
          kind: 'structure',
          describe: 'DDPM Step feeds back into Diffusion Noise',
          test: ({ doc }) =>
            Object.values(doc.edges).some((e) => e.kind === 'feedback' && doc.nodes[e.from.node]?.type === 'ddpm_step' && doc.nodes[e.to.node]?.type === 'diffusion_noise') ||
            'Connect DDPM Step’s output into Diffusion Noise’s prev input.',
        },
        {
          kind: 'generate',
          describe: 'Generated points land on the moons',
          steps: 1500,
          generate: 40,
          test: ({ q, session }) => {
            const step = q.nodes('ddpm_step')[0];
            const samples = step && session?.valueOf(step.id)?.data;
            if (!samples) return 'DDPM Step produced nothing.';
            const d = distanceToData(samples);
            return d < 0.2 || `Generated points are ${d.toFixed(2)} away from the data on average (goal: below 0.2).`;
          },
        },
      ],
      solve: (doc) =>
        extend(doc, (b, d) => {
          const noise = find(d, 'diffusion_noise').id;
          const net = Object.values(d.nodes).find((n) => n.source?.id === 'mlp' && n.parent === null)!;
          const step = b.add('ddpm_step', { steps: 40 }, { label: 'Denoise', pos: [1400, -5500] });
          b.wire([noise, 'xt'], step, 'xt');
          b.wire([net.id, 'y'], step, 'eps');
          b.wire([noise, 't'], step, 't');
          b.wire(step, noise, 'prev', 'feedback');
          const plot = b.add('scatter', {}, { label: 'Generated', pos: [2600, -6600] });
          b.wire(step, plot, 'x');
        }),
    },
  ],
};
