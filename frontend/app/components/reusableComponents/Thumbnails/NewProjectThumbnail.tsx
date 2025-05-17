import { convertToString, getColoring } from "@/app/services/getColoring";
import { THUMBNAIL_WIDTH as width, THUMBNAIL_HEIGHT as height } from "@/app/sizing/thumbnails";
import { createAbsProject, createGraphProject } from "@/app/store/features/workspace/thunks/create/project";
import { AppDispatch, RootState } from "@/app/store/store";
import { useCallback, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";







export function NewProjectThumbnail({type}: {type: "graph" | "abs"}) {
    const dispatch: AppDispatch = useDispatch()


    const darkMode = useSelector((state: RootState) => state.panels.darkMode)
    const coloring = useMemo(() => getColoring(darkMode).thumbnailColoring.graph, [darkMode]);

    const callback = useCallback(() => {
        type == 'graph' ? dispatch(createGraphProject()) : dispatch(createAbsProject())
    }, [])

    return (
        <div style={{
            height: height,
            width: width,
            border: '2px solid rgba(224, 224, 224, 0.5)',
            borderRadius: '5px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '4px',
            cursor: 'pointer'
        }} 
        onClick={callback}>
            <div style={{
                height: height - 30,
                width: height - 30,
                border: `2px solid ${type === "graph" ? convertToString(coloring.selected) : "orange"}`,
                borderRadius: type === "graph" ? "5%" : "50%",
                overflow: 'hidden',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                margin: '0 auto'
            }}>
                <svg 
                    width="20" 
                    height="20" 
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke={type === "graph" ? convertToString(coloring.selected) : "orange"}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                >
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
            </div>
            <div style={{
                color: 'grey',
                fontSize: '10px',
                textAlign: 'center',
                fontFamily: 'Century Gothic'
            }}>
                {type === "graph" ? "New Graph Project" : "New Node Project"}
            </div>
        </div>
    )
}