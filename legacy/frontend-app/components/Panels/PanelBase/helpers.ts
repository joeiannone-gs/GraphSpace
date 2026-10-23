
//Get Light Theme PNGs
import hubPng from './Symbols/LightTheme/HUB.png'
import CommitHistoryPng from './Symbols/LightTheme/CommitHistory.png'
import MyGraphSpacePng from './Symbols/LightTheme/MyGraphSpace.png'
import InfoPng from './Symbols/LightTheme/Info.png'
import horizontalCollapseArrowPng from './Symbols/LightTheme/horizontalCollapseArrow.png'
import verticalExpandArrowPng from './Symbols/LightTheme/VerticalExpand.png'

//Get Dark Theme PNGs
import hubPngDark from './Symbols/DarkTheme/HUB.png'
import CommitHistoryPngDark from './Symbols/DarkTheme/CommitHistory.png'
import MyGraphSpacePngDark from './Symbols/DarkTheme/MyGraphSpace.png'
import InfoPngDark from './Symbols/DarkTheme/Info.png'
import horizontalCollapseArrowPngDark from './Symbols/DarkTheme/horizontalCollapseArrow.png'
import verticalExpandArrowPngDark from './Symbols/DarkTheme/VerticalExpand.png'


import { Heading } from './types'

/**
 * Get the symbol given panel heading
 * This function returns a PIXI.Sprite based on the theme (dark or light) and the heading provided.
 * It uses the imported PNGs for the symbols and creates a PIXI texture from them, which is then used to create the sprite.
 */
export const getSymbolSrc = (darkTheme: boolean, heading: Heading) => {
    let symbolPath;
    switch (heading) {
        case "HUB":
            symbolPath = darkTheme ? hubPngDark : hubPng;
            break;
        case "My Graph Space":
            symbolPath = darkTheme ? MyGraphSpacePngDark : MyGraphSpacePng;
            break;
        case "Info":
            symbolPath = darkTheme ? InfoPngDark : InfoPng;
            break;
        case "Commit History":
            symbolPath = darkTheme ? CommitHistoryPngDark : CommitHistoryPng;
            break;
        default:
            throw new Error("Invalid heading provided");
    }

    return symbolPath.src
}

/**
 * Get the horizontal collapse arrow texture
 * @param darkTheme 
 * @returns 
 */
export const getHorizontalCollapseArrowSrc = (darkTheme: boolean) => {
    const arrowPath = darkTheme ? horizontalCollapseArrowPngDark : horizontalCollapseArrowPng
    return arrowPath.src
}


export const getVerticalExpandSrc = (darkTheme: boolean) => {
    const arrowPath = darkTheme ? verticalExpandArrowPngDark : verticalExpandArrowPng
    return  arrowPath.src
}

/**
 * Determines if the given heading is positioned on the left.
 * @param heading The heading to check.
 * @returns true if the heading is "Info" or "Commit History", false otherwise.
 */
export const isOnLeft = (heading: Heading): boolean => {
    return heading === "HUB" || heading === "My Graph Space";
}


