import * as PIXI from 'pixi.js'
import { normalizeValue, screenToWorld } from "../../services/math"
import store, { AppDispatch, RootState } from "@/app/store/store"
import { Id, Pos } from "@/app/types/common"
import workspaceSlice, { updateCurrentSelectedItem, updateRightClickMenu, updateSelectionMenu } from "@/app/store/features/workspace/workspaceSlice"
import { getColoring } from "@/app/services/getColoring"
import { createBaseNode } from '@/app/store/features/workspace/thunks/create/nodes'
import { mergeAbsNodeProjectIntoGraphProject } from '@/app/store/features/workspace/thunks/create/project'
import { accessoryState, graphController, mainTicker, ViewportValues } from '@/app/globalObjs'
import { getCurrentGraph } from './graphGetters'





const maxSpacing = 40;
const minSpacing = 10;
const maxLineWidth = 3;
const minLineWidth = 1;
const maxAlpha = 1;
const minAlpha = 0.1;
const initialLayer0Spacing = 800;



export class Background {
    pixiContainer = new PIXI.Container()
    stage: PIXI.Container
    dispatch: AppDispatch
    backgroundColoring: {fill: number, lines: number}
    layer0spacing = 800

    constructor(stage: PIXI.Container, dispatch: AppDispatch) {

        this.stage = stage;
        this.dispatch = dispatch;

        const state = store.getState();
        const darkMode = state.panels.darkMode;
        this.backgroundColoring = getColoring(darkMode).backgroundColoring;
        


        //Because viewport is the parent of everything (it needs to be because it needs to register events throughout the whole canvas), background 
        //needs to update as the viewport changes in order to cover the area of the canvas. It needs to resize everytime the viewport is changed 
        //for example when the user pans or zooms.
        this.createSolidRectangle(new PIXI.Graphics());

        const updateFunction = () => {
            const solidRect = this.pixiContainer.getChildByLabel('solid-rect');
            if (solidRect) this.createSolidRectangle(solidRect as PIXI.Graphics);
            // const grids = this.pixiContainer.getChildByLabel('grids');
            // if (grids) this.createAllGrids(grids as PIXI.Graphics);    
        };

        mainTicker.add(updateFunction);
    }

    
    private createSolidRectangle(g: PIXI.Graphics) {

        g.clear()

        const { bottomRight, topLeft} = accessoryState.viewportValues!

        if (!bottomRight || !topLeft) return
        
        const height = bottomRight[1] - topLeft[1]
        const width = bottomRight[0]  - topLeft[0]

        g.label = 'solid-rect'
        g.rect(topLeft[0], topLeft[1], width, height)
        g.fill({ color: 'black'})

        //Selection Brush
            
        let isDragging = false;
        let startPos: Pos | null = null;

        g.off('mousedown')
        g.on('mousedown', (downEvent: PIXI.FederatedPointerEvent) => {
            
            if (downEvent.shiftKey) return

            isDragging = false;
            startPos = screenToWorld([downEvent.globalX, downEvent.globalY], accessoryState.viewportValues);

            this.stage.off('pointermove');
            this.stage.on('pointermove', (e: PIXI.FederatedPointerEvent) => {
                const currentPos = screenToWorld([e.globalX, e.globalY], accessoryState.viewportValues);
                if (startPos && (Math.abs(currentPos[0] - startPos[0]) > 10 || Math.abs(currentPos[1] - startPos[1]) > 5)) {
                    isDragging = true;
                    const brushState = [startPos, currentPos] as [Pos, Pos];
                    accessoryState.brush = brushState
                }
            });

            this.stage.off('pointerup')
            this.stage.on('pointerup', (e: PIXI.FederatedPointerEvent) => {
                this.stage.off('pointermove');
                this.stage.off('pointerup');

                if (!isDragging) {
                    // Logic for a simple click

                    this.dispatch(updateCurrentSelectedItem({ type: 'project', id: null}))

                    const clickPos = screenToWorld([e.globalX, e.globalY], accessoryState.viewportValues);
                    this.dispatch(updateRightClickMenu(clickPos))
                } else {
                    // Logic for when the drag ends
                    const globalPos: Pos = [e.globalX, e.globalY];
                    this.dispatch(updateSelectionMenu(globalPos))
                }
            });
        });

        g.off('rightdown')
        g.on("rightdown", (event: PIXI.FederatedPointerEvent) => {
            const eventPos = [event.globalX, event.globalY] as Pos;
            this.dispatch(updateRightClickMenu(eventPos))
        });

        //On mouse up (when element is dropped)
        g.off('pointerup')
        g.on('pointerup', (event: PIXI.FederatedPointerEvent) => {
            const draggedThumbnail = store.getState().workspace.thumbnailBeingDragged
            if (draggedThumbnail) {
                const pos = screenToWorld([event.globalX, event.globalY], accessoryState.viewportValues) as Pos
                const id = draggedThumbnail[1]
                const isBaseNode = !id // no id provided means base node
                if (isBaseNode) {
                    createBaseNode(draggedThumbnail[0], pos)
                } else {
                    mergeAbsNodeProjectIntoGraphProject(getCurrentGraph(), id, pos)
                }
                this.dispatch(workspaceSlice.actions.updateThumbnailBeingDragged({ value: null}))
            }
        })

        this.pixiContainer.addChildAt(g, 0)
    }


    private createAllGrids(g: PIXI.Graphics) {

        g.clear()

        g.label = 'grids'

        const {scale, topLeft, bottomRight} =  accessoryState.viewportValues!

        if (!scale) return


        const maxLineWidthInWorld = maxLineWidth / scale
        const minLineWidthInWorld = minLineWidth / scale
    
        const spacingInScreenPixels = this.layer0spacing * scale //converting world to screen
    
        if ( spacingInScreenPixels > maxSpacing) {
            this.layer0spacing = minSpacing / scale //converting screen to world
        } else if (spacingInScreenPixels < minSpacing) {
            this.layer0spacing = maxSpacing / scale //screen to world
        }
    
    
        const absMaxSpacing = ( maxSpacing / scale ) * 4 //layer 2 spacing
        const absMinSpacing = minSpacing  / scale// layer 0 spacing
    
        //layer 0
        const alphaLayer0 = normalizeValue(this.layer0spacing, absMinSpacing, absMaxSpacing, minAlpha, maxAlpha ) 
        const widthLayer0 = normalizeValue(this.layer0spacing, absMinSpacing, absMaxSpacing, minLineWidthInWorld, maxLineWidthInWorld)
        createGrid(g, this.layer0spacing, widthLayer0, alphaLayer0, topLeft, bottomRight, this.backgroundColoring.lines)
    
        //layer 1
        const layer1Spacing = this.layer0spacing * 2
        const alphaLayer1 = normalizeValue(layer1Spacing, absMinSpacing, absMaxSpacing, minAlpha, maxAlpha )
        const widthLayer1 = normalizeValue(layer1Spacing, absMinSpacing, absMaxSpacing, minLineWidthInWorld, maxLineWidthInWorld)
        createGrid(g, layer1Spacing, widthLayer1, alphaLayer1, topLeft, bottomRight, this.backgroundColoring.lines)
    
        //layer 2
        const layer2Spacing = layer1Spacing * 2
        const alphaLayer2 = normalizeValue(layer2Spacing, absMinSpacing, absMaxSpacing, minAlpha, maxAlpha )
        const widthLayer2 = normalizeValue(layer2Spacing, absMinSpacing, absMaxSpacing, minLineWidthInWorld, maxLineWidthInWorld )
        createGrid(g, layer2Spacing, widthLayer2, alphaLayer2, topLeft, bottomRight, this.backgroundColoring.lines)

        g.zIndex = 1;
        g.eventMode = 'none'

        this.pixiContainer.addChild(g)
    }


    /* Helpers */
    
}






//function that takes in line spacing, width, alpha, bottom right and top left.

const createGrid = (g: PIXI.Graphics, lineSpacing: number, lineWidth: number, alpha: number, topLeft: Pos, bottomRight: Pos, color: number) => {
    const height = (bottomRight[1] - topLeft[1])
    const width = (bottomRight[0] - topLeft[0])

    // g.beginFill(GLOBALS.BACKGROUND_FILL_COLOR, .3);
    // g.drawRect(topLeft[0], topLeft[1], width, height);
    // g.endFill()
    // g.setStrokeStyle(lineWidth, color, alpha)


    const lineSpacingY = lineSpacing
    const lineSpacingX = lineSpacingY / Math.tan(Math.PI/6)

    const offsetX = - topLeft[0] % lineSpacingX
    const offsetY = - topLeft[1] % lineSpacingY
    // vertical
    for (let i = 1; i < width *2 / lineSpacing ; i++) {
     g.moveTo(topLeft[0] + i * lineSpacingX/2 + offsetX, topLeft[1])
     g.lineTo(topLeft[0] + i * lineSpacingX/2 + offsetX, bottomRight[1])
    }


    //left side to top
    for (let i = 1; i < height * 2 / lineSpacingY; i++) {
        const pointOnVertAxis = [topLeft[0] + offsetX, topLeft[1] + i * lineSpacingY + offsetY];
        const pointOnHorzAxis = [topLeft[0] + i * lineSpacingX + offsetX, topLeft[1] + offsetY];
        g.moveTo(pointOnVertAxis[0], pointOnVertAxis[1]);
        g.lineTo(pointOnHorzAxis[0], pointOnHorzAxis[1]);
    }

    const offsetXMirror = - bottomRight[0] % lineSpacingX;
    const offsetYMirror = - topLeft[1] % lineSpacingY;

    for (let i = 1; i < height * 2 / lineSpacingY; i++) {
        const pointOnVertAxis = [bottomRight[0] + offsetXMirror, topLeft[1] + i * lineSpacingY + offsetYMirror];
        const pointOnHorzAxis = [bottomRight[0] - i * lineSpacingX + offsetXMirror, topLeft[1] + offsetYMirror];

        g.moveTo(pointOnVertAxis[0], pointOnVertAxis[1]);
        g.lineTo(pointOnHorzAxis[0], pointOnHorzAxis[1]);
    }

    g.stroke({ width: lineWidth, color, alpha })


}