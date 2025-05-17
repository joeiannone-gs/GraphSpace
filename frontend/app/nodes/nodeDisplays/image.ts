import * as PIXI from 'pixi.js'
import { NODE_RADIUS } from "@/app/sizing/nodes"
import { getDepth, normalizeValue } from "@/app/services/math"

export function image(array2D: number[][]) {
    // Input validation
    if (!array2D || !Array.isArray(array2D) || array2D.length === 0) {
        return new PIXI.Container();
    }

    // Create container and set pivot point
    const container = new PIXI.Container();
    container.pivot.set(NODE_RADIUS/2, NODE_RADIUS/2);

    // Create graphics object for drawing
    const graphics = new PIXI.Graphics();
    container.addChild(graphics);

    // Calculate dimensions and color range
    const numRows = array2D.length;
    const numCols = array2D[0].length;
    const sideLength = NODE_RADIUS / Math.max(numRows, numCols);

    const flatArray = array2D.flat(2);
    const min = Math.min(...flatArray);
    const max = Math.max(...flatArray);

    // Draw pixels
    array2D.forEach((row, rowIndex) => {
        row.forEach((elem, colIndex) => {
            // Calculate grayscale color value
            const normalizedValue = normalizeValue(elem, min, max, 0, 1);
            const colorComponent = Math.round(normalizedValue * 255);
            const color = (colorComponent << 16) | (colorComponent << 8) | colorComponent;

            // Draw rectangle
            const x = colIndex * sideLength;
            const y = rowIndex * sideLength;
            graphics.rect(x, y, sideLength, sideLength);
            graphics.fill({ color });
        });
    });

    // Add dimensions text
    const dimensionsText = new PIXI.Text({
        text: `${numRows}x${numCols}`,
        style: {
            fontSize: 24,
            fill: 0xFFFFFF,
            fontFamily: 'Arial'
        }
    }
    )
    dimensionsText.position.set(NODE_RADIUS/2, NODE_RADIUS + 10);
    dimensionsText.anchor.set(0.5, 0);
    container.addChild(dimensionsText);

    return container;
}