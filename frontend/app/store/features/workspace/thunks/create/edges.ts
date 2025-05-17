import { generateId,  screenToWorld } from '@/app/services/math'
import * as PIXI from 'pixi.js'


//Types
import { DragTarget, Graph } from '@/app/types/main'
import { Edge } from '@/app/types/main'
import { Id, Pos } from "@/app/types/common"
import _ from "lodash"
import store from "@/app/store/store"
import {  getEdgeTemplate } from "@/app/templates"
import { onDragStart } from "../update/nodes"
import { getBaseNodeDescendants, topologicalSort } from '@/app/services/graphTheory'
import { CANT_TAKE_INPUT } from '@/app/nodes/dataFlow'
import {  NodeAccumulator } from '../accumulators'
import { accessoryState, graphController } from '@/app/globalObjs'
import { AddEdgesCommand, ApplyAccumulatorCommand } from '@/app/components/Workspace/commands'
import { updateEdgeNodulePositionsHelper } from '../update/helpers'





export const addMultipleConnectedEdges = (graph: Graph, startNodeIds: Id[], endNodeIds: Id[], newEdges: Edge[], newIds: Id[]) => {

    const nodeAccumulator = new NodeAccumulator()

    newEdges.forEach((newEdge, index) => {
        // Update relevant node's incoming and outgoing edges
        const startNodeId = startNodeIds[index]
        const endNodeId = endNodeIds[index]
        const newId = newIds[index]
        nodeAccumulator.createEntry('add', startNodeId, 'outgoingEdges', [newId])
        nodeAccumulator.createEntry('add', endNodeId, 'incomingEdges', [newId])
    })

    graphController.addCommand(new AddEdgesCommand(newIds, newEdges))
    graphController.addCommand(new ApplyAccumulatorCommand(nodeAccumulator))
    for (let id of newIds) {
        updateEdgeNodulePositionsHelper(graph, id)
    }
}


//Connect both groups of multi connect with edges
export const multiConnectCreateEdges = (graph: Graph, secondGroup: Id[]) => {
        const state = store.getState()
        const firstGroup = state.workspace.multiConnect
        
        const { nodeIdMap, edgeIdMap } = graph

        // Get base nodes that will be connected


        const startNodes: Id[] = []
        const endNodes: Id[] = []

        // For first group
        firstGroup.forEach((nodeId: Id) => {
            const node = nodeIdMap[nodeId]
            // If base node 
            if (!(node.children && node.children.length > 0)) {
                startNodes.push(nodeId)
            } else { // If abs node
                //Get last in top sort
                const baseNodeDescendants = Array.from(getBaseNodeDescendants(nodeId, nodeIdMap))
                const topSort = topologicalSort(baseNodeDescendants, nodeIdMap, edgeIdMap)
                const last = topSort[topSort.length - 1]
                startNodes.push(last)
            } 
        })

        // For second group
        secondGroup.forEach((nodeId: Id) => {
            const node = nodeIdMap[nodeId]

            //If base node
            if (!(node.children && node.children.length > 0)) {
                endNodes.push(nodeId)
            } else { //If abs node
                const baseNodeDescendants = Array.from( getBaseNodeDescendants(nodeId, nodeIdMap) )
                const topSort = topologicalSort(baseNodeDescendants, nodeIdMap, edgeIdMap)
                // Find first node that can take an input
                for (const idInTopSort of topSort) {
                    const nodeInTopSort = nodeIdMap[idInTopSort];
                    if (!CANT_TAKE_INPUT.includes(nodeInTopSort.type)) {
                        endNodes.push(idInTopSort)
                        break;
                    }
                }
            }

        })

        //Both startNodes and endNodes need to have the same length
        //Replicate each elem in the array according to the size of the other array

        const newStartNodes: Id[] = []
        const newEndNodes: Id[] = []

        if (startNodes.length > endNodes.length) { 
            startNodes.forEach((id) => {
                newStartNodes.push(...Array(endNodes.length).fill(id))
            })
            newStartNodes.forEach((id) => {
                newEndNodes.push(...endNodes)
            })
        } else {
            startNodes.forEach((id) => {
                newStartNodes.push(...Array(endNodes.length).fill(id))
            })
            startNodes.forEach((id) => {
                newEndNodes.push(...endNodes)
            })
        }
            
        createEdgesGivenStartAndEndNodes(graph, newStartNodes, newEndNodes)
}


/**
 * Create a new edge
 */
export const createEdgeFromUserAction = (graph: Graph, startNodeId: Id, event: PIXI.FederatedPointerEvent, dragEndCallback?: () => void) => {
    const state = store.getState()

    //Check if there's already a drag target
    if (state.workspace.dragTarget.id) return

    const viewportValues = accessoryState.viewportValues

    // Make edge object
    const globalClickPos = [event.globalX, event.globalY] as Pos

    const pos = screenToWorld(globalClickPos, viewportValues)

    const newId = generateId(8)

    const offsetPos: Pos = [pos[0] - 1, pos[1] - 1]

    const newEdge = getEdgeTemplate()
    newEdge.startNodeId = startNodeId
    newEdge.startPos= pos
    newEdge.endPos = offsetPos//slight offset so determinant is non-null

    //Add to edgeIdMap for current graph
    graphController.addCommand( new AddEdgesCommand([newId], [newEdge]))
    //Add to node's outgoing edges
    const nodeAccumulator = new NodeAccumulator();
    nodeAccumulator.createEntry('add', startNodeId, 'outgoingEdges', [newId]);
    graphController.addCommand( new ApplyAccumulatorCommand(nodeAccumulator))
    
    //Start dragging
    const dragTarget = {type: 'end-nodule', id: newId } as DragTarget
    onDragStart( graph, dragTarget, dragEndCallback)
}

export const createEdgesGivenStartAndEndNodes = (graph: Graph, startNodeIds: Id[], endNodeIds: Id[]) => {


    const newEdges: Edge[] = []
    const newIds: Id[] = []

    for (let index = 0; index < startNodeIds.length; index++) {
        const startNodeId = startNodeIds[index];
        const endNodeId = endNodeIds[index];

        const newEdge = getEdgeTemplate();
        newEdge.startNodeId = startNodeId;
        newEdge.endNodeId = endNodeId;
        newEdges.push(newEdge);

        const newId = generateId(8);
        newIds.push(newId);
    }
    addMultipleConnectedEdges(graph, startNodeIds, endNodeIds, newEdges, newIds)
    
}
function getState() {
    throw new Error('Function not implemented.')
}

