

import { NodeTypeEnum } from '../proto/compiled'


/**
 * Icons and images should almost always be svgs.
 */

//SVGs
import valSVG from '@/public/nodes/SVGs/val.svg'
import divideSVG from '@/public/nodes/SVGs/divide.svg'
import squareSVG from '@/public/nodes/SVGs/square.svg'
import reluSVG from '@/public/nodes/SVGs/relu.svg'
import avgSVG from '@/public/nodes/SVGs/avg.svg'
import dotSVG from '@/public/nodes/SVGs/dot.svg'
import sliceSVG from '@/public/nodes/SVGs/slice.svg'
import dropIconSVG from '@/public/nodes/SVGs/dropIcon.svg'
import sigmoidSVG from '@/public/nodes/SVGs/sigmoidSVG.svg'
import addSVG from '@/public/nodes/SVGs/add.svg'
import subSVG from '@/public/nodes/SVGs/subtract.svg'
import mulSVG from '@/public/nodes/SVGs/multiply.svg'
import arraySVG from '@/public/nodes/SVGs/array.svg'
import flattenSVG from '@/public/nodes/SVGs/flatten.svg'
import paramSVG from '@/public/nodes/SVGs/param.svg'
import stackSVG from '@/public/nodes/SVGs/stack.svg'
import popSVG from '@/public/nodes/SVGs/pop.svg'
import imageSVG from '@/public/nodes/SVGs/image.svg'
import bracketSVG from '@/public/nodes/SVGs/bracket.svg'
//PNGs

import sliceArrowPNG from '@/public/nodes/PNGs/sliceArrow.png'
import dashedSquarePNG from '@/public/nodes/PNGs/dashedSquare.png';



import { Assets } from 'pixi.js'


export const typeToUrl = {
    //base node main assets
    [NodeTypeEnum.ADD]: addSVG.src,
    [NodeTypeEnum.SUBTRACT]: subSVG.src,
    [NodeTypeEnum.MULTIPLY]: mulSVG.src,
    [NodeTypeEnum.DIVIDE]: divideSVG.src,
    [NodeTypeEnum.SQUARE]: squareSVG.src,
    [NodeTypeEnum.RELU]: reluSVG.src,
    [NodeTypeEnum.FLATTEN]: flattenSVG.src,
    [NodeTypeEnum.ARRAY]: arraySVG.src,
    [NodeTypeEnum.STACK]: stackSVG.src,
    [NodeTypeEnum.POP]: popSVG.src,
    [NodeTypeEnum.DOT]: dotSVG.src,
    [NodeTypeEnum.VALUE]: valSVG.src,
    [NodeTypeEnum.PARAMETER]: paramSVG.src,
    [NodeTypeEnum.AVERAGE]: avgSVG.src,
    [NodeTypeEnum.SLICE]: sliceSVG.src,
    [NodeTypeEnum.IMAGE]: imageSVG.src,
    [NodeTypeEnum.IMPORT]: dropIconSVG.src,
    [NodeTypeEnum.SIGMOID]: sigmoidSVG.src,

    //other
    sliceArrow: sliceArrowPNG.src ,
    dashedSquare: dashedSquarePNG.src,
    dropIcon: dropIconSVG.src,
    bracket: bracketSVG.src
}


export async function getAssets() {
  Assets.addBundle('graphAssets', typeToUrl)
  return await Assets.loadBundle('graphAssets')
}



