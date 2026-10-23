import { IEdge, INode, NodeTypeEnum } from "@/app/proto/compiled"
import { EdgeAccumulator, NodeAccumulator } from "@/app/store/features/workspace/thunks/accumulators"
import { Id } from "@/app/types/common"
import { Graph, NodePropValue, Node, Edge, EdgePropValue } from "@/app/types/main"
import { getEndNoduleRadius, getStartNoduleRadius, scaleAndPivot, updateEdgeLine } from "./edgeHelpers"
import { updateDisplay as updateDisplay, updateDisplayObjScaleAndPosition } from "./nodeHelpers"
import { populateAbsNodeDisplayObjs, populateBaseNodeDisplayObjs, populateEdgeDisplayObjs } from "./graphDisplayObjs"
import { AccessoryState, graphController, graphs } from "@/app/globalObjs"
import store from "@/app/store/store"
import { createAddDeltas, createDeleteDeltas, createUpdateDeltas } from "@/app/store/features/workspace/workspaceSlice"
import _ from "lodash"
import { TextureMap } from "./graphController"
import { Graphics } from "pixi.js"






export interface ICommand {
    execute: (graphId: Id, visualUpdates?: boolean) => void
    undo: (graphId: Id, accessoryState: AccessoryState) => void
}

interface IModifyGraphCommand extends ICommand {
    ids: Id[]
    oldValues?: NodePropValue[]
    newValues?: NodePropValue[]
    accumulator?: NodeAccumulator | EdgeAccumulator
}

interface IToolCommand extends ICommand {
    ids: Id[]
}




export class ApplyAccumulatorCommand implements IModifyGraphCommand {

    ids: Id[] = []
    oldValues: (INode | IEdge)[] = []
    newValues: (INode | IEdge)[] = []
    accumulator: NodeAccumulator | EdgeAccumulator

    constructor(accumulatorOrId: NodeAccumulator | EdgeAccumulator | Id, type?: 'node' | 'edge', property?: keyof Edge | keyof Node, newValue?: EdgePropValue | NodePropValue ) {
        this.accumulator = new NodeAccumulator()
        if (typeof accumulatorOrId === 'string' ) {
            if (type === 'node') {
                this.accumulator.createEntry('update', accumulatorOrId, property as keyof Node, newValue)
            } else if (type === 'edge') {
                const acc = new EdgeAccumulator()
                acc.createEntry('update', accumulatorOrId, property as keyof Edge, newValue)
                this.accumulator = acc
            }
        } else {
            this.accumulator = accumulatorOrId as NodeAccumulator | EdgeAccumulator
        }
    }

    execute(graphId: Id, visualUpdates = true) {

        const graph = graphs[graphId]
        
        if (this.accumulator instanceof NodeAccumulator) {

            const changes = []

            for (let [id, update] of Object.entries(this.accumulator.update)) {
                for (let [prop, newVal] of Object.entries(update)) {
                    const node = graph.nodeIdMap[id]
                    if (!node) continue;
                    this.ids.push(id)
                    const oldVal = _.cloneDeep(node[prop as keyof Node])
                    this.oldValues.push(oldVal)
                    this.newValues.push(newVal)
                    graph.nodeIdMap[id][prop as keyof Node] = newVal
                    changes.push({ id, property: prop, newValue: newVal, oldValue: oldVal})
                    
                    if (!visualUpdates) continue;
                    if (prop === 'position' || prop === 'parent') {
                        updateDisplayObjScaleAndPosition(id, graph)
                    } else if (prop === 'metadata' || prop === 'displayValue') {
                        updateDisplay(graph, id)                    
                    }
                }
            }
            for (let [id, additions] of Object.entries(this.accumulator.add)) {
                for (let [prop, newAdditions] of Object.entries(additions)) {
                    const node = graph.nodeIdMap[id]
                    if (!node) continue;
                    this.ids.push(id)
                    const oldVal = [... node[prop as keyof Node] ]
                    this.oldValues.push({ [prop]: oldVal})
                    const newVal = [...oldVal, ...newAdditions ?? []]
                    graph.nodeIdMap[id][prop as keyof Node] = newVal
                    this.newValues.push({ [prop]: newVal})
                    changes.push({ id, property: prop, newValue: newVal, oldValue: oldVal})
                }
            }
            for (let [id, subtractions] of Object.entries(this.accumulator.sub)) {
                for (let [prop, toBeSubtracted] of Object.entries(subtractions)) {
                    const node = graph.nodeIdMap[id]
                    if (!node) continue;
                    this.ids.push(id)
                    const oldVal= [...node[prop as keyof Node] ]
                    this.oldValues.push({ [prop]: oldVal})
                    const newVal = node[prop as keyof Node].filter((item: string) => toBeSubtracted?.includes(item));
                    this.newValues.push({ [prop]: newVal})
                    changes.push({ id, property: prop, newValue: newVal, oldValue: oldVal})
                }
            }

            store.dispatch(createUpdateDeltas({ graphProperty: 'nodeIdMap', values: changes}))

        } else if (this.accumulator instanceof EdgeAccumulator) {

            const changes = []

            for (let [id, update] of this.accumulator.update) {
                for (let [prop, newVal] of Object.entries(update)) {

                    const edge = graph.edgeIdMap[id]
                    if (!edge) continue;
                    this.ids.push(id)
                    const oldVal = edge[prop as keyof Edge]
                    
                    this.oldValues.push({ [prop]: oldVal})
                    this.newValues.push({ [prop]: newVal})
                    graph.edgeIdMap[id][prop as keyof Edge] = newVal
                    changes.push({ id, property: prop, newValue: newVal, oldValue: oldVal})
                    
                    if (!visualUpdates) continue;
                    const startNoduleRadius = getStartNoduleRadius(graph, id)
                    const endNoduleRadius = getEndNoduleRadius(graph, id)
                    if (edge.line) updateEdgeLine(edge.line, edge.startPos, edge.endPos, startNoduleRadius, endNoduleRadius, edge.outline, edge.backprop)
                    if (edge.thumbnailLine) updateEdgeLine(edge.thumbnailLine, edge.startPos, edge.endPos, startNoduleRadius, endNoduleRadius)
                    if (edge.commitLine) updateEdgeLine(edge.commitLine, edge.startPos, edge.endPos, startNoduleRadius, endNoduleRadius)

                    scaleAndPivot(edge.startNodule!, startNoduleRadius)
                    scaleAndPivot(edge.endNodule!, endNoduleRadius)
                    edge.startNodule!.x = edge.startPos[0]     
                    edge.startNodule!.y = edge.startPos[1]
                    edge.endNodule!.x = edge.endPos[0] 
                    edge.endNodule!.y = edge.endPos[1] 
                }
                
            }

            store.dispatch(createUpdateDeltas({ graphProperty: 'edgeIdMap', values: changes}))

        }
    }

    undo(graphId: Id) {
        const graph = graphs[graphId]
        for (let i = 0; i < this.ids.length; i++) {
            const id = this.ids[i];
            if (this.accumulator instanceof NodeAccumulator) {
                Object.assign(graph.nodeIdMap[id], this.oldValues[i]);
            } else if (this.accumulator instanceof EdgeAccumulator) {
                Object.assign(graph.edgeIdMap[id], this.oldValues[i]);
            }
        }
    }
}


export class AddNodesCommand implements IModifyGraphCommand {

    ids: Id[] = []
    newValues: Node[] = []

    constructor(ids: Id[], nodes: Node[]) {
        this.ids = ids
        this.newValues = nodes
    }

    execute(graphId: Id) {
        const graph = graphs[graphId]
        for (let i = 0; i < this.ids.length; i++) {
            const id = this.ids[i]
            graph.nodeIdMap[id] = this.newValues[i]
            const node = graph.nodeIdMap[id]


            if (Number(node.type) === NodeTypeEnum.ABS) {
                node.container = populateAbsNodeDisplayObjs(graph, id, graphController.mainTextureMap)
                node.thumbnailContainer = populateAbsNodeDisplayObjs(graph, id, graphController.thumbnailTextureMapMap.get(graphId)!, false)
                node.commitContainer = populateAbsNodeDisplayObjs(graph, id, graphController.commitTextureMap, false)
            } else {
                node.container = populateBaseNodeDisplayObjs(graph, id, graphController.mainTextureMap)
                node.thumbnailContainer = populateBaseNodeDisplayObjs(graph, id, graphController.thumbnailTextureMapMap.get(graphId)!, false)
                node.commitContainer = populateBaseNodeDisplayObjs(graph, id, graphController.commitTextureMap, false)
            }
            graph.container?.addChild(node.container)
            graph.thumbnailContainer?.addChild(node.thumbnailContainer)
            graph.commitContainer?.addChild(node.commitContainer)

        }
        store.dispatch(createAddDeltas({ graphProperty: "nodeIdMap", newIds: this.ids, newObjs: this.newValues }))
    }

    undo(graphId: Id) {
        const graph = graphs[graphId]
        for (let i = 0; i < this.ids.length; i++) {
            delete graph.nodeIdMap[this.ids[i]]
        }
    }
}

export class DeleteNodesCommand implements IModifyGraphCommand {
    ids: Id[] = []
    oldValues: Node[] = []

    constructor(ids: Id[]) {
        this.ids = ids
        
    }

    execute(graphId: Id) {
        const graph = graphs[graphId]
        for (let i = 0; i < this.ids.length; i++) {
            const id = this.ids[i]
            const node = graph.nodeIdMap[id]
            if (!node) continue;
            this.oldValues[i] = node
            if (node.container) graph.container?.removeChild(node.container)
            if (node.thumbnailContainer) graph.thumbnailContainer?.removeChild(node.thumbnailContainer)
            if (node.commitContainer) graph.commitContainer?.removeChild(node.commitContainer)
            delete graph.nodeIdMap[id]
        }
        store.dispatch(createDeleteDeltas({ graphProperty: "nodeIdMap", ids: this.ids, oldObjs: this.oldValues }))

    }

    undo(graphId: Id) {
        const graph = graphs[graphId]
        for (let i = 0; i < this.ids.length; i++) {
            graph.nodeIdMap[this.ids[i]] = this.oldValues[i]
        }
    }
}

export class AddEdgesCommand implements IModifyGraphCommand {
    ids: Id[] = []
    newValues: Edge[] = []

    constructor(ids: Id[], edges: Edge[]) {
        this.ids = ids
        this.newValues = edges
    }

    execute(graphId: Id) {
        const graph = graphs[graphId]
        for (let i = 0; i < this.ids.length; i++) {
            const id = this.ids[i]
            graph.edgeIdMap[id] = this.newValues[i]
            const edge = graph.edgeIdMap[id]
            edge.container =  populateEdgeDisplayObjs(graph, id, graphController.mainTextureMap, true)
            edge.thumbnailLine =  populateEdgeDisplayObjs(graph, id, graphController.thumbnailTextureMapMap.get(graphId)!, false) as Graphics
            edge.commitLine =  populateEdgeDisplayObjs(graph, id, graphController.commitTextureMap, false) as Graphics
            graph.container?.addChild(edge.container)
            graph.thumbnailContainer?.addChild(edge.thumbnailLine)
            graph.commitContainer?.addChild(edge.commitLine)
        }

        store.dispatch(createAddDeltas({ graphProperty: "edgeIdMap", newIds: this.ids, newObjs: this.newValues }))

    }

    undo(graphId: Id) {
        const graph = graphs[graphId]
        for (let i = 0; i < this.ids.length; i++) {
            delete graph.edgeIdMap[this.ids[i]]
        }
    }
}

export class DeleteEdgesCommand implements IModifyGraphCommand {
    ids: Id[] = []
    oldValues: Edge[] = []

    constructor(ids: Id[]) {
        this.ids = ids
    }

    execute(graphId: Id) {
        const graph = graphs[graphId]
        for (let i = 0; i < this.ids.length; i++) {
            const id = this.ids[i]
            const edge = graph.edgeIdMap[id]
            if (!edge) continue;
            this.oldValues[i] = edge
            if (edge.container) graph.container?.removeChild(edge.container)
            if (edge.thumbnailLine) graph.thumbnailContainer?.removeChild(edge.thumbnailLine)
            if (edge.commitLine) graph.commitContainer?.removeChild(edge.commitLine)
            delete graph.edgeIdMap[id]
        }

        store.dispatch(createDeleteDeltas({ graphProperty: "edgeIdMap", ids: this.ids, oldObjs: this.oldValues }))

    }

    undo(graphId: Id) {
        const graph = graphs[graphId]
        for (let i = 0; i < this.ids.length; i++) {
            graph.edgeIdMap[this.ids[i]] = this.oldValues[i]
        }
    }
}


//* Tool Commands




// export class SetNodesWithinBrush implements IToolCommand {

//     ids: Id[] = []

//     constructor(ids: Id[]) {
//         this.ids = ids
//     }

//     execute(graph: Graph, accessoryState: AccessoryState ) {
//         for (let i = 0; i < this.ids.length; i++) {
//             const id = this.ids[i]
//             if (graph.nodeIdMap[id].outline){
//                 graph.nodeIdMap[id].outline.visible = true
//             }

//             accessoryState.nodesWithinBrush.add(id)
//         }
//     }

//     undo(graph: Graph, accessoryState: AccessoryState) {
//         for (let i = 0; i < this.ids.length; i++) {
//             const id = this.ids[i]
//             if (graph.nodeIdMap[id].outline) { 
//                 graph.nodeIdMap[id].outline.visible = false
//             }


//             accessoryState.nodesWithinBrush.delete(id)
//         }
//     }
    
// }

// export class SetMultiConnectNodes implements IToolCommand {
//     ids: Id[] = []

//     constructor(ids: Id[]) {
//         this.ids = ids
//     }

//     execute(graph: Graph, accessoryState: AccessoryState ) {
//         for (let i = 0; i < this.ids.length; i++) {
//             const id = this.ids[i]
//             if (graph.nodeIdMap[id].outline) {
//                 graph.nodeIdMap[id].outline.visible = true
//             }

//             accessoryState.multiConnect.push(id)
//         }
//     }

//     undo(graph: Graph, accessoryState: AccessoryState) {
//         for (let i = 0; i < this.ids.length; i++) {
//             const id = this.ids[i]
//             if (graph.nodeIdMap[id].outline) {
//                 graph.nodeIdMap[id].outline.visible = false
//             }

//             accessoryState.multiConnect = accessoryState.multiConnect.filter(nodeId => nodeId !== id)
//         }
//     }
// }



