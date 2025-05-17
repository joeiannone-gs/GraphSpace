import { EdgeIdMap, NodeIdMap } from '../types/main';
import { Node } from '../types/main';
import { Id } from '@/app/types/common';










/**
 * Get all edges along th paths from multiple origin nodes to a single destination node
 * @returns a Set of Edges
 */
export const getEdgesFromNodesToNode = (originNodeIds: Id[], destinationNodeId: Id, nodeIdMap: NodeIdMap, edgeIdMap: EdgeIdMap) => {

    // Get all edges leading into the destination node (all other edges are irrelevant here)
    const relevantEdges = dfsBackwards(destinationNodeId, nodeIdMap, edgeIdMap)

    
    const discoveredEdges = new Set<Id>()

    originNodeIds.forEach((nodeId: Id) => {
        const pathToDestination = dfs(nodeId, nodeIdMap, edgeIdMap, discoveredEdges, relevantEdges)
        //Add edges along path to discovered edges
        pathToDestination.forEach(edgeId => discoveredEdges.add(edgeId) )
    })

    return discoveredEdges

}


/**
 * Get path (array of edgeIds) from one node to another node
 * @returns a Set of edgeIds
 */
export const dfs = (originNodeId: Id, nodeIdMap: NodeIdMap, edgeIdMap: EdgeIdMap, discoveredEdges = new Set<Id>(), allowedEdges?: Set<Id>): Set<Id> => {
    
    const nodeStack = []

    nodeStack.push(originNodeId)

    while (nodeStack.length > 0) {
        const nodeId = nodeStack.pop()
        if (!nodeId) continue;

        const node = nodeIdMap[nodeId] as Node

        node.outgoingEdges?.forEach((edgeId) => {
            if (!discoveredEdges?.has(edgeId) && allowedEdges?.has(edgeId)) {
                discoveredEdges.add(edgeId)
                const endNodeId = edgeIdMap[edgeId]?.endNodeId
                nodeStack.push(endNodeId)
            }
        })
    }

    return discoveredEdges
}

/**
 * Get all edges along all paths going into a node. This is used for getting all edges that are along all paths 
 * going into the last node in a loss abstraction node.
 * @returns a Set of edge ids
 */
export const dfsBackwards = (nodeId: Id, nodeIdMap: NodeIdMap, edgeIdMap: EdgeIdMap): Set<Id> => {
    
    const discoveredEdges = new Set<Id>();
    const nodeStack: Id[] = [];

    nodeStack.push(nodeId)

    while (nodeStack.length > 0) {

        const nodeId = nodeStack.pop()
        if (!nodeId) continue;

        const node = nodeIdMap[nodeId] as Node

        node.incomingEdges?.forEach((edgeId) => {

            if (!discoveredEdges.has(edgeId)) {
                discoveredEdges.add(edgeId)
                const edge = edgeIdMap[edgeId]
                if (edge) {
                    const startNodeId = edge.startNodeId
                    if (startNodeId) nodeStack.push(startNodeId)
                }
            }
        })
    }

    return discoveredEdges
}


export const topologicalSort = (nodeIds: Id[], nodeIdMap: NodeIdMap, edgeIdMap: EdgeIdMap) => {

    nodeIds = removeAbsNodes(nodeIds, nodeIdMap)

    const visited = new Set<Id>()
    const stack: Id[] = []

    const recursiveDfs = (nodeId: Id) => {
        visited.add(nodeId)
        const dependencies = getDependencies(nodeId, nodeIdMap, edgeIdMap, nodeIds)
        dependencies.forEach((inputNodeId: Id) => {
            recursiveDfs(inputNodeId)
        })
        stack.push(nodeId)
    }

    nodeIds.forEach((nodeId: Id) => {
        if (!visited.has(nodeId)) {
            recursiveDfs(nodeId)
        }
    })

    return stack

}


export function getDependencies(nodeId: Id, nodeIdMap: NodeIdMap, edgeIdMap: EdgeIdMap, allowedNodes?: Id[]) {
    const dependencies: Id[] = []
    const node = nodeIdMap[nodeId]
    node.incomingEdges?.forEach((edgeId: Id) => {
        const inputNodeId = edgeIdMap[edgeId]?.startNodeId
        if (inputNodeId && allowedNodes?.includes(inputNodeId)) dependencies.push(inputNodeId)
    })
    return dependencies
}


export function getBaseNodeDescendants(absNodeId: string, nodeIdMap: NodeIdMap) {

    const baseNodes = new Set<Id>()
    const allDesc = getDescendants(absNodeId, nodeIdMap)
    const allDescArray = Array.from(allDesc)
    for (let i = 0; i < allDescArray.length; i++) {
        const id = allDescArray[i]
        const node = nodeIdMap[id]
        if (!isAbsNode(node)) baseNodes.add(id)
    }

    return baseNodes


    // const absNode = nodeIdMap[absNodeId];
    // const children = absNode.children || [];
    // if (!containsAbsNodes(children, nodeIdMap)) {
    //     return children;
    // }
    // // If there are abs nodes, return their descendants plus the base nodes in children
    // const remainingAbsNodeIds = getAbsNodes(children, nodeIdMap);
    // let remainingDescendants: string[] = [];
    // for (const remAbsNodeId of remainingAbsNodeIds) {
    //     remainingDescendants = remainingDescendants.concat(getBaseNodeDescendants(remAbsNodeId, nodeIdMap));
    // }
    // return removeAbsNodes(children, nodeIdMap).concat(remainingDescendants);
}

export function getDescendants(absNodeId: Id, nodeIdMap: NodeIdMap) {
    const absNode = nodeIdMap[absNodeId];
    const children = absNode.children || [];

    const remainingAbsNodeIds = children.filter(nodeId => isAbsNode(nodeIdMap[nodeId]));
    let remainingDescendants = new Set(children)

    if (!containsAbsNodes(children, nodeIdMap)) {
        return remainingDescendants;
    }

    for ( const remAbsNodeId of remainingAbsNodeIds) {
        getDescendants(remAbsNodeId, nodeIdMap).forEach(id => remainingDescendants.add(id))
    }

    return remainingDescendants
}


function containsAbsNodes(nodeIds: string[], nodeIdMap: NodeIdMap): boolean {
    return nodeIds.some(nodeId => isAbsNode(nodeIdMap[nodeId]));
}


export function isAbsNode(node: Node): boolean {
    return (node?.children || []).length > 0;
}

function removeAbsNodes(nodeIds: string[], nodeIdMap: NodeIdMap): string[] {
    const idsToKeep: string[] = [];
    for (const nodeId of nodeIds) {
        const node = nodeIdMap[nodeId];
        if (!isAbsNode(node)) {
            idsToKeep.push(nodeId);
        }
    }
    return idsToKeep;
}



// From a list of edges find the edges that connect nodes (in a given list of nodes)
export const getEdgesConnectingNodes = (edgeIds: Id[], nodeIds: Set<Id>, edgeIdMap: EdgeIdMap) => {
    const includedEdges= new Set<Id>()


    for (let i = 0; i < edgeIds.length; i++) {
        const edgeId = edgeIds[i];
        if (includedEdges.has(edgeId)) continue;
        const edge = edgeIdMap[edgeId];
        const containsStart = nodeIds.has(edge.startNodeId ?? "");
        const containsEnd = nodeIds.has(edge.endNodeId ?? "");
        if (containsStart && containsEnd) {
            includedEdges.add(edgeId);
        }
    }

    return includedEdges
}



// export const getEdgesGoingIntoOrOutOfAbsNode = (absNodeId: Id, nodeIdMap: NodeIdMap, edgeIdMap: EdgeIdMap) => {


//     const descendants = getDescendants(absNodeId, nodeIdMap)
//     const edgesConnectingDesc = getEdgesConnectingNodes(Object.keys(edgeIdMap), descendants, edgeIdMap)
//     const edgesGoingIn = new Set<Id>()
//     const edgesGoingOut = new Set<Id>()
    
//     descendants.forEach(descendantId => {
//         const node = nodeIdMap[descendantId]
//         if (node.incomingEdges) {
//             node.incomingEdges.forEach(edgeId => {
//                 if (!edgesConnectingDesc.has(edgeId)) {
//                     edgesGoingIn.add(edgeId)
//                 }
//             })
//         }
//         if (node.outgoingEdges) {
//             node.outgoingEdges.forEach(edgeId => {
//                 if (!edgesConnectingDesc.has(edgeId)) {
//                     edgesGoingOut.add(edgeId)
//                 }
//             })
//         }
//     })

//     return { edgesGoingIn, edgesGoingOut }
// }



//unchecked
export const getConnectedNodes = (
    nodeId: Id,
    nodeIdMap: NodeIdMap,
    edgeIdMap: EdgeIdMap,
    depth: number,
    direction: 'in' | 'out' | 'both'
  ): Set<Id> => {
    const visited = new Set<Id>();
    const queue: Array<[Id, number]> = [[nodeId, 0]];
  
    while (queue.length > 0) {
      const [currentId, currentDepth] = queue.shift()!;
      if (visited.has(currentId)) continue;
      visited.add(currentId);
  
      if (currentDepth >= depth) continue;
  
      const node = nodeIdMap[currentId];
      if (!node) continue;
  
      const edges = [];
      if (direction === 'in' || direction === 'both') {
        edges.push(...(node.incomingEdges || []));
      }
      if (direction === 'out' || direction === 'both') {
        edges.push(...(node.outgoingEdges || []));
      }
  
      for (const edgeId of edges) {
        const edge = edgeIdMap[edgeId];
        if (!edge) continue;
  
        let neighborId = direction === 'in' ? edge.startNodeId : edge.endNodeId;
        if (direction === 'both') {
          const isIncoming = node.incomingEdges?.includes(edgeId);
          neighborId = isIncoming ? edge.startNodeId : edge.endNodeId;
        }
  
        if (neighborId && !visited.has(neighborId)) {
          queue.push([neighborId, currentDepth + 1]);
        }
      }
    }
  
    return visited;
  };