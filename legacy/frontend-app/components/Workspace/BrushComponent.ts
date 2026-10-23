import { accessoryState, ViewportValues } from '@/app/globalObjs'
import { Pos } from '@/app/types/common'
import * as PIXI from 'pixi.js'



type Brush = [Pos, Pos] | null


export class BrushComponent {
    pixiContainer = new PIXI.Container()
    ticker: PIXI.Ticker

    constructor(ticker: PIXI.Ticker) {
        this.ticker = ticker
        
        const updateFunction = () => {
            const oldBrush = this.pixiContainer.getChildByLabel('brush');
            if (oldBrush) this.pixiContainer.removeChild(oldBrush);
            this.createBrush();
        };

        this.ticker.add(updateFunction);
    }

    private createBrush() {
        if (accessoryState.brush?.[0] && accessoryState.viewportValues?.scale) {

            const g = new PIXI.Graphics()
            g.label = "brush"
            
            const [start, end] = accessoryState.brush
            const x = Math.min(start[0], end[0])
            const y = Math.min(start[1], end[1])
            const width = Math.abs(end[0] - start[0])
            const height = Math.abs(end[1] - start[1])
            
            g.rect(x, y, width, height)
            g.stroke({ width: 1/accessoryState.viewportValues!.scale, color: 0xFFFFFF})

            this.pixiContainer.addChild(g)
        }
    }


    // /* Helpers */
    // private didBrushChange(newBrush: Brush) {
    //     return this.brush === null && newBrush !== null ||
    //         (this.brush?.[1]?.[0] !== newBrush?.[1]?.[0] ||
    //         this.brush?.[1]?.[1] !== newBrush?.[1]?.[1])
    // }

} 