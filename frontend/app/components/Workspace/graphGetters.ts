import { accessoryState, graphs } from "@/app/globalObjs";
import { calculateEdgesWithinBrush, calculateNodesWithinBrush, isPointWithinCircle, screenToWorld } from "@/app/services/math";
import { NODE_RADIUS } from "@/app/sizing/nodes";
import { selectCurrentGraphId, selectCurrentGraphIdForProject, selectCurrentProject, selectProjectById } from "@/app/store/features/workspace/selectors/project";
import store from "@/app/store/store";
import { Id, Pos } from "@/app/types/common";
import { Graph, NodePropValue } from "@/app/types/main";










export function getNode(id: Id) {
    return getCurrentGraph().nodeIdMap[id]
}

export function getEdge(id: Id) {
    return getCurrentGraph().edgeIdMap[id]
}

export function getCurrentGraph(projectId?: Id, branchName?: Id): Graph {
    const state = store.getState().workspace
    let graphId = selectCurrentGraphId(state)
    if (!projectId) return graphs[graphId!]
    graphId = selectCurrentGraphIdForProject(state, projectId)
    if (!branchName) return graphs[graphId!]
    const project = projectId ? selectProjectById(state, projectId) : selectCurrentProject(state)
    if (project) {
        graphId = Object.keys(project.branches).find(id => project.branches[id].name === branchName)
        return graphs[graphId!]
    }
}


export function getCurrentSelectedNode() {
    const currentSelectedItem = store.getState().workspace.currentSelectedItem
    if (currentSelectedItem.id ) {
        return getCurrentGraph().nodeIdMap[currentSelectedItem.id]        
    }
}


export function getInputNodeDisplayValues(id: Id) {

    const inputNodeIds = getInputNodeIds(id)
    const values: NodePropValue[] = [];
    inputNodeIds.forEach((inputId: Id) => {
        const inputNode = getNode( inputId)
        if (inputNode?.displayValue) values.push(inputNode.displayValue);
    });
    return values;
}


function getInputNodeIds(id: Id ) {
    const node = getNode(id)
    const inputNodeIds: Id[] = [];
    node.incomingEdges?.forEach((edgeId: Id) => {
        const edge = getEdge(edgeId);
        if (edge?.startNodeId) inputNodeIds.push(edge.startNodeId);
    });
    return inputNodeIds;
}


export function getNodesAndEdgesWithinBrush() {

    const graph = getCurrentGraph()
    const nodesInFocus = getNodesInFocus()
    const brush = accessoryState.brush

    if (!graph || !brush?.[1]) return {nodesWithinBrush: [], edgesWithinBrush: []}

    const abstractionNodesInFocus = [...nodesInFocus].filter(nodeId => graph.nodeIdMap[nodeId].children && graph.nodeIdMap[nodeId].children.length > 0)
    const nodesWithinBrush = calculateNodesWithinBrush(abstractionNodesInFocus, graph, brush)

    const edgesWithinBrush = calculateEdgesWithinBrush(graph, brush)

    return { nodesWithinBrush, edgesWithinBrush: Array.from(edgesWithinBrush)}
}




const EMPTY_SET = new Set<Id>();
export function getNodesInFocus() {

    // Minimum size on screen for a node to be considered in focus
    const MIN_SIZE_ON_SCREEN = 100 

    const nodesInFocus = new Set<Id>();

    const viewportScale = accessoryState.viewportValues?.scale || 1
    const screenCenter = getScreenCenter()
    const graph = getCurrentGraph()
    const allNodes: Id[] = Object.keys(graph.nodeIdMap) 

    for (const nodeId of allNodes) {
        const node = graph.nodeIdMap[nodeId];
        if (node) {
            let radius = NODE_RADIUS;
            if (node.parent) {
                const parent = graph.nodeIdMap[node.parent]
                radius = parent?.childrenScale ? radius * parent?.childrenScale : radius
            }
            if (isPointWithinCircle(screenCenter, radius, node.position)) {
                const sizeOnScreen = viewportScale * radius
                if (sizeOnScreen > MIN_SIZE_ON_SCREEN) {
                    nodesInFocus.add(nodeId)
                }
            }
        }
    }
    return nodesInFocus.size === 0 ? EMPTY_SET : nodesInFocus;
}

export function getScreenCenter() {
    const windowSize = store.getState().workspace.windowSize
    const viewportValues = accessoryState.viewportValues!
    if (!windowSize) return [0,0] as Pos
    const {width, height} = windowSize
    const screenCenter = [width/2, height/2] as Pos
    if (!viewportValues.bottomRight || !viewportValues.topLeft) return screenCenter
    const screenCenterWorld =  screenToWorld(screenCenter, viewportValues)
    return screenCenterWorld
}