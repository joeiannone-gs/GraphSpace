import { graphs } from "@/app/globalObjs"
import { convertToString, getColoring } from "@/app/services/getColoring"
import { calculateTabsPanel } from "@/app/services/positioningAndSizing"
import { selectCurrentGraphIdForProject, selectProjectById } from "@/app/store/features/workspace/selectors/project"
import workspaceSlice from "@/app/store/features/workspace/workspaceSlice"
import { AppDispatch, RootState } from "@/app/store/store"
import { Id } from "@/app/types/common"
import { useCallback, useMemo, useState } from "react"
import { useDispatch, useSelector } from "react-redux"

interface TabProps {
    tab: Id
}


export function Tabs() {


    const windowSize = useSelector((state: RootState) => state.workspace.windowSize)
    const { pos, size } = useMemo(() => calculateTabsPanel(windowSize), [windowSize])
    const darkMode = useSelector((state: RootState) => state.panels.darkMode);
    const backgroundColor = useMemo(() => getColoring(darkMode).panelColoring.background, [darkMode]);
    const tabs = useSelector((state: RootState) => state.workspace.openTabs)


    return (
        <div style={{
            position: 'absolute',
            left: pos[0],
            top: pos[1],
            width: size[0],
            height: size[1],
            backgroundColor: convertToString(backgroundColor),
            borderRadius: '8px',
            display: 'flex',
            flexDirection: 'row'
        }}>
            {[...tabs].map((tab, index) => (
                <Tab key={index} tab={tab} />
            ))}
        </div>
    )
}


const Tab = ({ tab }: TabProps) => {

    const dispatch: AppDispatch = useDispatch()


    const currentGraphOrAbsId = useSelector((state: RootState) => state.workspace.currentProjectId)
    const isSelected = useMemo(() => currentGraphOrAbsId === tab, [currentGraphOrAbsId, tab]);
    const graphId = useSelector((state: RootState) => selectCurrentGraphIdForProject(state.workspace, tab));
    // const name = useSelector((state: RootState) => selectProjectById(state.workspace, tab)?.graphs[graphId ?? ""]?.name);
    const name = graphs[ graphId ?? ""]?.name ?? "No name"

    const onClose = useCallback(() => {
        dispatch(workspaceSlice.actions.closeTab({projectId: tab}))
    }, [])

    const onTabClick = useCallback(() => {
        dispatch(workspaceSlice.actions.updateCurrentProjectId({ id: tab}))
    }, [])

    return (

        <div style={{ 
            display: 'flex',
            alignItems: 'center',
            marginLeft: '12px',
            marginRight: '12px',
            paddingLeft: '12px',
            paddingRight: '12px',
            borderRight: '2px solid rgba(0,0,0,1)'
        }}>
            <span style={{ 
                cursor: 'pointer',
                borderBottom: isSelected ? '1px solid #4CAF50' : 'none',
                fontFamily: 'Century Gothic',
                color: 'black'
            }} onClick={onTabClick}>{name}</span>
            <button 
                style={{
                    marginLeft: '8px',
                    cursor: 'pointer',
                    background: 'none',
                    border: 'none',
                    padding: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: 0.6,
                    transition: 'opacity 0.2s'
                }}
                onClick={onClose}
            >
                <svg width="12" height="12" viewBox="0 0 12 12">
                    <line x1="2" y1="2" x2="10" y2="10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    <line x1="2" y1="10" x2="10" y2="2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
            </button>
        </div>
    )
}

