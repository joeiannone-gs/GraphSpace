import { NODE_RADIUS } from "@/app/sizing/nodes";
import { Id, Size, Tensor } from "@/app/types/common";
import * as PIXI from 'pixi.js'
import { getArrayGraphic } from "./components/arrayGraphic";
import { getTensorGraphic } from "./components/tensorGraphic";
import { getShape, isEqualShape } from "@/app/services/math";



export async function parameter(data: Tensor | Tensor[] | null, tensorShape: number[]) {
    
    const allocatedSize: Size = [NODE_RADIUS, NODE_RADIUS]


    let innerElem: PIXI.Container;

    if (data) {
        
        // if data shape and tensor shape not equal, and its an array then it must be streaming data
        if (Array.isArray(data) && !isEqualShape(getShape(data), tensorShape)) { 
            const tensor = await getTensorGraphic(data[0], allocatedSize[1], allocatedSize[0], [], data)
            innerElem = tensor
        }
        // else normal
        else {
            const tensor = await getTensorGraphic(data, allocatedSize[1], allocatedSize[0], [], null)
            innerElem = tensor 
        }

    } else {
        // If no data and tensorSize indicates constant -> show 'θ'
        if (tensorShape?.length === 0 ) {
            const text = new PIXI.Text({
                text: 'θ',
                style: {
                    fontSize: NODE_RADIUS * 0.9,
                    fill: 0xFFFFFF,
                    align: 'center'
                }
            })
            text.anchor.set(0.5, 0.5)
            const c = new PIXI.Container()
            c.height = allocatedSize[1]
            c.width = allocatedSize[0]
            c.position.set(allocatedSize[0]/2, allocatedSize[1]/2)
            c.addChild(text)
            innerElem = c
        } 
        // If no data and tensorSize indicates tensor -> show blank tensor display
        else {
            const blankTensorDisplay = await getBlankTensorDisplay(tensorShape, allocatedSize)
            innerElem = blankTensorDisplay
        }
    }

    innerElem.pivot.set(allocatedSize[0]/2, allocatedSize[1]/2)

    return innerElem

}



const getBlankTensorDisplay = async (tensorSize: number[], allocatedSize: Size) => {

    const MAX_SIZE = 10
    let innerMostArray = []
    if (tensorSize[0] > MAX_SIZE) {
        const diff = tensorSize[0] - MAX_SIZE
        innerMostArray = [...new Array(MAX_SIZE-1).fill('θ'), `...${diff}...`, 'θ']
    } else {
        innerMostArray = new Array(tensorSize[0]).fill('θ')
    }

    let current = innerMostArray
    tensorSize.slice(1).forEach((dimSize: number) => {
        if (dimSize > MAX_SIZE) {
            const diff = dimSize - MAX_SIZE
            const newCurrent = [...new Array(MAX_SIZE-1).fill(current), `...${diff}...`, current]
            current = newCurrent
        } else {
            const newCurrent = new Array(dimSize).fill(current)
            current = newCurrent
        }
    })
    const array = await getArrayGraphic(current, allocatedSize[1], allocatedSize[0], [])

    return array
    
}