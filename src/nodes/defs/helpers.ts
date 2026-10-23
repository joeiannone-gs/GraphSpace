import { z } from 'zod';
import type { Var } from '@/engine/tape';
import type { ForwardCtx, PortDef } from '../types';

/** An input the executor should have resolved; compile reports missing inputs before forward runs. */
export function need<P>(ctx: ForwardCtx<P>, port: string): Var {
  const v = ctx.in[port];
  if (!v) throw new Error(`Input "${port}" is not connected`);
  return v;
}

export const ports = (...names: string[]): PortDef[] => names.map((name) => ({ name }));

export const out = [{ name: 'out' }];

export const noParams = z.object({});

/** Axes to reduce over: null means all. */
export const axesParam = z.array(z.number().int()).nullable().default(null);
