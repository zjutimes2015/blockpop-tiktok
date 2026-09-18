import { _decorator, Color, Component, Graphics, Node, tween, Tween, UIOpacity, UITransform, Vec3 } from 'cc';
import { COLORS, COLOR_MINT, GRID } from './core/Constants';
import type { Cell, Grid, Piece } from './core/Types';
import { createNode, fillRoundRect, hexToColor, paintPanel, setOpacity, strokeRoundRect, uit } from './ui/UiFactory';

const { ccclass } = _decorator;

interface CellView {
    node: Node;
    g: Graphics;
    opacity: UIOpacity;
}

@ccclass('BoardManager')
export class BoardManager extends Component {
    public boardNode: Node | null = null;
    public boardSize = 640;
    public padding = 8;
    public gap = 4;
    public cellSize = 74;

    private _cells: CellView[] = [];
    private _grid: Grid = [];

    public build(parent: Node, size: number): Node {
        this.boardSize = size;
        const inner = size - this.padding * 2;
        this.cellSize = (inner - this.gap * (GRID - 1)) / GRID;
        this.boardNode = createNode('Board', parent, size, size);
        paintPanel(this.boardNode, hexToColor('#000000', 90), 16);
        this._cells = [];
        for (let r = 0; r < GRID; r++) {
            for (let c = 0; c < GRID; c++) {
                const node = createNode(`c${r}_${c}`, this.boardNode, this.cellSize, this.cellSize);
                node.setPosition(this.cellPos(r, c));
                const g = node.addComponent(Graphics);
                const opacity = setOpacity(node, 255);
                this._cells.push({ node, g, opacity });
            }
        }
        return this.boardNode;
    }

    public cellPos(r: number, c: number): Vec3 {
        const stride = this.cellSize + this.gap;
        const originX = -this.boardSize / 2 + this.padding + this.cellSize / 2;
        const originY = this.boardSize / 2 - this.padding - this.cellSize / 2;
        return new Vec3(originX + c * stride, originY - r * stride, 0);
    }

    public cellFromLocal(local: Vec3): { r: number; c: number } | null {
        const stride = this.cellSize + this.gap;
        const lx = local.x + this.boardSize / 2 - this.padding;
        const ly = this.boardSize / 2 - this.padding - local.y;
        if (lx < 0 || ly < 0) return null;
        const c = Math.floor(lx / stride);
        const r = Math.floor(ly / stride);
        if (r < 0 || c < 0 || r >= GRID || c >= GRID) return null;
        const inCellX = lx - c * stride;
        const inCellY = ly - r * stride;
        if (inCellX > this.cellSize + this.gap * 0.5 || inCellY > this.cellSize + this.gap * 0.5) return null;
        return { r, c };
    }

    public worldToCell(world: Vec3): { r: number; c: number } | null {
        if (!this.boardNode) return null;
        const local = uit(this.boardNode).convertToNodeSpaceAR(world);
        const half = this.boardSize / 2;
        if (local.x < -half || local.x > half || local.y < -half || local.y > half) return null;
        return this.cellFromLocal(local);
    }

    public setGrid(grid: Grid): void {
        this._grid = grid;
    }

    public render(ghostCells?: Cell[] | null, ghostOk?: boolean, ghostColor?: string, hintCells?: Cell[] | null, hintColor?: string): void {
        const hintSet = new Set((hintCells || []).map(([r, c]) => r + ',' + c));
        const ghostSet = new Set((ghostCells || []).map(([r, c]) => r + ',' + c));
        for (let i = 0; i < GRID * GRID; i++) {
            const r = Math.floor(i / GRID);
            const c = i % GRID;
            const key = r + ',' + c;
            const view = this._cells[i];
            Tween.stopAllByTarget(view.node);
            view.node.setScale(1, 1, 1);
            view.opacity.opacity = 255;
            const filled = this._grid[r] && this._grid[r][c];
            this.paintCell(view, {
                filled: !!filled,
                color: filled || '#ffffff',
                ghost: ghostSet.has(key),
                ghostOk: !!ghostOk,
                ghostColor: ghostColor || '#ffffff',
                hint: hintSet.has(key),
                hintColor: hintColor || COLOR_MINT,
            });
        }
    }

    public animateClear(keys: string[], done: () => void): void {
        const set = new Set(keys);
        let n = 0;
        for (let i = 0; i < GRID * GRID; i++) {
            const r = Math.floor(i / GRID);
            const c = i % GRID;
            if (!set.has(r + ',' + c)) continue;
            n++;
            const view = this._cells[i];
            tween(view.node)
                .to(0.18, { scale: new Vec3(1.15, 1.15, 1) })
                .to(0.18, { scale: new Vec3(0, 0, 1) })
                .start();
            tween(view.opacity).to(0.36, { opacity: 0 }).start();
        }
        if (n === 0) {
            done();
            return;
        }
        this.scheduleOnce(() => {
            for (const view of this._cells) {
                view.node.setScale(1, 1, 1);
                view.opacity.opacity = 255;
            }
            done();
        }, 0.36);
    }

    public spawnParticles(parent: Node, keys: string[]): void {
        if (!this.boardNode) return;
        const boardWorld = this.boardNode.worldPosition;
        for (const key of keys) {
            const [r, c] = key.split(',').map(Number);
            const local = this.cellPos(r, c);
            const world = new Vec3(boardWorld.x + local.x, boardWorld.y + local.y, 0);
            for (let i = 0; i < 4; i++) {
                const p = createNode('spark', parent, 8, 8);
                const g = p.addComponent(Graphics);
                const col = hexToColor(COLORS[Math.floor(Math.random() * COLORS.length)]);
                fillRoundRect(g, -3, -3, 6, 6, 3, col);
                p.setWorldPosition(world);
                const ang = Math.random() * Math.PI * 2;
                const dist = 30 + Math.random() * 50;
                const target = new Vec3(world.x + Math.cos(ang) * dist, world.y + Math.sin(ang) * dist, 0);
                const op = setOpacity(p, 255);
                tween(p)
                    .to(0.5, { worldPosition: target, scale: new Vec3(0.1, 0.1, 1) })
                    .call(() => p.destroy())
                    .start();
                tween(op).to(0.5, { opacity: 0 }).start();
            }
        }
    }

    public containsWorld(world: Vec3): boolean {
        if (!this.boardNode) return false;
        const box = uit(this.boardNode).getBoundingBoxToWorld();
        const box = uit(this.boardNode).getBoundingBoxToWorld();
        return world.x >= box.x && world.x <= box.x + box.width && world.y >= box.y && world.y <= box.y + box.height;
    }

    private paintCell(
        view: CellView,
        st: {
            filled: boolean;
            color: string;
            ghost: boolean;
            ghostOk: boolean;
            ghostColor: string;
            hint: boolean;
            hintColor: string;
        },
    ): void {
        const g = view.g;
        g.clear();
        const w = this.cellSize;
        const h = this.cellSize;
        const x = -w / 2;
        const y = -h / 2;
        const radius = 8;
        if (st.filled) {
            fillRoundRect(g, x, y, w, h, radius, hexToColor(st.color));
        } else {
            fillRoundRect(g, x, y, w, h, radius, new Color(255, 255, 255, 16));
        }
        if (st.hint && !st.filled) {
            fillRoundRect(g, x, y, w, h, radius, hexToColor(st.hintColor, 140));
            strokeRoundRect(g, x, y, w, h, radius, hexToColor(COLOR_MINT), 3);
        } else if (st.ghost) {
            if (st.ghostOk) {
                if (!st.filled) fillRoundRect(g, x, y, w, h, radius, hexToColor(st.ghostColor, 115));
                strokeRoundRect(g, x, y, w, h, radius, new Color(255, 255, 255, 160), 2);
            } else {
                strokeRoundRect(g, x, y, w, h, radius, new Color(255, 80, 80, 170), 2);
            }
        }
    }
}
