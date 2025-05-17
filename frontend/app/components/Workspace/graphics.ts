import { mainRenderer } from "@/app/globalObjs";
import { getColoring } from "@/app/services/getColoring";
import { NODULE_RADIUS } from "@/app/sizing/edges";
import { NODE_RADIUS, SCALE_ZONE_RADIUS } from "@/app/sizing/nodes";
import { Graphics } from "pixi.js";



const nodeColoring = getColoring(false).nodeColoring
const edgeColoring = getColoring(false).edgeColoring

//Base nodes
export function createBaseNodeGraphic() {
    const graphic = new Graphics()
    graphic.circle(0, 0, NODE_RADIUS)
    graphic.fill({ color: 0xFFFFFF, alpha: 0.1})
    graphic.stroke({ color: nodeColoring.base, alpha: 1, width: 5})
    return graphic
}

export function createBaseNodeGraphicThumbnail() {
    const graphic = new Graphics()
    graphic.circle(0, 0, NODE_RADIUS)
    graphic.fill({ color: 0x888888, alpha: 1})
    return graphic
}

//Abstraction nodes
export function createAbsNodeGraphic() {
    const graphic = new Graphics()
    graphic.circle(0, 0, NODE_RADIUS)
    graphic.stroke({width: 5, color: nodeColoring.abs})
    graphic.circle(0, 0, SCALE_ZONE_RADIUS)
    graphic.stroke({width: 1, color: 0xFFFFFF, alpha: 0.25})
    return graphic
}

export function createAbsNodeGraphicThumbnail() {
    const graphic = new Graphics()
    graphic.circle(0, 0, NODE_RADIUS)
    graphic.stroke({width: 25, color: nodeColoring.abs})
    return graphic
}

export function createAbsNodeOverlayGraphic() {
    const graphic = new Graphics()
    graphic.circle(0, 0, NODE_RADIUS)
    graphic.fill({color: nodeColoring.abs, alpha: 0.1})
    return graphic
}

//Nodules
export function createNoduleGraphic() {
    const graphic = new Graphics()
    graphic.circle(0, 0, NODULE_RADIUS)
    graphic.fill(edgeColoring.nodule)
    return graphic
}