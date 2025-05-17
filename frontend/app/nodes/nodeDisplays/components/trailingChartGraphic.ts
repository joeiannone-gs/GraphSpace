import { NODE_RADIUS } from "@/app/sizing/nodes";
import * as PIXI from 'pixi.js'
import { normalizeValue } from "@/app/services/math";




export function getTrailingChartGraphic(value: number[]) {
    const height = NODE_RADIUS
    const width = NODE_RADIUS

    const range = { min: 0, max: 0 }

    const drawGraph = (g: PIXI.Graphics) => {
        if (!Array.isArray(value) || value.length < 3) {
            return
        }
        const min = Math.min(...value)
        const max = Math.max(...value)

        // get first point
        // x is 0
        const xNorm = normalizeValue(0, 0, value.length, 0, width)
        // y is first value of array
        const yNorm = normalizeValue(value[0], min, max, 0, height)

        g.clear()
        g.stroke({ alpha: 1, color: 0xFFFFFF})
        g.moveTo(xNorm, height - yNorm)
        value.forEach((point, index) => {
            const xNorm = normalizeValue(index, 0, value.length, 0, width)
            const yNorm = normalizeValue(point, min, max, 0, height)

            const x = xNorm
            const y = height - yNorm // format y to origin of chart

            g.stroke( { alpha: 1, color:  Math.random() * 0xFFFFFF } )
            g.lineTo(x, y)
        })
        g.x = -width / 2
        g.y = -height / 2
    }

    const container = new PIXI.Container()
    const graphics = new PIXI.Graphics()
    drawGraph(graphics)
    container.addChild(graphics)

    return container
}