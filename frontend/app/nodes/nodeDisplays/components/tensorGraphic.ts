import { getDepth, getShape, isIndexInRange, isPositionInSlice } from "@/app/services/math";
import { Id, Tensor } from "@/app/types/common";
import * as PIXI from 'pixi.js'
import { createChart, createDiagonalEllipses, createEllipses, createNumBracket, createText, getElemFromPos, getOmitted } from "./helpers";

import { Highlighting } from "./types";
import { mainRenderer,textureCacheHelper } from "@/app/globalObjs";


export async function getTensorGraphic(
    tensor: Tensor,
    height: number, 
    width: number,
    highlighting: Highlighting,
    timeseries: Tensor[] | null,
    // key?: Id
) {

    const SHOULD_SHOW_NUM_BRACKET = true

    const depth = getDepth(tensor)


    const _helper = async (
        allocatedWidth: number, 
        allocatedHeight: number,
        currentPosition: number[], // outer --> inner
    ) => {
        
        let outerContainer = new PIXI.Container()
        const currentTensor = getElemFromPos(tensor, currentPosition)
        const distFromBottom = depth - currentPosition.length

        //* Base Case
        if (distFromBottom === 0) { 

            // const rounding = allocatedWidth *0.05
            const borderWidth = ((allocatedWidth + allocatedHeight) / 2) * 0.025

            let insideElem;
            const background = new PIXI.Graphics()

            if (timeseries) {
                //return a chart
                const values: number[] = []
                for (let tensorElem of timeseries) {
                    values.push(getElemFromPos(tensorElem, currentPosition) as number)
                }
                // const chartCacheKey = `${key}_${currentPosition}`
                const c = new PIXI.Container()
                const v = values[values.length - 1].toFixed(3).toString()
                const text = createText(allocatedWidth, allocatedHeight, v , 0x000000)
                
                text.alpha = 0.25
                const chart = await createChart(allocatedHeight, allocatedWidth, values)
                c.addChild(text, chart)

                c.pivot.set(allocatedWidth/2, allocatedHeight/2)
                c.position.set(allocatedWidth/2, allocatedHeight/2)
                c.scale = 0.75
                insideElem = c
                
            } else {
                const text = createText(allocatedWidth, allocatedHeight, currentTensor as number | string)
                insideElem = text 
            }

            //Background 
            const isHighlighted = Array.isArray(highlighting) ? isPositionInSlice(currentPosition, highlighting) : highlighting
            const cacheKey = `${allocatedWidth}_${allocatedHeight}_${isHighlighted}`
            let backgroundSprite = textureCacheHelper.getCachedSprite(cacheKey)

            if (!backgroundSprite) {

                background.rect(0,0, allocatedWidth, allocatedHeight)
                background.stroke({color: isHighlighted ? 0xaef000 : 0xdddddd, width: borderWidth})       
                if (depth > 2) {
                    background.fill({color: isHighlighted ? 0xaef39b : 0x333333})
                }
                backgroundSprite = textureCacheHelper.graphicsToSprite(background, mainRenderer, cacheKey)
            }

            outerContainer.addChild(backgroundSprite, insideElem)
        } else if (Array.isArray(currentTensor)) {

            if (distFromBottom % 3 === 0) { // *Diagonal
                const ELEM_SIZE = 0.75; // proportion of allocated size
                const elemWidth = ELEM_SIZE * allocatedWidth;
                const elemHeight = ELEM_SIZE * allocatedHeight;
                const numElems = currentTensor.length
                if (numElems > 1) {
                    // Compute the maximum allowed offset so that an element’s center stays inside the allocated area
                    const availableOffsetX = allocatedWidth / 2 - elemWidth / 2;
                    const availableOffsetY = allocatedHeight / 2 - elemHeight / 2;
                    const d = Math.min(availableOffsetX, availableOffsetY);
                    // Determine spacing so that centers are evenly distributed from -d to +d along the diagonal
                    const spacing = (2 * d) / (numElems - 1);
                    let totalNum = 0
                    const elemComponents = []
                    for (let [index, elem] of currentTensor.entries()) {
                        const newCurrentPosition = [...currentPosition, index];
                        const offsetIndex = index - (numElems - 1) / 2;
                        // Compute each element's center along the diagonal
                        const centerX = allocatedWidth / 2 + offsetIndex * spacing;
                        const centerY = allocatedHeight / 2 + offsetIndex * spacing;
                        // Calculate slope for diagonal ellipses
                        const slope = availableOffsetY / availableOffsetX;
                        const elemContainer = (typeof elem === 'string' && elem.includes('...'))
                            ? createDiagonalEllipses(elemWidth, elemHeight, slope)
                            : await _helper(elemWidth, elemHeight, newCurrentPosition );
                        elemContainer.x = centerX - elemWidth / 2;
                        elemContainer.y = centerY - elemHeight / 2;
                        if (typeof elem === 'string' && elem.includes('...')) totalNum += getOmitted(elem)
            
                        totalNum++
                        elemComponents.push(elemContainer);
                    }

                    elemComponents.forEach(elem => outerContainer.addChild(elem))
              
                    if (SHOULD_SHOW_NUM_BRACKET && currentPosition.every(pos => pos === 0)) {

                        const lastComp = elemComponents[elemComponents.length - 1]
                        
                        const numBracket = createNumBracket(
                            elemComponents[0].x, 
                            elemComponents[0].y + elemHeight, 
                            lastComp.x, 
                            lastComp.y + elemHeight, 
                            totalNum
                        );
                        
                        outerContainer.addChild(numBracket);
                    }

                } else if (numElems === 1) {
                    // For a single element, just center it
                    const newCurrentPosition = [...currentPosition, 0];
                    const elemContainer = await _helper(elemWidth, elemHeight, newCurrentPosition);
                    elemContainer.x = (allocatedWidth - elemWidth) / 2;
                    elemContainer.y = (allocatedHeight - elemHeight) / 2;
                    outerContainer.addChild(elemContainer);
                }
            } else if (distFromBottom % 3 === 1) { //* Horizontal
                const numElems = currentTensor.length
                const elemWidth = allocatedWidth / numElems;
                const elemHeight = Math.min(allocatedHeight, elemWidth);
                const leftOffset = (allocatedWidth - elemWidth * numElems) / 2;
                const topOffset = (allocatedHeight - elemHeight) / 2;
                let totalNum = 0
                for (let [index, elem] of currentTensor.entries()) {
                    const newCurrentPosition = [...(currentPosition ?? []), index]
                    const isOmit = typeof elem === 'string' && elem.includes('...')
                    const elemContainer = (isOmit)
                        ? createEllipses(elemWidth, elemHeight, 'horiz') 
                        : await _helper(elemWidth, elemHeight, newCurrentPosition);
                    elemContainer.x = leftOffset + elemWidth * index + (isOmit ? elemWidth / 2 : 0)
                    elemContainer.y = topOffset + (isOmit ? elemHeight / 2 : 0)
                    if (isOmit) totalNum += getOmitted(elem)
                    
                    totalNum++
                    outerContainer.addChild(elemContainer);
                }

                if (SHOULD_SHOW_NUM_BRACKET && currentPosition.every((pos: number) => pos === 0)) {
                    const numBracket = createNumBracket(elemWidth * currentTensor.length, topOffset, 0, topOffset, totalNum);
                    outerContainer.addChild(numBracket);
                }


            } else { // *Vertical
                
                const numElems = currentTensor.length
                const elemWidth = allocatedWidth
                const elemHeight = allocatedHeight / numElems
                let totalNum = 0
                for (let [index, elem] of currentTensor.entries()) {
                    const newCurrentPosition = [...currentPosition, index]
                    const isOmit = typeof elem === 'string' && elem.includes('...')
                    const elemContainer = (isOmit)
                        ? createEllipses(elemWidth, elemHeight, 'vert') 
                        : await _helper(elemWidth, elemHeight, newCurrentPosition);
                    elemContainer.y = elemHeight * index + (isOmit ? elemHeight / 2 : 0)
                    elemContainer.x = isOmit ? elemWidth / 2 : 0 
                    if (isOmit)  totalNum += getOmitted(elem)
                    
                    totalNum++
                    outerContainer.addChild(elemContainer)
                }

                if (SHOULD_SHOW_NUM_BRACKET && currentPosition.every((pos: number) => pos === 0)) {
                    const numBracket = createNumBracket(0, 0, 0, elemHeight * currentTensor.length, totalNum);
                    outerContainer.addChild(numBracket);
                }

                if (distFromBottom == 2) {
                    outerContainer.on('pointerover', () => {
                        outerContainer.zIndex = 1
                    })
                    outerContainer.on('pointerout', () => {
                        outerContainer.zIndex = 0
                    })
                }

                
            }

        }

        return outerContainer
    }

    return await _helper(width, height, [])
}
