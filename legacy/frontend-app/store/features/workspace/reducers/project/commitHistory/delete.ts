import { PayloadAction } from '@reduxjs/toolkit';

import { WorkspaceState } from '../../../workspaceTypes';
import { selectCurrentProject } from '../../../selectors/project';
import { graphs } from '@/app/globalObjs';









const deleteBranch = (state: WorkspaceState, action: PayloadAction<{name: string}>) => {
    const { name } = action.payload
    const project = selectCurrentProject(state)
    if (project) {
        const branchId = Object.keys(project.branches).find(id => project.branches[id].name === name)    
        if (branchId) {

            const branch = project.branches[branchId]
            if (branch.latestCommitId && project.commits[branch.latestCommitId]?.branchName === branch.name) {
                delete project.commits[branch.latestCommitId]
            }

            delete project.branches[branchId]
            project.branchOrder = project.branchOrder.filter(id => id !== branchId)

        }
    }
 }

export default { deleteBranch }