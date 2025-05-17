import { selectCurrentBranch, selectCurrentBranchId } from "@/app/store/features/workspace/selectors/commitHistory";
import { resetDeltasForBranch } from "@/app/store/features/workspace/workspaceSlice";
import store from "@/app/store/store";
import { Id } from "@/app/types/common";
import _ from "lodash";
import { Project } from "next/dist/build/swc";
import { sendAndHandle } from "../handle";
import { USER_ID } from '../constants';
import Root from "@/app/proto/compiled"
import { isDeltasEmpty } from "../helpers";
import { BackwardDeltas, Branch, Commit, Graph } from "@/app/types/main";









export function emitCreateProject(project: Project) {
    const projectCopy = _.cloneDeep(project) as any
    delete projectCopy["branchOrder"]
    delete projectCopy["graphs"]
    if (projectCopy.branches) {
      Object.values(projectCopy.branches).forEach(branch => {
        delete branch.backwardDeltas;
        delete branch.forwardDeltas;
      });
    } 
    projectCopy.ownerId = USER_ID
    
    const projectPB = Root.Project.create(projectCopy)
    const messageWrapper = Root.Wrapper.create()
    messageWrapper.projectPB = projectPB

    const messages = Root.MessageList.create()
    messages.list.push(messageWrapper)


    sendAndHandle("projects/create", "POST", [["user_id", USER_ID]],  messages )
}

export function emitProjectDelete(id: Id) {
    sendAndHandle("projects/delete", "POST", [["project_id", id]])
}

export function emitCreateCommit(projectId: Id, branchId: Id, commitId: Id, commit: Commit, deltas: BackwardDeltas) {


    const commitMessage = Root.Commit.create(commit)
    const backwardDeltasMessage = Root.BackwardDeltas.create(deltas)
    
    
    const messageWrapper1 = Root.Wrapper.create()
    messageWrapper1.commitPB = commitMessage

    const messageWrapper2 = Root.Wrapper.create()
    messageWrapper2.backwardDeltasPB = backwardDeltasMessage

    const messages = Root.MessageList.create()
    messages.list.push(messageWrapper1)
    messages.list.push(messageWrapper2)


    sendAndHandle(
        "projects/create-commit", 
        "POST", 
        [["user_id", USER_ID], ["project_id", projectId], ["branch_id", branchId], ["commit_id", commitId]],
        messages
    )
}

export function emitCreateBranch(projectId: Id, branchId: Id, branch: Branch, currentSave: Graph) {

    const branchMessage = Root.Branch.create(branch)
    const graphMessage = Root.Graph.create(currentSave)
    
    const messageWrapper1 = Root.Wrapper.create()
    messageWrapper1.branchPB = branchMessage
    
    const messageWrapper2 = Root.Wrapper.create()
    messageWrapper2.graphPB = graphMessage
    
    const messages = Root.MessageList.create()
    messages.list.push(messageWrapper1)
    messages.list.push(messageWrapper2)

    sendAndHandle(
        "projects/create-branch", 
        "POST", 
        [["user_id", USER_ID], ["project_id", projectId], ["branch_id", branchId]],
        messages
    )
}

export function emitDeleteBranch(projectId: Id, branchId: Id) {
    sendAndHandle(
        "projects/delete-branch", 
        "POST", 
        [["user_id", USER_ID], ["project_id", projectId], ["branch_id", branchId]]
    )
}

export function emitUpdateBranchName(projectId: Id, branchId: Id, newName: string) {
    sendAndHandle(
        "projects/update-branch-name", 
        "POST", 
        [ ["project_id", projectId], ["branch_id", branchId],  ['new_name', newName]]
    )
}


export function emitDeltas() {

    //Foreward deltas are used by the server to update its graph
    //Backward deltas are used by the client to calculate commit graphs.
    //Backward deltas are not modified in any way by the server. They are immediately saved to its file system.

    const state = store.getState()
    const dispatch = store.dispatch



    const branch = selectCurrentBranch(state.workspace)
    const branchId = selectCurrentBranchId(state.workspace)
    const forwardDeltas = branch?.forwardDeltas
    const backwardDeltas = branch?.backwardDeltas

    if (!branchId || !backwardDeltas || !forwardDeltas ||  isDeltasEmpty(forwardDeltas)) return
    const forwardDeltasMessage = Root.ForwardDeltas.create(forwardDeltas)
    const backwardDeltasMessage = Root.BackwardDeltas.create(backwardDeltas)

    const message1 = Root.Wrapper.create()
    message1.forwardDeltasPB = forwardDeltasMessage as Root.ForwardDeltas
    const message2 = Root.Wrapper.create()
    message2.backwardDeltasPB = backwardDeltasMessage as Root.BackwardDeltas

    const messages = Root.MessageList.create()
    messages.list.push(message1)
    messages.list.push(message2)

    
    sendAndHandle(
        "projects/graph-deltas", 
        "POST", 
        [["user_id", USER_ID], ["branch_id", branchId] ],
        messages
    ).then(() => {
        dispatch(resetDeltasForBranch({ name: branch.name, deltaType: 'forwardDeltas'}))
    })
}

