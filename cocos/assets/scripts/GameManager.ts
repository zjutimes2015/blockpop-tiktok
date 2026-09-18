import {
    _decorator,
    Camera,
    Color,
    Component,
    EventTouch,
    input,
    Input,
    Layers,
    Node,
    UITransform,
    Vec3,
    Widget,
} from 'cc';
import { AdBridge } from './AdBridge';
import { BoardManager } from './BoardManager';
import {
    INTERSTITIAL_EVERY,
    MILESTONES,
} from './core/Constants';
import {
    anyTrayPlaceable,
    applyClears,
    canPlace,
    collectClearKeys,
    comboMessage,
    emptyGrid,
    findFullLines,
    findHint,
    ghostCellsAt,
    remainingCount,
    refillTray,
    resolveDropCell,
    reviveTray,
    scoreForClear,
    scoreForPlace,
    softStartTray,
    stampPiece,
    anchorOffset,
} from './core/GameLogic';
import type { Grid, Piece } from './core/Types';
import { PieceTray } from './PieceTray';
import { UIManager } from './UIManager';
import { WxAdapter } from './WxAdapter';

const { ccclass } = _decorator;

@ccclass('GameManager')
export class GameManager extends Component {
    private board!: BoardManager;
    private tray!: PieceTray;
    private ui!: UIManager;
    private ads!: AdBridge;
    private camera: Camera | null = null;

    private grid: Grid = emptyGrid();
    private pieces: Array<Piece | null> = [null, null, null];
    private score = 0;
    private best = 0;
    private lineClearEvents = 0;
    private reviveUsed = false;
    private gameActive = false;
    private clearing = false;
    private milestonesHit = new Set<number>();
    private hintCells: Array<[number, number]> | null = null;
    private hintColor: string | null = null;
    private hovering = false;

    onLoad(): void {
        this.ensureUiCamera();
        this.forceUiLayer(this.node);

        this.board = this.getComponent(BoardManager) || this.addComponent(BoardManager);
        this.tray = this.getComponent(PieceTray) || this.addComponent(PieceTray);
        this.ui = this.getComponent(UIManager) || this.addComponent(UIManager);
        this.ads = this.getComponent(AdBridge) || this.addComponent(AdBridge);

        this.ui.build(this.node);
        this.forceUiLayer(this.node);
        const host = this.ui.boardHost!;
        host.getComponent(Widget)?.updateAlignment();
        const ht = host.getComponent(UITransform)!;
        const side = Math.max(320, Math.min(ht.width, ht.height));
        this.board.build(host, side);
        this.tray.build(this.ui.trayHost!, Math.min(680, ht.width + 72));

        this.ui.callbacks = {
            onPlay: () => this.startGame(),
            onHint: () => this.onHint(),
            onRevive: () => this.onRevive(),
            onEndRun: () => this.endRun(),
            onAgain: () => this.startGame(),
            onHome: () => this.goHome(),
        };
        this.tray.events = {
            onSelect: (idx) => this.onTraySelect(idx),
            onDragStart: (idx, world) => this.onDrag(idx, world, 'start'),
            onDragMove: (idx, world) => this.onDrag(idx, world, 'move'),
            onDragEnd: (idx, world) => this.onDrag(idx, world, 'end'),
        };

        this.bindBoardInput();
        this.ads.init(this.ui);
        this.best = WxAdapter.loadBest();
        this.ui.setBest(this.best);
        this.ui.setScore(0);
        this.board.setGrid(this.grid);
        this.board.render();
    }

    onDestroy(): void {
        input.off(Input.EventType.MOUSE_MOVE, this.onMouseMove, this);
        input.off(Input.EventType.MOUSE_UP, this.onMouseUp, this);
    }

    private ensureUiCamera(): void {
        const camNode = this.node.getChildByName('Camera');
        this.camera = camNode ? camNode.getComponent(Camera) : this.getComponentInChildren(Camera);
        if (!this.camera) return;
        this.camera.projection = Camera.ProjectionType.ORTHO;
        this.camera.clearFlags = Camera.ClearFlag.SOLID_COLOR;
        this.camera.clearColor = new Color(26, 10, 46, 255);
        this.camera.priority = 1073741824;
        this.camera.visibility = Layers.Enum.UI_2D | Layers.Enum.UI_3D;
        this.camera.near = 1;
        this.camera.far = 2000;
        if (camNode) {
            camNode.layer = Layers.Enum.UI_2D;
            camNode.setPosition(0, 0, 1000);
        }
        this.node.layer = Layers.Enum.UI_2D;
    }

    private forceUiLayer(node: Node): void {
        node.layer = Layers.Enum.UI_2D;
        for (const child of node.children) this.forceUiLayer(child);
    }

    private bindBoardInput(): void {
        const board = this.board.boardNode!;
        board.on(Node.EventType.TOUCH_END, (e: EventTouch) => {
            if (!this.gameActive || this.clearing) return;
            if (this.tray.dragIdx >= 0) return;
            const idx = this.tray.selectedIdx;
            if (idx < 0 || !this.pieces[idx]) return;
            const cell = this.cellFromEvent(e);
            if (!cell) return;
            const drop = resolveDropCell(this.grid, this.pieces[idx]!, cell.r, cell.c, false);
            if (drop) this.placePiece(idx, drop.r0, drop.c0);
        });
        board.on(Node.EventType.TOUCH_MOVE, (e: EventTouch) => {
            if (!this.gameActive || this.clearing) return;
            if (this.tray.selectedIdx < 0) return;
            this.previewAtEvent(e, false);
        });
        board.on(Node.EventType.TOUCH_CANCEL, () => this.refreshBoard());
        input.on(Input.EventType.MOUSE_MOVE, this.onMouseMove, this);
        input.on(Input.EventType.MOUSE_UP, this.onMouseUp, this);
    }

    private onMouseMove(e: EventTouch | any): void {
        if (!this.gameActive || this.clearing) return;
        if (this.tray.selectedIdx < 0 || !this.pieces[this.tray.selectedIdx]) {
            if (this.hovering) {
                this.hovering = false;
                this.refreshBoard();
            }
            return;
        }
        const loc = e.getUILocation ? e.getUILocation() : e.getLocation();
        const world = new Vec3(loc.x, loc.y, 0);
        const cell = this.board.worldToCell(world);
        if (!cell) {
            if (this.hovering) {
                this.hovering = false;
                this.refreshBoard();
            }
            return;
        }
        this.hovering = true;
        this.previewCell(this.tray.selectedIdx, cell.r, cell.c, false);
    }

    private onMouseUp(): void {
        /* drag end from tray is handled on the slot */
    }

    private cellFromEvent(e: EventTouch): { r: number; c: number } | null {
        const loc = e.getUILocation();
        return this.board.worldToCell(new Vec3(loc.x, loc.y, 0));
    }

    private previewAtEvent(e: EventTouch, preferAnchor: boolean): void {
        const idx = this.tray.selectedIdx;
        const cell = this.cellFromEvent(e);
        if (!cell || idx < 0) {
            this.refreshBoard();
            return;
        }
        this.previewCell(idx, cell.r, cell.c, preferAnchor);
    }

    private previewCell(idx: number, r: number, c: number, preferAnchor: boolean): void {
        const piece = this.pieces[idx];
        if (!piece) {
            this.refreshBoard();
            return;
        }
        let r0 = r;
        let c0 = c;
        if (preferAnchor || !canPlace(this.grid, piece, r, c)) {
            const drop = resolveDropCell(this.grid, piece, r, c, preferAnchor);
            if (drop) {
                r0 = drop.r0;
                c0 = drop.c0;
            } else if (preferAnchor) {
                const { ar, ac } = anchorOffset(piece);
                r0 = r - ar;
                c0 = c - ac;
            }
        }
        const ok = canPlace(this.grid, piece, r0, c0);
        this.board.render(ghostCellsAt(piece, r0, c0), ok, piece.color, this.hintCells, this.hintColor || undefined);
    }

    private onTraySelect(idx: number): void {
        if (!this.gameActive || this.clearing || !this.pieces[idx]) return;
        this.tray.selectedIdx = this.tray.selectedIdx === idx ? -1 : idx;
        this.refreshBoard();
    }

    private onDrag(idx: number, world: Vec3, phase: 'start' | 'move' | 'end'): void {
        if (!this.gameActive || this.clearing) return;
        const piece = this.pieces[idx];
        if (!piece) return;
        this.tray.selectedIdx = idx;
        const cell = this.board.worldToCell(world);
        if (phase === 'end') {
            this.tray.clearDrag();
            if (cell) {
                const drop = resolveDropCell(this.grid, piece, cell.r, cell.c, true);
                if (drop) {
                    this.placePiece(idx, drop.r0, drop.c0);
                    return;
                }
            }
            this.refreshBoard();
            return;
        }
        if (!cell) {
            this.refreshBoard();
            return;
        }
        this.previewCell(idx, cell.r, cell.c, true);
    }

    private startGame(): void {
        this.grid = emptyGrid();
        this.score = 0;
        this.lineClearEvents = 0;
        this.reviveUsed = false;
        this.milestonesHit = new Set();
        this.clearing = false;
        this.gameActive = true;
        this.hintCells = null;
        this.pieces = softStartTray();
        this.tray.selectedIdx = -1;
        this.tray.setTray(this.pieces);
        this.board.setGrid(this.grid);
        this.board.render();
        this.ui.setScore(0);
        this.ui.setMilestone('');
        this.best = WxAdapter.loadBest();
        this.ui.setBest(this.best);
        this.ui.showScreen('game');
    }

    private goHome(): void {
        this.gameActive = false;
        this.best = WxAdapter.loadBest();
        this.ui.setBest(this.best);
        this.ui.showScreen('start');
    }

    private placePiece(idx: number, r0: number, c0: number): boolean {
        const piece = this.pieces[idx];
        if (!piece || !canPlace(this.grid, piece, r0, c0) || this.clearing) return false;
        stampPiece(this.grid, piece, r0, c0);
        this.pieces[idx] = null;
        this.tray.selectedIdx = -1;
        this.tray.clearDrag();
        this.hintCells = null;
        this.score += scoreForPlace(piece);
        this.updateScoreUI();
        this.tray.setTray(this.pieces);
        this.board.setGrid(this.grid);
        this.board.render();

        const { rows, cols, lines } = findFullLines(this.grid);
        if (lines > 0) {
            const keys = collectClearKeys(rows, cols);
            this.animateClear(keys, lines);
        } else {
            this.afterPlace();
        }
        return true;
    }

    private animateClear(keys: string[], lines: number): void {
        this.clearing = true;
        this.ui.showCombo(comboMessage(lines));
        this.board.spawnParticles(this.ui.particleLayer!, keys);
        this.score += scoreForClear(lines, keys.length);
        this.updateScoreUI();
        this.saveBest();
        this.lineClearEvents++;
        this.board.animateClear(keys, () => {
            applyClears(this.grid, keys);
            this.clearing = false;
            this.board.setGrid(this.grid);
            this.board.render();
            if (this.lineClearEvents > 0 && this.lineClearEvents % INTERSTITIAL_EVERY === 0) {
                this.ads.showInterstitial(() => this.afterPlace());
            } else {
                this.afterPlace();
            }
        });
    }

    private afterPlace(): void {
        if (remainingCount(this.pieces) === 0) {
            this.pieces = refillTray(this.grid);
            this.tray.selectedIdx = -1;
        }
        this.tray.setTray(this.pieces);
        if (!anyTrayPlaceable(this.grid, this.pieces)) {
            this.ui.showDeadEnd(this.score, this.reviveUsed);
            this.gameActive = false;
        }
    }

    private onHint(): void {
        if (!this.gameActive || this.clearing) return;
        this.ads.showRewarded('Watching Ad…', () => {
            const hint = findHint(this.grid, this.pieces);
            if (!hint) {
                this.ui.showCombo('No hint');
                return;
            }
            const piece = this.pieces[hint.idx]!;
            this.tray.selectedIdx = hint.idx;
            this.tray.setTray(this.pieces);
            this.hintCells = ghostCellsAt(piece, hint.r, hint.c);
            this.hintColor = piece.color;
            this.board.render(this.hintCells, true, piece.color, this.hintCells, piece.color);
            this.ui.showCombo('HINT!');
            this.scheduleOnce(() => {
                this.board.render(this.hintCells, true, piece.color);
            }, 1.2);
        });
    }

    private onRevive(): void {
        if (this.reviveUsed) return;
        this.ads.showRewarded('Watching Ad…', () => this.doRevive(), () => this.ui.showDeadEnd(this.score, this.reviveUsed));
    }

    private doRevive(): void {
        this.reviveUsed = true;
        this.pieces = reviveTray(this.grid);
        this.tray.selectedIdx = -1;
        this.tray.setTray(this.pieces);
        this.board.setGrid(this.grid);
        this.board.render();
        this.gameActive = true;
        this.ui.showScreen('game');
        this.ui.showCombo('REVIVED!');
    }

    private endRun(): void {
        this.saveBest();
        const isNew = this.score >= this.best;
        this.ui.showGameOver(this.score, this.best, isNew);
        this.gameActive = false;
    }

    private updateScoreUI(): void {
        this.ui.setScore(this.score);
        for (const m of MILESTONES) {
            if (this.score >= m && !this.milestonesHit.has(m)) {
                this.milestonesHit.add(m);
                this.ui.setMilestone('★ Milestone ' + m + '!');
                this.scheduleOnce(() => {
                    if (this.ui.milestoneLabel && this.ui.milestoneLabel.string.indexOf(String(m)) >= 0) {
                        this.ui.setMilestone('');
                    }
                }, 2.5);
            }
        }
    }

    private saveBest(): void {
        this.best = WxAdapter.saveBest(this.score);
        this.ui.setBest(this.best);
    }

    private refreshBoard(): void {
        this.board.setGrid(this.grid);
        this.board.render(null, false, undefined, this.hintCells, this.hintColor || undefined);
    }
}
