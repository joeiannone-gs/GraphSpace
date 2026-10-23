import { PayloadAction } from '@reduxjs/toolkit';

import { Id, } from "@/app/types/common"
import { getBackwardDeltasTemplate, getForwarddDeltasTemplate } from '@/app/templates';
import { WorkspaceState } from '../../../workspaceTypes';
import { selectBranchFromName, selectCommitById, selectCurrentBranch } from '../../../selectors/commitHistory';
import { BackwardDeltas, ForwardDeltas } from '@/app/types/main';
import _ from 'lodash';















 const updateBranchName = (state: WorkspaceState, action: PayloadAction<{currentName: string, newName: string}>) => {
    const { currentName, newName} = action.payload
    const branch = selectBranchFromName(state, currentName)
    if (branch) branch.name = newName
  }
 
   const resetDeltasForBranch = (state: WorkspaceState, action: PayloadAction<{name: string, deltaType: 'backwardDeltas' | 'forwardDeltas'}>) => {
    const { name, deltaType } = action.payload
    const branch = selectBranchFromName(state, name)
    if (!branch) {
       console.error('Cannot reset deltas for branch: ' + name)
       return
    }
    if (deltaType === 'backwardDeltas') {
       branch.backwardDeltas = getBackwardDeltasTemplate()
    } else if (deltaType === 'forwardDeltas') {
       branch.forwardDeltas = getForwarddDeltasTemplate()
    }
  }
 
   const updateBranchlatestCommitId = (state: WorkspaceState, action: PayloadAction<{name: string, commitId: Id}>) => {
    const { name, commitId } = action.payload
    const branch = selectBranchFromName(state, name)
    if (branch) branch.latestCommitId = commitId
  }
 
  const setDeltasForCommit = (state: WorkspaceState, action: PayloadAction<{commitId: Id, deltas: BackwardDeltas}>) => {
   const { commitId, deltas} = action.payload
   const commit = selectCommitById(state, commitId)
   if (commit) commit.backwardDeltas = deltas
  }


  const setBackwardDeltas = (
   state: WorkspaceState,
   action: PayloadAction<{ backwardDeltas: BackwardDeltas }>
 ) => {
   const branch = selectCurrentBranch(state);
   if (!branch) return;
   
   branch.backwardDeltas = _.merge(getBackwardDeltasTemplate(), _.cloneDeep(action.payload.backwardDeltas));
 };

 
 export default {
    updateBranchName,
    updateBranchlatestCommitId,
    resetDeltasForBranch,
    setDeltasForCommit,
    setBackwardDeltas
}
 
 