/// <reference lib="webworker" />
import { EngineHost } from './engineHost';
import type { FromWorker, ToWorker } from './protocol';

const scope = self as unknown as DedicatedWorkerGlobalScope;

const host = new EngineHost(
  async (path) => {
    const res = await fetch(new URL(path, scope.location.origin));
    if (!res.ok) throw new Error(`Couldn't download ${path} (${res.status})`);
    return res.arrayBuffer();
  },
  (msg: FromWorker) => scope.postMessage(msg),
);

scope.onmessage = (event: MessageEvent<ToWorker>) => {
  void host.handle(event.data);
};
