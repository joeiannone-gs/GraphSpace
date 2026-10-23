import { NODE_RADIUS } from "@/app/sizing/nodes"
import { Id, Pos } from "@/app/types/common"
import { Container, Graphics, Sprite, Texture } from "pixi.js"
import { getNodeScale, updateDisplay } from "./nodeHelpers"
import { DragTarget, Graph, Node } from "@/app/types/main"
import store from "@/app/store/store"
import { onDragStart } from "@/app/store/features/workspace/thunks/update/nodes"
import workspaceSlice, { updateCurrentSelectedItem } from "@/app/store/features/workspace/workspaceSlice"
import { createEdgeFromUserAction } from "@/app/store/features/workspace/thunks/create/edges"
import { updateEdgeEndNode, updateEdgeStartNode } from "@/app/store/features/workspace/thunks/update/edges"
import { mainRenderer, mainStage } from "@/app/globalObjs"
import { getEndNoduleRadius, getStartNoduleRadius, scaleAndPivot, updateEdgeLine } from "./edgeHelpers"
import { isAbsNode } from "@/app/services/graphTheory"
import { TextureMap } from "./graphController"
import { edgeLineGraphic } from "@/app/services/graphics"





export function populateGraphDisplayObjs(type: 'main' | 'thumbnail' | 'commit', graph: Graph, textureMap: TextureMap) {

    
    //main
    if (type === 'main') {

        graph.container = new Container()
        for (let [id, node] of Object.entries(graph.nodeIdMap)) {
            if (isAbsNode(node)) {
                node.container= populateAbsNodeDisplayObjs(graph, id, textureMap, true)
            } else {
                node.container = populateBaseNodeDisplayObjs(graph, id, textureMap, true)
            }
            graph.container.addChild(node.container)
        }
        for (let [id, edge] of Object.entries(graph.edgeIdMap)) {
            edge.container = populateEdgeDisplayObjs(graph, id, textureMap, true)
            graph.container.addChild(edge.container)
        }
    } else if (type === 'thumbnail') {
        graph.thumbnailContainer = new Container()
        for (let [id, node] of Object.entries(graph.nodeIdMap)) {
            if (isAbsNode(node)) {
                node.thumbnailContainer = populateAbsNodeDisplayObjs(graph, id, textureMap, false)
            } else {
                node.thumbnailContainer = populateBaseNodeDisplayObjs(graph, id, textureMap, false)
            }
            graph.thumbnailContainer.addChild(node.thumbnailContainer)
        }
        for (let [id, edge] of Object.entries(graph.edgeIdMap)) {
            edge.thumbnailLine = populateEdgeDisplayObjs(graph, id, textureMap, false) as Graphics
            graph.thumbnailContainer.addChild(edge.thumbnailLine)
        }
    } else if (type === 'commit') {
        graph.commitContainer = new Container()
        for (let [id, node] of Object.entries(graph.nodeIdMap)) {
            if (isAbsNode(node)) {
                node.commitContainer = populateAbsNodeDisplayObjs(graph, id, textureMap, false)
            } else {
                node.commitContainer = populateBaseNodeDisplayObjs(graph, id, textureMap, false)
            }
            graph.commitContainer.addChild(node.commitContainer)
        }
        for (let [id, edge] of Object.entries(graph.edgeIdMap)) {
            edge.commitLine = populateEdgeDisplayObjs(graph, id, textureMap, false) as Graphics
            graph.commitContainer.addChild(edge.commitLine)
        }
    }

}


export function populateBaseNodeDisplayObjs(graph: Graph, id: Id, textureMap: TextureMap, isInteractive = true) {

    const node = graph.nodeIdMap[id]
    
    const scale = getNodeScale(id, graph.nodeIdMap)
    const pos = node.position
    const { c0, c1 } = createNodeContainer(pos, scale)

    
    const baseNodeTexture = isInteractive ?  textureMap.get('baseNode') : textureMap.get('baseNodeThumbnail')
    const background = new Sprite(baseNodeTexture)
    background.pivot.set(NODE_RADIUS)

    c1.addChild( background)

    if (isInteractive) {

        node.outline = new Graphics()
        node.edgeCreationOverlay = new Graphics()
        node.edgeDropOverlay = new Graphics()

        c0.on('pointerdown', (e) => {
            e.stopImmediatePropagation()
            e.stopPropagation()
            store.dispatch(workspaceSlice.actions.updateCurrentSelectedItem({type: 'node', id: id}))

            //Make drag target
            const newDragTarget = {type: 'node', id: id} as DragTarget;
            onDragStart(graph, newDragTarget)
        })
    

        createEdgeCreationOverlay(graph, node.edgeCreationOverlay, id)
        
        createEdgeDropOverlay(graph, node.edgeDropOverlay, id)
        
        node.outline.circle(0, 0, NODE_RADIUS + 10);
        node.outline.stroke({color: 'red', width: 10})
        node.outline.visible = false
        
        if (!node.mainDisplay) node.mainDisplay = new Container()
        node.mainDisplay.eventMode = 'none'
        updateDisplay(graph, id)
        
        c1.addChild(node.outline, node.mainDisplay, node.edgeDropOverlay, node.edgeCreationOverlay)    
        
        // node.container = c0
        // graph.container!.addChild(node.container)
    } 
    
    
    c0.addChild(c1)
    return c0
    
}


function createEdgeCreationOverlay(graph: Graph, overlay: Graphics, id: Id) {
    overlay.circle(0, 0, NODE_RADIUS)
    overlay.fill({color: 'green', alpha: 0.5})
    overlay.eventMode = 'static'
    overlay.cursor = 'pointer'
    overlay.on('pointerdown', (event) => {
        event.stopImmediatePropagation() //so it doesnt drag the node
        event.stopPropagation()
        // this.pixiContainer.eventMode = 'none'
        // const dragEndCallback = () => this.pixiContainer.eventMode = 'static'
        createEdgeFromUserAction(graph, id, event)
    })
    overlay.visible = false
    
}

function createEdgeDropOverlay(graph: Graph, overlay: Graphics, id: Id) {
    overlay.circle(0, 0, NODE_RADIUS)
    overlay.fill({color: 'red', alpha: 0.5})
    overlay.cursor = 'pointer'
    overlay.alpha = 0.01 //alpha instead of visibility bc invisibly obj dont have events
    overlay.on('pointerup', () => {
        const dragTarget = store.getState().workspace.dragTarget
        if (dragTarget.id) {
            if (dragTarget.type == 'start-nodule') {
                updateEdgeStartNode(graph, dragTarget.id, id)
            } else if (dragTarget.type == 'end-nodule') {
                updateEdgeEndNode(graph, dragTarget.id, id)
            }
        }
        overlay.alpha = 0.01
    })
    overlay.on('mouseover', () => {
        const dragTarget = store.getState().workspace.dragTarget
        const isDraggingNodule = ['start-nodule', 'end-nodule'].includes(dragTarget.type ?? "")
        if (isDraggingNodule) {
            const endNodule = graph.edgeIdMap[dragTarget.id ?? ""]?.endNodule
            const line = graph.edgeIdMap[dragTarget.id ?? ""]?.line
            if (endNodule) endNodule.eventMode = 'none'
            if (line) line.eventMode = 'none'
            overlay.alpha = 1
        }
    })
    overlay.on('mouseout', () => {
        const dragTarget = store.getState().workspace.dragTarget
        const endNodule = graph.edgeIdMap[dragTarget.id ?? ""]?.endNodule
        const line = graph.edgeIdMap[dragTarget.id ?? ""]?.line
        if (endNodule) endNodule.eventMode = 'none'
        if (line) line.eventMode = 'none'

        overlay.alpha = 0.01
    })
}






export function populateAbsNodeDisplayObjs(graph: Graph, id: Id, textureMap: TextureMap, isInteractive = true) {

    const node = graph.nodeIdMap[id]
    // const coloring = getColoring(true).nodeColoring.abs

    const scale = getNodeScale(id, graph.nodeIdMap)
    const { c0, c1 } = createNodeContainer(node.position, scale)
    const border = isInteractive ? new Sprite(textureMap.get('absNode')) : new Sprite(textureMap.get('absNodeThumbnail'))
    c1.addChild(border)

    border.eventMode = "none"
    border.pivot.set(NODE_RADIUS)

    if (isInteractive) {

        node.container = c0
        node.outline = new Graphics()
        node.outline.eventMode = "none"
        node.outline.circle(0, 0, NODE_RADIUS + 10);
        node.outline.stroke({color: 'red', width: 10})
        node.outline.visible = false
        
        node.absNodeOverlay = new Sprite(textureMap.get('absNodeOverlay'))
        node.absNodeOverlay.pivot.set(NODE_RADIUS)
        createAbstractionNodeOverlay(graph, id, node.absNodeOverlay)
        
        updateDisplay(graph, id)
        
        c1.addChild( node.outline, node.absNodeOverlay)
        
    }


    c0.addChild(c1)
    return c0

}



function createAbstractionNodeOverlay(graph: Graph, id: Id, overlay: Sprite) {
    const node = graph.nodeIdMap[id]

    if (!node.container) return

    overlay.cursor = 'pointer'
    overlay.on('pointerdown', (event) => {
        // event.stopImmediatePropagation() //so it doesnt drag the node
        // event.stopPropagation()
        store.dispatch(workspaceSlice.actions.updateCurrentSelectedItem({type: 'abs', id}))
        const newDragTarget = {type: 'abs', id} as DragTarget;
        onDragStart( graph, newDragTarget)
    })
    node.container.off('mouseenter')
    node.container.on('mouseenter', () => {
        const isDraggingNodule = ['start-nodule', 'end-nodule'].includes(store.getState().workspace.dragTarget.type ?? "")
        if (isDraggingNodule) {
            overlay.visible = false
        }
        mainStage.on('pointermove', (e) => {
            const isWithin = node?.container?.getBounds().containsPoint(e.globalX, e.globalY)
                if (!isWithin) {
                overlay.visible = true 
            }
        })
    })
}


export function populateEdgeDisplayObjs(graph: Graph, id: Id, textureMap: TextureMap, isInteractive = true): Container | Graphics {

    const edge = graph.edgeIdMap[id]

    // const coloring = getColoring(store.getState().panels.darkMode)

    const startPos = edge.startPos
    const endPos = edge.endPos

    const c0 = new Container()
    c0.zIndex = 1

    const startNoduleRadius = getStartNoduleRadius(graph, id)
    const endNoduleRadius = getEndNoduleRadius(graph, id)

    if (isInteractive) {

        edge.line = new Graphics()
        edge.outline = new Graphics()

        
        updateEdgeLine(edge.line, startPos, endPos, startNoduleRadius, endNoduleRadius, edge.outline, edge.backprop)
        
        edge.line.on('pointerover', () => onHover(edge.line ?? new Graphics() ))
        edge.line.on('pointerout', ()=> hoverEnd(edge.line ?? new Graphics()))
        edge.line.off('pointerdown')
        edge.line.on('pointerdown', () => {
            store.dispatch(updateCurrentSelectedItem({type: 'edge', id: id}))
        })

    
        // Nodules
        const dragEndCallback = () => {
            if (edge.container) edge.container.eventMode = 'static'
        }
        const drag = (newDragTarget: DragTarget) => onDragStart(graph, newDragTarget, dragEndCallback)
        
        // startNodule = new Graphics()
        // makeInteractiveCircle(startNodule, startNoduleRadius, coloring.edgeColoring.nodule, true)
        edge.startNodule = new Sprite(textureMap.get('nodule'))
        scaleAndPivot(edge.startNodule, getStartNoduleRadius(graph, id))
        createNodule(edge.startNodule, startPos, id, 'start-nodule', drag)
        
        
        edge.endNodule = new Sprite(textureMap.get('nodule'))
        scaleAndPivot(edge.endNodule, getEndNoduleRadius(graph, id))
        createNodule(edge.endNodule, endPos, id, 'end-nodule', drag)
        
        c0.addChild(edge.outline, edge.line, edge.startNodule, edge.endNodule )
        return c0

    } else {
        const line = new Graphics()
        updateEdgeLine(line, startPos, endPos, startNoduleRadius, endNoduleRadius)
        return line
    }

}

function createNodule(s: Sprite, position: Pos, id: Id, type: 'start-nodule' | 'end-nodule', onDragStart: (dragTarget: DragTarget) => void) {
    s.alpha = 1
    s.cursor = 'grab'
    s.x = position[0]
    s.y = position[1]
    
    s.off('pointerdown')
    s.on('pointerdown', (event) => {
        event.stopPropagation()
        onDragStart({type, id})
    })
}



//* Helpers

function createNodeContainer(pos: Pos, scale: number) {
    const c0 = new Container()

    //Set up outer container
    c0.x = pos[0] + NODE_RADIUS * scale
    c0.y = pos[1] + NODE_RADIUS * scale
    c0.pivot.set(NODE_RADIUS, NODE_RADIUS )
    c0.scale.set(scale)

    //Inner Container
    const c1 = new Container()

    return { c0, c1 }
}

export function onHover (g: Graphics){
    g.alpha = 0.25
    g.cursor = "pointer"
}

export function hoverEnd (g: Graphics){
    g.alpha = 1
    g.cursor = "auto"
}
