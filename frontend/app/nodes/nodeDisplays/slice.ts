import { NODE_RADIUS } from "@/app/sizing/nodes";
import { Id, Size, Slice, Tensor } from "@/app/types/common";
import * as PIXI from 'pixi.js'
import { getArrayGraphic } from "./components/arrayGraphic";
import { NodeValue } from '@/app/types/main';
import { truncateArray } from "@/app/services/math";


export async function slice(displayValue: NodeValue | undefined, inputNodeDisplayValue: NodeValue, slice: Slice, sliceArrowSprite: PIXI.Sprite) {

    const allocatedSize: Size = [NODE_RADIUS/2, NODE_RADIUS/2]

    const c0 = new PIXI.Container()
    c0.label = 'Slice Container'
    c0.x = 0
    c0.y = 0
    c0.pivot.set(0, 0)

    const c1 = new PIXI.Container()
    c1.x = -NODE_RADIUS / 2
    c1.pivot.set(allocatedSize[0] / 2, allocatedSize[1] / 2)

    if (inputNodeDisplayValue) {
        const arrayComponent = new PIXI.Container()
        const truncated = truncateArray(inputNodeDisplayValue, 6, 3)
        arrayComponent.addChild(await getArrayGraphic(truncated, allocatedSize[1], allocatedSize[0], slice))
        c1.addChild(arrayComponent)
    }

    sliceArrowSprite.scale.set(1.2)
    sliceArrowSprite.anchor.set(0.5)

    const c2 = new PIXI.Container()
    c2.x = NODE_RADIUS / 2
    c2.pivot.set(allocatedSize[0] / 2, allocatedSize[1] / 2)

    if (displayValue) {
        const arrayComponent = new PIXI.Container()
        const truncated = truncateArray(displayValue, 6, 3)
        arrayComponent.addChild(await getArrayGraphic(truncated, allocatedSize[1], allocatedSize[0], []))
        c2.addChild(arrayComponent)
    }

    c0.addChild(c1, sliceArrowSprite, c2)

    return c0

}
