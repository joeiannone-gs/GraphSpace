import  { updateCurrentSelectedItem } from "../../workspaceSlice"

//Types
import { Id } from "@/app/types/common"
import store from "@/app/store/store"
import { NodeAccumulator } from "../accumulators"
import { Graph } from "@/app/types/main"
import { graphController } from "@/app/globalObjs"
import { ApplyAccumulatorCommand, DeleteNodesCommand } from "@/app/components/Workspace/commands"
import { deleteEdges } from "./edges"




export const deleteNodes = (graph: Graph, ids: Id[]) => {
        

        const nodeAccumulator = new NodeAccumulator()

        const edgesToBeDeleted = new Set<Id>
        const nodesToBeDeleted = new Set<Id>

        deleteNodesHelper(graph, new Set(ids), nodeAccumulator, nodesToBeDeleted, edgesToBeDeleted)


        deleteEdges(graph,  Array.from(edgesToBeDeleted))
        // deleteNodesReducer({ ids: Array.from(nodesToBeDeleted) }))
        graphController.addCommand( new DeleteNodesCommand(Array.from(nodesToBeDeleted)))
        graphController.addCommand( new ApplyAccumulatorCommand(nodeAccumulator))

        //If current selected item is deleted node, change current selected item to null
        if (ids.includes(store.getState().workspace.currentSelectedItem.id ?? "")) {
            store.dispatch(updateCurrentSelectedItem({ type: "project", id: null}))
        }
}




const deleteNodesHelper = (graph: Graph, ids: Set<Id>, nodeAccumulator: NodeAccumulator, nodesToBeDeleted: Set<Id>, edgesToBeDeleted: Set<Id>) => {

    ids.forEach((id, index) => {
        const node = graph.nodeIdMap[id]

        if (node) {
            
            //Delete all incoming and outgoing edges
            const allConnectingEdges = [...node.incomingEdges ?? [], ...node.outgoingEdges ?? []]
            allConnectingEdges.forEach(edge => edgesToBeDeleted.add(edge))

            //If has parent, deletes from children array
            const parentId = node?.parent
            if (parentId) {
                // removeChild(state, wrapInFauxAction({ parentId, childId: id}))
                nodeAccumulator.createEntry('sub', parentId, 'children', [id])
            }

            //If has children, delete all children
            if (node.children && node.children.length > 0) {
                // deleteNodes(state, wrapInFauxAction({ ids: node.children }))
                deleteNodesHelper(graph, new Set( node.children ) , nodeAccumulator, nodesToBeDeleted, edgesToBeDeleted)
            }

            // deleteNode(state, wrapInFauxAction({ id }))
            nodesToBeDeleted.add(id)
        }
    })
}

