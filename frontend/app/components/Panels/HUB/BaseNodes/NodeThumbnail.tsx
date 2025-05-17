import { typeToUrl } from '@/app/nodes/assets'
import { convertToString, getColoring } from '@/app/services/getColoring'
import workspaceSlice, { updateExplanation } from '@/app/store/features/workspace/workspaceSlice'
import store, { AppDispatch, RootState } from '@/app/store/store'
import React, { DragEventHandler, useCallback } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { getNameAndExplanation } from '@/app/nodes/helpers'
import { NodeTypeEnum } from '@/app/proto/compiled'




export function NodeThumbnail({type}: {type: NodeTypeEnum}) {

    
    const dispatch: AppDispatch = useDispatch()

    const darkMode = useSelector((state: RootState) => state.panels.darkMode)
    const { nodeColoring } = getColoring(darkMode)

    const onDragStart = useCallback((e: React.DragEvent) => {
        dispatch(workspaceSlice.actions.updateThumbnailBeingDragged({ value: [type]}))
    }, [])

    return (
        <div 
        draggable={true} 
        style={{
            cursor: 'move',
            opacity: 1,
            transition: 'opacity 0.1s'
        }} 
        onMouseEnter={(e) => {
            e.currentTarget.style.opacity = '0.7'
            const {name, explanation} = getNameAndExplanation(type)
            store.dispatch(updateExplanation({ heading: name, text: explanation}))
        }} 
        onMouseLeave={(e) => {
            e.currentTarget.style.opacity = '1'
            store.dispatch(updateExplanation({ heading: null, text: null}))
        }}
        onDragStart={onDragStart}>
            <div style={{
                width: 50,
                height: 50,
                borderRadius: '50%',
                border: `1px solid ${convertToString(nodeColoring.base)}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
            }}>
                <img 
                    src={typeToUrl[type as keyof typeof typeToUrl]} 
                    style={{
                        maxWidth: '30px',
                        maxHeight: '30px',
                        userSelect: 'none',
                        pointerEvents: 'none'
                    }}
                    draggable="false"
                />
            </div>
        </div>
    )
}