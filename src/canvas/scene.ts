/**
 * Keeps pixi views in step with the document. Views are keyed by id; a view is only rebuilt when
 * its node object (or what it depends on) changed, which Immer's structural sharing makes cheap to
 * detect. Pixi objects never go into application state.
 */
import { Container, FederatedPointerEvent } from 'pixi.js';
import type { Id, ProjectDoc } from '@/doc/types';
import type { SessionSnapshot, TensorSnap } from '@/engine/session';
import { getDef, portsOf } from '@/nodes/registry';
import { DrawColors, drawImages, drawMessage, drawScatter, drawSparkline, drawTensor, drawTextBlock, formatNumber } from './displays/draw';
import { NODE_RADIUS, fitInside, groupRadius, portOffsets } from './geometry';
import type { CanvasTheme } from './theme';
import { EdgeView } from './views/EdgeView';
import { NodeModel, NodeView } from './views/NodeView';

export interface SceneUi {
  selectedNodes: readonly Id[];
  selectedEdges: readonly Id[];
  scope: Id | null;
  showGradients: boolean;
  diff: { added: readonly Id[]; changed: readonly Id[] } | null;
}

const BOUNDARY_RADIUS = NODE_RADIUS * 0.55;

export interface SceneEvents {
  nodeDown(view: NodeView, e: FederatedPointerEvent): void;
  portDown(view: NodeView, kind: 'in' | 'out', port: string, e: FederatedPointerEvent): void;
  edgeDown(view: EdgeView, e: FederatedPointerEvent): void;
}

export class Scene {
  readonly root = new Container();
  readonly rootEdges = new Container();
  readonly rootNodes = new Container();
  readonly nodes = new Map<Id, NodeView>();
  readonly edges = new Map<Id, EdgeView>();
  /** While dragging, groups keep their current inner scale so contents don't jump. */
  freezeFits = false;
  private doc: ProjectDoc | null = null;
  private ui: SceneUi | null = null;
  private signatures = new Map<Id, string>();
  private snapshot: SessionSnapshot | null = null;
  private scalarHistory = new Map<Id, number[]>();
  private lastStep = -1;

  constructor(
    private theme: CanvasTheme,
    private colors: DrawColors,
    private readonly requestRender: () => void,
    private readonly events: SceneEvents,
  ) {
    this.root.addChild(this.rootEdges, this.rootNodes);
  }

  get currentDoc() {
    return this.doc;
  }

  setTheme(theme: CanvasTheme, colors: DrawColors) {
    this.theme = theme;
    this.colors = colors;
    for (const v of this.nodes.values()) v.setTheme(theme);
    if (this.doc && this.ui) this.reconcile(this.doc, this.ui, true);
    this.paintRuntime(this.snapshot, true);
  }

  /** Containers that hold a scope's edges and nodes (null = top level). */
  layers(scope: Id | null): { edges: Container; nodes: Container } | undefined {
    if (scope === null) return { edges: this.rootEdges, nodes: this.rootNodes };
    const v = this.nodes.get(scope);
    return v ? { edges: v.innerEdges, nodes: v.innerNodes } : undefined;
  }

  private model(doc: ProjectDoc, id: Id, childCount: number): NodeModel {
    const node = doc.nodes[id];
    const radius =
      node.type === 'composite' ? groupRadius(childCount) : node.type === 'input' || node.type === 'output' ? BOUNDARY_RADIUS : NODE_RADIUS;
    const { inputs, outputs } = portsOf(doc, node);
    const dir = doc.layout.direction;
    const inPos = portOffsets(radius, inputs.length, 'in', dir);
    const outPos = portOffsets(radius, outputs.length, 'out', dir);
    return {
      node,
      def: getDef(node.type),
      radius,
      ports: {
        inputs: inputs.map((def, i) => ({ def, pos: inPos[i] })),
        outputs: outputs.map((def, i) => ({ def, pos: outPos[i] })),
      },
    };
  }

  reconcile(doc: ProjectDoc, ui: SceneUi, force = false) {
    const prevDoc = this.doc;
    const prevUi = this.ui;
    this.doc = doc;
    this.ui = ui;
    const children = new Map<Id | null, Id[]>();
    for (const n of Object.values(doc.nodes)) children.set(n.parent, [...(children.get(n.parent) ?? []), n.id]);

    // Parents before children.
    const order: Id[] = [];
    const queue: (Id | null)[] = [null];
    while (queue.length) {
      const p = queue.shift()!;
      for (const id of children.get(p) ?? []) {
        order.push(id);
        queue.push(id);
      }
    }

    const changed = new Set<Id>();
    for (const id of order) {
      const node = doc.nodes[id];
      const model = this.model(doc, id, children.get(id)?.length ?? 0);
      const signature = JSON.stringify([model.radius, model.ports.inputs.map((p) => [p.def.name, p.pos]), model.ports.outputs.map((p) => [p.def.name, p.pos])]);
      let view = this.nodes.get(id);
      if (!view) {
        const created = new NodeView(model, this.theme, this.requestRender);
        created.container.on('pointerdown', (e: FederatedPointerEvent) => {
          e.stopPropagation();
          this.events.nodeDown(created, e);
        });
        created.onPortDown = (kind, port, e) => this.events.portDown(created, kind, port, e);
        view = created;
        this.nodes.set(id, view);
        changed.add(id);
      } else if (force || view.model.node !== node || this.signatures.get(id) !== signature) {
        view.update(model);
        changed.add(id);
      }
      this.signatures.set(id, signature);
      const target = this.layers(node.parent)?.nodes;
      if (target && view.container.parent !== target) target.addChild(view.container);
    }
    for (const [id, view] of this.nodes) {
      if (!doc.nodes[id]) {
        view.destroy();
        this.nodes.delete(id);
        this.signatures.delete(id);
        this.scalarHistory.delete(id);
      }
    }

    // Fit each group's contents inside its circle.
    if (!this.freezeFits) {
      for (const id of order) {
        const view = this.nodes.get(id)!;
        if (!view.isGroup) continue;
        const kids = (children.get(id) ?? []).map((k) => ({ pos: doc.nodes[k].pos, r: this.nodes.get(k)!.model.radius }));
        const fit = fitInside(kids, view.model.radius);
        if (fit.scale !== view.fit.scale || fit.center[0] !== view.fit.center[0] || fit.center[1] !== view.fit.center[1]) {
          view.setInnerFit(fit.scale, fit.center);
        }
      }
    }

    const selectedNodes = new Set(ui.selectedNodes);
    const selectionChanged = !prevUi || prevUi.selectedEdges !== ui.selectedEdges || prevUi.showGradients !== ui.showGradients;
    const added = new Set(ui.diff?.added ?? []);
    const changedInDiff = new Set(ui.diff?.changed ?? []);
    for (const [id, view] of this.nodes) {
      view.setSelected(selectedNodes.has(id));
      view.setHighlight(added.has(id) ? 'added' : changedInDiff.has(id) ? 'changed' : null);
    }

    for (const edge of Object.values(doc.edges)) {
      let view = this.edges.get(edge.id);
      const isNew = !view;
      if (!view) {
        const created = new EdgeView(edge);
        created.g.on('pointerdown', (e: FederatedPointerEvent) => {
          e.stopPropagation();
          this.events.edgeDown(created, e);
        });
        view = created;
        this.edges.set(edge.id, view);
      }
      const from = this.nodes.get(edge.from.node);
      const to = this.nodes.get(edge.to.node);
      const layer = this.layers(doc.nodes[edge.from.node]?.parent ?? null)?.edges;
      if (!from || !to || !layer) continue;
      if (view.g.parent !== layer) layer.addChild(view.g);
      const dirty =
        isNew ||
        force ||
        view.edge !== edge ||
        changed.has(edge.from.node) ||
        changed.has(edge.to.node) ||
        prevDoc?.layout.direction !== doc.layout.direction ||
        selectionChanged;
      view.edge = edge;
      if (dirty) this.drawEdge(view);
    }
    for (const [id, view] of this.edges) {
      if (!doc.edges[id]) {
        view.destroy();
        this.edges.delete(id);
      }
    }

    this.applyScope(ui.scope);
    if (changed.size) this.paintRuntime(this.snapshot, false, changed);
  }

  private gradientLevel(sourceKey: string): number | null {
    const snap = this.snapshot;
    if (!snap || !this.ui?.showGradients) return null;
    const g = snap.grads[sourceKey];
    if (!g) return null;
    let max = 0;
    for (const s of Object.values(snap.grads)) max = Math.max(max, s.stats.absMean);
    if (max === 0) return 0;
    // Log scale so small-but-nonzero gradients stay visible.
    const ratio = g.stats.absMean / max;
    return Math.max(0, 1 + Math.log10(Math.max(ratio, 1e-4)) / 4);
  }

  private drawEdge(view: EdgeView) {
    const doc = this.doc!;
    const edge = view.edge;
    const from = this.nodes.get(edge.from.node);
    const to = this.nodes.get(edge.to.node);
    const start = from?.portPosition('out', edge.from.port);
    const end = to?.portPosition('in', edge.to.port);
    if (!start || !end) {
      view.g.clear();
      return;
    }
    const sourceKey = this.resolveKey(edge.from.node, edge.from.port);
    view.draw(start, end, doc.layout.direction, this.theme, {
      selected: !!this.ui?.selectedEdges.includes(edge.id),
      gradient: sourceKey ? this.gradientLevel(sourceKey) : null,
    });
  }

  /** The snapshot key holding the value on a node's output port (groups and inputs resolve through). */
  private resolveKey(node: Id, port: string): string | undefined {
    return this.snapshot?.nodes[node]?.outputs[port];
  }

  private applyScope(scope: Id | null) {
    const doc = this.doc!;
    const ancestors = new Set<Id>();
    for (let s = scope; s !== null; s = doc.nodes[s]?.parent ?? null) ancestors.add(s);
    const insideScope = (id: Id) => {
      for (let p = doc.nodes[id]?.parent ?? null; p !== null; p = doc.nodes[p]?.parent ?? null) {
        if (p === scope) return true;
      }
      return scope === null;
    };
    for (const [id, view] of this.nodes) {
      const node = doc.nodes[id];
      const active = node.parent === scope;
      const isAncestor = ancestors.has(id);
      view.container.alpha = active || isAncestor || insideScope(id) ? 1 : 0.22;
      view.setInteractive(active ? 'active' : isAncestor ? 'ancestor' : 'off');
    }
    for (const [id, view] of this.edges) {
      const e = doc.edges[id];
      view.g.eventMode = e && doc.nodes[e.from.node]?.parent === scope ? 'static' : 'none';
    }
  }

  /** Update live values, statuses and gradient overlays from the engine. */
  paintRuntime(snapshot: SessionSnapshot | null, all = true, only?: Set<Id>) {
    const prev = this.snapshot;
    this.snapshot = snapshot;
    const doc = this.doc;
    if (!doc) return;
    if (snapshot && snapshot.step !== this.lastStep) {
      this.lastStep = snapshot.step;
      for (const [id, n] of Object.entries(snapshot.nodes)) {
        const key = n.outputs.out;
        const v = key ? snapshot.tensors[key] : undefined;
        if (doc.nodes[id]?.type === 'accuracy' && v) {
          const h = this.scalarHistory.get(id) ?? [];
          h.push(v.data[0]);
          if (h.length > 400) h.shift();
          this.scalarHistory.set(id, h);
        }
      }
    }
    if (snapshot && snapshot.step === 0) this.scalarHistory.clear();

    // Group status: an error anywhere inside shows on the group.
    const innerError = new Set<Id>();
    if (snapshot) {
      for (const [id, n] of Object.entries(snapshot.nodes)) {
        if (n.status !== 'error') continue;
        for (let p = doc.nodes[id]?.parent ?? null; p !== null; p = doc.nodes[p]?.parent ?? null) innerError.add(p);
      }
    }
    for (const [id, view] of this.nodes) {
      if (!all && only && !only.has(id)) continue;
      const ns = snapshot?.nodes[id];
      if (view.isGroup) view.setStatus(innerError.has(id) ? 'inner-error' : 'ok');
      else view.setStatus(ns ? ns.status : 'idle', ns?.error);
      view.paint(this.painter(id));
    }
    if (prev !== snapshot || all) for (const view of this.edges.values()) this.drawEdge(view);
  }

  private painter(id: Id): ((ctx: CanvasRenderingContext2D, w: number, h: number) => boolean) | null {
    const doc = this.doc!;
    const node = doc.nodes[id];
    const snap = this.snapshot;
    const def = getDef(node.type);
    if (!snap || !def || node.type === 'composite') return null;
    const ns = snap.nodes[id];
    const c = this.colors;
    if (ns?.status === 'error' && ns.error) {
      const message = ns.error.message;
      return (ctx, w, h) => {
        drawMessage(ctx, message, w, h, '#ff6b6b');
        return true;
      };
    }
    if (!ns || ns.status === 'blocked') return null;
    const t = (key: string | undefined): TensorSnap | undefined => (key ? snap.tensors[key] : undefined);
    switch (def.display) {
      case 'value':
      case 'tensor':
      case 'parameter': {
        const v = t(ns.outputs.out) ?? t(ns.inputs.in);
        return v ? (ctx, w, h) => (drawTensor(ctx, v, w, h, c), true) : null;
      }
      case 'dataset': {
        const x = t(ns.outputs.x);
        const y = t(ns.outputs.y);
        if (!x || !y) return null;
        const source = String(node.params.source);
        if (source === 'mnist-200') return (ctx, w, h) => (drawImages(ctx, x, 4, w, h, c), true);
        if (x.shape[x.shape.length - 1] <= 2) return (ctx, w, h) => (drawScatter(ctx, x, y, undefined, w, h, c), true);
        return (ctx, w, h) => (drawTensor(ctx, x, w, h, c), true);
      }
      case 'scatter': {
        const x = t(ns.inputs.x);
        const y = t(ns.inputs.y);
        const p = t(ns.inputs.prediction);
        return x && (y || x.shape[x.shape.length - 1] === 2) ? (ctx, w, h) => (drawScatter(ctx, x, y, p, w, h, c), true) : null;
      }
      case 'points': {
        const pts = t(ns.outputs.xt) ?? t(ns.outputs.out);
        return pts && pts.shape[pts.shape.length - 1] === 2 ? (ctx, w, h) => (drawScatter(ctx, pts, undefined, undefined, w, h, c), true) : null;
      }
      case 'image': {
        const x = t(ns.inputs.x);
        const count = Number(node.params.count ?? 4);
        return x ? (ctx, w, h) => (drawImages(ctx, x, count, w, h, c), true) : null;
      }
      case 'loss': {
        if (node.type === 'minimize') {
          const loss = t(ns.inputs.loss);
          const latest = loss ? loss.data[0] : null;
          const history = snap.lossHistory;
          return (ctx, w, h) => (drawSparkline(ctx, history, latest, 'loss', w, h, c), true);
        }
        const v = t(ns.outputs.out);
        const history = this.scalarHistory.get(id) ?? [];
        return v
          ? (ctx, w, h) => (drawSparkline(ctx, history, v.data[0], node.type === 'accuracy' ? `accuracy ${formatNumber(v.data[0] * 100)}%` : '', w, h, c), true)
          : null;
      }
      case 'text': {
        const content = snap.texts[id];
        return content ? (ctx, w, h) => (drawTextBlock(ctx, content, w, h, c), true) : null;
      }
      default:
        return null;
    }
  }

  destroy() {
    for (const v of this.nodes.values()) v.destroy();
    for (const v of this.edges.values()) v.destroy();
    this.nodes.clear();
    this.edges.clear();
    this.root.destroy({ children: true });
  }
}
