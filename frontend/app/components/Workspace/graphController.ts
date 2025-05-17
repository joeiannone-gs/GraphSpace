import { Container, Renderer, Texture, Ticker } from "pixi.js"
import { ICommand } from "./commands"
import { Graph } from "@/app/types/main"
import { Id } from "@/app/types/common"
import { accessoryState, graphController, graphs, mainRenderer } from "@/app/globalObjs"
import { populateGraphDisplayObjs } from "./graphDisplayObjs"
import { createAbsNodeGraphic, createAbsNodeGraphicThumbnail, createAbsNodeOverlayGraphic, createBaseNodeGraphic, createBaseNodeGraphicThumbnail, createNoduleGraphic } from "./graphics"
import store from "@/app/store/store"
import { deleteNodes } from "@/app/store/features/workspace/thunks/delete/nodes"
import { deleteEdges } from "@/app/store/features/workspace/thunks/delete/edges"
import { getNodesAndEdgesWithinBrush, getNodesInFocus } from "./graphGetters"




interface IGraphController {
    executeCommands: () => void
    getDisplay: (graphId: Id, canvas: 'main' | 'thumbnail' | 'commit',  renderer: Renderer) => Container | undefined
}


export type TextureMap = Map<string, Texture>

export class GraphController implements IGraphController {

    currentGraphId: Id | null = null
    queue: ICommand[] = []
    mainTextureMap: TextureMap = new Map()
    commitTextureMap: TextureMap = new Map()
    thumbnailTextureMapMap: Map<Id, TextureMap> = new Map()


    constructor( ) {

        this.setupEventHandlers()

        setInterval(() => {
            const graph = graphs[this.currentGraphId] as Graph
            if (!graph) return;
            if ( accessoryState.brush?.[0]) {
                const { nodesWithinBrush, edgesWithinBrush } = getNodesAndEdgesWithinBrush()
                for (let [id, node] of Object.entries(graph.nodeIdMap)) {
                    const outline = node.outline
                    if (outline) {
                        outline.visible = nodesWithinBrush.includes(id)
                    }
                }
                for (let [id, edge] of Object.entries(graph.edgeIdMap)) {
                    const outline = edge.outline
                    if (outline) {
                        outline.visible = edgesWithinBrush.includes(id)
                    }
                }
            }

            const nodesInFocus = getNodesInFocus()
            for (let [id, node] of Object.entries(graph.nodeIdMap)) {
                const overlay = node.absNodeOverlay
                if (overlay) {
                    overlay.visible = !nodesInFocus.has(id)
                }
            }
    
        }, 50)

        setInterval(() => {
            if (!(this.currentGraphId && accessoryState && this.isRenderingReady() )) return
            this.executeCommands()
        }, 16)
    }

    executeCommands() {
        while (this.queue.length > 0 ) {
            const command = this.queue.shift()
            if (command) {
                command.execute(this.currentGraphId!)
            }
        }
    }

    isRenderingReady() {
        return this.mainTextureMap.size > 0 && this.thumbnailTextureMapMap.size > 0 && this.commitTextureMap.size > 0
    }

    setupEventHandlers() {
        const handleKeyDown = (event: KeyboardEvent) => {
            const graph = graphs[this.currentGraphId] as Graph
            //CTRL
            if (event.key === 'Control') {
                for (let node of Object.values(graph?.nodeIdMap ?? {})) {
                    if (node.edgeCreationOverlay) {
                        node.edgeCreationOverlay.visible = true
                    }
                }
            }

            //Delete
            if (graph && event.key === 'Delete') {
                const state = store.getState().workspace;
                const {type, id} = state.currentSelectedItem
                const { nodesWithinBrush, edgesWithinBrush } = getNodesAndEdgesWithinBrush()

                // Delete currently selected item if it exists
                if (id) {
                    if (type === 'node' || type === 'abs') {
                        deleteNodes(graph, [id])
                    } else if (type === 'edge') {
                        deleteEdges(graph, [id])
                    }
                }

                
                // Delete everything in brush selection
                if (nodesWithinBrush.length > 0) {
                    deleteNodes(graph, nodesWithinBrush)
                }
                if (edgesWithinBrush.length > 0) {
                    deleteEdges(graph, edgesWithinBrush)
                }
            }
        };

        const handleKeyUp = (event: KeyboardEvent) => {
            const graph = graphs[this.currentGraphId] as Graph
            //CTRL
            if (event.key === 'Control') {
                for (let node of Object.values(graph.nodeIdMap ?? {})) {
                    if (node.edgeCreationOverlay) {
                        node.edgeCreationOverlay.visible = false
                    }                
                }
            }
        };

        // Add event listeners for keydown and keyup
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
    }
    switchGraph(id: Id) {
        this.currentGraphId = id
    }

    addCommand(command: ICommand) {
        if (this.currentGraphId) {
            const visualUpdates = this.isRenderingReady()
            command.execute(this.currentGraphId, visualUpdates)
        } else {
            this.queue.push(command)
        }
    }

    getDisplay(graphId: Id, canvas: 'main' | 'thumbnail' | 'commit', renderer: Renderer) {

        const graph = graphs[graphId]

        if (!graph) return

        if (canvas === 'main') {

            if (this.mainTextureMap.size === 0) {
                this.mainTextureMap = this.generateTextureMap(renderer)
            }
            
            if (!graph.container) {
                populateGraphDisplayObjs(canvas, graph, this.mainTextureMap)
            }

            return graph.container

        } else if (canvas === 'thumbnail') {
            if (!this.thumbnailTextureMapMap.get(graphId)) {
                this.thumbnailTextureMapMap.set(graphId, this.generateTextureMap(renderer))
            }

            if (!graph.thumbnailContainer) {
                const map = this.thumbnailTextureMapMap.get(graphId)!
                populateGraphDisplayObjs(canvas, graph, map)
            }

            return graph.thumbnailContainer

        } else if (canvas === 'commit') {
            if (this.commitTextureMap.size === 0) {
                this.commitTextureMap = this.generateTextureMap(renderer)
            }

            if (!graph.commitContainer) {
                populateGraphDisplayObjs(canvas, graph, this.commitTextureMap)
            }

            return graph.commitContainer
        }

    }
    

    generateTextureMap(renderer: Renderer) {
        const map = new Map()
        map.set('baseNode', renderer.generateTexture(createBaseNodeGraphic()))
        map.set('baseNodeThumbnail', renderer.generateTexture(createBaseNodeGraphicThumbnail()))
        map.set('absNode', renderer.generateTexture(createAbsNodeGraphic()))
        map.set('absNodeThumbnail', renderer.generateTexture(createAbsNodeGraphicThumbnail()))
        map.set('absNodeOverlay', renderer.generateTexture(createAbsNodeOverlayGraphic()))
        map.set('nodule', renderer.generateTexture(createNoduleGraphic()))
        return map
    }


}