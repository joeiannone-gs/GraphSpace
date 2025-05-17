import * as PIXI from 'pixi.js'
import { NODE_RADIUS } from "@/app/sizing/nodes"
import { Id, Pos } from "@/app/types/common"
import { Edge } from '@/app/types/main'

export function getInputIndicatorGraphic(
    symbolGraphic: PIXI.Text,
    edgeEndpos: Pos,
    nodePosition: Pos
): PIXI.Container {
    const container = new PIXI.Container()

    // Calculate position
    const angle = Math.atan2(
        nodePosition[1] - edgeEndpos[1], 
        nodePosition[0] - edgeEndpos[0]
    ) + Math.PI

    const distance = NODE_RADIUS * 0.8
    const position: Pos = [
        distance * Math.cos(angle),
        distance * Math.sin(angle)
    ]

    // Set container position
    container.position.set(position[0], position[1])
    
    // Add the symbol graphic
    container.addChild(symbolGraphic)

    return container
}

