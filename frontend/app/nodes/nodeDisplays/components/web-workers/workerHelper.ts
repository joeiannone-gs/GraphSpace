



const workerArray = new Array<Worker>
let requestId = 0;
export const pending = new Map();


function initializeWorkers() {
  const numWorkers = Math.min(navigator.hardwareConcurrency - 1, 8)
    for (let i = 0; i < numWorkers; i++) {
        const worker  = new Worker(new URL('worker.ts', import.meta.url))
        workerArray.push(worker)

        worker.postMessage({ id: "none", payload: "init"})
        
        worker.onmessage = (e) => {
          const { id, result, error } = e.data;
          if (pending.has(id)) {
            if (error) {
              pending.get(id).reject(error);
            } else {
              pending.get(id).resolve(result);
            }
            pending.delete(id);
          }
        };

    }
}
initializeWorkers() //* Initialize




export function callWorker(payload: any, transfer: ArrayBuffer) {
  return new Promise((resolve, reject) => {
    const id = ++requestId;
    pending.set(id, { resolve, reject });
    const worker = workerArray[requestId % workerArray.length];
    worker.postMessage({ id, payload }, [transfer]);
  });
}