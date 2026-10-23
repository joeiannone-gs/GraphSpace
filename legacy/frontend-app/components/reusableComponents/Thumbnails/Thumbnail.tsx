import { convertToString, getColoring } from "@/app/services/getColoring";
import store, { AppDispatch, RootState } from "@/app/store/store";
import React, { useCallback, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { PixiCanvas } from "../PixiCanvas";
import { selectCurrentGraphId, selectCurrentGraphIdForProject, selectProjectById } from "@/app/store/features/workspace/selectors/project";
import { Id, Pos, Size } from "@/app/types/common";
import { Menu } from "../Menu";
import workspaceSlice from "@/app/store/features/workspace/workspaceSlice";
import * as PIXI from 'pixi.js'

import { THUMBNAIL_WIDTH, THUMBNAIL_HEIGHT, HEADER_PERC } from "@/app/sizing/thumbnails";
import { emitProjectDelete } from "@/app/server/routes/projects";
import { deleteAbsProject, deleteGraphProject } from "@/app/store/features/workspace/thunks/delete/project";
import { graphController, graphs } from "@/app/globalObjs";
import {updateScaleAndPositions } from "@/app/services/math";

const canvasHeight = THUMBNAIL_HEIGHT * ( 1 - HEADER_PERC)
const canvasWidth = THUMBNAIL_WIDTH
const absThumbnailRadius = canvasHeight / 2 - 7


export function Thumbnail({projectId}: {projectId: Id}) {

    const dispatch: AppDispatch = useDispatch()

    //Selectors
    const currentGraphOrAbsId = useSelector((state: RootState) => state.workspace.currentProjectId)
    const isSelected = useMemo(() => currentGraphOrAbsId === projectId, [currentGraphOrAbsId, projectId]);
    const isAbsNode = useSelector((state: RootState) => selectProjectById(state.workspace, projectId)?.isAbsNode)
    const darkMode = useSelector((state: RootState) => state.panels.darkMode)
    const coloring = useMemo(() => getColoring(darkMode).thumbnailColoring.graph, [darkMode]);
    const graphId = useSelector((state: RootState) => selectCurrentGraphIdForProject(state.workspace, projectId));
    

    //State
    const [menuPos, setMenuPos] = useState<Pos | null>(null)


    const borderColor = useMemo(() => {
        return isSelected ? convertToString(coloring.selected) : convertToString(coloring.main)
    }, [isSelected])

    const callback = useCallback((stage: PIXI.Container, renderer: PIXI.Renderer, ticker: PIXI.Ticker) => {

        const background = new PIXI.Graphics()
        background.rect(0, 0, canvasWidth, canvasHeight)
        background.fill({color: 0x000000})
        stage.addChild(background)

        ticker.add(() => {
            const state = store.getState().workspace
            const gID = state.currentProjectId === projectId ? selectCurrentGraphId(state) : selectCurrentGraphIdForProject(state, projectId)
            const container = graphController.getDisplay(gID ?? "", 'thumbnail', renderer);
            if (!stage.children[1] && container) {
                stage.addChild(container);
            }

            if (container) {
                if (isAbsNode) {

                    updateScaleAndPositions(graphs[gID!], container, [absThumbnailRadius * 2, absThumbnailRadius * 2])
                } else {
                    updateScaleAndPositions(graphs[gID!], container, [canvasWidth, canvasHeight])
                }
            }

            renderer.render(stage);
        })

        // ticker.start()

        const state = store.getState().workspace
        ticker.stop()
        ticker.update()
        if (state.currentProjectId === projectId) ticker.start()
        
        

        //Render only when is selected (meaning it is being edited in the main editor)
        let p = state.currentProjectId
        store.subscribe(() => {
            const potentiallyNewP = store.getState().workspace.currentProjectId
            if (p !== potentiallyNewP) {
                if (potentiallyNewP === projectId) { // if p changed and is now this project id
                    ticker.start()
                } else {
                    ticker.stop()
                }
                p = potentiallyNewP
            }
        })

        

    }, [graphId, isAbsNode])

    const onDelete = useCallback(() => {
        emitProjectDelete(projectId)
        if (isAbsNode) {
            store.dispatch(deleteAbsProject(projectId))
        } else {
            store.dispatch(deleteGraphProject(projectId))
        }
    }, [])

    const onThumbnailClick = useCallback(() => {
        dispatch(workspaceSlice.actions.updateCurrentProjectId({id: projectId}))
        dispatch(workspaceSlice.actions.updateCurrentBranchName({name: 'main'}))
        dispatch(workspaceSlice.actions.openTab({projectId}))
    }, [])

    const onOptionDotsClick = useCallback((e: React.MouseEvent) => {
        setMenuPos([e.pageX, e.pageY])
    }, [])

    const menuOptionHandler = useCallback((option: string) => {
        switch(option) {
            case 'delete':
                onDelete()
                break
        }
    }, [])

    const onDragStart = useCallback((e: React.DragEvent) => { // only for abs nodes
        dispatch(workspaceSlice.actions.updateThumbnailBeingDragged({ value: ["abs", projectId]}))
    }, [])

    return (
        <div style={{
            height: THUMBNAIL_HEIGHT,
            width: THUMBNAIL_WIDTH,
            border: `3px solid ${ borderColor }`,
            borderRadius: '5%',
            overflow: 'hidden',
            cursor: "pointer"
        }}>
            <div style={{
                background: isAbsNode ? "none" : borderColor,
                height: THUMBNAIL_HEIGHT * HEADER_PERC,
                color: convertToString(coloring.text),
                padding: '0 5px',
                fontSize: '0.8em',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: 'flex',
                alignItems: 'center'
            }}>
                <span style={{color: 'black', fontFamily: 'Century Gothic', fontSize: '0.8em'}}>{graphs[graphId ?? ""]?.name ?? "No name"}</span>
                <div style={{marginLeft: 'auto'}}>
                    <OptionDots coloring={convertToString(coloring.text)} onClickCallback={onOptionDotsClick}/>
                </div>
               {menuPos && <Menu options={['delete']} optionHandler={menuOptionHandler} pos={menuPos} onClose={() => setMenuPos(null)} />}
            </div>

            {graphs[graphId ?? ""] && (
                <div onClick={onThumbnailClick}>
                    {isAbsNode? (
                        <div style={{
                            display: 'flex', 
                            justifyContent: 'center', 
                            alignItems: 'center',
                            height: canvasHeight
                        }}>
                            <div style={{
                                height: absThumbnailRadius * 2,
                                width: absThumbnailRadius * 2,
                                borderRadius: '25%',
                                overflow: 'hidden',
                                border: '3px solid orange',
                                cursor: 'move'
                            }}>
                                <div draggable onDragStart={onDragStart}>
                                    <PixiCanvas width={absThumbnailRadius * 2} height={absThumbnailRadius * 2} callback={callback} />
                                </div>
                            </div>
                        </div>
                    ) : 
                       <div>
                         <PixiCanvas width={canvasWidth} height={canvasHeight} callback={callback} />
                        </div>
                    }
                </div>
            )}
        </div>
    )
}





function OptionDots({ coloring, onClickCallback }: {coloring: string, onClickCallback: (e: React.MouseEvent) => void}) {
    const dotStyle = {
        width: '3px',
        height: '3px',
        borderRadius: '50%',
        background: coloring
    };

    return (
        <div 
            style={{float: 'right', cursor: 'pointer', padding: '0 5px'}}
            onClick={onClickCallback}
        >
            <div style={{display: 'flex', gap: '2px'}}>
                <div style={dotStyle}/>
                <div style={dotStyle}/>
                <div style={dotStyle}/>
            </div>
        </div>
    )
}