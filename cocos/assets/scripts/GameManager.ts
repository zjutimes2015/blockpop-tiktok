/**
 * BlockPop run loop — port of the HTML prototype.
 *
 * Preview boot (Creator ▶ browser):
 * - GameController lives UNDER Canvas (not a Scene sibling) so Labels/Graphics
 *   stay in the UI tree the ORTHO camera actually sees.
 * - onLoad may run before Scene children are queryable; start() rebuilds the
 *   board + tray if they are still missing.
 * - Never call find() — parent / scene + getChildByName only.
 * - Scene mounts GameManager only; Board / Tray / UI / Ads are addComponent'd.
 */
import {
    _decorator,
    Camera,
    Canvas,
    Color,
    Component,
    director,
    EventTouch,
    input,
    Input,
    Layers,
    Node,
    ResolutionPolicy,
    UITransform,
    Vec3,
    view,
    Widget,
} from 'cc';
import { AdBridge } from './AdBridge';
import { BoardManager } from './BoardManager';
import {
    BANNER_HEIGHT,
    DESIGN_HEIGHT,
    DESIGN_WIDTH,
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

const { ccclass, executionOrder } = _decorator;
const orderEarly: ClassDecorator = (typeof executionOrder === 'function'
    ? executionOrder(-100)
    : ((ctor: unknown) => ctor)) as ClassDecorator;

const UI_2D = Layers.Enum.UI_2D;

@ccclass('GameManager')
@orderEarly
export class GameManager extends Component {
    private board: BoardManager | null = null;
    private tray: PieceTray | null = null;
    private ui: UIManager | null = null;
    private ads: AdBridge | null = null;
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
    private _wired = false;
    private _inputBound = false;

    onLoad(): void {
        try {
            this.boot('onLoad', false);
        } catch (err) {
            console.error('[GameManager] onLoad failed', err);
        }
    }

    start(): void {
        try {
            if (!this.hasPlayUI()) {
                console.warn('[GameManager] start(): board/tray UI missing — rebuilding');
                this.boot('start', true);
            } else {
                console.log('[GameManager] start(): play UI already built');
            }
        } catch (err) {
            console.error('[GameManager] start failed', err);
        }
    }

    /**
     * Wire hierarchy + managers and build the start screen + empty board/tray.
     * @param allowCreateCanvas only start() should create a Canvas (onLoad often
     *   sees an empty sibling list and would otherwise nest a duplicate Canvas
     *   on GameController, leaving the scene Camera staring at an empty UIRoot).
     */
    boot(phase: string, allowCreateCanvas: boolean): void {
        const parentName = this.node.parent ? this.node.parent.name : '(null)';
        const sceneName = this.node.scene ? this.node.scene.name : '(no scene)';
        console.log(
            `[GameManager] boot(${phase}) node=${this.node.name} parent=${parentName} scene=${sceneName} allowCreate=${allowCreateCanvas}`,
        );

        if (view && view.setDesignResolutionSize) {
            view.setDesignResolutionSize(DESIGN_WIDTH, DESIGN_HEIGHT, ResolutionPolicy.SHOW_ALL);
        }

        const hier = this.ensureHierarchy(allowCreateCanvas);
        if (!hier) {
            console.warn(`[GameManager] boot(${phase}) Canvas not ready — waiting for start()`);
            return;
        }
        const { canvas, board, ui } = hier;
        this.ensureComponents();
        if (!this.board || !this.tray || !this.ui || !this.ads) {
            console.error('[GameManager] boot failed: sibling components missing');
            return;
        }

        this.ensureCanvasCamera(canvas);
        this.forceUiLayer(canvas);

        this.ui.setUIRoot(ui);
        this.ui.setBoardHost(board);
        this.ui.build();

        const host = this.ui.boardHost;
        if (!host) {
            console.error(`[GameManager] boot(${phase}) FAILED — board host missing after UI build`);
            return;
        }
        host.getComponent(Widget)?.updateAlignment();
        const ht = host.getComponent(UITransform);
        const side = Math.max(320, Math.min(ht ? ht.width : 640, ht ? ht.height : 640));
        if (!this.board.hasBoard()) {
            this.board.build(host, side);
        }
        const trayParent = this.ui.trayHost;
        if (!trayParent) {
            console.error(`[GameManager] boot(${phase}) FAILED — tray host missing after UI build`);
            return;
        }
        if (!this.tray.hasTray()) {
            this.tray.build(trayParent, Math.min(680, side + 72));
        }

        this.wireOnce();
        this.forceUiLayer(canvas);

        this.best = WxAdapter.loadBest();
        this.ui.setBest(this.best);
        this.ui.setScore(0);
        this.board.setGrid(this.grid);
        this.board.render();
        this.ui.showScreen('start');

        if (this.hasPlayUI()) {
            console.log(
                `[GameManager] boot(${phase}) SUCCESS board under ${host.name} tray under ${trayParent.name} ui=${ui.name}`,
            );
        } else {
            console.error(`[GameManager] boot(${phase}) FAILED — play UI was not created`);
        }
    }

    /**
     * Scene only mounts GameManager. Attach sibling gameplay scripts at runtime
     * so Creator never has to deserialize BoardManager / PieceTray / UIManager / AdBridge.
     */
    ensureComponents(): void {
        this.board = this.getComponent(BoardManager) || this.addComponent(BoardManager);
        this.tray = this.getComponent(PieceTray) || this.addComponent(PieceTray);
        this.ui = this.getComponent(UIManager) || this.addComponent(UIManager);
        this.ads = this.getComponent(AdBridge) || this.addComponent(AdBridge);
        if (!this.board || !this.tray || !this.ui || !this.ads) {
            console.error('[GameManager] ensureComponents failed', {
                board: !!this.board, tray: !!this.tray, ui: !!this.ui, ads: !!this.ads,
            });
        }
    }

    /**
     * Resolve Canvas without `find()`. Prefer `this.node.parent` when
     * GameController is a Canvas child — that works even if Scene's sibling
     * list is still empty during onLoad.
     */
    resolveCanvas(): Node | null {
        const named = (root: Node | null | undefined, name: string): Node | null => {
            if (!root) return null;
            if (root.name === name) return root;
            return root.getChildByName ? root.getChildByName(name) : null;
        };

        const fromParent = named(this.node.parent, 'Canvas');
        if (fromParent) return fromParent;

        const scene = this.node.scene || director.getScene();
        const fromScene = named(scene, 'Canvas');
        if (fromScene) return fromScene;

        for (let p: Node | null = this.node; p; p = p.parent) {
            if (p.name === 'Canvas') return p;
            const child = p.getChildByName ? p.getChildByName('Canvas') : null;
            if (child) return child;
        }
        return null;
    }

    /**
     * Create Canvas / BoardRoot / UIRoot / ORTHO Camera if missing.
     * Always returns the live board/ui nodes so boot can wire managers without find().
     */
    ensureHierarchy(allowCreateCanvas: boolean): { canvas: Node; board: Node; ui: Node } | null {
        let canvas = this.resolveCanvas();
        if (!canvas) {
            if (!allowCreateCanvas) return null;
            console.warn('[GameManager] no Canvas in hierarchy — creating one on the scene');
            canvas = new Node('Canvas');
            canvas.layer = UI_2D;
            const scene = this.node.scene || director.getScene() || this.node.parent;
            if (scene && scene !== this.node) scene.addChild(canvas);
            else {
                console.error('[GameManager] cannot parent Canvas (would nest under GameController)');
                return null;
            }

            const ut = canvas.addComponent(UITransform);
            ut.setContentSize(DESIGN_WIDTH, DESIGN_HEIGHT);
            const widget = canvas.addComponent(Widget);
            widget.isAlignTop = widget.isAlignBottom = widget.isAlignLeft = widget.isAlignRight = true;
            widget.top = widget.bottom = widget.left = widget.right = 0;
            if (Widget.AlignMode) widget.alignMode = Widget.AlignMode.ON_WINDOW_RESIZE;
            this.ensureCanvasCamera(canvas);
        } else {
            let w = canvas.getComponent(Widget);
            if (!w) {
                w = canvas.addComponent(Widget);
                w.isAlignTop = w.isAlignBottom = w.isAlignLeft = w.isAlignRight = true;
                w.top = w.bottom = w.left = w.right = 0;
            }
            if (!canvas.getComponent(UITransform)) {
                const ut = canvas.addComponent(UITransform);
                ut.setContentSize(DESIGN_WIDTH, DESIGN_HEIGHT);
            }
            canvas.layer = UI_2D;
            this.ensureCanvasCamera(canvas);
        }

        // Never reparent the Canvas onto itself (legacy scene had GameManager on Canvas).
        if (this.node !== canvas && this.node.parent !== canvas) {
            console.log(`[GameManager] reparent ${this.node.name} → Canvas (was ${this.node.parent ? this.node.parent.name : 'null'})`);
            this.node.parent = canvas;
        }
        if (this.node !== canvas) {
            this.node.name = 'GameController';
            const selfUt = this.node.getComponent(UITransform);
            if (selfUt) selfUt.setContentSize(1, 1);
        }
        this.node.layer = UI_2D;

        const ensureChild = (name: string, sibling: number, sizeW: number, sizeH: number) => {
            let n = canvas!.getChildByName(name);
            if (!n) {
                n = new Node(name);
                n.layer = UI_2D;
                n.addComponent(UITransform).setContentSize(sizeW, sizeH);
                canvas!.addChild(n);
                console.log(`[GameManager] created missing child ${name}`);
            }
            n.layer = UI_2D;
            n.setSiblingIndex(sibling);
            return n;
        };

        const board = ensureChild('BoardRoot', 2, 640, 640);
        const ui = ensureChild('UIRoot', 10, DESIGN_WIDTH, DESIGN_HEIGHT);
        this.ensureBoardWidget(board);
        this.ensureFullWidget(ui);
        this.ensureCanvasCamera(canvas);
        return { canvas, board, ui };
    }

    private ensureBoardWidget(board: Node): void {
        const ut = board.getComponent(UITransform) || board.addComponent(UITransform);
        if (!ut.width || !ut.height) ut.setContentSize(640, 640);
        let w = board.getComponent(Widget);
        if (!w) {
            w = board.addComponent(Widget);
            w.isAlignTop = w.isAlignBottom = w.isAlignLeft = w.isAlignRight = true;
            w.top = 140;
            w.bottom = BANNER_HEIGHT + 148;
            w.left = 36;
            w.right = 36;
            w.alignMode = Widget.AlignMode.ALWAYS;
        }
        w.updateAlignment();
    }

    private ensureFullWidget(node: Node): void {
        const ut = node.getComponent(UITransform) || node.addComponent(UITransform);
        if (!ut.width || !ut.height) ut.setContentSize(DESIGN_WIDTH, DESIGN_HEIGHT);
        let w = node.getComponent(Widget);
        if (!w) {
            w = node.addComponent(Widget);
            w.isAlignTop = w.isAlignBottom = w.isAlignLeft = w.isAlignRight = true;
            w.top = w.bottom = w.left = w.right = 0;
            w.alignMode = Widget.AlignMode.ALWAYS;
        }
        w.updateAlignment();
    }

    ensureCanvasCamera(canvas: Node): void {
        let camNode = canvas.getChildByName('Camera');
        if (!camNode) {
            camNode = new Node('Camera');
            camNode.layer = UI_2D;
            canvas.insertChild(camNode, 0);
            camNode.setPosition(0, 0, 1000);
            console.log('[GameManager] created Camera under Canvas');
        } else {
            camNode.setSiblingIndex(0);
            if (camNode.position.z === 0) camNode.setPosition(0, 0, 1000);
        }
        camNode.layer = UI_2D;

        let camera = camNode.getComponent(Camera);
        if (!camera) camera = camNode.addComponent(Camera);
        this.camera = camera;

        camera.projection = Camera.ProjectionType.ORTHO;
        camera.orthoHeight = DESIGN_HEIGHT / 2;
        camera.near = 1;
        camera.far = 2000;
        camera.clearFlags = Camera.ClearFlag.SOLID_COLOR;
        camera.clearColor = new Color(26, 10, 46, 255);
        camera.visibility = UI_2D;
        camera.priority = 0;

        let canvasComp = canvas.getComponent(Canvas);
        if (!canvasComp) canvasComp = canvas.addComponent(Canvas);
        canvasComp.cameraComponent = camera;
        canvasComp.alignCanvasWithScreen = true;
    }

    hasPlayUI(): boolean {
        return !!(this.ui && this.ui.hasPlayUI() && this.board && this.board.hasBoard() && this.tray && this.tray.hasTray());
    }

    onDestroy(): void {
        if (this._inputBound) {
            input.off(Input.EventType.MOUSE_MOVE, this.onMouseMove, this);
            input.off(Input.EventType.MOUSE_UP, this.onMouseUp, this);
            this._inputBound = false;
        }
    }

    private wireOnce(): void {
        if (this._wired || !this.ui || !this.tray || !this.ads) return;
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
        this._wired = true;
    }

    private forceUiLayer(node: Node): void {
        node.layer = UI_2D;
        for (const child of node.children) this.forceUiLayer(child);
    }

    private bindBoardInput(): void {
        if (this._inputBound || !this.board || !this.board.boardNode) return;
        const board = this.board.boardNode;
        board.on(Node.EventType.TOUCH_END, (e: EventTouch) => {
            if (!this.gameActive || this.clearing || !this.tray) return;
            if (this.tray.dragIdx >= 0) return;
            const idx = this.tray.selectedIdx;
            if (idx < 0 || !this.pieces[idx]) return;
            const cell = this.cellFromEvent(e);
            if (!cell) return;
            const drop = resolveDropCell(this.grid, this.pieces[idx]!, cell.r, cell.c, false);
            if (drop) this.placePiece(idx, drop.r0, drop.c0);
        });
        board.on(Node.EventType.TOUCH_MOVE, (e: EventTouch) => {
            if (!this.gameActive || this.clearing || !this.tray) return;
            if (this.tray.selectedIdx < 0) return;
            this.previewAtEvent(e, false);
        });
        board.on(Node.EventType.TOUCH_CANCEL, () => this.refreshBoard());
        input.on(Input.EventType.MOUSE_MOVE, this.onMouseMove, this);
        input.on(Input.EventType.MOUSE_UP, this.onMouseUp, this);
        this._inputBound = true;
    }

    private onMouseMove(e: EventTouch | any): void {
        if (!this.gameActive || this.clearing || !this.tray || !this.board) return;
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
        if (!this.board) return null;
        const loc = e.getUILocation();
        return this.board.worldToCell(new Vec3(loc.x, loc.y, 0));
    }

    private previewAtEvent(e: EventTouch, preferAnchor: boolean): void {
        if (!this.tray) return;
        const idx = this.tray.selectedIdx;
        const cell = this.cellFromEvent(e);
        if (!cell || idx < 0) {
            this.refreshBoard();
            return;
        }
        this.previewCell(idx, cell.r, cell.c, preferAnchor);
    }

    private previewCell(idx: number, r: number, c: number, preferAnchor: boolean): void {
        if (!this.board) return;
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
        if (!this.gameActive || this.clearing || !this.pieces[idx] || !this.tray) return;
        this.tray.selectedIdx = this.tray.selectedIdx === idx ? -1 : idx;
        this.refreshBoard();
    }

    private onDrag(idx: number, world: Vec3, phase: 'start' | 'move' | 'end'): void {
        if (!this.gameActive || this.clearing || !this.tray || !this.board) return;
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
        if (!this.ui || !this.tray || !this.board) return;
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
        if (!this.ui) return;
        this.gameActive = false;
        this.best = WxAdapter.loadBest();
        this.ui.setBest(this.best);
        this.ui.showScreen('start');
    }

    private placePiece(idx: number, r0: number, c0: number): boolean {
        if (!this.ui || !this.tray || !this.board) return false;
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
        if (!this.ui || !this.board) return;
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
            this.board!.setGrid(this.grid);
            this.board!.render();
            if (this.lineClearEvents > 0 && this.lineClearEvents % INTERSTITIAL_EVERY === 0) {
                this.ads!.showInterstitial(() => this.afterPlace());
            } else {
                this.afterPlace();
            }
        });
    }

    private afterPlace(): void {
        if (!this.ui || !this.tray) return;
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
        if (!this.gameActive || this.clearing || !this.ui || !this.tray || !this.board || !this.ads) return;
        this.ads.showRewarded('Watching Ad…', () => {
            const hint = findHint(this.grid, this.pieces);
            if (!hint) {
                this.ui!.showCombo('No hint');
                return;
            }
            const piece = this.pieces[hint.idx]!;
            this.tray!.selectedIdx = hint.idx;
            this.tray!.setTray(this.pieces);
            this.hintCells = ghostCellsAt(piece, hint.r, hint.c);
            this.hintColor = piece.color;
            this.board!.render(this.hintCells, true, piece.color, this.hintCells, piece.color);
            this.ui!.showCombo('HINT!');
            this.scheduleOnce(() => {
                this.board!.render(this.hintCells, true, piece.color);
            }, 1.2);
        });
    }

    private onRevive(): void {
        if (this.reviveUsed || !this.ui || !this.ads) return;
        this.ads.showRewarded('Watching Ad…', () => this.doRevive(), () => this.ui!.showDeadEnd(this.score, this.reviveUsed));
    }

    private doRevive(): void {
        if (!this.ui || !this.tray || !this.board) return;
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
        if (!this.ui) return;
        this.saveBest();
        const isNew = this.score >= this.best;
        this.ui.showGameOver(this.score, this.best, isNew);
        this.gameActive = false;
    }

    private updateScoreUI(): void {
        if (!this.ui) return;
        this.ui.setScore(this.score);
        for (const m of MILESTONES) {
            if (this.score >= m && !this.milestonesHit.has(m)) {
                this.milestonesHit.add(m);
                this.ui.setMilestone('★ Milestone ' + m + '!');
                this.scheduleOnce(() => {
                    if (this.ui && this.ui.milestoneLabel && this.ui.milestoneLabel.string.indexOf(String(m)) >= 0) {
                        this.ui.setMilestone('');
                    }
                }, 2.5);
            }
        }
    }

    private saveBest(): void {
        if (!this.ui) return;
        this.best = WxAdapter.saveBest(this.score);
        this.ui.setBest(this.best);
    }

    private refreshBoard(): void {
        if (!this.board) return;
        this.board.setGrid(this.grid);
        this.board.render(null, false, undefined, this.hintCells, this.hintColor || undefined);
    }
}
