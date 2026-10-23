/**
 * The open project's document with undo/redo. Every edit is one pure op from graph/ops and one
 * history entry, except during a gesture (a drag), which becomes a single entry when it ends.
 */
import { createSlice, original, type PayloadAction } from '@reduxjs/toolkit';
import type { Subtree } from '@/doc/clone';
import { emptyDoc, type Id, type PortRef, type ProjectDoc, type Vec2 } from '@/doc/types';
import * as ops from '@/graph/ops';

const HISTORY_LIMIT = 100;

export interface DocState {
  present: ProjectDoc;
  past: ProjectDoc[];
  future: ProjectDoc[];
  /** Increases on every change to `present` (used to match engine results to documents). */
  version: number;
  gestureBase: ProjectDoc | null;
  /** Last edit that was rejected, for a toast (e.g. "Both nodes must be in the same group"). */
  rejected: string | null;
}

const initialState: DocState = {
  present: emptyDoc(),
  past: [],
  future: [],
  version: 1,
  gestureBase: null,
  rejected: null,
};

/** Record history (unless a gesture is open), then apply `edit` to the draft document. */
function edit(state: DocState, apply: (doc: ProjectDoc) => string | null | void) {
  const before = original(state.present) as ProjectDoc;
  const problem = apply(state.present);
  if (typeof problem === 'string') {
    state.rejected = problem;
    return;
  }
  state.rejected = null;
  if (!state.gestureBase) {
    state.past.push(before);
    if (state.past.length > HISTORY_LIMIT) state.past.shift();
    state.future = [];
  }
  state.version++;
}

const docSlice = createSlice({
  name: 'doc',
  initialState,
  reducers: {
    replaceDoc(state, a: PayloadAction<{ doc: ProjectDoc; keepHistory?: boolean }>) {
      if (a.payload.keepHistory) {
        state.past.push(original(state.present) as ProjectDoc);
        if (state.past.length > HISTORY_LIMIT) state.past.shift();
      } else {
        state.past = [];
      }
      state.future = [];
      state.present = a.payload.doc;
      state.gestureBase = null;
      state.version++;
    },
    undo(state) {
      const prev = state.past.pop();
      if (!prev) return;
      state.future.push(original(state.present) as ProjectDoc);
      state.present = prev;
      state.version++;
    },
    redo(state) {
      const next = state.future.pop();
      if (!next) return;
      state.past.push(original(state.present) as ProjectDoc);
      state.present = next;
      state.version++;
    },
    beginGesture(state) {
      if (!state.gestureBase) state.gestureBase = original(state.present) as ProjectDoc;
    },
    endGesture(state) {
      const base = state.gestureBase;
      state.gestureBase = null;
      if (base && base !== (original(state.present) as ProjectDoc)) {
        state.past.push(base);
        if (state.past.length > HISTORY_LIMIT) state.past.shift();
        state.future = [];
      }
    },
    clearRejected(state) {
      state.rejected = null;
    },
    addNode(state, a: PayloadAction<Parameters<typeof ops.addNode>[1]>) {
      edit(state, (d) => ops.addNode(d, a.payload));
    },
    addSubtree(state, a: PayloadAction<Subtree>) {
      edit(state, (d) => ops.addSubtree(d, a.payload));
    },
    removeNodes(state, a: PayloadAction<Id[]>) {
      edit(state, (d) => ops.removeNodes(d, a.payload));
    },
    moveNodes(state, a: PayloadAction<{ id: Id; pos: Vec2 }[]>) {
      edit(state, (d) => ops.moveNodes(d, a.payload));
    },
    connect(state, a: PayloadAction<{ id: Id; from: PortRef; to: PortRef; kind?: 'feedback' }>) {
      edit(state, (d) => ops.connect(d, a.payload));
    },
    disconnect(state, a: PayloadAction<Id[]>) {
      edit(state, (d) => ops.disconnect(d, a.payload));
    },
    removeSelection(state, a: PayloadAction<{ nodes: Id[]; edges: Id[] }>) {
      edit(state, (d) => {
        ops.disconnect(d, a.payload.edges);
        ops.removeNodes(d, a.payload.nodes);
      });
    },
    setParams(state, a: PayloadAction<{ id: Id; patch: Record<string, unknown> }>) {
      edit(state, (d) => ops.setParams(d, a.payload.id, a.payload.patch));
    },
    setLabel(state, a: PayloadAction<{ id: Id; label: string }>) {
      edit(state, (d) => ops.setLabel(d, a.payload.id, a.payload.label));
    },
    setNote(state, a: PayloadAction<{ id: Id; note: string }>) {
      edit(state, (d) => ops.setNote(d, a.payload.id, a.payload.note));
    },
    group(state, a: PayloadAction<{ ids: Id[]; groupId: Id; label?: string }>) {
      edit(state, (d) => ops.groupNodes(d, a.payload.ids, a.payload.groupId, a.payload.label));
    },
    ungroup(state, a: PayloadAction<Id>) {
      edit(state, (d) => ops.ungroup(d, a.payload));
    },
    replaceGroupContents(state, a: PayloadAction<{ id: Id; sub: Subtree }>) {
      edit(state, (d) => ops.replaceGroupContents(d, a.payload.id, a.payload.sub));
    },
    setTraining(state, a: PayloadAction<Partial<ProjectDoc['training']>>) {
      edit(state, (d) => ops.setTraining(d, a.payload));
    },
    setDescription(state, a: PayloadAction<string>) {
      edit(state, (d) => ops.setDescription(d, a.payload));
    },
    setDirection(state, a: PayloadAction<ProjectDoc['layout']['direction']>) {
      edit(state, (d) => ops.setDirection(d, a.payload));
    },
    setTrainedValues(state, a: PayloadAction<Record<Id, { shape: number[]; data: number[] }>>) {
      edit(state, (d) => {
        for (const [id, value] of Object.entries(a.payload)) {
          if (d.nodes[id]?.type === 'parameter') d.nodes[id].params.value = value;
        }
      });
    },
  },
});

export const docActions = docSlice.actions;
export default docSlice.reducer;
