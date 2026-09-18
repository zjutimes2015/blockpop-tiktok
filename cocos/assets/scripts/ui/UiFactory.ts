import {
    BlockInputEvents,
    Button,
    Color,
    Graphics,
    Label,
    Layers,
    Node,
    UIOpacity,
    UITransform,
    Widget,
} from 'cc';

export const UI_LAYER = Layers.Enum.UI_2D;

export function hexToColor(hex: string, a = 255): Color {
    if (!hex) return new Color(255, 255, 255, a);
    if (hex.startsWith('rgba')) {
        const m = hex.match(/rgba?\(([^)]+)\)/);
        if (m) {
            const p = m[1].split(',').map((s) => parseFloat(s.trim()));
            const alpha = p.length > 3 ? Math.round(p[3] * 255) : a;
            return new Color(p[0], p[1], p[2], alpha);
        }
    }
    const h = hex.replace('#', '');
    const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
    return new Color((n >> 16) & 255, (n >> 8) & 255, n & 255, a);
}

export function createNode(name: string, parent?: Node, w = 0, h = 0): Node {
    const node = new Node(name);
    node.layer = UI_LAYER;
    const uit = node.addComponent(UITransform);
    if (w || h) uit.setContentSize(w, h);
    uit.setAnchorPoint(0.5, 0.5);
    if (parent) parent.addChild(node);
    return node;
}

export function uit(node: Node): UITransform {
    return node.getComponent(UITransform) || node.addComponent(UITransform);
}

export function setSize(node: Node, w: number, h: number): UITransform {
    const t = uit(node);
    t.setContentSize(w, h);
    return t;
}

export function fillRoundRect(g: Graphics, x: number, y: number, w: number, h: number, r: number, color: Color): void {
    g.fillColor = color;
    const rr = Math.max(0, Math.min(r, Math.min(w, h) / 2));
    if (rr <= 0) g.rect(x, y, w, h);
    else g.roundRect(x, y, w, h, rr);
    g.fill();
}

export function strokeRoundRect(
    g: Graphics,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
    color: Color,
    lineWidth = 2,
): void {
    g.strokeColor = color;
    g.lineWidth = lineWidth;
    const rr = Math.max(0, Math.min(r, Math.min(w, h) / 2));
    if (rr <= 0) g.rect(x, y, w, h);
    else g.roundRect(x, y, w, h, rr);
    g.stroke();
}

export function paintPanel(node: Node, color: Color, radius = 12, clear = true): Graphics {
    const g = node.getComponent(Graphics) || node.addComponent(Graphics);
    if (clear) g.clear();
    const t = uit(node);
    const w = t.width;
    const h = t.height;
    fillRoundRect(g, -w / 2, -h / 2, w, h, radius, color);
    return g;
}

export function createLabel(
    name: string,
    parent: Node,
    text: string,
    fontSize: number,
    color: Color,
    w = 400,
    h = 40,
    bold = false,
): Label {
    const node = createNode(name, parent, w, h);
    const lab = node.addComponent(Label);
    lab.string = text;
    lab.fontSize = fontSize;
    lab.lineHeight = Math.ceil(fontSize * 1.25);
    lab.color = color;
    lab.useSystemFont = true;
    lab.fontFamily = 'Arial';
    lab.overflow = Label.Overflow.SHRINK;
    lab.enableWrapText = true;
    lab.horizontalAlign = Label.HorizontalAlign.CENTER;
    lab.verticalAlign = Label.VerticalAlign.CENTER;
    lab.isBold = bold;
    lab.cacheMode = Label.CacheMode.NONE;
    return lab;
}

export interface BtnOpts {
    width: number;
    height: number;
    fill: Color;
    label: string;
    fontSize?: number;
    textColor?: Color;
    radius?: number;
    stroke?: Color;
}

export function createButton(name: string, parent: Node, opts: BtnOpts, onClick: () => void): Node {
    const node = createNode(name, parent, opts.width, opts.height);
    paintPanel(node, opts.fill, opts.radius ?? 16);
    if (opts.stroke) {
        const g = node.getComponent(Graphics)!;
        strokeRoundRect(g, -opts.width / 2, -opts.height / 2, opts.width, opts.height, opts.radius ?? 16, opts.stroke, 2);
    }
    const lab = createLabel(
        'Label',
        node,
        opts.label,
        opts.fontSize ?? 28,
        opts.textColor ?? Color.WHITE,
        opts.width - 12,
        opts.height,
        true,
    );
    lab.overflow = Label.Overflow.SHRINK;
    const btn = node.addComponent(Button);
    btn.transition = Button.Transition.SCALE;
    btn.zoomScale = 0.96;
    btn.target = node;
    node.on(Button.EventType.CLICK, () => onClick());
    return node;
}

export function alignFull(node: Node, inset = 0): Widget {
    const w = node.getComponent(Widget) || node.addComponent(Widget);
    w.isAlignTop = true;
    w.isAlignBottom = true;
    w.isAlignLeft = true;
    w.isAlignRight = true;
    w.top = inset;
    w.bottom = inset;
    w.left = inset;
    w.right = inset;
    w.alignMode = Widget.AlignMode.ALWAYS;
    w.updateAlignment();
    return w;
}

export function alignTopBar(node: Node, top: number, left: number, right: number, height: number): Widget {
    const w = node.getComponent(Widget) || node.addComponent(Widget);
    w.isAlignTop = true;
    w.isAlignLeft = true;
    w.isAlignRight = true;
    w.isAlignBottom = false;
    w.top = top;
    w.left = left;
    w.right = right;
    w.alignMode = Widget.AlignMode.ALWAYS;
    setSize(node, 100, height);
    w.updateAlignment();
    return w;
}

export function alignBottomBar(node: Node, bottom: number, left: number, right: number, height: number): Widget {
    const w = node.getComponent(Widget) || node.addComponent(Widget);
    w.isAlignBottom = true;
    w.isAlignLeft = true;
    w.isAlignRight = true;
    w.isAlignTop = false;
    w.bottom = bottom;
    w.left = left;
    w.right = right;
    w.alignMode = Widget.AlignMode.ALWAYS;
    setSize(node, 100, height);
    w.updateAlignment();
    return w;
}

export function setOpacity(node: Node, opacity: number): UIOpacity {
    const o = node.getComponent(UIOpacity) || node.addComponent(UIOpacity);
    o.opacity = opacity;
    return o;
}

export function blockInput(node: Node): void {
    if (!node.getComponent(BlockInputEvents)) node.addComponent(BlockInputEvents);
}

export function setActive(node: Node, active: boolean): void {
    node.active = active;
}
