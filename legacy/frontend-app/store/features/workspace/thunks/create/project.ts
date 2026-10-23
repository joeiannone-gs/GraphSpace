import { generateId } from '@/app/services/math'
import workspaceSlice from "../../workspaceSlice"
import { createGraphClone, getTimeStampString } from "../../helpers"

//Types
import { EdgeIdMap, Graph, NodeIdMap } from '@/app/types/main'
import { NodeTypeEnum } from '@/app/proto/compiled'
import { Id, Pos } from "@/app/types/common"
import _ from "lodash"
import store, { AppDispatch, RootState } from "@/app/store/store"
import { BackwardDeltas } from '@/app/types/main'
import {  getAbsNodeTemplate, getBranchTemplate, getCommitTemplate, getGraphTemplate, getProjectTemplate } from "@/app/templates"
import { scaleAndCenterChildren, updateAbstractionNodePosition } from "../update/nodes"
import { getDescendants, getEdgesConnectingNodes } from '@/app/services/graphTheory'
import {  selectCurrentProject } from '../../selectors/project'
import { metadataToPb } from '@/app/proto/helpers'
import { emitCreateBranch, emitCreateCommit, emitCreateProject } from '@/app/server/routes/projects'
import { graphController, graphs } from '@/app/globalObjs'
import { AddEdgesCommand, AddNodesCommand } from '@/app/components/Workspace/commands'
import { getCurrentGraph } from '@/app/components/Workspace/graphGetters'












/**
 * Create a temporary branch
 */
export const createTempBranch = (latestCommitId: Id) => {
    return (dispatch: AppDispatch, getState: () => RootState) => {
        //Get redux state
        const state = getState()
        const project = selectCurrentProject(state.workspace)
        if ( !project) return
        
        //Make new branch

        //Create a clone of the commit's graph and set this branch's currentSave as that clone
        const graph = graphs[latestCommitId]
        
        const clonedGraph = _.cloneDeep(graph)
        
        const newBranch = getBranchTemplate()
        newBranch.name = 'temp'
        newBranch.latestCommitId = latestCommitId
        newBranch.projectId = project.id
        const branchId = generateId(8)
        
        //Add graph to project graphs
        // dispatch(workspaceSlice.actions.addGraphToProjectGraphs( {projectId: project.id, pointer: branchId, graphObj: clonedGraph }))
        graphs[branchId] = clonedGraph
        delete clonedGraph.container
        delete clonedGraph.thumbnailContainer
        delete clonedGraph.commitContainer


        //Add branch to current graph branches
        dispatch(workspaceSlice.actions.createTempBranch( {newBranch, id: branchId } ))

        //Send to server
        emitCreateBranch(project.id, branchId, newBranch, clonedGraph)
    }
}


/**
 * Create a commit
 */
export const createCommit = (message: string, branchName: string, previousId: Id, deltas: BackwardDeltas, commitId: Id) => {
    return (dispatch: AppDispatch, getState: () => RootState) => {

        const state = getState()
        const project = selectCurrentProject(state.workspace)
        if (!project) return

        //Make commit object
        const timeStamp = getTimeStampString()
        const newCommit = getCommitTemplate()

        newCommit.message = message
        newCommit.timestamp = timeStamp
        newCommit.branchName = branchName
            
        newCommit.prevCommitId = previousId
        newCommit.backwardDeltas = deltas


        
        //Clone current save and add to
        const currentGraph = getCurrentGraph()
        const clonedGraph = _.cloneDeep(currentGraph)
        const projectId = state.workspace.currentProjectId ?? ""
        // dispatch(addGraphToProjectGraphs({ projectId, pointer: commitId, graphObj: clonedGraph }))
        graphs[commitId] = clonedGraph
        delete clonedGraph.container
        delete clonedGraph.thumbnailContainer
        delete clonedGraph.commitContainer

        //Add the commit to current project commits and make latest commit of branch
        dispatch(workspaceSlice.actions.createCommit({newId: commitId, newCommit}))

        //Send to server
        const branchId = Object.keys(project.branches).find(id => project.branches[id]["name"] == branchName);
        emitCreateCommit(projectId, branchId, commitId, newCommit, deltas)
    }
}


/**
 * Create a new graph for the user
 */
export const createGraphProject = () => {
    return (dispatch: AppDispatch, getState: () => RootState) => {
        const { newId, project } = createProject(false)

        //Set as current selected graphOrAbs
        dispatch(workspaceSlice.actions.updateCurrentProjectId( { id: newId }))
        //Add the graph to the graphProjects in state
        dispatch(workspaceSlice.actions.createGraphProject({ project}))
        //Create
        emitCreateProject(project)
        //Update selection
        dispatch(workspaceSlice.actions.updateCurrentProjectId({id: newId}))
        dispatch(workspaceSlice.actions.openTab({projectId: newId}))
    }
}


/**
 * Create a new graph for the user
 */
export const createAbsProject = () => {
    return (dispatch: AppDispatch, getState: () => RootState) => {
        const { newId, project } = createProject(true)

        
        //Set as current selected graphOrAbs
        dispatch(workspaceSlice.actions.updateCurrentProjectId( { id: newId }))
        //Add the abstraction node to the absProject in state
        dispatch(workspaceSlice.actions.createAbsProject({ project }))
        //Create 
        emitCreateProject(project)
    }
}


/**
 * Merges the currentSave (of main) of an abs node project
 *  into the currentSave of a project branch (given branch index)
 */
export const mergeAbsNodeProjectIntoGraphProject = (graph: Graph, absNodeProjectId: Id, pos: Pos ) => {
    //Get abs node project currentsave
    const absNodeGraph = getCurrentGraph(absNodeProjectId)
    if (!absNodeGraph) return

    //Change ids to be unique
    const {nodeIdMap, edgeIdMap} = createGraphClone(absNodeGraph).graphClone
    
    //Create new abs node 
    const newAbsNodeId = generateId(8)
    const children = Object.keys(nodeIdMap).filter(id => !nodeIdMap[id].parent)

    const newAbsNode = getAbsNodeTemplate()
    newAbsNode.position = pos
    newAbsNode.type = NodeTypeEnum.ABS
    newAbsNode.metadata = metadataToPb(["normal"], ["purpose"])
    newAbsNode.name = absNodeGraph.name
    newAbsNode.explanation = absNodeGraph?.description
    newAbsNode.children = children

    //Set abs node as parent for all nodeIdMap
    children.forEach((id: Id) => {
        nodeIdMap[id].parent = newAbsNodeId
    }) 

    //Set in nodeIdMap
    nodeIdMap[newAbsNodeId] = newAbsNode

    //Add new nodes in state
    graphController.addCommand(new AddNodesCommand([...Object.keys(nodeIdMap)], [...Object.values(nodeIdMap)] ))
    //Add new edges in state
    graphController.addCommand(new AddEdgesCommand( [...Object.keys(edgeIdMap)], [...Object.values(edgeIdMap)] ))
    //Scale and center everything
    scaleAndCenterChildren(graph, newAbsNodeId)
    updateAbstractionNodePosition(graph, newAbsNodeId, pos)

    
}


//Paste from clipboard
export const pasteFromClipboard = (position: Pos) => {

    const state = store.getState()

    const currentSave = getCurrentGraph()

    if (!currentSave) return 
        
    const clipboard = state.workspace.clipboard
    const nodeIds =  new Set([...clipboard.nodeIds])
    const topLevelNodes = new Set([...clipboard.nodeIds])
    const edgeIds =  new Set([...clipboard.edgeIds])
    
    // Add in abstraction node descendants
    const topLevelAbsNodes = new Set<Id>()
    const nodeQueue = [...nodeIds]
    while (nodeQueue.length > 0) {
        const id = nodeQueue.pop()

        if (!id) continue

        const node = currentSave.nodeIdMap[id]
        if (node.children && node.children.length > 0) {
            topLevelAbsNodes.add(id)
            const descendants = getDescendants(id, currentSave.nodeIdMap)
            descendants.forEach(descendant => {
                nodeIds.add(descendant) 
            })
        }

    }

    // Get Edges of descendants and add them in
    const allEdges = Object.keys(currentSave.edgeIdMap)
    const edgesToAdd = getEdgesConnectingNodes(allEdges, nodeIds, currentSave.edgeIdMap)
    edgesToAdd.forEach(edgeId => edgeIds.add(edgeId))

    // Create clone of nodes and edges

    const clipboardNodeIdMap = Array.from(nodeIds).reduce((acc, nodeId) => {
        acc[nodeId] = {
            ...currentSave.nodeIdMap[nodeId],
            //Remove edge references that are not included in edgeIds
            incomingEdges: (currentSave.nodeIdMap[nodeId].incomingEdges || []).filter(edgeId => edgeIds.has(edgeId)),
            outgoingEdges: (currentSave.nodeIdMap[nodeId].outgoingEdges || []).filter(edgeId => edgeIds.has(edgeId))
        }
        return acc
    }, {} as NodeIdMap)

    const clipboardEdgeIdMap = Array.from(edgeIds).reduce((acc, edgeId) => {
        acc[edgeId] = currentSave.edgeIdMap[edgeId]
        return acc
    }, {} as EdgeIdMap)


    const { graphClone, oldToNewNodeIds, oldToNewEdgeIds} = createGraphClone({nodeIdMap: clipboardNodeIdMap, edgeIdMap: clipboardEdgeIdMap})


    // Edit Positions (only of top level nodes)

    //Get Top left corner (imagine a rectangle that perfectly contains the nodes) of original nodes
    let minX = Infinity;
    let minY = Infinity;
    Array.from(topLevelNodes).forEach(nodeId => {
        const cloneId = oldToNewNodeIds[nodeId]
        const node = graphClone.nodeIdMap[cloneId]
        if (node.position[0] < minX) {
            minX = node.position[0];
        }
        if (node.position[1] < minY) {
            minY = node.position[1];
        }
    });

    const topLeftCorner = [minX, minY]

    //Calculate difference between top left corner and pointer position
    const offsetX = position[0] - topLeftCorner[0];
    const offsetY = position[1] - topLeftCorner[1];

    // Update positions of cloned nodes (only top leve nodes)
    Array.from(topLevelNodes).forEach(nodeId => {
        const cloneId = oldToNewNodeIds[nodeId]
        const node = graphClone.nodeIdMap[cloneId]
        node.position[0] += offsetX;
        node.position[1] += offsetY;
    });

    //Update positions of cloned edges (start and end positions)
    // Object.values(graphClone.edgeIdMap).forEach(edge => {
    //     edge.startPos[0] += offsetX;
    //     edge.startPos[1] += offsetY;
    //     edge.endPos[0] += offsetX;
    //     edge.endPos[1] += offsetY;
    // });

    //Add new nodes in state
    // dispatch(addNodes({newIds: [...Object.keys(graphClone.nodeIdMap)], newNodes: [...Object.values(graphClone.nodeIdMap)]}))
    graphController.addCommand(new AddNodesCommand( [...Object.keys(graphClone.nodeIdMap)], [...Object.values(graphClone.nodeIdMap)]))
    //Add new edges in state
    // dispatch(addEdges({newIds: [...Object.keys(graphClone.edgeIdMap)], newEdges: [...Object.values(graphClone.edgeIdMap)]}))
    graphController.addCommand(new AddEdgesCommand([...Object.keys(graphClone.edgeIdMap)], [...Object.values(graphClone.edgeIdMap)] ))

    // scale and center children of abstraction nodes
    Array.from(topLevelAbsNodes).forEach((nodeId) => {
        const cloneId = oldToNewNodeIds[nodeId]
        scaleAndCenterChildren(graphClone, cloneId)
    })

}



//* Helpers 

function createProject(isAbsNode:boolean) {

    const newId = generateId(8)
    const branchId = generateId(8)

    //Make new graph object
    const project = getProjectTemplate()
    //New Project Id
    project.id = newId
    project.isAbsNode = isAbsNode
    //Current graph
    graphs[branchId] = getGraphTemplate()
    //Main branch
    const mainBranch = getBranchTemplate()
    mainBranch.projectId = newId
    mainBranch.name = 'main'
    project.branches[branchId] = mainBranch

    project.branchOrder = [branchId]
    return { newId, project }
}