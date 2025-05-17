import { getColoring } from "@/app/services/getColoring"
import { edgeLineGraphic } from "@/app/services/graphics"
import { isPointWithinCircle } from "@/app/services/math"
import { NODULE_RADIUS } from "@/app/sizing/edges"
import { NODE_RADIUS } from "@/app/sizing/nodes"
import { Id, Pos } from "@/app/types/common"
import { Graph } from "@/app/types/main"
import { Graphics, Sprite } from "pixi.js"
import { getNodeScale } from "./nodeHelpers"





export function updateEdgeLine(lineGraphic: Graphics, startPos: Pos, endPos: Pos, startRadius: number, endRadius: number, outlineGraphic?: Graphics, backprop = false) {
    const coloring = getColoring(false)
    lineGraphic.clear()
    
    // // Get nodule radii
    // const startNoduleRadius = getStartNoduleRadius(graph, id)
    // const endNoduleRadius = getEndNoduleRadius(graph, id)
    
    // Reverse direction if backprop
    edgeLineGraphic(lineGraphic, backprop ? endPos : startPos, backprop ? startPos : endPos, startRadius, endRadius, backprop ? 'top' : 'bottom')
    lineGraphic.fill({ color: backprop ? coloring.edgeColoring.backprop : coloring.edgeColoring.edge, alpha: 1 })
    
    edgeLineGraphic(lineGraphic, startPos, endPos, startRadius, endRadius, 'top')
    lineGraphic.fill({ color: coloring.edgeColoring.edge, alpha: 1 })
    
    // Create outline line
    if (outlineGraphic) {

        const startWidth = startRadius * 1.5
        const endWidth = endRadius * 1.5
        outlineGraphic.clear()
        
        // Outline top line with reverse direction if backprop
        edgeLineGraphic(outlineGraphic, backprop ? endPos : startPos, backprop ? startPos : endPos, 
        startWidth, endWidth, backprop ? 'top' : 'bottom')
        edgeLineGraphic(outlineGraphic, startPos, endPos, startWidth, endWidth, 'top')
        outlineGraphic.fill({ color: 0xFF0000, alpha: 0.8 })
        outlineGraphic.visible = false
    }
}

export function scaleAndPivot(noduleSprite: Sprite, radius: number) {
    noduleSprite.height = radius * 2
    noduleSprite.width = radius * 2
    noduleSprite.pivot.set(radius)
}


export function getStartNoduleRadius(graph: Graph, id: Id) {
    const edge = graph.edgeIdMap[id];
    if (edge.startNodeId) {
        // If connected
        return calculateStartNoduleRadius(graph, id);
    }
    // If being dragged
    return calculateNoduleRadiusFromPosition(graph, id, 'start-nodule');
}

export function getEndNoduleRadius(graph: Graph, id: Id) {
    const edge = graph.edgeIdMap[id];
    if (edge.endNodeId) {
        // If connected
        return calculateEndNoduleRadius(graph, id);
    }
    // If being dragged
    return calculateNoduleRadiusFromPosition(graph, id, 'end-nodule');
}

function calculateStartNoduleRadius(graph: Graph, id: Id) {
    const edge = graph.edgeIdMap[id];
    const startNodeId = edge.startNodeId;
    const startNode = startNodeId ? graph.nodeIdMap[startNodeId] : null;
    const startNodeParentId = startNode?.parent;
    const startNodeParent = startNodeParentId ? graph.nodeIdMap[startNodeParentId] : null;
    const startNoduleRadius = startNodeParent?.childrenScale ? NODULE_RADIUS * startNodeParent.childrenScale : NODULE_RADIUS;
    return startNoduleRadius;
}

function calculateEndNoduleRadius(graph: Graph, id: Id) {
    const edge = graph.edgeIdMap[id];
    const endNodeId = edge.endNodeId;
    if (endNodeId) {
        const endNode = graph.nodeIdMap[endNodeId];
        const endNodeParentId = endNode?.parent;
        const endNodeParent = endNodeParentId ? graph.nodeIdMap[endNodeParentId] : null;
        const endNoduleRadius = endNodeParent?.childrenScale ? NODULE_RADIUS * endNodeParent.childrenScale : NODULE_RADIUS;
        return endNoduleRadius;
    }
    return calculateStartNoduleRadius(graph, id);
}

function calculateNoduleRadiusFromPosition(graph: Graph, id: Id, noduleType: 'start-nodule' | 'end-nodule') {
    const edge = graph.edgeIdMap[id];
    const pos = noduleType === 'start-nodule' ? edge.startPos : edge.endPos;

    // Check each node to see if the nodule position falls within its bounds
    for (const nodeId in graph.nodeIdMap) {
        const node = graph.nodeIdMap[nodeId];
        // Only check abstraction nodes (nodes with children)
        if (node.children && node.children.length > 0) {
            // Get the parent's childrenScale to determine this node's radius
            const nodeRadius = NODE_RADIUS * getNodeScale(nodeId, graph.nodeIdMap);
            
            if (isPointWithinCircle(pos, nodeRadius, node.position)) {
                return NODULE_RADIUS * (node.childrenScale || 1);
            }
        }
    }

    return NODULE_RADIUS;
}
