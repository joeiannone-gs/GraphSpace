import { PayloadAction } from '@reduxjs/toolkit';

//Types
import { Edge, UpdatableProperty, Node, } from '@/app/types/main';
import { Id, } from "@/app/types/common"
import { Branch, Commit } from '@/app/types/main';
import { WorkspaceState } from '../../../workspaceTypes';
import { selectCurrentBranch } from '../../../selectors/commitHistory';
import { selectCurrentProject } from '../../../selectors/project';
import { EXCLUDE_FROM_DELTAS } from '@/app/nodes/dataFlow';



export const createUpdateDeltas = (state: WorkspaceState, action: PayloadAction<{ 
      graphProperty: UpdatableProperty, 
      values: {
         id: Id | undefined,
         property: keyof Node | keyof Edge| undefined,
         newValue: Node[keyof Node] | Edge[keyof Edge] | string,
         oldValue: Node[keyof Node] | Edge[keyof Edge] | string
      }[]
   }>) => {
   const { graphProperty, values} = action.payload
   const branch = selectCurrentBranch(state)
   if (!branch) return
   const forwardDeltas = branch.forwardDeltas // For updating the graph on the server
   const backwardDeltas = branch.backwardDeltas // For keeping track of changes for when a commit is made

   for (let val of values) {
      if (val.id && val.property) {
         const validGraphProp = graphProperty as "nodeIdMap" | "edgeIdMap"
         const fMap = forwardDeltas.update[validGraphProp]
         fMap[val.id] = { ...fMap[val.id], [val.property]: val.newValue } 
         const bMap = backwardDeltas.update[validGraphProp]
         if (!bMap[val.id]) { 
            bMap[val.id] = { ...bMap[val.id], [val.property]: val.oldValue ?? 'N/A' }
         }
      } else {
         const validGraphProp = graphProperty as "name" | "description"
         forwardDeltas.update[validGraphProp] = val.newValue as string
         if (!backwardDeltas.update[validGraphProp]) { 
            backwardDeltas.update[validGraphProp] = val.oldValue as string ?? 'N/A'
         }
      }
   }
}

export const createAddDeltas = (state: WorkspaceState, action: PayloadAction<{
   graphProperty: "nodeIdMap" | "edgeIdMap",
   newIds: Id[],
   newObjs: Node[] | Edge[]
}>) => {
   const { graphProperty, newIds, newObjs } = action.payload
   const branch = selectCurrentBranch(state)
   if (!branch) return
   const forwardDeltas = branch.forwardDeltas // For updating the graph on the server
   const backwardDeltas = branch.backwardDeltas // For keeping track of changes for when a commit is made

   for (let i = 0; i < newIds.length; i++) {
      const id = newIds[i]
      const obj = filterExcludedProperties(newObjs[i])
      forwardDeltas.add[graphProperty][id] = obj
      backwardDeltas.add[graphProperty].push(id);
   }

}

export const createDeleteDeltas = (state: WorkspaceState, action: PayloadAction<{
   graphProperty:  "nodeIdMap" | "edgeIdMap", 
   ids: Id[],
   oldObjs: Node[] | Edge[]
}>) => {
   const { graphProperty, ids, oldObjs } = action.payload
   const branch = selectCurrentBranch(state)
   if (!branch) return
   const forwardDeltas = branch.forwardDeltas // For updating the graph on the server
   const backwardDeltas = branch.backwardDeltas // For keeping track of changes for when a commit is made

   for (let i = 0; i < ids.length; i++) {
      const id = ids[i]
      const obj = oldObjs[i]

      //if already in add, remove from add, otherwise create delete enty.
      if (forwardDeltas.add[graphProperty][id]) {
         delete forwardDeltas.add[graphProperty][id]
      } else {
         forwardDeltas.delete[graphProperty].push(id);
      }
      if (backwardDeltas.add[graphProperty].includes(id)) {
         backwardDeltas.add[graphProperty] = backwardDeltas.add[graphProperty].filter(item => item !== id)
      } else if (obj) {
         backwardDeltas.delete[graphProperty][id] = filterExcludedProperties(obj)
      }
   }
}  






 const createTempBranch = (state: WorkspaceState, action: PayloadAction< {newBranch: Branch, id: Id} >) => {
    const { newBranch, id } = action.payload

    const project = selectCurrentProject(state)
    if (project) {

       const branches = project["branches"]
       
       branches[id] = newBranch
       const branchedOffOf = project.commits[newBranch.latestCommitId!].branchName
       const branchId = Object.keys(branches).find(id => branches[id].name === branchedOffOf) ?? ""
       
       const branchIndex = project.branchOrder.indexOf(branchId)
       if (branchIndex !== -1) {
           project.branchOrder.splice(branchIndex + 1, 0, id)
       } else {
           project.branchOrder.push(id)
       }
   }
 }


 const createCommit = (state: WorkspaceState, action: PayloadAction<{ newId: Id, newCommit: Commit }>) => {
    const { newId, newCommit } = action.payload
    const project = selectCurrentProject(state)
    // Creating a shallow copy of commitIdMap to trigger re-render of CommitGraph
    if (project) {

       const commits = { ...project.commits }
       commits[newId] = newCommit
       project.commits = commits
       //Update latest commit id
       const branch = selectCurrentBranch(state)
       if (branch) branch.latestCommitId = newId
      }
}

 const addIdToCommitNext = (state: WorkspaceState, action: PayloadAction<{commitId: Id, nextCommitId: Id}>) => {
    const {commitId, nextCommitId} = action.payload

    const project = selectCurrentProject(state)
    if (project) {

       const commitIdMap = project.commits
       const commit = commitIdMap[commitId]
       if (!commit.nextCommitIds) {
         commit.nextCommitIds = []
       }
       commit.nextCommitIds.push(nextCommitId)
      }
}
 



/* Helpers */



function stringifyIfNecessary(value: any) {
   if (typeof value !== 'string') {
      return JSON.stringify(value)
   }
   return value
}

function filterExcludedProperties(obj: any) {
   if (typeof obj !== 'object') return obj
   return Object.fromEntries(Object.entries(obj).filter(([key]) => !EXCLUDE_FROM_DELTAS.includes(key))) 
}
 
 export default {
   createUpdateDeltas,
   createAddDeltas,
   createDeleteDeltas,
    createCommit,
    createTempBranch,
    addIdToCommitNext,
    
}