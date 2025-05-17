import { calculatePointDifference, isPointWithinCircle, screenToWorld, findCircleLineIntersections, pointComparison, calculateDistance } from '@/app/services/math'
import workspaceSlice from "../../workspaceSlice"

import { DragTarget, Graph } from '@/app/types/main'
import { Id, Pos, Tensor } from "@/app/types/common"
import store from "@/app/store/store"
import { NODE_RADIUS } from '@/app/sizing/nodes';
import * as PIXI from "pixi.js";
import { SCALE_ZONE_RADIUS } from '@/app/sizing/nodes'
import { scaleAndCenterChildrenHelper, updateAbstractionNodePositionHelper, updateBaseNodePositionHelper } from './helpers'
import {  updateEndNodulePosition, updateStartNodulePosition } from './edges'
import { getConnectedNodes } from '@/app/services/graphTheory'
import { calculateGradientPaths, setBackPropEdges } from '../../helpers'
import { NodeAccumulator } from '../accumulators'
import { dataflowChangeSideEffects } from '../dataflowChangeSideEffects'
import { accessoryState, graphController, mainStage } from '@/app/globalObjs'
import { metadataToPb } from '@/app/proto/helpers'
import { ApplyAccumulatorCommand, DeleteNodesCommand } from '@/app/components/Workspace/commands'




export const updateAbsNodeSubType = (graph: Graph, id: Id, subType: "normal" | "loss" | "predictor") => {

    

        const node = graph.nodeIdMap[id]

        //Clear backprop edges if previous type was 'loss'
        if (graph.gradientPathMap.map && node.metadata?.values?.["purpose"]?.stringValue === 'loss') {
            //for all previous gradient path maps whose loss node was this node, remove
            for (let entry of Object.keys(graph.gradientPathMap.map)) {
                const [predId, lossId] = entry.split('->-')
                if (lossId === id) {
                    const edgeAccumulator = setBackPropEdges(graph.gradientPathMap.map[entry], false)
                    graphController.addCommand(new ApplyAccumulatorCommand(edgeAccumulator))
                    delete graph.gradientPathMap.map[entry]
                }
            }
        }
       
        //Change type to new type 
        graphController.addCommand( new ApplyAccumulatorCommand(id, 'node', 'metadata', metadataToPb([subType], ["purpose"]) ))

        if (subType === 'loss') {

            const {nodeIdMap, edgeIdMap} = graph

            if ( nodeIdMap && edgeIdMap) {
                //If new type is loss, get all edges into loss node and params
                const  gradientPathMap  = calculateGradientPaths(id, nodeIdMap, edgeIdMap)
                //Create gradient path
                Object.keys(gradientPathMap.map).forEach((entry: string) => {
                    if (!graph.gradientPathMap?.map) graph.gradientPathMap = { map: {}}
                    let pathElems = gradientPathMap.map[entry]
                    if (!pathElems) {
                        pathElems = { ids: [], edgeIds: new Set() }
                    }
                    graph.gradientPathMap.map[entry] = pathElems
                    const edgeAccumulator = setBackPropEdges(pathElems, true)
                    graphController.addCommand(new ApplyAccumulatorCommand(edgeAccumulator))
                })
            }
        }
}


export const updateNodeDisplayValue = (graph: Graph, id: Id, newValue: Tensor | null, sideEffects = true) => {
        
        const node = graph.nodeIdMap[id]
        if (node) {
            graphController.addCommand( new ApplyAccumulatorCommand (id, 'node', 'displayValue', newValue ))
        }

        const affectedNodes = getConnectedNodes(id, graph.nodeIdMap, graph.edgeIdMap, 1, 'out')

        if (sideEffects) dataflowChangeSideEffects(graph, affectedNodes)
    
}



export const updateAbstractionNodePosition = (graph: Graph, id: Id, newPos: Pos) => {
    updateAbstractionNodePositionHelper(graph, id, newPos)    
}

export const updateBaseNodePosition = (graph: Graph, id: Id, newPos: Pos) => {
    updateBaseNodePositionHelper(graph, id, newPos)
}

export const scaleAndCenterChildren = (graph: Graph, id: Id) => {
    scaleAndCenterChildrenHelper(graph, id)
}


/**
 * Update the parent abstraction node if dragged out or dragged in
 */
export const updateParentIfNecessary = (graph: Graph, id: Id, newPos: Pos) => {

        const node = graph.nodeIdMap[id]

        if (!graph || !node) {
            return
        }

        const nodeIdMap = graph.nodeIdMap
        const parentId = node?.parent ?? ""
        const parentObj = graph.nodeIdMap[parentId]

        const parentOfParent = graph.nodeIdMap[parentObj?.parent ?? ""]
        const parentOfParentRadius = parentOfParent?.childrenScale ? parentOfParent.childrenScale * NODE_RADIUS : NODE_RADIUS

        //Get parent (no parent means it's at base level)
        
        if (parentObj) {
            //Check if being dragged out
            const isInParent = isPointWithinCircle(newPos, parentOfParentRadius, parentObj.position )
            if (!isInParent) {
                updateParent(graph, id, parentObj.parent)
            }
        }

        //Check if being dragged in
        let abstractionNodesToCheck: Id[] = []
        if (parentObj?.children) {
            abstractionNodesToCheck = [...parentObj.children].filter(childId => {
                const childNode = nodeIdMap[childId];
                return childNode && (childNode.children && childNode.children.length > 0) && (childId != id)
            })
        } else {
            //All abstraction nodes without a parent
            abstractionNodesToCheck = Object.keys(nodeIdMap).filter(childId => {
                const childNode = nodeIdMap[childId];
                return childNode && (childNode.children && childNode.children.length > 0) && 
                       (!childNode.parent || childNode.parent === '') &&
                       (childId != id)
            })
        } 
        //If being dragged in, then update parent
        abstractionNodesToCheck.forEach((absId: Id) => {
            const abstractionNode = graph.nodeIdMap[absId]
            const parent = graph.nodeIdMap[abstractionNode.parent!]
            const abstractionNodeScale = parent?.childrenScale ?? 1
            const position = abstractionNode?.position
            if (position && abstractionNodeScale) {
                const isInParent = isPointWithinCircle(newPos, NODE_RADIUS * abstractionNodeScale, position)
                if (isInParent) {
                    updateParent(graph, id, absId)
                }
            }
        })
    
}


export const updateParent = (graph: Graph, id: Id, newParentId: Id | undefined | null) => {

    const node = graph.nodeIdMap[id]

    if (!node) return

    const nodeAccumulator = new NodeAccumulator()

    const oldParentId = node.parent;

    const oldParentSingleChild = (graph.nodeIdMap[oldParentId!]?.children?.length ?? 0) <= 1

    // Remove node from old parent's children list
    if (oldParentId) nodeAccumulator.createEntry('sub', oldParentId, 'children', [id])
    
    // Add node to new parent's children list
    if (newParentId) nodeAccumulator.createEntry('add', newParentId, 'children', [id])
    
    // Update parent property of the node
    nodeAccumulator.createEntry('update', id, 'parent', newParentId ?? "")
    // dispatch(applyNodeAccumulator({ nodeAccumulator }))
    graphController.addCommand( new ApplyAccumulatorCommand(nodeAccumulator))

    //If only one child, delete old parent too
    if (oldParentId && oldParentSingleChild) {
        // dispatch(deleteNodes([oldParentId]))
        graphController.addCommand(new DeleteNodesCommand([oldParentId]))
    }

    //Scale and center
    if (newParentId) scaleAndCenterChildren(graph, newParentId)
    if (oldParentId && !oldParentSingleChild) scaleAndCenterChildren(graph, oldParentId)
    if (node.children && node.children.length > 0) {
        scaleAndCenterChildren(graph, id)
    }  
    
}




//* Dragging





export const onDragStart = (graph: Graph, dragTarget: DragTarget, dragEndCallback?: () => void) => {


    store.dispatch(workspaceSlice.actions.updateDragTarget(dragTarget))

    mainStage.on('pointermove', (event) => onDragMove(graph, event));
    mainStage.on('pointerup', (event) => onDragEnd(graph, event, dragEndCallback));
    mainStage.on('pointerupoutside', (event) => onDragEnd(graph, event, dragEndCallback));
    
}


export const onDragMove = (graph: Graph, event: PIXI.FederatedPointerEvent) => {

        const state = store.getState()

        const dragTarget = state.workspace.dragTarget
        const viewportValues  = accessoryState.viewportValues


        if (dragTarget.id && graph) {

            const {nodeIdMap, edgeIdMap} = graph
            const id = dragTarget.id;

            const node = graph.nodeIdMap[id]
            const parentId = node?.parent;
            
            if (!(id in edgeIdMap) && !(id in nodeIdMap)) {
              return;
            }
      
            const globalPos = [event.globalX, event.globalY] as Pos
            const itemType = dragTarget.type
            const newPos = screenToWorld(globalPos, viewportValues)

      
            /**
             * Update siblings positions/scales if necessary 
             */
            if (parentId && (itemType == 'node' || itemType == 'abs')) {
        
                const parentNode = graph.nodeIdMap[parentId];
                const [x, y] = parentNode.position;
                const siblings = parentNode.children;
                const siblingsScale = parentNode.childrenScale;
                const parentOfParentId = parentNode.parent ?? "";
                const parentOfParentScale = (parentOfParentId ? graph.nodeIdMap[parentOfParentId].childrenScale : 1) ?? 1;
                const draggedSiblingPosition =  (dragTarget.id && siblings?.includes(dragTarget.id)) ? graph.nodeIdMap[dragTarget.id].position : null

                if (siblingsScale) {
                    const draggedNodeRadius = NODE_RADIUS*siblingsScale
                    //Draw line from center of abstraction node to center of drag item
                    //intersection points of line with drag item circle (get furthest point from abstraction center)
                    const draggedNodeIntersections = findCircleLineIntersections(draggedSiblingPosition, draggedNodeRadius, [x,y])
                    const draggedNodePoint = pointComparison(draggedNodeIntersections[0], draggedNodeIntersections[1], [x,y], 'furthest')
                    //intersection points of line with scaleZone circle (get closest to node being dragged)
                    const scaleZoneCircleIntersections = findCircleLineIntersections([x,y], parentOfParentScale * SCALE_ZONE_RADIUS, draggedSiblingPosition)
                    const scaleZoneCirclePoint = pointComparison(scaleZoneCircleIntersections[0], scaleZoneCircleIntersections[1], draggedSiblingPosition, "closest")
                    //If point 2 is closer to abstraction node center, then somepart of the node being dragged is in scale zone
                    if (calculateDistance([x,y], draggedNodePoint) > calculateDistance([x,y], scaleZoneCirclePoint)) {
                        scaleAndCenterChildren(graph, parentId)
                    }
                }                
            }

            if (itemType == 'node') {
                updateBaseNodePosition(graph, id, newPos)
                updateParentIfNecessary(graph, id, newPos)
            } else if ( itemType == 'abs') {
                updateAbstractionNodePosition(graph, id, newPos)
                updateParentIfNecessary(graph, id, newPos)
            } else if (itemType == 'start-nodule') {
                updateStartNodulePosition(graph, id, newPos)
            } else if (itemType == 'end-nodule') {
                updateEndNodulePosition(graph, id, newPos)
            }
            
        } 
}

export const onDragEnd = (graph: Graph, event: PIXI.FederatedPointerEvent, callback?: () => void) => {

        const state = store.getState()

        const dragTarget = state.workspace.dragTarget

        if (dragTarget.id && graph) {

            const viewportValues  = accessoryState.viewportValues
            
            const endingPos = screenToWorld([event.globalX, event.globalY], viewportValues);

            if (dragTarget.type == 'abs') {
                updateAbstractionNodePosition(graph, dragTarget.id, endingPos)
            }
            
            // if (dragTarget.type == 'node' || dragTarget.type == 'abs') {
            //     const parentId = graph.nodeIdMap[dragTarget.id]?.parent
            //     if (parentId) scaleAndCenterChildren(graph, parentId)
            // }
          
            store.dispatch(workspaceSlice.actions.updateDragTarget({ type: null, id: null}));
                
        }

        mainStage.off('pointermove');
        mainStage.off('pointerup');
        mainStage.off('pointerupoutside');

        callback?.()
}


