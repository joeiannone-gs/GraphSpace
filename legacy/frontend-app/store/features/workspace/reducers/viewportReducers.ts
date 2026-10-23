
import { PayloadAction } from '@reduxjs/toolkit';

//Types
import { WorkspaceState } from '../workspaceTypes';



export const updateWindowSize = (state: WorkspaceState, action: PayloadAction<{width: number, height: number}>) => {
    state.windowSize = action.payload;
}

export default { 
    updateWindowSize
}

