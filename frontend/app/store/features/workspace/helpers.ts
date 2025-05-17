
import { Id, Pos } from "@/app/types/common"
import { EdgeIdMap, GradientPathMap, NodeIdMap, PathElems } from '@/app/types/main'
import { IElems, NodeTypeEnum } from "@/app/proto/compiled"
import { getBaseNodeDescendants, getEdgesFromNodesToNode, topologicalSort } from "@/app/services/graphTheory"
import { generateId } from "@/app/services/math"
import _ from "lodash"
import { Edge } from '@/app/types/main'
import { Node } from '@/app/types/main'
import { metadataToPb } from "@/app/proto/helpers"
import { EdgeAccumulator } from "./thunks/accumulators"
import { BitmapText, Container, Graphics, Sprite } from "pixi.js"

 //
 export const getTimeStampString = () => {
   const unixTimeStamp = Math.floor(Date.now() / 1000).toString()
   return new Date(parseInt(unixTimeStamp) * 1000).toLocaleString('en-US', {
       month: 'numeric',
       day: 'numeric',
       hour: 'numeric',
       minute: 'numeric'
   });
}




/**
 * When a new loss node is created
 */
export const calculateGradientPaths = (lossAbsNodeId: Id, nodeIdMap: NodeIdMap, edgeIdMap: EdgeIdMap) => {

  const allEdgesIntoLossNode = new Set<Id>
  const gradientPathMap: GradientPathMap = {map: {}}

  //Get the last loss node in the loss abs node
  const lossNodeDescendents = Array.from(getBaseNodeDescendants(lossAbsNodeId, nodeIdMap))
  const topSort = topologicalSort(lossNodeDescendents, nodeIdMap, edgeIdMap)
  const lastNodeInLoss = topSort[topSort.length - 1]

  //Get all predictor abs nodes
  const predictorIds = Object.keys(nodeIdMap).filter(nodeId => nodeIdMap[nodeId].metadata?.values?.["purpose"]?.stringValue ==='predictor')
  //For each, find path into loss node
  predictorIds.forEach((predictorId) => {
      let parameterNodes: Id[] = []

      //Get parameter nodes within descendants
      const descendants = Array.from(getBaseNodeDescendants(predictorId, nodeIdMap))
      const paramDescendants = descendants.filter((id: Id) => Number(nodeIdMap[id]?.type) === NodeTypeEnum.PARAMETER)
      //Find all the edges that make up the paths from param nodes to loss node
      const edges = getEdgesFromNodesToNode(paramDescendants, lastNodeInLoss, nodeIdMap, edgeIdMap)
      edges.forEach((edgeId: Id) => allEdgesIntoLossNode.add(edgeId))
      //If there are edges (paths) into loss node
      if (allEdgesIntoLossNode.size > 0) {
        parameterNodes = paramDescendants
        const entry = `${predictorId}->-${lossAbsNodeId}`
        gradientPathMap.map[entry] =  {ids: parameterNodes, edgeIds: allEdgesIntoLossNode}
      }
      
  })

  return gradientPathMap
}


export function setBackPropEdges(elems: PathElems, value: boolean) {
    const edgeAccumulator = new EdgeAccumulator()

    for (let edgeId of elems.edgeIds) {
        edgeAccumulator.createEntry('update', edgeId, 'backprop', value)
    }
    
    return edgeAccumulator
}






export const createGraphClone = (originalGraph: { nodeIdMap: NodeIdMap, edgeIdMap: EdgeIdMap}) => {

    const nodeIdMapDisplayObjRemoved = {} as NodeIdMap

    for (let [id, node] of Object.entries(originalGraph.nodeIdMap)) {
        const shallowCopy = { ...node} 
        removeDisplayObj(shallowCopy)
        nodeIdMapDisplayObjRemoved[id] = shallowCopy
    }

    const edgeIdMapDisplayObjRemoved = {} as EdgeIdMap

    for (let [id, edge] of Object.entries(originalGraph.edgeIdMap)) {
        const shallowCopy = { ...edge} 
        removeDisplayObj(shallowCopy)
        edgeIdMapDisplayObjRemoved[id] = shallowCopy
    }
    
    const copiedNodes: NodeIdMap = _.cloneDeep(nodeIdMapDisplayObjRemoved)
    const copiedEdges: EdgeIdMap = _.cloneDeep(edgeIdMapDisplayObjRemoved)
    const graph = {
        nodeIdMap: copiedNodes,
        edgeIdMap: copiedEdges
    }

    // Generate new ids
    const oldToNewNodeIds: Record<Id, Id> = {};
    const oldToNewEdgeIds: Record<Id, Id> = {};

    // Update node IDs in the nodeIdMap
    for (const oldNodeId in graph.nodeIdMap) {
        const newId = generateId(8);
        oldToNewNodeIds[oldNodeId] = newId;
        graph.nodeIdMap[newId] = graph.nodeIdMap[oldNodeId];
        delete graph.nodeIdMap[oldNodeId];
    }

    // Update edge IDs in the edgeIdMap
    for (const oldEdgeId in graph.edgeIdMap) {
        const newId = generateId(8);
        oldToNewEdgeIds[oldEdgeId] = newId;
        graph.edgeIdMap[newId] = graph.edgeIdMap[oldEdgeId];
        delete graph.edgeIdMap[oldEdgeId];
    }

    // Replace children, parent references, and incoming/outgoing edge references
    Object.values(graph.nodeIdMap).forEach((node: Node) => {
        if (node.children && node.children.length > 0) { // If abstraction node
            node.children = node.children.map(childId => oldToNewNodeIds[childId]);
        } else {
            if (node.incomingEdges) {
                node.incomingEdges = node.incomingEdges.map(edgeId => oldToNewEdgeIds[edgeId]);
            }
            if (node.outgoingEdges) {
                node.outgoingEdges = node.outgoingEdges.map(edgeId => oldToNewEdgeIds[edgeId]);
            }
        }

        if (node.parent) {
            node.parent = oldToNewNodeIds[node.parent];
        }
    });

    // Replace start/end node references in edges
    Object.values(graph.edgeIdMap).forEach((edge: Edge) => {
        edge.startNodeId = oldToNewNodeIds[edge.startNodeId];
        edge.endNodeId = oldToNewNodeIds[edge.endNodeId];
    });

    return { graphClone: graph, oldToNewNodeIds, oldToNewEdgeIds }
}


function removeDisplayObj(nodeOrEdge: Node | Edge) {
    for (const key in nodeOrEdge) {
        const value = nodeOrEdge[key as keyof (Node | Edge)] as any
        if (
            value instanceof Container || value instanceof BitmapText
        ) {
            delete nodeOrEdge[key as keyof (Node | Edge)];
        }
    }
}