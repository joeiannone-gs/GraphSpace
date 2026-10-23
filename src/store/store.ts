import { configureStore } from '@reduxjs/toolkit';
import { useDispatch, useSelector, useStore } from 'react-redux';
import doc from './docSlice';
import engine from './engineSlice';
import ui from './uiSlice';

export function makeStore() {
  return configureStore({
    reducer: { doc, ui, engine },
    middleware: (getDefault) =>
      getDefault({
        // Documents can be large (trained weights); the default checks walk every value on every action.
        immutableCheck: { warnAfter: 200 },
        serializableCheck: { warnAfter: 200 },
      }),
  });
}

export type AppStore = ReturnType<typeof makeStore>;
export type RootState = ReturnType<AppStore['getState']>;
export type AppDispatch = AppStore['dispatch'];

export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<RootState>();
export const useAppStore = useStore.withTypes<AppStore>();
