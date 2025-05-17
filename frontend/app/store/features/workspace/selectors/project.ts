import { Id, Pos } from "@/app/types/common"
import { Graph, Project } from '@/app/types/main'
import { createSelector } from "@reduxjs/toolkit"
import { WorkspaceState } from "../workspaceTypes"






export const selectAllGraphProjects = (state: Readonly<WorkspaceState>): Project[] => {
    return state.graphProjects
}

export const selectAllAbsProjects = (state: Readonly<WorkspaceState>): Project[] => {
    return state.absProjects
}



export const selectProjectById = createSelector(
    [selectAllGraphProjects, selectAllAbsProjects, (_: WorkspaceState, id: Id | null) => id],
    (allGraphProjects, allAbsProject, id): Project | undefined => {
      const graphProject = allGraphProjects?.find((project: Project) => project.id === id);
      if (graphProject) return graphProject;
      return allAbsProject?.find((abs: Project) => abs.id === id);
    }
  );

// Selector for retrieving the current graph object based on the currentGraphOrAbs ID
export const selectCurrentProject = ( state: Readonly<WorkspaceState>): Project | undefined => {
    const currentId = state.currentProjectId
    return selectProjectById(state, currentId)
}


export const selectCurrentGraphId = createSelector(
    [
        selectCurrentProject,
        (state) => state.currentBranchName
    ], 
    (currentProject, currentBranchName) => {
        if (!currentProject || Object.keys(currentProject.branches).length === 0) return undefined;
        const targetBranchId = Object.keys(currentProject.branches).find(branchId => currentProject.branches[branchId].name === currentBranchName);
        return targetBranchId //branchIds are the same as their associated graphIds
})


export const selectCurrentGraphIdForProject = createSelector(
    [
        selectProjectById,
        (_: WorkspaceState, projectId: Id) => projectId
    ],
    (project) => {
        if (!project || Object.keys(project.branches).length === 0) return undefined;
        const targetBranchId = Object.keys(project.branches).find(branchId => project.branches[branchId].name === "main");
        if (!targetBranchId) return undefined;
        return targetBranchId
    }
);





