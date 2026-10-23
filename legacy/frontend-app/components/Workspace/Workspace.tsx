import { useEffect, useRef } from "react";
import store, { AppDispatch, RootState } from "@/app/store/store";
import { useDispatch, useSelector } from "react-redux";
import { selectCurrentGraphId } from "@/app/store/features/workspace/selectors/project";
import { Background } from "./Background";
import { setupViewport } from "../reusableComponents/viewport";
import { accessoryState, graphController, mainRenderer, mainStage, mainTicker, ViewportValues } from "@/app/globalObjs";
import { BrushComponent } from "./BrushComponent";




export function Workspace() {

  const dispatch: AppDispatch = useDispatch()


  const {height, width} = useSelector((state: RootState) => state.workspace.windowSize);
  const projectId = useSelector((state: RootState) => state.workspace.currentProjectId);
  const graphId = useSelector((state: RootState) => selectCurrentGraphId(state.workspace));

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const initialized = useRef(false)

  useEffect(() => {

  
    if (canvasRef.current) {
      const initialize = async () => {
        initialized.current = true
        await mainRenderer.init({ 
          height, 
          width, 
          eventMode: 'static',
          antialias: true,
          canvas: canvasRef.current as HTMLCanvasElement
        })
         
    
        
        //Viewport
        const updateValues = (newValues: ViewportValues) => accessoryState.viewportValues = newValues
        const viewport = setupViewport(mainRenderer, updateValues)
        mainStage.addChild(viewport)
        
        //Background
        const background = new Background(mainStage, dispatch)
        viewport.addChild(background.pixiContainer)

        //Brush
        const brush = new BrushComponent(mainTicker)
        viewport.addChild(brush.pixiContainer)

        //Graph
        graphController.switchGraph(graphId ?? "")
        let graph = graphController.getDisplay(graphId ?? "", 'main', mainRenderer)
        if (graph) viewport.addChild(graph)
        

        let g = graphId
        store.subscribe(() => {
          
          //Change graph component when there's a new current graph (e.g. when the user switches branches or clicks on another project)
          const potentiallyNewGraphId = selectCurrentGraphId(store.getState().workspace)
          if (potentiallyNewGraphId !== g) {
            if (graph) viewport.removeChild(graph)
            const pId = store.getState().workspace.currentProjectId
            if (potentiallyNewGraphId && pId) {
              graphController.switchGraph(potentiallyNewGraphId)
              graph = graphController.getDisplay(potentiallyNewGraphId, 'main', mainRenderer)
              if (graph) viewport.addChild(graph)
              g =  potentiallyNewGraphId
            }
          }
        })


        mainTicker.add((time) => {
          mainRenderer.render(mainStage)
        })
      }
      if (!initialized.current) initialize();
    }
  }, [canvasRef.current, projectId, graphId])


  return (
    <div>
      {/* <PixiCanvas height={height} width={width} callback={callback} isMain={true} /> */}
      <canvas 
        id={'main-canvas'}
        ref={canvasRef} 
        height={height} 
        width={width} 
        onDrop={(e) => {
            //drop events converted to pointerup so PIXI event system can work with it
            const pointerEvent = new PointerEvent('pointerup', {clientX: e.clientX, clientY: e.clientY});
            e.currentTarget.dispatchEvent(pointerEvent);
        }}
        onDragOver={(e) => e.preventDefault()}
    ></canvas>
    </div>
  )
 
}