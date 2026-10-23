/** The pixi display of one node: circle, label, ports, live value and (for groups) its contents. */
import { Assets, Container, FederatedPointerEvent, Graphics, Sprite, Text, Texture } from 'pixi.js';
import type { DocNode, Vec2 } from '@/doc/types';
import type { NodeError } from '@/engine/compile';
import type { NodeDef, PortDef } from '@/nodes/types';
import { NODE_RADIUS, PORT_RADIUS } from '../geometry';
import { CanvasTheme, GROUP_COLOR, categoryColor } from '../theme';

const TEXTURE_SIZE = 320;
const FONT = 'Century Gothic, CenturyGothic, Futura, sans-serif';

export interface PortLayout {
  inputs: { def: PortDef; pos: Vec2 }[];
  outputs: { def: PortDef; pos: Vec2 }[];
}

export interface NodeModel {
  node: DocNode;
  def: NodeDef<Record<string, unknown>> | undefined;
  radius: number;
  ports: PortLayout;
}

export type NodeStatus = 'ok' | 'error' | 'blocked' | 'inner-error' | 'idle';

export class NodeView {
  readonly container = new Container();
  /** For groups: holds the contents (scaled to fit inside the circle). */
  readonly inner = new Container();
  readonly innerEdges = new Container();
  readonly innerNodes = new Container();
  private readonly ring = new Graphics();
  private readonly portLayer = new Container();
  private readonly label: Text;
  private readonly displayCanvas: HTMLCanvasElement | null;
  private readonly display: Sprite;
  private icon: Sprite | null = null;
  private iconUrl: string | undefined;
  model: NodeModel;
  selected = false;
  status: NodeStatus = 'idle';
  error: NodeError | undefined;
  onPortDown: ((kind: 'in' | 'out', port: string, e: FederatedPointerEvent) => void) | null = null;
  /** Inner content scale/center for groups (frozen while dragging). */
  fit = { scale: 1, center: [0, 0] as Vec2 };

  constructor(model: NodeModel, private theme: CanvasTheme) {
    this.model = model;
    this.container.label = `node:${model.node.id}`;
    this.label = new Text({ text: '', style: { fontFamily: FONT, fontSize: 64, fill: theme.textCss, align: 'center' } });
    this.label.anchor.set(0.5);
    this.displayCanvas = typeof document !== 'undefined' ? document.createElement('canvas') : null;
    if (this.displayCanvas) {
      this.displayCanvas.width = TEXTURE_SIZE;
      this.displayCanvas.height = TEXTURE_SIZE;
    }
    this.display = new Sprite(this.displayCanvas ? Texture.from(this.displayCanvas) : Texture.EMPTY);
    this.display.anchor.set(0.5);
    this.display.visible = false;
    this.inner.addChild(this.innerEdges, this.innerNodes);
    this.container.addChild(this.ring, this.inner, this.display, this.label, this.portLayer);
    this.container.eventMode = 'static';
    this.container.cursor = 'pointer';
    this.update(model);
  }

  get id() {
    return this.model.node.id;
  }

  get isGroup() {
    return this.model.node.type === 'composite';
  }

  setTheme(theme: CanvasTheme) {
    this.theme = theme;
    this.label.style.fill = theme.textCss;
    this.update(this.model);
  }

  update(model: NodeModel) {
    this.model = model;
    const { node, radius } = model;
    this.container.position.set(node.pos[0], node.pos[1]);
    // The circle is clickable through the ring; no hit area on the container itself, because pixi
    // prunes a container's children outside its hit area and ports sit on the circle's edge.
    this.ring.hitArea = { contains: (x: number, y: number) => x * x + y * y <= radius * radius };
    this.drawRing();
    const name = node.label ?? model.def?.label ?? node.type;
    this.label.text = name;
    const isBoundary = node.type === 'input' || node.type === 'output';
    if (this.isGroup) {
      this.label.style.fontSize = Math.max(64, radius * 0.16);
      this.label.position.set(0, -radius - this.label.height * 0.6);
    } else {
      this.label.style.fontSize = isBoundary ? 90 : 80;
      this.label.position.set(0, isBoundary ? 0 : -radius * 0.66);
    }
    this.label.scale.set(1);
    const maxLabel = this.isGroup ? radius * 2.4 : radius * 1.5;
    if (this.label.width > maxLabel) this.label.scale.set(maxLabel / this.label.width);
    this.drawPorts();
    this.updateIcon();
    const size = radius * 1.12;
    this.display.width = size;
    this.display.height = size;
    this.display.position.set(0, radius * 0.1);
  }

  private drawRing() {
    const { radius, def, node } = this.model;
    const t = this.theme;
    const base = this.isGroup ? GROUP_COLOR : def ? categoryColor(def.category) : t.error;
    const g = this.ring;
    g.clear();
    g.circle(0, 0, radius).fill({ color: t.nodeFill, alpha: this.isGroup ? t.nodeFillAlpha * 0.6 : t.nodeFillAlpha });
    const statusColor =
      this.status === 'error' ? t.error : this.status === 'inner-error' ? t.error : this.status === 'blocked' ? t.blocked : base;
    g.circle(0, 0, radius).stroke({ color: statusColor, width: this.isGroup ? 10 : 8, alpha: this.status === 'blocked' ? 0.6 : 1 });
    if (this.selected) g.circle(0, 0, radius + 26).stroke({ color: t.selected, width: 14 });
    if (node.type === 'input' || node.type === 'output') {
      g.circle(0, 0, radius * 0.82).stroke({ color: base, width: 4, alpha: 0.5 });
    }
  }

  private drawPorts() {
    for (const child of this.portLayer.removeChildren()) child.destroy();
    const { inputs, outputs } = this.model.ports;
    const showNames = (list: { def: PortDef }[]) => list.length > 1 || list.some((p) => !['x', 'in', 'out'].includes(p.def.name));
    const draw = (list: { def: PortDef; pos: Vec2 }[], kind: 'in' | 'out') => {
      for (const { def, pos } of list) {
        const nodule = new Graphics();
        nodule.circle(0, 0, PORT_RADIUS).fill({ color: def.feedback ? this.theme.feedback : this.theme.port });
        if (def.optional) nodule.circle(0, 0, PORT_RADIUS * 0.45).fill({ color: this.theme.background });
        nodule.position.set(pos[0], pos[1]);
        nodule.label = `${kind}:${def.name}`;
        nodule.eventMode = 'static';
        nodule.cursor = 'crosshair';
        nodule.hitArea = { contains: (x: number, y: number) => x * x + y * y <= (PORT_RADIUS * 2.2) ** 2 };
        nodule.on('pointerdown', (e: FederatedPointerEvent) => {
          e.stopPropagation();
          this.onPortDown?.(kind, def.name, e);
        });
        this.portLayer.addChild(nodule);
        if (showNames(list)) {
          const t = new Text({
            text: def.label ?? def.name,
            style: { fontFamily: FONT, fontSize: 40, fill: this.theme.mutedCss },
          });
          t.anchor.set(0.5);
          const len = Math.hypot(pos[0], pos[1]) || 1;
          const inward = 1 - (PORT_RADIUS * 2.6) / len;
          t.position.set(pos[0] * inward, pos[1] * inward);
          t.eventMode = 'none';
          this.portLayer.addChild(t);
        }
      }
    };
    draw(inputs, 'in');
    draw(outputs, 'out');
  }

  private updateIcon() {
    const url = this.model.def?.icon;
    if (url === this.iconUrl) return;
    this.iconUrl = url;
    this.icon?.destroy();
    this.icon = null;
    if (!url || this.isGroup) return;
    const sprite = new Sprite(Texture.EMPTY);
    sprite.anchor.set(0.5);
    const size = this.model.radius * 0.7;
    void Assets.load<Texture>({ src: url, data: { resolution: 4 } }).then((tex) => {
      if (this.icon !== sprite || sprite.destroyed) return;
      sprite.texture = tex;
      sprite.scale.set(size / Math.max(tex.width, tex.height, 1));
    });
    sprite.position.set(0, this.model.radius * 0.08);
    sprite.eventMode = 'none';
    this.icon = sprite;
    this.container.addChildAt(sprite, 1);
  }

  /**
   * active: in the scope being edited (draggable, ports usable). ancestor: a group that contains
   * the scope (only its contents react). off: outside the scope.
   */
  setInteractive(mode: 'active' | 'ancestor' | 'off') {
    this.container.eventMode = mode === 'active' ? 'static' : mode === 'ancestor' ? 'passive' : 'none';
    this.container.interactiveChildren = mode !== 'off';
    this.portLayer.eventMode = mode === 'active' ? 'passive' : 'none';
    this.portLayer.interactiveChildren = mode === 'active';
    this.inner.interactiveChildren = mode === 'ancestor';
    this.ring.eventMode = mode === 'active' ? 'static' : 'none';
    for (const layer of [this.label, this.display]) layer.eventMode = 'none';
  }

  setSelected(selected: boolean) {
    if (selected === this.selected) return;
    this.selected = selected;
    this.drawRing();
  }

  setStatus(status: NodeStatus, error?: NodeError) {
    if (status === this.status && error?.message === this.error?.message) return;
    this.status = status;
    this.error = error;
    this.drawRing();
  }

  /** Draw into the node's display texture; return false to hide it (the icon shows instead). */
  paint(draw: ((ctx: CanvasRenderingContext2D, w: number, h: number) => boolean) | null) {
    const canvas = this.displayCanvas;
    if (!canvas || !draw) {
      this.display.visible = false;
      if (this.icon) this.icon.visible = true;
      return;
    }
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const shown = draw(ctx, canvas.width, canvas.height);
    this.display.visible = shown;
    if (this.icon) this.icon.visible = !shown;
    if (shown) this.display.texture.source.update();
  }

  /** Where a port's center is, in the coordinates of the scope that contains this node. */
  portPosition(kind: 'in' | 'out', port: string): Vec2 | undefined {
    const list = kind === 'in' ? this.model.ports.inputs : this.model.ports.outputs;
    const p = list.find((x) => x.def.name === port);
    return p ? [this.model.node.pos[0] + p.pos[0], this.model.node.pos[1] + p.pos[1]] : undefined;
  }

  setInnerFit(scale: number, center: Vec2) {
    this.fit = { scale, center };
    this.inner.scale.set(scale);
    this.inner.pivot.set(center[0], center[1]);
  }

  destroy() {
    const texture = this.display.texture;
    this.icon = null;
    this.container.destroy({ children: true });
    if (texture && !texture.destroyed) texture.destroy(true);
  }
}

export { NODE_RADIUS };
