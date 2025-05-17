import * as PIXI from 'pixi.js'
import { NODE_RADIUS } from '@/app/sizing/nodes'
import { normalizeValue } from '@/app/services/math'
import {  Pos } from '@/app/types/common'
import { getInputIndicatorGraphic } from './components/inputIndicatorGraphic'
import { EdgeIdMap } from '@/app/types/main'

const defaultStyle = new PIXI.TextStyle({
    fontFamily: 'Arial',
    fontSize: 36,
    fill: 0xFFFFFF,
})

export function chart(data: number[][], nodePosition: Pos, viewportScale: number, endPositionsOfIncomingEdges: Pos[]) {
    const container = new PIXI.Container()
    
    // Calculate point size based on viewport scale
    const pointSize = Math.min(10/viewportScale, 3)

    // Create graphics for points and axis
    const pointsGraphic = new PIXI.Graphics()
    const axisGraphic = new PIXI.Graphics()
    
    // Draw axis
    axisGraphic.stroke({ width: 5, color: 0xffffff})
    // Draw horizontal axis
    axisGraphic.moveTo(-NODE_RADIUS, NODE_RADIUS)
    axisGraphic.lineTo(NODE_RADIUS, NODE_RADIUS)
    // Draw vertical axis  
    axisGraphic.moveTo(-NODE_RADIUS, NODE_RADIUS)
    axisGraphic.lineTo(-NODE_RADIUS, -NODE_RADIUS)

    // Draw points
    drawPoints(pointsGraphic, data, pointSize)
    
    // Create container for display content
    const displayContainer = new PIXI.Container()
    displayContainer.scale.set(0.5)
    displayContainer.addChild(axisGraphic)
    displayContainer.addChild(pointsGraphic)
    container.addChild(displayContainer)

    // Add input indicators if there are incoming edges
    if (endPositionsOfIncomingEdges.length > 0) {
        endPositionsOfIncomingEdges.forEach((pos, index) => {
            const symbolText = new PIXI.Text({
                text: getValue(index),
                style: defaultStyle
            })
            const indicator = getInputIndicatorGraphic(symbolText, pos, nodePosition)
            container.addChild(indicator)
        })
    }

    return container
}

function drawPoints(g: PIXI.Graphics, data: number[][], pointSize: number) {
    if (!Array.isArray(data) || data.length < 2 || !Array.isArray(data[0])) {
        return
    }

    g.clear()

    // Precompute normalized x values
    const [xMin, xMax] = [Math.min(...data[0]), Math.max(...data[0])]
    const normalizedX = data[0].map(x => 
        normalizeValue(x, xMin, xMax, -NODE_RADIUS, NODE_RADIUS)
    )

    // Precompute normalized y values for each column
    const normalizedY = data.slice(1).map(yCol => {
        const [yMin, yMax] = [Math.min(...yCol), Math.max(...yCol)]
        return yCol.map(y => 
            normalizeValue(y, yMin, yMax, NODE_RADIUS, -NODE_RADIUS)
        )
    })

    // Make a random color for each yCol
    const colors = normalizedY.map((_, index) => index * 0x0000FF)

    // Draw points using precomputed normalized values
    normalizedX.forEach((xNorm, verticalIndex) => {
        normalizedY.forEach((yCol, colIndex) => {
            const yNorm = yCol[verticalIndex]
            g.circle(xNorm, yNorm, pointSize)
            g.fill({ color: colors[colIndex] })
        })
    })
}


const getValue = (num: number) => {
    
    if (num === 0) {
        return 'x';
    }

    return `y${num}`;
}
