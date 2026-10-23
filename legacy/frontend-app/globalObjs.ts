import { Container, Graphics, Renderer, Sprite, Texture, Ticker, WebGLRenderer, WebGPURenderer } from "pixi.js";
import { Id, Pos } from "./types/common";
import { Graphs } from "./types/main";
import { GraphController } from "./components/Workspace/graphController";






export const graphs: Graphs = {} 

export const graphController = new GraphController()





export interface ViewportValues {
    scale: number | null;
    topLeft: Pos | null;
    bottomRight: Pos | null;
    viewportPos?: Pos | null;
}

export type AccessoryState = {
    brush: [Pos, Pos] | [],
    multiConnect:  Id[],
    viewportValues: ViewportValues
}

class AccessoryStateManager {
    private static instance: AccessoryStateManager;
    private _state: AccessoryState = {
        brush: [],
        multiConnect: [],
        viewportValues: {
            topLeft: [0,0],
            bottomRight: [0,0],
            scale: 1
        }
    };

    private constructor() {}

    public static getInstance(): AccessoryStateManager {
        if (!AccessoryStateManager.instance) {
            AccessoryStateManager.instance = new AccessoryStateManager();
        }
        return AccessoryStateManager.instance;
    }

    get brush() { return this._state.brush; }
    set brush(value) { this._state.brush = value; }

    get viewportValues() { return this._state.viewportValues; }
    set viewportValues(value) { this._state.viewportValues = value; }

    get multiConnect() { return this._state.multiConnect; }
    set multiConnect(value) { this._state.multiConnect = value; }
}

export const accessoryState = AccessoryStateManager.getInstance();







export const mainTicker = new Ticker()
mainTicker.start()

export const mainStage = new Container()
export const mainRenderer = new WebGPURenderer()

export const textureCache = new Map<string, Texture>()

export class TextureCacheHelper {
    SCALED_UP_SIZE = 500
    textureCache = new Map<string, [Texture, number]>();

    graphicsToSprite(g: Graphics | Container, renderer: Renderer, cacheKey?: string) {
        const { width, height } = g.getBounds()
        const scaleFactor = Math.max(this.SCALED_UP_SIZE / width, this.SCALED_UP_SIZE / height)
      
        g.scale.set(scaleFactor)
        const c = new Container()
        c.addChild(g)
      
        const t = renderer.generateTexture({ target: c })
        const s = new Sprite(t)
        s.scale.set(1/scaleFactor)
        
        if (cacheKey) this.textureCache.set(cacheKey, [t, scaleFactor]) //set in cache if key provided
            
        return s
    }

    getCachedSprite(cacheKey: string) {
        const entry = this.textureCache.get(cacheKey)
        if (!entry) return undefined
        const [texture, scaleFactor] = entry
        const s = new Sprite(texture)
        s.scale.set(1/scaleFactor)
        return s
    }

}

export const textureCacheHelper = new TextureCacheHelper();