import { calculateCentroid, generateId } from '@/app/services/math'

//Types
import {  Graph } from "@/app/types/main"
import { Id, Pos } from "@/app/types/common"
import _ from "lodash"
import {  getAbsNodeTemplate, getBaseNodeTemplate } from "@/app/templates"
import { scaleAndCenterChildren } from "../update/nodes"
import { NodeAccumulator } from '../accumulators'
import { getMetadata } from '@/app/nodes/helpers'
import { graphController } from '@/app/globalObjs'
import { AddNodesCommand, ApplyAccumulatorCommand } from '@/app/components/Workspace/commands'
import { NodeTypeEnum } from '@/app/proto/compiled'




/**
 * Creates a new base node
 * called by baseNodes when a node is dropped on the workspace
 */
export const createBaseNode = (type: NodeTypeEnum, pos: Pos) => {
    
    //Generate id and make node object
    const newId = generateId(8)

    const newNode = getBaseNodeTemplate()
    newNode.position = pos
    newNode.type = type

    
    const initialMetadata = getMetadata(type)
    if (initialMetadata) newNode.metadata = initialMetadata

    //Add node to current graph
    // dispatch(workspaceSlice.actions.addNodes( {newIds: [newId], newNodes: [newNode]}))
    graphController.addCommand(new AddNodesCommand([newId], [newNode]))
}



export const createAbstractionNode = (graph: Graph, children: Id[]) => {


    //Generate new id
    const newId = generateId(8);
    //Create Abstraction node object
    const newAbstractionNode = getAbsNodeTemplate()

    const nodeAccumulator = new NodeAccumulator()
    //Set parent to be old parent of children
    const oldParent = graph.nodeIdMap[children[0]]?.parent //Assumes all children have the same parent
    if (oldParent) {
        newAbstractionNode.parent = oldParent
        //Delete children from old abstraction node children
        nodeAccumulator.createEntry('sub', oldParent, 'children', children)
        //Add new abstraction node to be child of old parent
        nodeAccumulator.createEntry('add', oldParent, 'children', [newId])
    }
    //Update parent of each child to this new abstraction node
    children.forEach(id => {
        nodeAccumulator.createEntry('update', id, 'parent', newId)
    })
    //Set children
    newAbstractionNode.children = children
    //Set Position
    const childrenPositions = children.map(childId => graph.nodeIdMap[childId]?.position)
    const childrenCentroid = calculateCentroid(childrenPositions)
    newAbstractionNode.position = childrenCentroid

    //Add object to nodeIdMap
    // dispatch(addNodes({newIds: [newId], newNodes: [newAbstractionNode]}))
    graphController.addCommand(new AddNodesCommand([newId], [newAbstractionNode]))
    //Apply updates
    // dispatch(applyNodeAccumulator({ nodeAccumulator}))
    graphController.addCommand(new ApplyAccumulatorCommand(nodeAccumulator))
    //Scale and center children
    scaleAndCenterChildren(graph, newId)
}






