import { mainRenderer, textureCacheHelper } from "@/app/globalObjs"
import { Tensor } from "@/app/types/common"
import * as PIXI from 'pixi.js'
import { callWorker } from "./web-workers/workerHelper"



export const getElemFromPos = (t: Tensor, p: number[]) => {
  return p.reduce((inner, index) => Array.isArray(inner) ? inner[index] : inner , t)
}


export const getOmitted = (elem: string) => {
  const match = elem.match(/\.\.\.(\d+)\.\.\./);
  if (match && match[1])  return parseInt(match[1], 10) - 1;
  return 0
}





export async function createChart(height: number, width: number, values: number[]) {
    const asTypedArray = new Float32Array(values)
    const pixels = await callWorker({type: "createChart", data: { height, width, values: asTypedArray }}, asTypedArray.buffer) as PIXI.GetPixelsOutput
    const texture = PIXI.Texture.from({ ...pixels, resource: pixels.pixels})
    const sprite = new PIXI.Sprite(texture);
    return sprite;
}

// type Chart = { 
//   container: PIXI.Container
//   minVal: number,
//   maxVal: number,
//   lastX: number,
//   lastY: number
// }
// const chartCache = new Map<string, Chart>()
// export function createChart( height: number, width: number, values: number[], cacheKey?: string) { 

//   const spacing = 5
//   const stroke = { color: 0xFFFFFF, width: 5, pixelLine: false }

//   let cachedChart = chartCache.get(cacheKey ?? "")
//   if (!cachedChart) {
//       const getChart = () => {
//           const chart = new PIXI.Graphics()

//           const minVal = Math.min(...values);
//           const maxVal = Math.max(...values);
//           const range = maxVal - minVal || 1;
//           const length = values.length
//           const heightFactor = height / range;
//           let lastX = 0;
//           let lastY = 0;
      
//           chart.moveTo(0, height - ((values[0] - minVal) * heightFactor));
      
//           for (let i = 1; i < length; i++) {
//             const x = i * spacing;
//             const y = height - ((values[i] - minVal) * heightFactor);
//             chart.lineTo(x, y);
//             lastX = x
//             lastY = y
//           }
//           chart.stroke(stroke)
//           const container = new PIXI.Container()
//           container.addChild(chart)
//           container.scale.x = width * (1/ (length * spacing))
//           return { container, minVal, maxVal, lastX, lastY}
//       }
//       const chart = getChart()
//       if (cacheKey) chartCache.set(cacheKey, chart)
//       return chart.container
//   } else {
//       const chart = cachedChart.container.getChildAt(0) as PIXI.Graphics
//       chart.moveTo(cachedChart.lastX, cachedChart.lastY)

//       const latestValue = values[values.length - 1]

//       if (latestValue < cachedChart.minVal) {
//           cachedChart.minVal = latestValue
//       } else if (latestValue > cachedChart.maxVal) {
//           cachedChart.maxVal = latestValue
//       }

//       const range = cachedChart.maxVal - cachedChart.minVal || 1;
//       const heightFactor = height / range;
//       const x = spacing * values.length
//       const y = height - (latestValue - cachedChart.minVal) * heightFactor
//       chart.lineTo(x, y)
//       cachedChart.lastX = x
//       cachedChart.lastY = y
//       chart.stroke(stroke)
//       cachedChart.container.scale.x = width * (1/ (values.length * spacing))
//       return cachedChart.container 
//   }

// }


export function createDiagonalEllipses(elemWidth: number, elemHeight: number, slope = 1) {
  const dotRadius = Math.min(elemWidth, elemHeight) * 0.01;
  const dotSpacing = Math.min(elemWidth, elemHeight) * 0.03; // spacing along the diagonal

  const dots = new PIXI.Graphics();

  // Top-left group (aligned along the slope)
  dots.circle(0, 0, dotRadius).fill(0xFFFFFF);
  dots.circle(dotSpacing, dotSpacing * slope, dotRadius).fill(0xFFFFFF);
  dots.circle(2 * dotSpacing, 2 * dotSpacing * slope, dotRadius).fill(0xFFFFFF);

  // Top-right group (shifted so they lie on a line with the given slope)
  dots.circle(elemWidth - 2 * dotSpacing, 0, dotRadius).fill(0xFFFFFF);
  dots.circle(elemWidth - dotSpacing, dotSpacing * slope, dotRadius).fill(0xFFFFFF);
  dots.circle(elemWidth, 2 * dotSpacing * slope, dotRadius).fill(0xFFFFFF);

  // Bottom-left group (shifted so they lie on a line with the given slope)
  dots.circle(0, elemHeight - 2 * dotSpacing * slope, dotRadius).fill(0xFFFFFF);
  dots.circle(dotSpacing, elemHeight - dotSpacing * slope, dotRadius).fill(0xFFFFFF);
  dots.circle(2 * dotSpacing, elemHeight, dotRadius).fill(0xFFFFFF);

  // Bottom-right group (aligned along the slope)
  dots.circle(elemWidth - 2 * dotSpacing, elemHeight - 2 * dotSpacing * slope, dotRadius).fill(0xFFFFFF);
  dots.circle(elemWidth - dotSpacing, elemHeight - dotSpacing * slope, dotRadius).fill(0xFFFFFF);
  dots.circle(elemWidth, elemHeight, dotRadius).fill(0xFFFFFF);

  return dots
}

export function createEllipses(elemWidth:number, elemHeight: number, alignment: 'horiz' | 'vert' , numOmitted?: number) {

  const cacheKey = `${elemWidth}_${elemHeight}_${alignment}_${numOmitted}`
  let sprite = textureCacheHelper.getCachedSprite(cacheKey)

  if (!sprite) {
    const container = new PIXI.Container();
    const dots = new PIXI.Graphics();
    const dotRadius = Math.min(elemWidth, elemHeight) * 0.05;
    const dotSpacing = Math.min(elemWidth, elemHeight) * 0.2;
    
    if (alignment === 'horiz') {
        dots.circle(elemWidth / 2 - dotSpacing, elemHeight / 2, dotRadius);
        dots.circle(elemWidth / 2, elemHeight / 2, dotRadius);
        dots.circle(elemWidth / 2 + dotSpacing, elemHeight / 2, dotRadius);
    } else { // vertical
        dots.circle(elemWidth / 2, elemHeight / 2 - dotSpacing, dotRadius);
        dots.circle(elemWidth / 2, elemHeight / 2, dotRadius);
        dots.circle(elemWidth / 2, elemHeight / 2 + dotSpacing, dotRadius);
    }
    
    dots.fill(0xFFFFFF);
    container.addChild(dots);
    
    if (numOmitted !== undefined) {
        
        const maxTextWidth = elemWidth * 0.1;
        const maxTextHeight = elemHeight * 0.4;
        
        const text = createText(maxTextWidth, maxTextHeight, numOmitted)
      
        if (alignment === 'horiz') {
            text.anchor.set(0.5, 1); // Center horizontally, bottom-aligned.
            const posX = elemWidth / 2;
            const posY = elemHeight / 2 - dotRadius;
            text.position.set(posX, posY);
        } else {
            text.anchor.set(1, 0.5); // Right-aligned, center vertically.
            const posX = elemWidth / 2 - dotRadius;
            const posY = elemHeight / 2;
            text.position.set(posX, posY);
        }
        
        container.addChild(text);
    }
    sprite = textureCacheHelper.graphicsToSprite(container, mainRenderer, cacheKey)
  }
  
  sprite.anchor.set(0.5, 0.5)
  return sprite;
}

export function createNumBracket(x1: number, y1: number, x2: number, y2: number, num: number) {
  const container = new PIXI.Container();
  const bracket = new PIXI.Graphics();

  // Calculate length and direction
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy);

  // Parameters
  const availableWidth = len * 0.2
  const tickSize = len * 0.025;
  const offset = len * 0.05;
  const lineWidth = len * 0.005;

  // Perpendicular vector
  const perpX = -dy / len;
  const perpY = dx / len;

  // Tick endpoints
  const startTickX = x1 + tickSize * perpX;
  const startTickY = y1 + tickSize * perpY;
  const endTickX = x2 + tickSize * perpX;
  const endTickY = y2 + tickSize * perpY;

  // Draw bracket
  bracket.moveTo(startTickX, startTickY).lineTo(x1, y1);
  bracket.moveTo(endTickX, endTickY).lineTo(x2, y2);
  bracket.moveTo(startTickX, startTickY).lineTo(endTickX, endTickY);
  bracket.stroke({ color: 0xFFFFFF, width: lineWidth });
  
  container.addChild(bracket);

  // Text positioning
  const centerX = (startTickX + endTickX) / 2;
  const centerY = (startTickY + endTickY) / 2;

  const text = createText(availableWidth, availableWidth / 2, num)
  text.position.set(
      centerX + offset * perpX,
      centerY + offset * perpY
  );
  
  container.addChild(text);
  return container;
}


export const createText = (width: number, height: number, text: number | string, fill?: number ) => {
  const FONT_SIZE = 24

  const asText = text.toString()

  const textWidth = FONT_SIZE * 0.6 * asText.length;
  const scale = Math.min(
      (width / textWidth) * 0.9,
      (height / FONT_SIZE) * 0.7
  );


  const pixiText = new PIXI.BitmapText( { 
    text: asText,
    style: {
      fontSize: FONT_SIZE, 
      fontFamily: "Century Gothic",
      fill: fill ?? 0xFFFFFF,
    }
  })

  pixiText.anchor.set(0.5, 0.5)
  pixiText.position.set(width/2, height/2)
  pixiText.scale.set(scale)
  return pixiText
}

export const getBracket = (x: number, height: number, side: 'start' | 'end') => {
  const g = new PIXI.Graphics()
  const armLength = height / 6
  const cornerRadius = armLength / 5
  const newHeight = height

  const cacheKey = height.toString() + side
  let sprite = textureCacheHelper.getCachedSprite(cacheKey)
 
  if (!sprite) {
      
    if (side == 'start') {
        // Draw left bracket with rounded corners
        g.moveTo(armLength, 0)
        g.lineTo(cornerRadius, 0)
        g.arcTo(0, 0, 0, cornerRadius, cornerRadius)
        g.lineTo(0, newHeight - cornerRadius)
        g.arcTo(0, newHeight, cornerRadius, newHeight, cornerRadius)
        g.lineTo(armLength, newHeight)
      } else {
        // Draw right bracket with rounded corners
        g.moveTo(-armLength, 0)
        g.lineTo(-cornerRadius, 0)
        g.arcTo(0, 0, 0, cornerRadius, cornerRadius)
        g.lineTo(0, newHeight - cornerRadius)
        g.arcTo(0, newHeight, -cornerRadius, newHeight, cornerRadius)
        g.lineTo(-armLength, newHeight)
    }
    g.stroke({width: height * 0.005, color: 0xFFFFFF, cap: 'round'})
    
    sprite = textureCacheHelper.graphicsToSprite(g, mainRenderer, cacheKey)
  }

  sprite.x = x - armLength
  return sprite
}
