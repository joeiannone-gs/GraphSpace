import React, { useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "@/app/store/store";
import { convertToString, getColoring } from "@/app/services/getColoring";
import { getHorizontalCollapseArrowSrc, getSymbolSrc, getVerticalExpandSrc, isOnLeft } from "./helpers";
import { updateExpanded, updateHorizontalCollapse } from "@/app/store/features/panels/panelsSlice";
import { styles } from './PanelBase.styles';
import { selectPanelPositionAndSize } from "@/app/store/features/panels/selectors";
import { Heading } from "./types";

interface PanelBaseComponentProps {
    panelName: Heading
    children: React.ReactNode
}

const PanelTitle = ({ panelName, headerHeight }: { panelName: Heading, headerHeight: number }) => {
    const darkMode = useSelector((state: RootState) => state.panels.darkMode);
    const symbolSrc = getSymbolSrc(darkMode, panelName);

    return (
        <div style={styles.headerLeft}>
            <span style={{...styles.headerText, fontSize: headerHeight * 0.5}}>{panelName}</span>
            <img src={symbolSrc} style={{height: headerHeight * 0.5}} />
        </div>
    );
};

const PanelControls = ({ panelName }: { panelName: Heading }) => {
    const dispatch = useDispatch();
    const darkMode = useSelector((state: RootState) => state.panels.darkMode);
    const isHorizontalCollapse = useSelector((state: RootState) => {
        switch (panelName) {
            case 'My Graph Space': return state.panels.horizontalCollapse.myGraphSpace;
            case 'Info': return state.panels.horizontalCollapse.info;
            case 'HUB': return state.panels.horizontalCollapse.hub;
            case 'Commit History': return state.panels.horizontalCollapse.commitHistory;
            default: return false;
        }
    });
    const isCollapsed = useSelector((state: RootState) => {
        switch (panelName) {
            case 'My Graph Space': return !state.panels.expanded.myGraphSpace;
            case 'Info': return !state.panels.expanded.info;
            case 'HUB': return state.panels.expanded.myGraphSpace;
            case 'Commit History': return state.panels.expanded.info;
            default: return false;
        }
    });

    const headerHeight = 30;
    const isOnLeftSide = isOnLeft(panelName);
    const arrowSrc = getHorizontalCollapseArrowSrc(darkMode);
    const verticalExpandSrc = getVerticalExpandSrc(darkMode);

    const handleCollapse = (value: boolean) => {
        const panel = panelName === 'HUB' ? 'hub' : panelName.replace(/\s+/g, '').charAt(0).toLowerCase() + panelName.replace(/\s+/g, '').slice(1);
        dispatch(updateExpanded({ panel, value: !value }));
    };

    const handleHorizontalCollapse = (value: boolean) => {
        const panel = panelName === 'HUB' ? 'hub' : panelName.replace(/\s+/g, '').charAt(0).toLowerCase() + panelName.replace(/\s+/g, '').slice(1);
        dispatch(updateHorizontalCollapse({ panel, value }));
    };

    return (
        <div style={styles.headerControls}>
            <img 
                src={arrowSrc} 
                style={{...styles.controlIcon, height: headerHeight * 0.5, transform: `rotate(${(isOnLeftSide ? 0 : 180) + (isHorizontalCollapse ? 180 : 0)}deg)`}}
                onClick={() => handleHorizontalCollapse(!isHorizontalCollapse)}
            />
            <img 
                src={verticalExpandSrc}
                style={{...styles.controlIcon, height: headerHeight * 0.5, transform: `rotate(${isCollapsed ? 0 : 180}deg)`}}
                onClick={() => handleCollapse(!isCollapsed)}
            />
        </div>
    );
};

export function PanelBase({ panelName, children }: PanelBaseComponentProps) {
    const darkMode = useSelector((state: RootState) => state.panels.darkMode);
    const posAndSize = useSelector((state: RootState) => selectPanelPositionAndSize(state, panelName));
    const isOnLeftSide = useMemo(() => isOnLeft(panelName), [panelName]);

    const backgroundColor = useMemo(() => getColoring(darkMode).panelColoring.background, [darkMode]);
    const headerBackgroundColor = useMemo(() => getColoring(darkMode).panelColoring.subHeaderBackground, [darkMode]);
    const headerHeight = 30;

    return (
        <div style={{...styles.panel, background: convertToString(backgroundColor), left: posAndSize.pos[0], top: posAndSize.pos[1], width: posAndSize.size[0], height: posAndSize.size[1]}}>
            <div style={{...styles.header, height: headerHeight, background: convertToString(headerBackgroundColor)}}>
                {isOnLeftSide ? (
                    <>
                        <PanelTitle panelName={panelName} headerHeight={headerHeight} />
                        <PanelControls panelName={panelName} />
                    </>
                ) : (
                    <>
                        <PanelControls panelName={panelName} />
                        <PanelTitle panelName={panelName} headerHeight={headerHeight} />
                    </>
                )}
            </div>
            {children}
        </div>
    );
}