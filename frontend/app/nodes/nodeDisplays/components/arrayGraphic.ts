import { createEllipses, createText, getBracket, getElemFromPos, getOmitted } from "./helpers";
import { Id, Size, Slice, Tensor } from "@/app/types/common";
import * as PIXI from 'pixi.js'
import { getTensorGraphic } from "./tensorGraphic";
import { getDepth, isIndexInRange, isPositionInSlice, isRectangular } from "@/app/services/math";
import { Highlighting } from "./types";


export async function getArrayGraphic(
    arrayVal : Tensor,
    height: number,
    width: number,
    highlighting: Highlighting,
    // key?: Id
) {

    const SHRINK_FACTOR = 0.8

    const depth = getDepth(arrayVal)

  
    const _helper = async (
        allocatedWidth: number, 
        allocatedHeight: number,
        currentPosition: number[], //outer --> inner
        
    ) => {

        
    
        const outerContainer = new PIXI.Container()
        const currentArray = getElemFromPos(arrayVal, currentPosition)
        const distFromBottom = depth - currentPosition.length

       
        if (typeof currentArray == 'number' || typeof currentArray == 'string') { //* Base Case
            const color = isPositionInSlice(currentPosition, highlighting) ? 0xaef39b : 0xFFFFFF
            const text = createText(allocatedWidth, allocatedHeight, currentArray, color )
            outerContainer.addChild(text)
            return outerContainer
        } else if (isRectangular(currentArray)) { //* If Tensor (rectangular array)
            const shrinkFactoredHeight = allocatedHeight * SHRINK_FACTOR;
            const shrinkFactoredWidth = allocatedWidth * SHRINK_FACTOR;
            const newHighlighting = currentPosition.length === 0 ? highlighting : isPositionInSlice(currentPosition, highlighting)
            const tensorGraphic = await getTensorGraphic(currentArray, shrinkFactoredHeight, shrinkFactoredWidth, newHighlighting , null)
            tensorGraphic.pivot.set(shrinkFactoredHeight /2, shrinkFactoredWidth /2)
            tensorGraphic.position.set(allocatedWidth / 2, allocatedHeight / 2)       
            outerContainer.addChild(tensorGraphic)
        } else { //* If non-rectangular array

            const numElems = currentArray.length;
            const spacing = allocatedWidth / (numElems + 1);
            const elemWidth = spacing;
            const elemHeight = Math.min(allocatedHeight, spacing);
            for (let [index, elem] of currentArray.entries()) {
                const newCurrentPosition = [...currentPosition, index];
                
                // Check if element contains ellipses
                const elemContainer = (typeof elem === 'string' && elem.includes('...'))
                    ? createEllipses(elemWidth * SHRINK_FACTOR, elemHeight * SHRINK_FACTOR, 'horiz', getOmitted(elem))
                    :  await _helper(elemWidth * SHRINK_FACTOR, elemHeight * SHRINK_FACTOR, newCurrentPosition);
                
                elemContainer.pivot.set((elemWidth * SHRINK_FACTOR) / 2, (elemHeight * SHRINK_FACTOR) / 2);
                elemContainer.x = spacing * (index + 1);
                elemContainer.y = allocatedHeight / 2;
                outerContainer.addChild(elemContainer);
            }
        }
        const leftBracket = getBracket(0, allocatedHeight, 'start');
        const rightBracket = getBracket(allocatedWidth, allocatedHeight, 'end');
        outerContainer.addChild(leftBracket);
        outerContainer.addChild(rightBracket);
        return outerContainer
    }

    return await _helper(width, height, [])
}

