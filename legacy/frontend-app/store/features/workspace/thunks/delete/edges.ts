
//Types
import { Id, Pos } from "@/app/types/common"
import { NodeAccumulator } from "../accumulators"
import { dataflowChangeSideEffects } from "../dataflowChangeSideEffects"
import { graphController } from "@/app/globalObjs"
import { ApplyAccumulatorCommand, DeleteEdgesCommand } from "@/app/components/Workspace/commands"
import { Graph } from "@/app/types/main"





/**
 * Delete an edge
 */
export const deleteEdges = (graph: Graph, ids: Id[]) => {


    const nodeAccumulator = new NodeAccumulator()

    deleteEdgesHelper(graph, new Set(ids), nodeAccumulator)

    // dispatch(deleteEdgesReducer({ ids })) 
    graphController.addCommand( new DeleteEdgesCommand(ids))
    // dispatch(applyNodeAccumulator({ nodeAccumulator}))
    graphController.addCommand(new ApplyAccumulatorCommand(nodeAccumulator))

    dataflowChangeSideEffects(graph, nodeAccumulator.allIds)
    
}



const deleteEdgesHelper = (graph: Graph, ids: Set<Id>, nodeAccumulator: NodeAccumulator) => {
    ids.forEach(id => {
        const edge = graph.edgeIdMap[id]
        if (edge) {
            nodeAccumulator.createEntry('sub', edge.startNodeId ?? "", 'outgoingEdges', [id])
            nodeAccumulator.createEntry('sub', edge.endNodeId ?? "", 'incomingEdges', [id])
        }
    })
}
