import { PayloadAction } from '@reduxjs/toolkit';

//Types
import { Graph, Project } from '@/app/types/main';
import { Id, Pos } from "@/app/types/common"
import { WorkspaceState } from "../../workspaceTypes";


import createCommitHistory from './commitHistory/create'
import deleteCommitHistory from './commitHistory/delete'
import updateCommitHistory from './commitHistory/update'








  const createAbsProject = (state: WorkspaceState, action: PayloadAction<{ project: Project }>) => {
    const { project } = action.payload
    state.absProjects.push(project)
 }

  const deleteAbsProject = (state: WorkspaceState, action: PayloadAction<{ id: Id }>) => {
    const {id } = action.payload
    state.absProjects = state.absProjects.filter(abs => abs.id !== id)
 }

  const createGraphProject = (state: WorkspaceState, action: PayloadAction<{ project: Project }>) => {
    const { project } = action.payload
    state.graphProjects.push(project)
}


  const deleteGraphProject = (state: WorkspaceState, action: PayloadAction<{ id: Id }>) => {
    const { id } = action.payload
    state.graphProjects = state.graphProjects.filter((graph: Project) => graph.id !== id)
 }


 export  default {
   createAbsProject,
   createGraphProject,
   deleteAbsProject,
   deleteGraphProject,
   ...createCommitHistory,
   ...updateCommitHistory,
   ...deleteCommitHistory
 }
