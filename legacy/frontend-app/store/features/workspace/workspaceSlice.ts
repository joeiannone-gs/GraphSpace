import { createSlice } from '@reduxjs/toolkit'

//* Reducers
import projectReducers from './reducers/project/project'
import selectionReducers from './reducers/selectionReducers'
import viewportReducers from './reducers/viewportReducers'
import toolsReducers from './reducers/toolsReducers'

//Types
import { WorkspaceState } from './workspaceTypes'








export const initialState: WorkspaceState = {
   //* Selection
   currentProjectId: null,
   currentSelectedItem: {type: 'project', id: null},
   currentBrushSelection: [],
   currentBranchName: "main",
   dragTarget: {type: null, id: null},
   thumbnailBeingDragged: null,

   //* Viewport
   windowSize: {width: 0, height: 0},
   //* Tools
   selectionMenu: null,
   rightClickMenu: null,
   clipboard: { nodeIds: [], edgeIds: []},
   multiConnect: [],
   openTabs: new Set(),
   //* Other
   graphProjects: [],
   absProjects: [],
   explanation: {heading: null, text: null},
   
}

export const workspaceSlice = createSlice({
    name: "workspace",
    initialState,
    reducers: { 
      ...projectReducers, 
      ...selectionReducers, 
      ...viewportReducers, 
      ...toolsReducers 
   }
})



//Export actions
export const {
   //*Selection
   updateExplanation,
   updateCurrentProjectId,
   updateCurrentSelectedItem,
   updateDragTarget,
   updateCurrentBranchName,
   resetSelection,

   //*Commit History
   // Create
   createCommit,
   createAddDeltas,
   createDeleteDeltas,
   createUpdateDeltas,
   createTempBranch,
   addIdToCommitNext,
   // Update
   updateBranchName,
   updateBranchlatestCommitId,
   setDeltasForCommit,
   setBackwardDeltas,
   // Delete
   deleteBranch,
   resetDeltasForBranch,

   //*Graph Obj
   // Create
   createAbsProject,
   createGraphProject,

   // Delete
   deleteAbsProject,
   deleteGraphProject,

   //* Tools
   updateSelectionMenu,
   updateRightClickMenu,
   updateClipboard,
   clearClipboard,
   closeTab, 
   openTab,
   updateMultiConnect, 
   clearMultiConnect
} = workspaceSlice.actions



export default workspaceSlice