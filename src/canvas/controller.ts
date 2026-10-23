/**
 * Owns the pixi application for the editor: viewport, background, scene, and every pointer and
 * keyboard interaction. Interactions become Redux actions; rendering follows the store.
 */
import { Application, FederatedPointerEvent, Graphics, Point, Rectangle, Ticker } from 'pixi.js';
import { Viewport } from 'pixi-viewport';
import { cloneSubtree, type Subtree } from '@/doc/clone';
import { newId } from '@/doc/ids';
import type { Id, Vec2 } from '@/doc/types';
import { getBuiltin } from '@/library/builtin';
import { portsOf } from '@/nodes/registry';
import type { RuntimeStore } from '@/runtime/runtimeStore';
import { docActions } from '@/store/docSlice';
import type { AppStore, RootState } from '@/store/store';
import { uiActions } from '@/store/uiSlice';
import { Background } from './background';
import { darkDrawColors, lightDrawColors } from './displays/draw';
import { EDGE_WIDTH, NODE_RADIUS, PORT_RADIUS } from './geometry';
import { Scene } from './scene';
import { canvasThemes } from './theme';
import type { EdgeView } from './views/EdgeView';
import type { NodeView } from './views/NodeView';

export type PaletteItem = { kind: 'node'; type: string } | { kind: 'builtin'; id: string } | { kind: 'subtree'; sub: Subtree };

const DRAG_THRESHOLD = 4;
const DOUBLE_CLICK_MS = 350;

type Drag =
  | { kind: 'nodes'; start: Vec2; origins: Map<Id, Vec2>; scope: Id | null; moved: boolean; screenStart: Vec2 }
  | { kind: 'wire'; from: { node: Id; port: string; kind: 'in' | 'out' }; anchor: Vec2; scope: Id | null }
  | { kind: 'brush'; start: Vec2 };

export class CanvasController {
  private app!: Application;
  private viewport!: Viewport;
  private background!: Background;
  private scene!: Scene;
  private ghost = new Graphics();
  private brush = new Graphics();
  private unsubscribe: (() => void)[] = [];
  private frame = 0;
  private seenDoc: RootState['doc']['present'] | null = null;
  private seenUi: RootState['ui'] | null = null;
  private seenRuntime = -1;
  private seenTheme: string | null = null;
  private seenLoads = -1;
  private drag: Drag | null = null;
  private lastDown: { id: Id; at: number } | null = null;
  private destroyed = false;
  private resizeObserver: ResizeObserver | null = null;

  private constructor(
    private readonly host: HTMLElement,
    private readonly store: AppStore,
    private readonly runtime: RuntimeStore,
  ) {}

  static async create(host: HTMLElement, store: AppStore, runtime: RuntimeStore): Promise<CanvasController> {
    const c = new CanvasController(host, store, runtime);
    await c.init();
    return c;
  }

  private get state() {
    return this.store.getState();
  }

  private async init() {
    const theme = canvasThemes[this.state.ui.theme];
    const app = new Application();
    await app.init({
      resizeTo: this.host,
      background: theme.background,
      antialias: true,
      autoDensity: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      preference: 'webgl',
      // Render on demand (see requestRender) instead of 60 times a second while idle.
      autoStart: false,
    });
    if (this.destroyed) {
      app.destroy(true);
      return;
    }
    this.app = app;
    app.canvas.style.display = 'block';
    this.host.appendChild(app.canvas);

    const viewport = new Viewport({
      events: app.renderer.events,
      screenWidth: this.host.clientWidth,
      screenHeight: this.host.clientHeight,
      passiveWheel: false,
      disableOnContextMenu: true,
      // The default hit area is the world rectangle, and pixi prunes hits outside it — so nodes at
      // negative coordinates couldn't be clicked. Make the whole plane hittable.
      forceHitArea: new Rectangle(-1e9, -1e9, 2e9, 2e9),
    });
    viewport.drag({ mouseButtons: 'left' }).pinch().wheel({ smooth: 4 }).clampZoom({ minScale: 0.005, maxScale: 6 });
    viewport.sortableChildren = false;
    this.viewport = viewport;
    app.stage.addChild(viewport);
    app.stage.eventMode = 'static';
    app.stage.hitArea = app.screen;

    this.background = new Background(theme.grid);
    this.scene = new Scene(theme, this.state.ui.theme === 'dark' ? darkDrawColors : lightDrawColors, this.requestRender, {
      nodeDown: (v, e) => this.onNodeDown(v, e),
      portDown: (v, kind, port, e) => this.onPortDown(v, kind, port, e),
      edgeDown: (v, e) => this.onEdgeDown(v, e),
    });
    viewport.addChild(this.background.g, this.scene.root, this.brush);

    viewport.on('pointerdown', (e) => this.onBackgroundDown(e));
    viewport.on('clicked', () => {
      if (!this.drag) this.store.dispatch(uiActions.clearSelection());
    });
    viewport.on('moved', () => this.drawBackground());
    viewport.on('zoomed', () => this.drawBackground());
    // pixi-viewport animates (wheel smoothing, fit animations) on the shared ticker.
    Ticker.shared.add(this.onTick);
    app.stage.on('globalpointermove', this.onPointerMove);
    // Anything under the pointer may highlight, so redraw on pointer activity too.
    app.stage.on('pointerdown', this.requestRender);
    app.stage.on('pointerup', this.requestRender);
    app.stage.on('pointerup', this.onPointerUp);
    app.stage.on('pointerupoutside', this.onPointerUp);
    window.addEventListener('keydown', this.onKeyDown);

    this.resizeObserver = new ResizeObserver(() => {
      app.resize();
      viewport.resize(this.host.clientWidth, this.host.clientHeight);
      this.drawBackground();
    });
    this.resizeObserver.observe(this.host);

    this.unsubscribe.push(this.store.subscribe(this.schedule), this.runtime.subscribe(this.schedule));
    this.flush();
    this.fitScope(false);
  }

  private schedule = () => {
    if (this.frame || this.destroyed) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      this.flush();
      if (this.needsRender || this.viewport?.dirty) {
        this.needsRender = false;
        if (this.viewport) this.viewport.dirty = false;
        this.app.render();
      }
    });
  };

  private needsRender = true;

  /** Ask for one redraw on the next animation frame. */
  requestRender = () => {
    this.needsRender = true;
    this.schedule();
  };

  private onTick = () => {
    if (this.viewport?.dirty) this.schedule();
  };

  private flush() {
    if (this.destroyed) return;
    this.needsRender = true;
    const { doc, ui } = this.state;
    if (ui.theme !== this.seenTheme) {
      const theme = canvasThemes[ui.theme];
      if (this.seenTheme !== null) {
        this.app.renderer.background.color = theme.background;
        this.background.setColor(theme.grid);
        this.scene.setTheme(theme, ui.theme === 'dark' ? darkDrawColors : lightDrawColors);
      }
      this.seenTheme = ui.theme;
      this.drawBackground();
    }
    const scopeChanged = this.seenUi?.scope !== ui.scope;
    if (doc.present !== this.seenDoc || ui !== this.seenUi) {
      this.scene.freezeFits = doc.gestureBase !== null;
      this.scene.reconcile(doc.present, ui);
      this.seenDoc = doc.present;
      this.seenUi = ui;
      // A newly loaded document jumps into view; entering or leaving a group animates.
      if (doc.loads !== this.seenLoads) this.fitScope(false);
      else if (scopeChanged) this.fitScope(true);
      this.seenLoads = doc.loads;
    }
    if (this.runtime.revision !== this.seenRuntime) {
      this.seenRuntime = this.runtime.revision;
      this.scene.paintRuntime(this.runtime.get());
    }
  }

  private drawBackground() {
    if (!this.viewport) return;
    const v = this.viewport;
    this.background.draw(v.left, v.top, v.right, v.bottom, v.scale.x);
    this.requestRender();
  }

  // ---- coordinates ----

  /** Pointer position in a scope's coordinates (the space node positions live in). */
  private toScope(global: Point, scope: Id | null): Vec2 {
    const layer = this.scene.layers(scope)?.nodes ?? this.scene.rootNodes;
    const p = layer.toLocal(global);
    return [p.x, p.y];
  }

  private toWorld(global: Point): Vec2 {
    const p = this.viewport.toLocal(global);
    return [p.x, p.y];
  }

  // ---- pointer handlers ----

  private onNodeDown(view: NodeView, e: FederatedPointerEvent) {
    if (e.button !== 0) return;
    const { ui } = this.state;
    const id = view.id;
    const now = performance.now();
    if (this.lastDown?.id === id && now - this.lastDown.at < DOUBLE_CLICK_MS) {
      this.lastDown = null;
      if (view.isGroup) this.store.dispatch(uiActions.setScope(id));
      return;
    }
    this.lastDown = { id, at: now };
    const additive = e.shiftKey || e.metaKey || e.ctrlKey;
    if (additive) this.store.dispatch(uiActions.select({ nodes: [id], additive: true }));
    else if (!ui.selectedNodes.includes(id)) this.store.dispatch(uiActions.select({ nodes: [id] }));
    const selected = this.state.ui.selectedNodes;
    const doc = this.state.doc.present;
    const origins = new Map<Id, Vec2>();
    for (const sid of selected) {
      const n = doc.nodes[sid];
      if (n && n.parent === ui.scope) origins.set(sid, [...n.pos] as Vec2);
    }
    this.drag = {
      kind: 'nodes',
      start: this.toScope(e.global, ui.scope),
      screenStart: [e.global.x, e.global.y],
      origins,
      scope: ui.scope,
      moved: false,
    };
  }

  private onPortDown(view: NodeView, kind: 'in' | 'out', port: string, e: FederatedPointerEvent) {
    if (e.button !== 0) return;
    const scope = this.state.ui.scope;
    const doc = this.state.doc.present;
    if (kind === 'in') {
      // Pick up an existing wire from an input and re-plug it elsewhere.
      const existing = Object.values(doc.edges).find((x) => x.to.node === view.id && x.to.port === port);
      if (existing) {
        this.store.dispatch(docActions.disconnect([existing.id]));
        const source = this.scene.nodes.get(existing.from.node);
        const anchor = source?.portPosition('out', existing.from.port);
        if (anchor) {
          this.drag = { kind: 'wire', from: { node: existing.from.node, port: existing.from.port, kind: 'out' }, anchor, scope };
          this.drawGhost(this.toScope(e.global, scope));
          return;
        }
      }
    }
    const anchor = view.portPosition(kind, port);
    if (!anchor) return;
    this.drag = { kind: 'wire', from: { node: view.id, port, kind }, anchor, scope };
    this.drawGhost(this.toScope(e.global, scope));
  }

  private onEdgeDown(view: EdgeView, e: FederatedPointerEvent) {
    const additive = e.shiftKey || e.metaKey || e.ctrlKey;
    this.store.dispatch(uiActions.select({ edges: [view.edge.id], additive }));
  }

  private onBackgroundDown(e: FederatedPointerEvent) {
    if (e.button !== 0 || !e.shiftKey) return;
    // Shift-drag on the background draws a selection box instead of panning.
    this.viewport.plugins.pause('drag');
    this.drag = { kind: 'brush', start: this.toWorld(e.global) };
  }

  private onPointerMove = (e: FederatedPointerEvent) => {
    const drag = this.drag;
    if (!drag) return;
    if (drag.kind === 'nodes') {
      if (!drag.moved) {
        const dist = Math.hypot(e.global.x - drag.screenStart[0], e.global.y - drag.screenStart[1]);
        if (dist < DRAG_THRESHOLD || drag.origins.size === 0) return;
        drag.moved = true;
        this.store.dispatch(docActions.beginGesture());
      }
      const now = this.toScope(e.global, drag.scope);
      const dx = now[0] - drag.start[0];
      const dy = now[1] - drag.start[1];
      this.store.dispatch(
        docActions.moveNodes([...drag.origins].map(([id, [x, y]]) => ({ id, pos: [x + dx, y + dy] as Vec2 }))),
      );
    } else if (drag.kind === 'wire') {
      this.drawGhost(this.toScope(e.global, drag.scope));
      this.requestRender();
    } else {
      this.requestRender();
      const [x0, y0] = drag.start;
      const [x1, y1] = this.toWorld(e.global);
      this.brush.clear();
      this.brush
        .rect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0))
        .fill({ color: canvasThemes[this.state.ui.theme].selected, alpha: 0.08 })
        .stroke({ color: canvasThemes[this.state.ui.theme].selected, width: 2 / this.viewport.scale.x });
    }
  };

  private onPointerUp = (e: FederatedPointerEvent) => {
    const drag = this.drag;
    this.drag = null;
    if (!drag) return;
    if (drag.kind === 'nodes') {
      if (drag.moved) this.store.dispatch(docActions.endGesture());
    } else if (drag.kind === 'wire') {
      this.ghost.clear();
      this.requestRender();
      this.finishWire(drag, e);
    } else {
      this.brush.clear();
      this.requestRender();
      this.viewport.plugins.resume('drag');
      this.finishBrush(drag, this.toWorld(e.global));
    }
  };

  private drawGhost(to: Vec2) {
    const drag = this.drag;
    if (!drag || drag.kind !== 'wire') return;
    const layer = this.scene.layers(drag.scope)?.edges;
    if (!layer) return;
    if (this.ghost.parent !== layer) layer.addChild(this.ghost);
    const theme = canvasThemes[this.state.ui.theme];
    this.ghost.clear();
    this.ghost.moveTo(drag.anchor[0], drag.anchor[1]).lineTo(to[0], to[1]).stroke({ color: theme.edge, width: EDGE_WIDTH, alpha: 0.7 });
    this.ghost.circle(to[0], to[1], EDGE_WIDTH * 1.5).fill({ color: theme.edge });
  }

  /**
   * Which node/port of the scope is under the pointer (ports first, with generous snapping).
   * Computed geometrically rather than with pixi hit-testing, which is unreliable mid-dispatch.
   */
  private hitTarget(e: FederatedPointerEvent, scope: Id | null): { node: Id; port?: string; kind?: 'in' | 'out' } | null {
    const [x, y] = this.toScope(e.global, scope);
    const doc = this.state.doc.present;
    const snap = (PORT_RADIUS * 3) ** 2;
    let best: { node: Id; port: string; kind: 'in' | 'out'; d: number } | null = null;
    let body: Id | null = null;
    for (const [id, view] of this.scene.nodes) {
      if (doc.nodes[id]?.parent !== scope) continue;
      const [nx, ny] = view.model.node.pos;
      for (const kind of ['in', 'out'] as const) {
        for (const p of view.model.ports[kind === 'in' ? 'inputs' : 'outputs']) {
          const d = (nx + p.pos[0] - x) ** 2 + (ny + p.pos[1] - y) ** 2;
          if (d <= snap && (!best || d < best.d)) best = { node: id, port: p.def.name, kind, d };
        }
      }
      if ((nx - x) ** 2 + (ny - y) ** 2 <= view.model.radius ** 2) body = id;
    }
    if (best) return { node: best.node, port: best.port, kind: best.kind };
    return body ? { node: body } : null;
  }

  private finishWire(drag: Extract<Drag, { kind: 'wire' }>, e: FederatedPointerEvent) {
    const target = this.hitTarget(e, drag.scope);
    if (!target || target.node === drag.from.node) return;
    const doc = this.state.doc.present;
    const node = doc.nodes[target.node];
    if (!node || node.parent !== drag.scope) return;
    const ports = portsOf(doc, node);
    let from = { node: drag.from.node, port: drag.from.port };
    let to: { node: Id; port: string };
    if (drag.from.kind === 'out') {
      // Dropped on the node body: use the first free input.
      const port =
        target.kind === 'in'
          ? target.port!
          : (ports.inputs.find((p) => !Object.values(doc.edges).some((x) => x.to.node === node.id && x.to.port === p.name)) ??
              ports.inputs[0])?.name;
      if (!port) return;
      to = { node: node.id, port };
    } else {
      const port = target.kind === 'out' ? target.port! : ports.outputs[0]?.name;
      if (!port) return;
      to = { node: drag.from.node, port: drag.from.port };
      from = { node: node.id, port };
    }
    const targetDoc = doc.nodes[to.node];
    const feedback = portsOf(doc, targetDoc).inputs.find((p) => p.name === to.port)?.feedback;
    this.store.dispatch(docActions.connect({ id: newId(), from, to, ...(feedback ? { kind: 'feedback' as const } : {}) }));
    const rejected = this.state.doc.rejected;
    if (rejected) this.store.dispatch(uiActions.showToast(rejected));
  }

  private finishBrush(drag: Extract<Drag, { kind: 'brush' }>, end: Vec2) {
    const [x0, y0] = drag.start;
    const [x1, y1] = end;
    const [minX, maxX, minY, maxY] = [Math.min(x0, x1), Math.max(x0, x1), Math.min(y0, y1), Math.max(y0, y1)];
    const scope = this.state.ui.scope;
    const hits: Id[] = [];
    for (const [id, view] of this.scene.nodes) {
      if (this.state.doc.present.nodes[id]?.parent !== scope) continue;
      const g = view.container.getGlobalPosition();
      const [wx, wy] = this.toWorld(g);
      if (wx >= minX && wx <= maxX && wy >= minY && wy <= maxY) hits.push(id);
    }
    this.store.dispatch(uiActions.select({ nodes: hits }));
  }

  // ---- keyboard ----

  private onKeyDown = (e: KeyboardEvent) => {
    const el = document.activeElement as HTMLElement | null;
    if (el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName))) return;
    const mod = e.metaKey || e.ctrlKey;
    const { ui, doc } = this.state;
    const key = e.key.toLowerCase();
    if (key === 'delete' || key === 'backspace') {
      if (!ui.selectedNodes.length && !ui.selectedEdges.length) return;
      e.preventDefault();
      this.store.dispatch(docActions.removeSelection({ nodes: ui.selectedNodes, edges: ui.selectedEdges }));
      this.store.dispatch(uiActions.clearSelection());
    } else if (mod && key === 'z') {
      e.preventDefault();
      this.store.dispatch(e.shiftKey ? docActions.redo() : docActions.undo());
    } else if (mod && key === 'y') {
      e.preventDefault();
      this.store.dispatch(docActions.redo());
    } else if (mod && key === 'g') {
      e.preventDefault();
      this.groupOrUngroup(e.shiftKey);
    } else if (mod && key === 'a') {
      e.preventDefault();
      const ids = Object.values(doc.present.nodes)
        .filter((n) => n.parent === ui.scope)
        .map((n) => n.id);
      this.store.dispatch(uiActions.select({ nodes: ids }));
    } else if (key === 'escape') {
      if (ui.selectedNodes.length || ui.selectedEdges.length) this.store.dispatch(uiActions.clearSelection());
      else if (ui.scope !== null) this.store.dispatch(uiActions.setScope(doc.present.nodes[ui.scope]?.parent ?? null));
    } else if (key === 'f' && !mod) {
      this.fitScope(true);
    }
  };

  groupOrUngroup(ungroup: boolean) {
    const { ui, doc } = this.state;
    if (ungroup) {
      for (const id of ui.selectedNodes) if (doc.present.nodes[id]?.type === 'composite') this.store.dispatch(docActions.ungroup(id));
      this.store.dispatch(uiActions.clearSelection());
      return;
    }
    if (ui.selectedNodes.length === 0) return;
    const groupId = newId();
    this.store.dispatch(docActions.group({ ids: ui.selectedNodes, groupId, label: 'Group' }));
    if (this.state.doc.rejected) this.store.dispatch(uiActions.showToast(this.state.doc.rejected));
    else this.store.dispatch(uiActions.select({ nodes: [groupId] }));
  }

  // ---- public API used by React ----

  /** Add a palette item where it was dropped (client coordinates). */
  dropAt(clientX: number, clientY: number, item: PaletteItem) {
    const rect = this.app.canvas.getBoundingClientRect();
    const global = new Point(clientX - rect.left, clientY - rect.top);
    const scope = this.state.ui.scope;
    const pos = this.toScope(global, scope);
    this.place(item, pos, scope);
  }

  /** Add a palette item in the middle of the view. */
  addAtCenter(item: PaletteItem) {
    const scope = this.state.ui.scope;
    const global = new Point(this.app.screen.width / 2, this.app.screen.height / 2);
    this.place(item, this.toScope(global, scope), scope);
  }

  private place(item: PaletteItem, pos: Vec2, scope: Id | null) {
    let id: Id;
    if (item.kind === 'node') {
      id = newId();
      this.store.dispatch(docActions.addNode({ id, type: item.type, parent: scope, pos }));
    } else {
      const sub = item.kind === 'builtin' ? getBuiltin(item.id)?.build(getBuiltin(item.id)!.defaults) : item.sub;
      if (!sub) return;
      const copy = cloneSubtree(sub, scope, pos);
      id = copy.root;
      this.store.dispatch(docActions.addSubtree(copy));
    }
    this.store.dispatch(uiActions.select({ nodes: [id] }));
  }

  /** Zoom to show the current scope's contents. */
  fitScope(animate: boolean) {
    if (!this.viewport) return;
    const { ui, doc } = this.state;
    const scope = ui.scope;
    const nodes = Object.values(doc.present.nodes).filter((n) => n.parent === scope);
    const layer = this.scene.layers(scope)?.nodes;
    if (!layer) return;
    let [minX, minY, maxX, maxY] = [Infinity, Infinity, -Infinity, -Infinity];
    const pad = NODE_RADIUS * 1.5;
    const corners: Vec2[] = nodes.length
      ? nodes.flatMap((n) => [
          [n.pos[0] - pad, n.pos[1] - pad],
          [n.pos[0] + pad, n.pos[1] + pad],
        ] as Vec2[])
      : [
          [-2000, -2000],
          [2000, 2000],
        ];
    for (const [x, y] of corners) {
      const [wx, wy] = this.toWorld(layer.toGlobal(new Point(x, y)));
      minX = Math.min(minX, wx);
      minY = Math.min(minY, wy);
      maxX = Math.max(maxX, wx);
      maxY = Math.max(maxY, wy);
    }
    // Leave room for the run bar at the top.
    const topBar = 70;
    const scale = Math.min(this.viewport.screenWidth / (maxX - minX), (this.viewport.screenHeight - topBar) / (maxY - minY), 1.2);
    const center = new Point((minX + maxX) / 2, (minY + maxY) / 2 - topBar / 2 / scale);
    if (animate) this.viewport.animate({ position: center, scale, time: 350, ease: 'easeInOutSine', callbackOnComplete: () => this.drawBackground() });
    else {
      this.viewport.setZoom(scale, true);
      this.viewport.moveCenter(center);
      this.drawBackground();
    }
  }

  /** Client (page) coordinates of a node's center or one of its ports — used by browser tests. */
  screenPoint(nodeId: Id, port?: { kind: 'in' | 'out'; name: string }): { x: number; y: number } | null {
    const view = this.scene.nodes.get(nodeId);
    if (!view) return null;
    const local = port ? view.model.ports[port.kind === 'in' ? 'inputs' : 'outputs'].find((p) => p.def.name === port.name)?.pos : [0, 0];
    if (!local) return null;
    const g = view.container.toGlobal(new Point(local[0], local[1]));
    const rect = this.app.canvas.getBoundingClientRect();
    return { x: rect.left + g.x, y: rect.top + g.y };
  }

  zoomBy(factor: number) {
    this.viewport.zoomPercent(factor - 1, true);
    this.drawBackground();
  }

  destroy() {
    this.destroyed = true;
    if (this.frame) cancelAnimationFrame(this.frame);
    for (const u of this.unsubscribe) u();
    window.removeEventListener('keydown', this.onKeyDown);
    Ticker.shared.remove(this.onTick);
    this.resizeObserver?.disconnect();
    if (this.app) {
      try {
        this.scene.destroy();
      } finally {
        this.app.canvas.remove();
        this.app.destroy(true, { children: true });
      }
    }
  }
}
