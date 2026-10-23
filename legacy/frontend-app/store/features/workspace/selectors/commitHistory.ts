import { Id, Pos } from "@/app/types/common"
import { Branch, Branches, Commit } from '@/app/types/main'
import { WorkspaceState } from "../workspaceTypes"
import { selectCurrentProject, selectProjectById } from "./project"






// Selector for retrieving the commit ID map of the current graph object
export const selectCommitIdMap = ( state: Readonly<WorkspaceState>) => {
    const currentProject = selectCurrentProject(state)
    if (!currentProject) return undefined
    return currentProject.commits
}

// Selector for retrieving the branches of the current graph object
export const selectBranches = ( state: Readonly<WorkspaceState>): undefined | Branches => {
    const currentProject = selectCurrentProject(state)
    if (!currentProject) return undefined
    return currentProject.branches
}





// Selector for retrieving a branch by its name
export const selectBranchFromName = ( state: Readonly<WorkspaceState>, name: string, graphProjectId?: Id): Branch | undefined => {
    const graphProject = graphProjectId ? selectProjectById(state, graphProjectId) : selectCurrentProject(state)
    if (!graphProject) return undefined
    const branches = graphProject.branches
    if (!branches) return undefined
    const branchId = Object.keys(branches).find(id => branches[id].name === name)
    return branchId ? branches[branchId] : undefined
}


// Selector for retrieving the current branch based on the current branch name
export const selectCurrentBranch = ( state: Readonly<WorkspaceState>): Branch | undefined  => {
    const name = state.currentBranchName
    return selectBranchFromName(state, name)
}
export const selectCurrentBranchId = ( state: Readonly<WorkspaceState>): Id | undefined  => {
    const name = state.currentBranchName
    const currentProject = selectCurrentProject(state)
    if (!currentProject?.branches) return undefined
    return Object.keys(currentProject.branches).find(id => currentProject.branches[id].name === name)
}


// Selector for retrieving a commit by its ID
export const selectCommitById = ( state: Readonly<WorkspaceState>, id: Id): Commit | undefined => {
    const commitIdMap = selectCommitIdMap(state)
    if (!commitIdMap) return undefined
    return commitIdMap[id]
}

