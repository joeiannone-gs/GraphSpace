import { shortestEdge } from "@/app/services/math"

import { Id, Pos } from "@/app/types/common"
import { NODE_RADIUS } from '@/app/sizing/nodes';
import { deleteEdges } from "../delete/edges";
import { EdgeAccumulator, NodeAccumulator } from "../accumulators";
import { dataflowChangeSideEffects } from "../dataflowChangeSideEffects";
import { graphController } from "@/app/globalObjs";
import { ApplyAccumulatorCommand } from "@/app/components/Workspace/commands";
import { Graph } from "@/app/types/main";
import { updateEdgeNodulePositionsHelper } from "./helpers";



export const updateEdgeEndNode = (graph: Graph, edgeId: Id, newNodeId: Id) => {
        
        //Store old nodeId
        const edge = graph.edgeIdMap[edgeId]
        const oldNodeId = edge?.endNodeId
        const originNodeId = edge?.startNodeId;
        const newNode = graph.nodeIdMap[newNodeId]
        if (!newNode || !originNodeId || oldNodeId  === newNodeId ) {
            updateEdgeNodulePositionsHelper(graph, edgeId )

            return
        }
        if (newNodeId === originNodeId) {
            deleteEdges(graph, [edgeId])
            return
        }
        //Delete and return if edge is going to connect the same nodes as another edge
        const newNodeIncomingEdges = newNode.incomingEdges;
        if (newNodeIncomingEdges) {
            for (const existingEdgeId of newNodeIncomingEdges) {
                const existingEdge = graph.edgeIdMap[existingEdgeId]
                if (existingEdgeId !== edgeId && existingEdge?.startNodeId === originNodeId ) {
                    deleteEdges(graph, [edgeId])
                    return
                }
            }
        }
        //Change start nodeId in tuple to newNodeId

        //Update outgoing edges for old and new nodes (delete from existing, add to new)
        const nodeAccumulator = new NodeAccumulator()
        if (oldNodeId) {
            nodeAccumulator.createEntry('sub', oldNodeId, 'incomingEdges', [edgeId])
        } 
        nodeAccumulator.createEntry('add', newNodeId, 'incomingEdges', [edgeId])
        graphController.addCommand( new ApplyAccumulatorCommand(nodeAccumulator))

        graphController.addCommand( new ApplyAccumulatorCommand(edgeId, 'edge','endNodeId', newNodeId ))
        updateEdgeNodulePositionsHelper(graph, edgeId )

        dataflowChangeSideEffects(graph, nodeAccumulator.allIds)
}




export const updateEdgeStartNode = (graph: Graph, edgeId: Id, newNodeId: Id) => {
        const edge = graph.edgeIdMap[edgeId]

        if (!edge) return
        const oldNodeId = edge.startNodeId
        const destinationNodeId = edge.endNodeId
        const newNode = graph.nodeIdMap[newNodeId]
        if (!newNode || !destinationNodeId || oldNodeId  === newNodeId) {
            updateEdgeNodulePositionsHelper(graph, edgeId )

            return
        }
        if (newNodeId === destinationNodeId) {
            deleteEdges(graph, [edgeId])
            return
        }
        //Delete and return if edge is goind to connect the same nodes as another edge
        const newNodeOutGoingEdges = newNode.outgoingEdges
        if (newNodeOutGoingEdges) {
            for (const existingEdgeId of newNodeOutGoingEdges) {
                const existingEdge = graph.edgeIdMap[existingEdgeId]
                if (existingEdgeId !== edgeId && existingEdge.endNodeId === destinationNodeId ) {
                    deleteEdges(graph, [edgeId])
                    return
                }
            }
        }

        //Change start nodeId in tuple to newNodeId
        graphController.addCommand( new ApplyAccumulatorCommand(edgeId, "edge", "startNodeId", newNodeId))
        //Update outgoing edges for old and new nodes (delete from existing, add to new)
        const nodeAccumulator = new NodeAccumulator()
        if (oldNodeId) {
            nodeAccumulator.createEntry('sub', oldNodeId, 'outgoingEdges', [edgeId])
        }
        nodeAccumulator.createEntry('add', newNodeId, 'outgoingEdges', [edgeId])
        graphController.addCommand( new ApplyAccumulatorCommand( nodeAccumulator ))
        //Update end tuple position
        updateEdgeNodulePositionsHelper(graph, edgeId )        
        dataflowChangeSideEffects(graph, new Set(destinationNodeId))
    
}


export const updateStartNodulePosition = (graph: Graph, id: Id, newPos: Pos) => {

        const edge = graph.edgeIdMap[id]

        if (edge) {

            const endNode = graph.nodeIdMap[edge.endNodeId!]
            const endScaler = graph.nodeIdMap[endNode.parent!]?.childrenScale ?? 1
            
            // dispatch(changeIndividualEdgeProperty( {id, property: 'startPos', newValue: newPos}))
            graphController.addCommand(new ApplyAccumulatorCommand(id, "edge", 'startPos', newPos))

            
            if (endNode?.position) {
                const endRadius = NODE_RADIUS * endScaler
                const closestPosToStartNodule = shortestEdge(newPos, endNode.position, 0, endRadius).closest2
                // dispatch(changeIndividualEdgeProperty( {id, property: 'endPos', newValue: closestPosToStartNodule}))
                graphController.addCommand(new ApplyAccumulatorCommand(id, "edge", 'endPos', closestPosToStartNodule))

            }
        }
}


export const updateEndNodulePosition = (graph: Graph, id: Id, newPos: Pos) => {

    const edge = graph.edgeIdMap[id]

    if (edge) {
        const startNode = graph.nodeIdMap[edge.startNodeId ?? ""]
        const startScaler = graph.nodeIdMap[startNode.parent ?? ""]?.childrenScale ?? 1
        
        // dispatch(changeIndividualEdgeProperty( {id, property: 'endPos', newValue: newPos}))
        graphController.addCommand(new ApplyAccumulatorCommand(id, 'edge', 'endPos', newPos ))

        if (startNode?.position) {
            const startRadius = NODE_RADIUS * startScaler
            const closestPosToEndNodule = shortestEdge(startNode.position, newPos, startRadius, 0).closest1
            // dispatch(changeIndividualEdgeProperty( {id, property: 'startPos', newValue: closestPosToEndNodule}))
            graphController.addCommand(new ApplyAccumulatorCommand(id, 'edge', 'startPos', closestPosToEndNodule ))
        }
    }
}


