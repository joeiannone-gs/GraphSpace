import { configureStore, createListenerMiddleware } from '@reduxjs/toolkit'
import serverReducer from './features/server/serverSlice'
import workspace from './features/workspace/workspaceSlice'
import panels from './features/panels/panelsSlice'
import { enableMapSet } from 'immer';

enableMapSet()

const listenerMiddleware = createListenerMiddleware()

const store = configureStore({
    reducer: {
      server: serverReducer.reducer,
      workspace: workspace.reducer,
      panels: panels.reducer
    },
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
        serializableCheck: false,
        immutableCheck: false,
      }).prepend(listenerMiddleware.middleware)
  })


export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export default store