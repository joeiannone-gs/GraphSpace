import { Id, Pos } from "@/app/types/common";
import * as PIXI from "pixi.js";
import { lineIntersection } from "./math";
import { mainRenderer } from "../globalObjs";

export function makeInteractiveCircle (g: PIXI.Graphics, r: number, c: number, fill=false, width=5) {
  g.clear()
  g.circle(r, r, r)
  g.fill({color: fill ? c : 0x000000, alpha: fill ? 1: 0.6})
  g.stroke({color: c, alpha: 1, width})
  g.cursor = 'pointer'
  g.pivot.set(r, r)
}




export const edgeLineGraphic = (g: PIXI.Graphics, closest1: Pos, closest2: Pos, startWidth: number, endWidth: number, draw: 'top' | 'bottom' | 'both' ) => {
  //mid point of the line
  const midX = (closest1[0] + closest2[0]) / 2;
  const midY = (closest1[1] + closest2[1]) / 2;

  const angle = Math.atan2(closest2[1] - closest1[1], closest2[0] - closest1[0]) + Math.PI
  const arrowSize = Math.max(startWidth, endWidth) * 3; // Adjust the size of the arrowhead as needed

  //tip of arrow
  const point2: Pos = [midX - (arrowSize / 2) * Math.cos(angle), midY - (arrowSize / 2) * Math.sin(angle)]

  //top point
  const pointH: Pos = [ point2[0] + arrowSize * Math.cos(angle - Math.PI / 6), point2[1] + arrowSize * Math.sin(angle - Math.PI / 6)]

  //bottom point
  const pointC: Pos = [point2[0] + arrowSize * Math.cos(angle + Math.PI / 6), point2[1] + arrowSize * Math.sin(angle + Math.PI / 6)]

  const startOffset = startWidth/2; // Adjust this value as needed for the desired offset
  const endOffset = endWidth/2; // Adjust this value as needed for the desired offset

  const dx = closest2[0] - closest1[0];
  const dy = closest2[1] - closest1[1];

  // Calculate normalized normals
  const nx = dy / Math.sqrt(dx * dx + dy * dy);
  const ny = -dx / Math.sqrt(dx * dx + dy * dy);

  // Create offset points
  const pointA = [closest1[0] + startOffset * nx, closest1[1] + startOffset * ny];
  const pointJ = [closest1[0] - startOffset * nx, closest1[1] - startOffset * ny];
  const pointE = [closest2[0] + endOffset * nx, closest2[1] + endOffset * ny];
  const pointF = [closest2[0] - endOffset * nx, closest2[1] - endOffset * ny];

  const arrowAngle = Math.atan2(closest2[1] - closest1[1], closest2[0] - closest1[0]);

  // Calculate normalized perpendiculars for the arrow points
  const arrowNx = Math.cos(arrowAngle + Math.PI / 2);
  const arrowNy = Math.sin(arrowAngle + Math.PI / 2);


  const pointG = [point2[0] + Math.max(startOffset, endOffset) * arrowNx, point2[1] + Math.max(startOffset, endOffset) * arrowNy];
  const pointD = [point2[0] - Math.max(startOffset, endOffset) * arrowNx, point2[1] - Math.max(startOffset, endOffset) * arrowNy];


  const intersection = lineIntersection(closest1, closest2, pointC, pointH);

  let pointB
  let pointI
  if (intersection) {
    pointB = [intersection[0] + Math.max(startOffset, endOffset) * nx, intersection[1] + Math.max(startOffset, endOffset) * ny];
    pointI = [intersection[0] - Math.max(startOffset, endOffset) * nx, intersection[1] - Math.max(startOffset, endOffset) * ny];
  } else {
    pointB = closest1
    pointI = closest2
  }

  if (draw == 'both') {
    g.poly([
      //To draw half
        closest1[0], closest1[1], 
        pointA[0], pointA[1], //start +offset
       pointB[0], pointB[1],
        pointC[0], pointC[1],
       pointD[0], pointD[1],
        pointE[0], pointE[1], //end +offset
        closest2[0], closest2[1],
        //To draw other half
        pointF[0], pointF[1], //end -
       pointG[0], pointG[1],
       pointH[0], pointH[1],
        pointI[0], pointI[1],
        pointJ[0], pointJ[1] //start -
    ]);
  } else if (draw == 'bottom') {
    g.poly([
      //To draw half
        closest1[0], closest1[1], 
        pointA[0], pointA[1], //start +offset
       pointB[0], pointB[1],
        pointC[0], pointC[1],
       pointD[0], pointD[1],
        pointE[0], pointE[1], //end +offset
        closest2[0], closest2[1],
    ]);
  } else if (draw == 'top') {
    g.poly([
      //To draw half
        closest1[0], closest1[1], 
        closest2[0], closest2[1],
        //To draw other half
        pointF[0], pointF[1], //end -offset
       pointG[0], pointG[1],
       pointH[0], pointH[1],
        pointI[0], pointI[1],
        pointJ[0], pointJ[1] //start -offset
    ]);
  }
}


const SCALED_UP_SIZE = 500
export function graphicsToTexture(g: PIXI.Graphics, renderer: PIXI.Renderer) {

  const { width, height } = g.getBounds()
  const scaleFactor = Math.max(SCALED_UP_SIZE / width, SCALED_UP_SIZE / height)

  g.scale.set(scaleFactor)
  const c = new PIXI.Container()
  c.addChild(g)

  const t = renderer.generateTexture({ target: c })

  return { texture: t, scaleFactor}
}