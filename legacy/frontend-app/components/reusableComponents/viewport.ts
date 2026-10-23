import { ViewportValues } from "@/app/globalObjs";
import { Pos } from "@/app/types/common";
import { Viewport } from "pixi-viewport";
import * as PIXI from 'pixi.js'






export function setupViewport( renderer: PIXI.Renderer, callback: (v: ViewportValues) => void) {

    const viewport = new Viewport({
        events: renderer.events
    });

    viewport.label = 'viewport'
    
    viewport.drag({
        clampWheel: false,
        mouseButtons: 'left',
        keyToPress: ['ShiftLeft', 'ShiftRight'], // Enable drag only with Shift key
        wheel: false,
        
    })
    

    const setViewportValues = () => {

        const {x, y} = viewport.corner
        const topLeft = [x, y] as Pos
        
        const scale = viewport.scaled as number
        
        const worldWidth = viewport.right as number
        const worldHeight = viewport.bottom as number
        const bottomRight = [worldWidth, worldHeight] as Pos
        
        const viewportValues = { scale, topLeft, bottomRight}
        callback(viewportValues)
    }

    viewport.on('wheel', (e) => {
        e.preventDefault();
        const point = e.global
        const oldPoint = viewport.toLocal(point)
        const step = -e.deltaY * 1 / 500
        const change = Math.pow(2, 1 * step)
        viewport.scale.x = viewport.scale.y *= change
        const newPoint = viewport.toGlobal(oldPoint)
        viewport.x += point.x - newPoint.x
        viewport.y += point.y - newPoint.y
        setViewportValues()
    } )

    viewport.on('drag-start', () => {
        viewport.on('pointermove', setViewportValues)
    })

    viewport.on('drag-end', () => {
        viewport.off('pointermove', setViewportValues)
    })

    setViewportValues()
    
    return viewport
}