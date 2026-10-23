import workspaceSlice, {  updateCurrentProjectId } from "../../workspaceSlice"

import _ from "lodash"

//Types
import { Id, Pos } from "@/app/types/common"
import { AppDispatch, RootState } from "@/app/store/store"
















/**
 * Delete user graph
 */
export const deleteGraphProject = (id: Id) => {
    return (dispatch: AppDispatch, getState: () => RootState) => {
        const state = getState()
        dispatch(workspaceSlice.actions.deleteGraphProject({ id }))
        updateCurrent(state, dispatch)
    }
}


/**
 * Delete user abstraction node
 */
export const deleteAbsProject = (id: Id) => {
    return (dispatch: AppDispatch, getState: () => RootState) => {
        const state = getState()
        dispatch(workspaceSlice.actions.deleteAbsProject({ id }))
        updateCurrent(state, dispatch)
    }
}


function updateCurrent(state: RootState, dispatch: AppDispatch) {
    const firstGraphId = state.workspace.graphProjects[0]?.id;
    const firstAbsId = state.workspace.absProjects[0]?.id;
    
    if (firstGraphId) {
        dispatch(workspaceSlice.actions.updateCurrentProjectId({ id: firstGraphId }));
    } else if (firstAbsId) {
        dispatch(workspaceSlice.actions.updateCurrentProjectId({ id: firstAbsId }));
    } else {
        dispatch(updateCurrentProjectId({ id: "" }));
    }
}