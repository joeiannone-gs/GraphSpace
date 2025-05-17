import { PayloadAction } from '@reduxjs/toolkit';

//Types
import { Id, Pos } from "@/app/types/common"
import { WorkspaceState } from '../workspaceTypes';


//Menus
const updateSelectionMenu = (state : WorkspaceState, action: PayloadAction<Pos | null>) => {
    state.selectionMenu = action.payload
}
const updateRightClickMenu =  (state : WorkspaceState, action: PayloadAction<Pos | null>) => {
    state.rightClickMenu = action.payload
}
//Clipboard
const updateClipboard =  (state : WorkspaceState, action: PayloadAction<{ nodeIds: Id[], edgeIds: Id[] }>) => {

    const { nodeIds, edgeIds } = action.payload

    state.clipboard.nodeIds = nodeIds
    state.clipboard.edgeIds = edgeIds
}
const clearClipboard = (state : WorkspaceState, action: PayloadAction<{}>) => {

    state.clipboard = { nodeIds: [], edgeIds: []}

}


//Tabs
const openTab = (state : WorkspaceState, action: PayloadAction<{ projectId: Id}>) => {
    const { projectId } = action.payload
    state.openTabs.add(projectId)
}

const closeTab = (state : WorkspaceState, action: PayloadAction<{ projectId: Id}>) => {
    const { projectId } = action.payload
    state.openTabs.delete(projectId)
}

//MultiConnect
const updateMultiConnect =  (state : WorkspaceState, action: PayloadAction<{ nodeIds: Id[]}>) => {
    const { nodeIds } = action.payload

    state.multiConnect = nodeIds
}
const clearMultiConnect = (state : WorkspaceState, action: PayloadAction<{}>) => {
    state.multiConnect = []
}




export default {
    updateSelectionMenu,
    updateRightClickMenu,
    updateClipboard,
    clearClipboard,
    openTab, 
    closeTab,
    updateMultiConnect, 
    clearMultiConnect
}