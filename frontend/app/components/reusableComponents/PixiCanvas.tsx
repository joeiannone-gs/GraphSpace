import { mainRenderer, mainStage, mainTicker } from "@/app/globalObjs";
import { ApplicationOptions, Container, Renderer, Ticker, WebGLRenderer, WebGPURenderer } from "pixi.js";
import { useEffect, useRef, useState } from "react";
 


interface PixiCanvasProps {
    width: number, 
    height: number, 
    callback: (stage: Container, renderer: Renderer, ticker: Ticker) => void,
}


export function PixiCanvas({width, height, callback }: PixiCanvasProps ) {

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const initialized = useRef(false)
  const [renderer] = useState(new WebGLRenderer())

  useEffect(() => {

    let stage: Container;
    let ticker: Ticker;

    if (canvasRef.current) {
      const initialize = async () => {
        initialized.current = true
        stage =  new Container()
        ticker = new Ticker()
        await renderer.init({ 
          height, 
          width, 
          eventMode: 'static',
          antialias: true,
          canvas: canvasRef.current as HTMLCanvasElement
        })
        callback(stage, renderer, ticker)
      }
      if (!initialized.current) initialize();
    }

  }, [canvasRef.current])


  return (
    <canvas 
        ref={canvasRef} 
        height={height} 
        width={width} 
        onDrop={(e) => {
            //drop events converted to pointerup so PIXI event system can work with it
            const pointerEvent = new PointerEvent('pointerup', {clientX: e.clientX, clientY: e.clientY});
            e.currentTarget.dispatchEvent(pointerEvent);
        }}
    ></canvas>
  )
}