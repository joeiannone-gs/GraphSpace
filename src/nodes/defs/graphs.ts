import { z } from 'zod';
import * as O from '@/engine/ops';
import { GRAPH_SOURCES } from '@/engine/graphs';
import { defineNode } from '../types';
import { need, noParams, out } from './helpers';

export const graphData = defineNode({
  type: 'graph_data',
  label: 'Graph Data',
  category: 'Graphs',
  explanation:
    'A network of people (nodes) and friendships (edges). `adj` says who is connected, scaled so that multiplying by it averages each node with its neighbours. `x` are node features, `y` everyone’s true group. Only the few `labeled` nodes (with answers `yLabeled`) may be used for training: the network has to infer the rest.',
  display: 'network',
  inputs: [],
  outputs: [
    { name: 'adj', doc: 'normalized adjacency [nodes, nodes]' },
    { name: 'x', doc: 'node features [nodes, features]' },
    { name: 'y', doc: 'true groups, one-hot [nodes, groups]' },
    { name: 'labeled', doc: 'ids of the labeled nodes' },
    { name: 'yLabeled', doc: 'their groups, one-hot' },
    { name: 'pos', doc: 'drawing positions [nodes, 2]' },
  ],
  params: z.object({ source: z.string().default('karate') }),
  fields: [{ key: 'source', label: 'Network', kind: 'select', options: GRAPH_SOURCES }],
  differentiable: true,
  forward: ({ tape, p, env }) => {
    const g = env.graph(p.source);
    return {
      adj: tape.constant(g.adj),
      x: tape.constant(g.x),
      y: tape.constant(g.y),
      labeled: tape.constant(g.labeled),
      yLabeled: tape.constant(g.yLabeled),
      pos: tape.constant(g.pos),
    };
  },
});

export const pickRows = defineNode({
  type: 'pick_rows',
  label: 'Pick Rows',
  category: 'Graphs',
  explanation: 'Keeps only the rows listed in `ids` (for example the labeled nodes, so the loss only uses answers training may see). Gradients flow back to the picked rows.',
  display: 'tensor',
  inputs: [
    { name: 'x', doc: 'any tensor [rows, …]' },
    { name: 'ids', doc: 'row numbers to keep' },
  ],
  outputs: out,
  params: noParams,
  fields: [],
  differentiable: true,
  forward: (ctx) => ({ out: O.gather(ctx.tape, need(ctx, 'x'), need(ctx, 'ids')) }),
});

export const networkPlot = defineNode({
  type: 'network_plot',
  label: 'Network Plot',
  category: 'Display',
  explanation: 'Draws the network. Nodes are colored by `color`: one score per group colors each node by its highest score; a single number per node shades it.',
  display: 'network',
  inputs: [{ name: 'adj' }, { name: 'pos' }, { name: 'color', optional: true }],
  outputs: [],
  params: noParams,
  fields: [],
  differentiable: true,
  forward: () => ({}),
});
