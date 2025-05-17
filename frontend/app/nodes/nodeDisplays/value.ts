import { NODE_RADIUS } from "@/app/sizing/nodes";
import { Size, Tensor } from "@/app/types/common";
import * as PIXI from 'pixi.js'
import { getArrayGraphic } from "./components/arrayGraphic";
import { NodeValue } from '@/app/types/main';
import { truncateArray } from "@/app/services/math";



export function value(value: Tensor) {
    const allocatedSize = [NODE_RADIUS*2, NODE_RADIUS*2]

    const c0 = new PIXI.Container()
    const c1 = new PIXI.Container()

    c1.scale.set(0.69, 0.69)
    c1.pivot.set(allocatedSize[0]/2, allocatedSize[1]/2)

    if (value) {
        const truncated = truncateArray(value, 6, 3)
        const array = getArrayGraphic(truncated, allocatedSize[1], allocatedSize[0], [] )
        c1.addChild(array)
    }

    c0.addChild(c1)

    return c0
}
