import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { EngineState } from '@/worker/protocol';

export interface EngineSliceState {
  state: EngineState;
  step: number;
  notice: string | null;
  error: string | null;
}

const initialState: EngineSliceState = { state: 'idle', step: 0, notice: null, error: null };

const engineSlice = createSlice({
  name: 'engine',
  initialState,
  reducers: {
    status(state, a: PayloadAction<{ state: EngineState; step: number; notice?: string }>) {
      state.state = a.payload.state;
      state.step = a.payload.step;
      if (a.payload.notice !== undefined) state.notice = a.payload.notice;
      else if (a.payload.state === 'training') state.notice = null;
    },
    error(state, a: PayloadAction<string | null>) {
      state.error = a.payload;
    },
    dismissNotice(state) {
      state.notice = null;
    },
  },
});

export const engineActions = engineSlice.actions;
export default engineSlice.reducer;
