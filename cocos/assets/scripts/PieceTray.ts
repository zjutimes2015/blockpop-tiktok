import { _decorator, Component, EventTouch, Graphics, Node, Vec3 } from 'cc';
import { TRAY_SIZE } from './core/Constants';
import { pieceBounds } from './core/GameLogic';
import type { Piece } from './core/Types';
import {
    createNode,
    fillRoundRect,
    hexToColor,
    setOpacity,
    strokeRoundRect,
    uit,
} from './ui/UiFactory';

const { ccclass } = _decorator;

export interface TrayEvents {
    onSelect(idx: number): void;
    onDragStart(idx: number, world: Vec3): void;
    onDragMove(idx: number, world: Vec3): void;
    onDragEnd(idx: number, world: Vec3): void;
}

interface SlotView {
    node: Node;
    g: Graphics;
    mini: Node;
}

@ccclass('PieceTray')
export class PieceTray extends Component {
    public trayNode: Node | null = null;
    public events: TrayEvents | null = null;

    private _slots: SlotView[] = [];
    private _tray: Array<Piece | null> = [null, null, null];
    private _selected = -1;
    private _dragIdx = -1;
    private _ghost: Node | null = null;
    private _slotW = 120;
    private _slotH = 96;

    private _dragMoved = false;

    public get selectedIdx(): number {
        return this._selected;
    }

    public set selectedIdx(v: number) {
        this._selected = v;
        this.paintSlots();
    }

    public get dragIdx(): number {
        return this._dragIdx;
    }

    public hasTray(): boolean {
        return !!(this.trayNode && this.trayNode.isValid !== false && this.trayNode.parent && this._slots.length === TRAY_SIZE);
    }

    public build(parent: Node, width: number): Node {
        this._slotW = Math.min(130, Math.floor((width - 24) / 3));
        this._slotH = 100;
        this.trayNode = createNode('Tray', parent, width, this._slotH + 8);
        this._slots = [];
        const gap = 10;
        const total = TRAY_SIZE * this._slotW + (TRAY_SIZE - 1) * gap;
        let x = -total / 2 + this._slotW / 2;
        for (let i = 0; i < TRAY_SIZE; i++) {
            const node = createNode(`slot${i}`, this.trayNode, this._slotW, this._slotH);
            node.setPosition(x, 0, 0);
            x += this._slotW + gap;
            const g = node.addComponent(Graphics);
            const mini = createNode('mini', node, this._slotW - 16, this._slotH - 16);
            this._slots.push({ node, g, mini });
            this.bindSlot(node, i);
        }
        this._ghost = createNode('DragGhost', parent, 80, 80);
        this._ghost.active = false;
        setOpacity(this._ghost, 230);
        return this.trayNode;
    }

    public setTray(tray: Array<Piece | null>): void {
        this._tray = tray;
        this.paintSlots();
    }

    public clearDrag(): void {
        this._dragIdx = -1;
        if (this._ghost) this._ghost.active = false;
    }

    private bindSlot(node: Node, idx: number): void {
        node.on(Node.EventType.TOUCH_START, (e: EventTouch) => {
            if (!this._tray[idx]) return;
            this._dragIdx = idx;
            this._dragMoved = false;
            e.propagationStopped = true;
        });
        node.on(Node.EventType.TOUCH_MOVE, (e: EventTouch) => {
            if (this._dragIdx !== idx) return;
            const start = e.getUIStartLocation();
            const now = e.getUILocation();
            const dist = Math.hypot(now.x - start.x, now.y - start.y);
            const world = this.uiWorld(e);
            if (!this._dragMoved && dist >= 12) {
                this._dragMoved = true;
                this._selected = idx;
                this.paintSlots();
                this.showGhost(this._tray[idx]!, world);
                this.events?.onDragStart(idx, world);
            }
            if (this._dragMoved) {
                this.moveGhost(world);
                this.events?.onDragMove(idx, world);
            }
            e.propagationStopped = true;
        });
        node.on(Node.EventType.TOUCH_END, (e: EventTouch) => {
            if (this._dragIdx !== idx) return;
            const world = this.uiWorld(e);
            const moved = this._dragMoved;
            this.clearDrag();
            if (moved) this.events?.onDragEnd(idx, world);
            else this.events?.onSelect(idx);
            e.propagationStopped = true;
        });
        node.on(Node.EventType.TOUCH_CANCEL, (e: EventTouch) => {
            if (this._dragIdx !== idx) return;
            const world = this.uiWorld(e);
            const moved = this._dragMoved;
            this.clearDrag();
            if (moved) this.events?.onDragEnd(idx, world);
        });
    }

    private uiWorld(e: EventTouch): Vec3 {
        const loc = e.getUILocation();
        return new Vec3(loc.x, loc.y, 0);
    }

    private paintSlots(): void {
        for (let i = 0; i < this._slots.length; i++) {
            const slot = this._slots[i];
            const piece = this._tray[i];
            slot.g.clear();
            const w = this._slotW;
            const h = this._slotH;
            const selected = i === this._selected && !!piece;
            const empty = !piece;
            const fill = selected
                ? hexToColor('#ff9ec8', 40)
                : hexToColor('#ffffff', empty ? 8 : 16);
            fillRoundRect(slot.g, -w / 2, -h / 2, w, h, 14, fill);
            if (selected) {
                strokeRoundRect(slot.g, -w / 2, -h / 2, w, h, 14, hexToColor('#ff9ec8'), 3);
            }
            slot.mini.removeAllChildren();
            if (piece) this.drawMini(slot.mini, piece, 16);
            setOpacity(slot.node, empty ? 90 : 255);
        }
    }

    private showGhost(piece: Piece, world: Vec3): void {
        if (!this._ghost) return;
        this._ghost.active = true;
        this._ghost.removeAllChildren();
        this.drawMini(this._ghost, piece, 20);
        this.moveGhost(world);
    }

    private moveGhost(world: Vec3): void {
        if (!this._ghost) return;
        // Finger sits near the bottom-center of the piece (HTML translate(-50%, -110%)).
        this._ghost.setWorldPosition(world.x, world.y + 48, 0);
    }

    private drawMini(host: Node, piece: Piece, cell: number): void {
        const { rows, cols } = pieceBounds(piece.cells);
        const gap = 2;
        const w = cols * cell + (cols - 1) * gap;
        const h = rows * cell + (rows - 1) * gap;
        uit(host).setContentSize(Math.max(w, 8), Math.max(h, 8));
        const set = new Set(piece.cells.map(([r, c]) => r + ',' + c));
        const originX = -w / 2 + cell / 2;
        const originY = h / 2 - cell / 2;
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                if (!set.has(r + ',' + c)) continue;
                const n = createNode(`p${r}_${c}`, host, cell, cell);
                n.setPosition(originX + c * (cell + gap), originY - r * (cell + gap), 0);
                const g = n.addComponent(Graphics);
                fillRoundRect(g, -cell / 2, -cell / 2, cell, cell, 4, hexToColor(piece.color));
            }
        }
    }
}
