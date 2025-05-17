import * as PIXI from 'pixi.js'
import { DOMAdapter, WebWorkerAdapter } from 'pixi.js';

// WebWorkerAdapter is an implementation of the Adapter interface
DOMAdapter.set(WebWorkerAdapter);

// use the adapter to create a canvas (in this case an OffscreenCanvas)
const canvas = DOMAdapter.get().createCanvas(800, 800);
const renderer = new PIXI.WebGLRenderer()

onmessage = async (e) => {
    const { id, payload } = e.data;
    try {
        if (payload === "init") {
            await renderer.init({ canvas })
            self.postMessage("initialized")
            return;
        }
        const { type, data } = payload
        if (type === 'createChart') {
            const result = createChart(data.height, data.width, data.values)
            self.postMessage( { id, result }, { transfer: [result.pixels.buffer] } );
        }
    } catch (error) {
        self.postMessage({ id, error: error.message });
    }
};


export function createChart(height: number, width: number, values: number[]) {
    const chart = new PIXI.Graphics();
    const minVal = Math.min(...values);
    const maxVal = Math.max(...values);
    const range = maxVal - minVal || 1;
    const length = values.length;
    const lengthMinusOne = Math.max(1, length - 1);
    const heightFactor = height / range;
  
    chart.moveTo(0, height - ((values[0] - minVal) * heightFactor));
    for (let i = 1; i < length; i++) {
      const x = (i / lengthMinusOne) * width;
      const y = height - ((values[i] - minVal) * heightFactor);
      chart.lineTo(x, y);
    }
    chart.stroke({ color: 0xFFFFFF, width: 2 });
    return renderer.extract.pixels(chart)
  }