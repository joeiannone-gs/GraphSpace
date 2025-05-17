import { Id } from "@/app/types/common";
import { PixiCanvas } from "./PixiCanvas";
import { useCallback } from "react";
import { Container, Renderer, Ticker } from "pixi.js";
import { createChart, createText } from "@/app/nodes/nodeDisplays/components/helpers";
import { getNode } from "../Workspace/graphGetters";






export function Chart( {id, width, height} : {id: Id, width: number, height: number}) {




    const callback = useCallback((stage: Container, renderer: Renderer, ticker: Ticker) => {


        ticker.add(async () => {
            const node = getNode(id)
            const stream = node.displayValue as number[]
            if (stream && stream.length > 0) {

                const sprite = await createChart(height, width, stream)
                stage.removeChildren()
                stage.addChild(sprite)
                const latestValue = Number(stream[stream.length - 1]).toFixed(4)
                const val = createText(100, 30, latestValue)
                val.y = height - 20
                stage.addChild(val)
                
                renderer.render(stage)
            }
        })
        ticker.start()


    }, [id])


    return (
        <div style={{ 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center',
            border: '1px solid #ccc',
            borderRadius: '8px',
            padding: '5px',
            height: height, 
            width: width
        }}>
            <PixiCanvas height={height} width={width} callback={callback} />
        </div>
    )
}