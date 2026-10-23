import { getCenterAndScale, calculatePointDifference, calculateCentroid, shortestEdge } from '@/app/services/math'
import { Graph, Node } from '@/app/types/main';
import { Id, Pos } from "@/app/types/common"
import { NODE_RADIUS } from '@/app/sizing/nodes';
import { EdgeAccumulator, NodeAccumulator } from '../accumulators';
import { getNodeScale } from '@/app/components/Workspace/nodeHelpers';
import { graphController } from '@/app/globalObjs';
import { ApplyAccumulatorCommand } from '@/app/components/Workspace/commands';
import { getDescendants, getEdgesConnectingNodes, isAbsNode } from '@/app/services/graphTheory';





//anything used in a recursive manner should take in state that is a writable (immer draft)
//subsequent calculations can use the modified state



export function updateAbstractionNodePositionHelper(graph: Graph, id: Id, newPos: Pos) {

    
    const absNode = graph.nodeIdMap[id]
    const oldPosition = absNode.position
    const [deltaX, deltaY] = calculatePointDifference(newPos, oldPosition)

    graphController.addCommand( new ApplyAccumulatorCommand(id, 'node', 'position', newPos))

    const desc = getDescendants(id, graph.nodeIdMap)
    const staticEdges = getEdgesConnectingNodes(Object.keys(graph.edgeIdMap), desc, graph.edgeIdMap)
    const staticEdgesArray = Array.from(staticEdges)

    const edgeAcc = new EdgeAccumulator()
    for (let i = 0; i < staticEdgesArray.length; i++) {
        const edgeId = staticEdgesArray[i]
        const oldStartPos = graph.edgeIdMap[edgeId].startPos
        const oldEndPos = graph.edgeIdMap[edgeId].endPos

        const newStartPos = [oldStartPos[0] + deltaX, oldStartPos[1] + deltaY]
        edgeAcc.createEntry('update', edgeId, 'startPos', newStartPos)
        const newEndPos = [oldEndPos[0] + deltaX, oldEndPos[1] + deltaY]
        edgeAcc.createEntry('update', edgeId, 'endPos', newEndPos)
    }
    graphController.addCommand( new ApplyAccumulatorCommand(edgeAcc))


    const inOrOutEdges = []
    const descArray = Array.from(desc)
    const nodeAcc = new NodeAccumulator()
    for (let i = 0; i < descArray.length; i++) {
        const descId = descArray[i]
        const node = graph.nodeIdMap[descId]
        if (!node) continue;

        const newPos = [node.position[0] + deltaX, node.position[1] + deltaY]
        nodeAcc.createEntry("update", descId, 'position', newPos)

        if (!isAbsNode(node)) {
            const all = [...node.incomingEdges ?? [], ...node.outgoingEdges ?? []]
            for (let j = 0; j < all.length; j++) {
                const edgeId = all[j]
                if (!staticEdges.has(edgeId)) {
                    inOrOutEdges.push(edgeId)
                }
            }
        }
    }
    graphController.addCommand( new ApplyAccumulatorCommand(nodeAcc))

    for (let i = 0; i < inOrOutEdges.length; i++) {
        const id = inOrOutEdges[i]
        updateEdgeNodulePositionsHelper(graph, id)
    }
}



export const updateBaseNodePositionHelper = (graph: Graph, id: Id, newPos: Pos, staticEdges?: Set<Id>) => {
    
    const node = graph.nodeIdMap[id]

    graphController.addCommand( new ApplyAccumulatorCommand(id, 'node', 'position', newPos))

    const incomingEdges = node.incomingEdges ?? [];
    const outgoingEdges = node.outgoingEdges ?? [];
    const edgesToUpdate = [...incomingEdges, ...outgoingEdges];
    
    for (let i = 0; i < edgesToUpdate.length; i++) {
        const edgeId = edgesToUpdate[i];
        if (staticEdges?.has(edgeId)) continue;
        updateEdgeNodulePositionsHelper(graph, edgeId);
    }

}





export const updateEdgeNodulePositionsHelper = (graph: Graph, id: Id) => {
 
    const edge = graph.edgeIdMap[id]
 
    if (edge) {
        const startNode = graph.nodeIdMap[edge.startNodeId ?? ""]
        const startScaler = getNodeScale(edge.startNodeId ?? "", graph.nodeIdMap)
        const endNode = graph.nodeIdMap[edge.endNodeId ?? ""]
        const endScaler = getNodeScale(edge.endNodeId ?? "", graph.nodeIdMap)
        
 
        if (startNode?.position && endNode?.position) {
            const startRadius = NODE_RADIUS * startScaler
            const endRadius = NODE_RADIUS * endScaler
            const {closest1, closest2} = shortestEdge(startNode.position, endNode.position, startRadius, endRadius)
            graphController.addCommand( new ApplyAccumulatorCommand(id, 'edge', 'startPos', closest1))
            graphController.addCommand( new ApplyAccumulatorCommand(id, 'edge', 'endPos', closest2))
        }
    }
 }



 export const USABLE_AREA = 0.95


 export function scaleAndCenterChildrenHelper(graph: Graph, id: Id) {

    const abstractionNode = graph.nodeIdMap[id]
    const position = abstractionNode.position
    const childrenIds = abstractionNode.children
    if (!childrenIds) return
    const childrenScale = abstractionNode.childrenScale || 1
    const childRadius = NODE_RADIUS*childrenScale
    const parentId = abstractionNode.parent
    const parent = graph.nodeIdMap[parentId ?? ""]
    const parentChildrenScale = parent?.childrenScale

    const innerRadius = parentChildrenScale ? NODE_RADIUS * USABLE_AREA * parentChildrenScale : NODE_RADIUS * USABLE_AREA
    
    const positions = []
    for (let i = 0; i < childrenIds.length; i++) {
        const id = childrenIds[i]
        positions.push(graph.nodeIdMap[id]?.position)
    }
    
    const { newScale, centerX, centerY } = getCenterAndScale(positions, childRadius, innerRadius)
    const updatedScale = childrenScale * newScale // b/c newScale is calculated using childRadius (which uses old childrenScale)

    graphController.addCommand( new ApplyAccumulatorCommand(id, 'node', 'childrenScale', updatedScale))

    const [deltaX, deltaY] = calculatePointDifference([centerX, centerY], position)

    for (let i = 0; i < childrenIds.length; i++) {
        const nodeId = childrenIds[i]
        const node = graph.nodeIdMap[nodeId]

        const nodePosition = node.position
        const postMove = [nodePosition[0] - deltaX, nodePosition[1] - deltaY] as Pos

        const [dX, dY] = calculatePointDifference(postMove, position)
        const xDistToMove = - dX * (1 - newScale)
        const yDistToMove = - dY * (1 - newScale)
        const postScale = [postMove[0] + xDistToMove, postMove[1] + yDistToMove] as Pos

        if (isAbsNode(node)) {
            updateAbstractionNodePositionHelper(graph, nodeId, postScale)
            scaleAndCenterChildrenHelper(graph, nodeId)
        } else {
            updateBaseNodePositionHelper(graph, nodeId, postScale)
        }
    }
 }

//  export const scaleAndCenterChildrenHelper = (graph: Graph, id: Id, ignore?: Id, imaginaryNodePosition?: Pos) => {


//     const abstractionNode = graph.nodeIdMap[id]
//     if (!abstractionNode) return
  
//     const position = abstractionNode.position
//     const childrenScale = abstractionNode.childrenScale ?? 1
//     const childrenRadii = (NODE_RADIUS*USABLE_AREA) * childrenScale
//     const parentId = abstractionNode.parent
//     const parentObj = graph.nodeIdMap[parentId!]
//     const parentChildrenScale = parentObj?.childrenScale
  
//     let childrenIds = abstractionNode?.children
//     if (!childrenIds) return 
  
//     if (childrenIds.length > 2) {
//       childrenIds = childrenIds.filter(childId => childId !== ignore)
//     } 
  
//     //Get radius of abstraction node
//     const abstractionNodeRadius = parentChildrenScale ? (NODE_RADIUS*USABLE_AREA) * parentChildrenScale : (NODE_RADIUS*USABLE_AREA)
//     //Get children objs
//     const childrenObjs = childrenIds ? childrenIds.map(childId => graph.nodeIdMap[childId]) : []
  
//     //*First, Scale down relative to centroid
//     const positions =  childrenObjs.map((node) => node?.position).concat(imaginaryNodePosition ? [imaginaryNodePosition] : [])
//     const {newScale} = getCenterAndScale(positions, NODE_RADIUS * childrenScale, abstractionNodeRadius) 
//     const oldCentroid = calculateCentroid(positions)
//     const updatedScale = childrenIds?.length > 0 ? childrenScale * newScale : USABLE_AREA

//     graphController.addCommand( new ApplyAccumulatorCommand(id, 'node', 'childrenScale', updatedScale))
  
//     const newPositionsMap: Record<Id, Pos> = {}


//     childrenIds?.forEach((childId: Id) => {
//       const childObj = graph.nodeIdMap[childId]
  
//       if (childObj) {
          
//           const oldChildPosition = childObj.position
          
//           const [centroidDeltaX, centroidDeltaY] = calculatePointDifference(oldCentroid, oldChildPosition)
  
//           const newChildPosition = [oldChildPosition[0], oldChildPosition[1]] as Pos
  
//           newChildPosition[0] += centroidDeltaX * ( 1 - newScale)
//           newChildPosition[1] += centroidDeltaY * ( 1 - newScale)

//           newPositionsMap[childId] = newChildPosition
//       }
//     })

//     //* Move to abstraction node center
//     const newPositions = Object.values(newPositionsMap)
//     const {centerX, centerY} = getCenterAndScale(newPositions, childrenRadii * newScale, abstractionNodeRadius)
//     const [centerDeltaX, centerDeltaY] =  calculatePointDifference([centerX, centerY], position)

//     childrenIds?.forEach((childId: Id) => {
//         const oldChildPosition = newPositionsMap[childId]
//         const newChildPosition = [oldChildPosition[0] - centerDeltaX, oldChildPosition[1] - centerDeltaY] as Pos 
//         newPositionsMap[childId] = newChildPosition
//     })

//     //* Add new positions to accumulators
//     childrenIds?.forEach((childId: Id) => {
//         const childObj = graph.nodeIdMap[childId]

//         if (childObj) {
//             const newChildPosition  = newPositionsMap[childId]
//             // updateChildPosition(graph, childObj, childId, newChildPosition)
//             if (isAbsNode(childObj)) { 
//                 updateAbstractionNodePositionHelper(graph, childId, newChildPosition)
//             } else {
//                 updateBaseNodePositionHelper(graph, childId, newChildPosition)
//             }

//             if (childObj?.children && childObj.children.length > 0) {
//                 scaleAndCenterChildrenHelper(graph, childId)
//             } 
//         }
//     })
//  }




//* Helpers


export const updateNodulePosFromNodePos = (graph: Graph, id: Id) => {
    //get node radius
    const node = graph.nodeIdMap[id]
    if (node) {
        const edgesToUpdate = [...node.incomingEdges ?? [], ...node.outgoingEdges ?? []];
        edgesToUpdate.forEach((edgeId: Id) => {
            updateEdgeNodulePositionsHelper(graph, edgeId)
        })
   }
  }
