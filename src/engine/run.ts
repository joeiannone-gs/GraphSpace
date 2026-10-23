/** One forward pass over a compiled graph. Each node runs in its own try/catch so one mistake doesn't hide the rest. */
import type { Id } from '@/doc/types';
import type { RunEnv } from '@/nodes/types';
import { Compiled, NodeError, portKey } from './compile';
import { Tape, Var } from './tape';
import { ShapeError, Tensor } from './tensor';

export interface ForwardResult {
  values: Map<string, Var>;
  inputVars: Map<Id, Record<string, Var | undefined>>;
  errors: Map<Id, NodeError>;
  loss: Var | null;
}

export function forward(compiled: Compiled, tape: Tape, env: RunEnv, previous: Map<string, Tensor>): ForwardResult {
  const values = new Map<string, Var>();
  const inputVars = new Map<Id, Record<string, Var | undefined>>();
  const errors = new Map(compiled.errors);
  let loss: Var | null = null;

  for (const node of compiled.order) {
    const inputs: Record<string, Var | undefined> = {};
    let blocked = false;
    for (const port of node.inputPorts) {
      const src = node.inputs[port.name];
      if (!src) continue;
      if (src.feedback) {
        const prev = previous.get(portKey(src.node, src.port));
        inputs[port.name] = prev ? tape.constant(prev) : undefined;
        continue;
      }
      const v = values.get(portKey(src.node, src.port));
      if (!v) {
        blocked = true;
        break;
      }
      inputs[port.name] = v;
    }
    inputVars.set(node.id, inputs);
    if (blocked) {
      errors.set(node.id, { code: 'blocked', message: 'Waiting on an input that has a problem upstream.' });
      continue;
    }
    try {
      const outs = node.def.forward ? node.def.forward({ tape, nodeId: node.id, p: node.params, in: inputs, env }) : {};
      for (const [port, v] of Object.entries(outs)) {
        values.set(portKey(node.id, port), node.def.differentiable ? v : tape.constant(v.value));
      }
      if (node.id === compiled.minimize) loss = inputs.loss ?? null;
    } catch (err) {
      const message = err instanceof ShapeError || err instanceof Error ? err.message : String(err);
      errors.set(node.id, { code: 'runtime', message: `${node.def.label}: ${message}` });
    }
  }

  return { values, inputVars, errors, loss };
}
