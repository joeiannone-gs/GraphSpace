
import _, { clone } from "lodash";
import { BackwardDeltas } from '../types/main';
import { Graph } from '../types/main';
import { produce, WritableDraft } from "immer";


/**
 * 
 * For each addition, we need to remove it to get to what it was before
 * For each subtraction, we need to add it to get it to what it was before
 * For each update, we need to make it what it was previously
 *  
 * @param graph - the graph for the commit after the one we want to calculate
 * @param deltas - the deltas or changes for the commit after the one we want to calculate
 * @returns a new graph
 */
export const applyBackwardDeltas = (graph: Graph, deltas: BackwardDeltas | undefined) => {

    if (deltas === undefined) return graph

    const clonedGraph = _.cloneDeep(graph)

    // const changedGraph = produce(graph, graphDraft => {

        //Updates
        Object.entries(deltas.update?.nodeIdMap ?? []).forEach(([key, value]) => {
            clonedGraph.nodeIdMap[key] = Object.assign(clonedGraph.nodeIdMap[key], value)
        })
        Object.entries(deltas.update?.edgeIdMap ?? []).forEach(([key, value]) => {
            clonedGraph.edgeIdMap[key] = Object.assign(clonedGraph.edgeIdMap[key], value)
        })
        

        //Additions
        deltas.add?.nodeIdMap?.forEach((entry: string) => {
            if (clonedGraph.nodeIdMap) {
                delete clonedGraph.nodeIdMap[entry]
            }
        })
        deltas.add?.edgeIdMap?.forEach((entry: string) => {
            if (clonedGraph.edgeIdMap) {
                delete clonedGraph.edgeIdMap[entry]
            }
        })

        //Deletions
        Object.entries(deltas.delete?.nodeIdMap ?? []).forEach(([id, node]) => {
            clonedGraph.nodeIdMap[id] = node
        })
        Object.entries(deltas.delete?.edgeIdMap ?? []).forEach(([id, edge]) => {
            clonedGraph.edgeIdMap[id] = edge
        })

        

    // })

    return clonedGraph
}
