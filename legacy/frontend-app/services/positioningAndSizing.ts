import { Pos, Size } from "../types/common"
import { WIDTH_PERC, VERT_PERC, RATIO, padding } from "../sizing/panels"





export const calculateInfoPanel = (windowSize: {height: number, width: number}, isCollapsed: boolean, isHorizontalCollapsed: boolean) => {
    const w = windowSize.width 
    const h = windowSize.height * VERT_PERC
    const size = [getWidth(w), getAdjustedHeight(h, isCollapsed)] as [number, number]
    const pos = [getLeftPanelX(w), getTopPanelY(h)] as Pos

    if (isHorizontalCollapsed) {
        const offset = size[0] * 0.8;
        pos[0] += offset;
    }

    return { 
        pos: applyPosPadding(pos), 
        size: applySizePadding(size) 
    };
}


export const calculateHubPanel = (windowSize: {height: number, width: number}, isCollapsed: boolean, isHorizontalCollapsed: boolean) => {
    const w = windowSize.width
    const h = windowSize.height * VERT_PERC
    const size = [getWidth(w), getAdjustedHeight(h, isCollapsed)] as [number, number]
    const pos = [ 0, getAdjustedY(h, isCollapsed)] as Pos //logo height + panel height

    if (isHorizontalCollapsed) {
        const offset = size[0] * 0.8;
        pos[0] -= offset;
    }

    return { 
        pos: applyPosPadding(pos), 
        size: applySizePadding(size) 
    }
}


export const calculateCommitHistoryPanel = (windowSize: {height: number, width: number}, isCollapsed: boolean, isHorizontalCollapsed: boolean) => {
    const w = windowSize.width
    const h = windowSize.height * VERT_PERC 
    const size = [getWidth(w), getAdjustedHeight(h, isCollapsed)] as [number, number]
    const pos = [getLeftPanelX(w), getAdjustedY(h, isCollapsed)] as Pos

    if (isHorizontalCollapsed) {
        const offset = size[0] * 0.8;
        pos[0] += offset;
    }

    return { 
        pos: applyPosPadding(pos), 
        size: applySizePadding(size) 
    }
}

export const calculateMyGraphSpacePanel = (windowSize: {height: number, width: number}, isCollapsed: boolean, isHorizontalCollapsed: boolean) => {
    const w = windowSize.width
    const h = windowSize.height * VERT_PERC
    const size = [getWidth(w), getAdjustedHeight(h, isCollapsed)] as [number, number]
    const pos = [ 0,  getTopPanelY(h) ] as Pos //logo height

    if (isHorizontalCollapsed) {
        const offset = size[0] * 0.8;
        pos[0] -= offset;
    }

    return { 
        pos: applyPosPadding(pos), 
        size: applySizePadding(size) 
    }
}

export const calculateTabsPanel = (windowSize: {height: number, width: number}) => {
    const heightPerc = 0.05
    const padding = 0.02
    const w = windowSize.width
    const h = windowSize.height 
    const size = [w*(1-WIDTH_PERC*2 - padding), h *heightPerc] as [number, number]
    const pos = [getWidth(w) + w*padding/2, h*(1-heightPerc-padding/2) ] as Pos
    return { 
        pos: applyPosPadding(pos), 
        size: applySizePadding(size) 
    }
}




export const applyPadding = (size: [number, number], pos: Pos) => {
    const adjustedSize = applySizePadding(size) 
    const adjustedPos = applyPosPadding(pos)
    return [...adjustedSize, ...adjustedPos]
}

export const applySizePadding = (size: [number, number]) => {
    return [size[0] - padding * 2, size[1] - padding * 2] as Size
}

export const applyPosPadding = (pos: Pos) => {
    return [pos[0] + padding, pos[1] + padding] as Pos
}


const getTopPanelY = (h: number) => {
    return ((1 - VERT_PERC) * h)
}

const getLeftPanelX = (w: number) => {
    return  w - w * WIDTH_PERC
}

const getAdjustedY = (h: number, isCollapsed: boolean) => {
    const topPanelHeight = isCollapsed ? h * (1 - RATIO) : h * RATIO
    return topPanelHeight + getTopPanelY(h)
}

const getAdjustedHeight = (h: number, isCollapsed: boolean) => {
    return isCollapsed ? h * RATIO : h * (1 - RATIO)
}

export const getWidth = (w: number) => {
    return w * WIDTH_PERC
}
