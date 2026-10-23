import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { Id } from '@/doc/types';

export type Theme = 'dark' | 'light';

export interface UiState {
  selectedNodes: Id[];
  selectedEdges: Id[];
  /** The group being edited (null = top level). */
  scope: Id | null;
  theme: Theme;
  showGradients: boolean;
  leftOpen: boolean;
  rightOpen: boolean;
  toast: string | null;
}

const initialState: UiState = {
  selectedNodes: [],
  selectedEdges: [],
  scope: null,
  theme: 'dark',
  showGradients: true,
  leftOpen: true,
  rightOpen: true,
  toast: null,
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    select(state, a: PayloadAction<{ nodes?: Id[]; edges?: Id[]; additive?: boolean }>) {
      const { nodes = [], edges = [], additive } = a.payload;
      if (additive) {
        const toggle = (list: Id[], ids: Id[]) => {
          const set = new Set(list);
          for (const id of ids) {
            if (set.has(id)) set.delete(id);
            else set.add(id);
          }
          return [...set];
        };
        state.selectedNodes = toggle(state.selectedNodes, nodes);
        state.selectedEdges = toggle(state.selectedEdges, edges);
      } else {
        state.selectedNodes = nodes;
        state.selectedEdges = edges;
      }
    },
    clearSelection(state) {
      state.selectedNodes = [];
      state.selectedEdges = [];
    },
    setScope(state, a: PayloadAction<Id | null>) {
      state.scope = a.payload;
      state.selectedNodes = [];
      state.selectedEdges = [];
    },
    setTheme(state, a: PayloadAction<Theme>) {
      state.theme = a.payload;
    },
    toggleGradients(state) {
      state.showGradients = !state.showGradients;
    },
    togglePanel(state, a: PayloadAction<'left' | 'right'>) {
      if (a.payload === 'left') state.leftOpen = !state.leftOpen;
      else state.rightOpen = !state.rightOpen;
    },
    showToast(state, a: PayloadAction<string | null>) {
      state.toast = a.payload;
    },
  },
});

export const uiActions = uiSlice.actions;
export default uiSlice.reducer;
