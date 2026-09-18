import { _decorator, Color, Component, Graphics, Label, Node, Tween, tween, UIOpacity, Vec3, Widget } from 'cc';
import type { AdHost } from './AdBridge';
import {
    BANNER_HEIGHT,
    COLOR_BG,
    COLOR_BG_MID,
    COLOR_GOLD,
    COLOR_HOWTO,
    COLOR_LABEL,
    COLOR_MINT,
    COLOR_MUTED,
    COLOR_PINK,
    COLOR_TEXT,
    DESIGN_HEIGHT,
    DESIGN_WIDTH,
} from './core/Constants';
import type { ScreenName } from './core/Types';
import {
    alignBottomBar,
    alignFull,
    alignTopBar,
    blockInput,
    createButton,
    createLabel,
    createNode,
    fillRoundRect,
    hexToColor,
    paintPanel,
    setActive,
    setOpacity,
} from './ui/UiFactory';

const { ccclass } = _decorator;

export interface UICallbacks {
    onPlay(): void;
    onHint(): void;
    onRevive(): void;
    onEndRun(): void;
    onAgain(): void;
    onHome(): void;
}

@ccclass('UIManager')
export class UIManager extends Component implements AdHost {
    public root: Node | null = null;
    public gameLayer: Node | null = null;
    public hudLayer: Node | null = null;
    public trayHost: Node | null = null;
    public boardHost: Node | null = null;
    public overlayLayer: Node | null = null;
    public particleLayer: Node | null = null;

    public scoreLabel: Label | null = null;
    public bestHudLabel: Label | null = null;
    public bestStartLabel: Label | null = null;
    public milestoneLabel: Label | null = null;
    public comboLabel: Label | null = null;
    public deadScoreLabel: Label | null = null;
    public reviveNoteLabel: Label | null = null;
    public goScoreLabel: Label | null = null;
    public goBestLabel: Label | null = null;
    public interCountLabel: Label | null = null;
    public rewardCountLabel: Label | null = null;
    public rewardTitleLabel: Label | null = null;

    public startScreen: Node | null = null;
    public gameScreen: Node | null = null;
    public deadend: Node | null = null;
    public gameover: Node | null = null;
    public interstitial: Node | null = null;
    public rewarded: Node | null = null;
    public banner: Node | null = null;
    public reviveBtn: Node | null = null;
    public interContinue: Node | null = null;

    public callbacks: UICallbacks | null = null;

    private _interTimer = 0;
    private _rewardTimer = 0;

    public build(canvas: Node): void {
        this.root = canvas;
        this.paintBackground(canvas);

        this.gameScreen = createNode('GameScreen', canvas, DESIGN_WIDTH, DESIGN_HEIGHT);
        alignFull(this.gameScreen);
        this.hudLayer = createNode('HUD', this.gameScreen, DESIGN_WIDTH - 32, 120);
        alignTopBar(this.hudLayer, 16, 16, 16, 120);
        this.buildHud(this.hudLayer);

        this.boardHost = createNode('BoardHost', this.gameScreen, 640, 640);
        const boardWidget = this.boardHost.addComponent(Widget);
        boardWidget.isAlignTop = true;
        boardWidget.isAlignBottom = true;
        boardWidget.isAlignLeft = true;
        boardWidget.isAlignRight = true;
        boardWidget.top = 140;
        boardWidget.bottom = BANNER_HEIGHT + 148;
        boardWidget.left = 36;
        boardWidget.right = 36;
        boardWidget.alignMode = Widget.AlignMode.ALWAYS;
        boardWidget.updateAlignment();

        this.trayHost = createNode('TrayHost', this.gameScreen, DESIGN_WIDTH - 24, 130);
        alignBottomBar(this.trayHost, BANNER_HEIGHT + 8, 12, 12, 130);
        createLabel('TrayLabel', this.trayHost, 'YOUR BLOCKS', 16, hexToColor(COLOR_LABEL), 300, 22, true).node.setPosition(0, 52, 0);

        this.comboLabel = createLabel('Combo', this.gameScreen, '', 44, hexToColor(COLOR_GOLD), 500, 60, true);
        this.comboLabel.node.setPosition(0, 220, 0);
        setOpacity(this.comboLabel.node, 0);

        this.particleLayer = createNode('Particles', canvas, DESIGN_WIDTH, DESIGN_HEIGHT);
        alignFull(this.particleLayer);

        this.startScreen = createNode('StartScreen', canvas, DESIGN_WIDTH, DESIGN_HEIGHT);
        alignFull(this.startScreen);
        this.buildStart(this.startScreen);

        this.overlayLayer = createNode('Overlays', canvas, DESIGN_WIDTH, DESIGN_HEIGHT);
        alignFull(this.overlayLayer);

        this.deadend = this.makeOverlay('DeadEnd');
        this.buildDeadend(this.deadend);
        this.interstitial = this.makeOverlay('Interstitial');
        this.buildInterstitial(this.interstitial);
        this.rewarded = this.makeOverlay('Rewarded');
        this.buildRewarded(this.rewarded);
        this.gameover = this.makeOverlay('GameOver');
        this.buildGameover(this.gameover);

        this.banner = createNode('Banner', canvas, DESIGN_WIDTH, BANNER_HEIGHT);
        alignBottomBar(this.banner, 0, 0, 0, BANNER_HEIGHT);
        paintPanel(this.banner, hexToColor('#555555'), 0);
        createLabel('BannerTxt', this.banner, 'Ad · Banner', 18, hexToColor('#bbbbbb'), DESIGN_WIDTH, 40, true);

        this.showScreen('start');
    }

    public showScreen(name: ScreenName | 'none'): void {
        setActive(this.startScreen!, name === 'start');
        setActive(this.gameScreen!, name === 'game' || name === 'deadend' || name === 'gameover' || name === 'interstitial' || name === 'rewarded');
        setActive(this.deadend!, name === 'deadend');
        setActive(this.gameover!, name === 'gameover');
        setActive(this.interstitial!, name === 'interstitial');
        setActive(this.rewarded!, name === 'rewarded');
    }

    public setScore(score: number): void {
        if (this.scoreLabel) this.scoreLabel.string = String(score);
    }

    public setBest(best: number): void {
        if (this.bestHudLabel) this.bestHudLabel.string = 'Best ' + best;
        if (this.bestStartLabel) this.bestStartLabel.string = 'Best: ' + best;
    }

    public setMilestone(text: string): void {
        if (this.milestoneLabel) this.milestoneLabel.string = text;
    }

    public showCombo(text: string): void {
        if (!this.comboLabel) return;
        const node = this.comboLabel.node;
        this.comboLabel.string = text;
        Tween.stopAllByTarget(node);
        const existingOp = node.getComponent(UIOpacity);
        if (existingOp) Tween.stopAllByTarget(existingOp);
        node.setScale(0.5, 0.5, 1);
        node.setPosition(0, 200, 0);
        const op = setOpacity(node, 0);
        tween(op).to(0.18, { opacity: 255 }).delay(0.45).to(0.28, { opacity: 0 }).start();
        tween(node)
            .to(0.18, { scale: new Vec3(1.2, 1.2, 1) })
            .to(0.2, { scale: new Vec3(1, 1, 1) })
            .to(0.45, { position: new Vec3(0, 250, 0) })
            .start();
    }

    public showDeadEnd(score: number, reviveUsed: boolean): void {
        if (this.deadScoreLabel) this.deadScoreLabel.string = String(score);
        if (this.reviveBtn) this.reviveBtn.active = !reviveUsed;
        if (this.reviveNoteLabel) {
            this.reviveNoteLabel.string = reviveUsed
                ? 'Revive already used this run. End Run to try again.'
                : 'Watch an ad to shuffle your tray and keep going (1 per run)';
        }
        this.showScreen('deadend');
    }

    public showGameOver(score: number, best: number, isNew: boolean): void {
        if (this.goScoreLabel) this.goScoreLabel.string = String(score);
        if (this.goBestLabel) this.goBestLabel.string = isNew ? 'New best!' : 'Best: ' + best;
        this.showScreen('gameover');
    }

    public showBannerStub(): void {
        if (this.banner) this.banner.active = true;
    }

    public hideBannerStub(): void {
        if (this.banner) this.banner.active = false;
    }

    public showRewardedSim(seconds: number, title: string, onDone: (ended: boolean) => void): void {
        this.unschedule(this._tickReward);
        if (this.rewardTitleLabel) this.rewardTitleLabel.string = title || 'Watching Ad…';
        this.showScreen('rewarded');
        let n = seconds;
        if (this.rewardCountLabel) this.rewardCountLabel.string = String(n);
        this._rewardTimer = n;
        const tick = () => {
            this._rewardTimer -= 1;
            if (this.rewardCountLabel) this.rewardCountLabel.string = String(Math.max(0, this._rewardTimer));
            if (this._rewardTimer <= 0) {
                this.unschedule(tick);
                this.rewarded!.active = false;
                onDone(true);
            }
        };
        this._tickReward = tick;
        this.schedule(tick, 1);
    }

    public showInterstitialSim(seconds: number, onDone: () => void): void {
        this.unschedule(this._tickInter);
        this.showScreen('interstitial');
        let n = seconds;
        if (this.interCountLabel) this.interCountLabel.string = String(n);
        if (this.interContinue) {
            this.interContinue.active = true;
            setOpacity(this.interContinue, 120);
        }
        this._onInterDone = onDone;
        this._interLocked = true;
        this._interTimer = n;
        const tick = () => {
            this._interTimer -= 1;
            if (this.interCountLabel) this.interCountLabel.string = String(Math.max(0, this._interTimer));
            if (this._interTimer <= 0) {
                this.unschedule(tick);
                this._interLocked = false;
                if (this.interContinue) setOpacity(this.interContinue, 255);
            }
        };
        this._tickInter = tick;
        this.schedule(tick, 1);
    }

    private _tickReward: () => void = () => { /* set later */ };
    private _tickInter: () => void = () => { /* set later */ };
    private _onInterDone: (() => void) | null = null;
    private _interLocked = true;

    private paintBackground(canvas: Node): void {
        const bg = createNode('Background', canvas, DESIGN_WIDTH, DESIGN_HEIGHT);
        alignFull(bg);
        bg.setSiblingIndex(0);
        const g = bg.addComponent(Graphics);
        g.clear();
        fillRoundRect(g, -DESIGN_WIDTH / 2, 0, DESIGN_WIDTH, DESIGN_HEIGHT / 2, 0, hexToColor(COLOR_BG_MID));
        fillRoundRect(g, -DESIGN_WIDTH / 2, -DESIGN_HEIGHT / 2, DESIGN_WIDTH, DESIGN_HEIGHT / 2, 0, hexToColor(COLOR_BG));
        // extra top wash
        fillRoundRect(g, -DESIGN_WIDTH / 2, DESIGN_HEIGHT / 2 - 280, DESIGN_WIDTH, 280, 0, hexToColor(COLOR_BG));
    }

    private buildHud(hud: Node): void {
        const left = createNode('ScoreBox', hud, 360, 110);
        left.setPosition(-140, 0, 0);
        createLabel('ScoreLbl', left, 'SCORE', 16, hexToColor(COLOR_LABEL), 200, 22, true).node.setPosition(-80, 36, 0);
        this.scoreLabel = createLabel('Score', left, '0', 48, hexToColor(COLOR_TEXT), 280, 52, true);
        this.scoreLabel.horizontalAlign = Label.HorizontalAlign.LEFT;
        this.scoreLabel.node.setPosition(0, 4, 0);
        this.bestHudLabel = createLabel('BestMini', left, 'Best 0', 18, hexToColor(COLOR_GOLD), 280, 24, false);
        this.bestHudLabel.horizontalAlign = Label.HorizontalAlign.LEFT;
        this.bestHudLabel.node.setPosition(0, -32, 0);
        this.milestoneLabel = createLabel('Milestone', left, '', 16, hexToColor(COLOR_MINT), 280, 22, false);
        this.milestoneLabel.horizontalAlign = Label.HorizontalAlign.LEFT;
        this.milestoneLabel.node.setPosition(0, -52, 0);

        const hint = createButton(
            'Hint',
            hud,
            {
                width: 150,
                height: 48,
                fill: hexToColor('#4dffc4', 28),
                label: 'Hint',
                fontSize: 22,
                textColor: hexToColor(COLOR_MINT),
                radius: 14,
                stroke: hexToColor(COLOR_MINT, 90),
            },
            () => this.callbacks?.onHint(),
        );
        hint.setPosition(240, 10, 0);
    }

    private buildStart(root: Node): void {
        blockInput(root);
        const dim = root.addComponent(Graphics);
        fillRoundRect(dim, -DESIGN_WIDTH / 2, -DESIGN_HEIGHT / 2, DESIGN_WIDTH, DESIGN_HEIGHT, 0, hexToColor(COLOR_BG, 0));

        const logo = createLabel('Logo', root, 'BlockPop', 72, hexToColor(COLOR_PINK), 640, 90, true);
        logo.node.setPosition(0, 360, 0);
        const tag = createLabel('Tag', root, 'Drop. Clear. One more round.', 24, hexToColor(COLOR_MUTED), 620, 36, false);
        tag.node.setPosition(0, 292, 0);

        const how = createNode('HowTo', root, 560, 220);
        how.setPosition(0, 110, 0);
        paintPanel(how, hexToColor('#ffffff', 16), 16);
        const howLbl = createLabel(
            'HowTxt',
            how,
            'How to play:\n1. Pick a colorful block from the tray\n2. Tap (or drag) to place it on the board\n3. Fill a full row or column → clear & score!\n4. Combos multiply your points. Don\'t get stuck!',
            22,
            hexToColor(COLOR_HOWTO),
            520,
            200,
            false,
        );
        howLbl.horizontalAlign = Label.HorizontalAlign.LEFT;
        howLbl.verticalAlign = Label.VerticalAlign.CENTER;

        const play = createButton(
            'Play',
            root,
            {
                width: 420,
                height: 72,
                fill: hexToColor('#c44dff'),
                label: 'Play',
                fontSize: 32,
                textColor: Color.WHITE,
                radius: 18,
            },
            () => this.callbacks?.onPlay(),
        );
        paintPanel(play, hexToColor('#ff6b9d'), 18);
        // re-draw gradient-ish: pink over purple already; add a second wash
        const g = play.getComponent(Graphics);
        if (g) {
            g.clear();
            fillRoundRect(g, -210, -36, 420, 72, 18, hexToColor('#ff6b9d'));
        }
        this.relabel(play, 'Play', 32);
        play.setPosition(0, -80, 0);

        this.bestStartLabel = createLabel('StartBest', root, 'Best: 0', 22, hexToColor(COLOR_GOLD), 400, 32, true);
        this.bestStartLabel.node.setPosition(0, -160, 0);
    }

    private buildDeadend(root: Node): void {
        createLabel('H', root, 'No moves!', 48, Color.WHITE, 560, 60, true).node.setPosition(0, 180, 0);
        const p = createLabel('P', root, 'Score:', 24, hexToColor(COLOR_MUTED), 400, 32, false);
        p.node.setPosition(-40, 110, 0);
        this.deadScoreLabel = createLabel('DS', root, '0', 28, Color.WHITE, 200, 36, true);
        this.deadScoreLabel.node.setPosition(70, 110, 0);
        this.reviveNoteLabel = createLabel(
            'Note',
            root,
            'Watch an ad to shuffle your tray and keep going (1 per run)',
            20,
            hexToColor(COLOR_GOLD),
            560,
            70,
            false,
        );
        this.reviveNoteLabel.node.setPosition(0, 50, 0);

        this.reviveBtn = createButton(
            'Revive',
            root,
            {
                width: 460,
                height: 70,
                fill: hexToColor('#ff9a3c'),
                label: 'Watch Ad to Revive',
                fontSize: 26,
                textColor: hexToColor('#2a1500'),
                radius: 16,
            },
            () => this.callbacks?.onRevive(),
        );
        this.reviveBtn.setPosition(0, -40, 0);

        const end = createButton(
            'EndRun',
            root,
            {
                width: 460,
                height: 64,
                fill: hexToColor('#ffffff', 28),
                label: 'End Run',
                fontSize: 24,
                textColor: hexToColor('#e8d8ff'),
                radius: 16,
                stroke: hexToColor('#ffffff', 40),
            },
            () => this.callbacks?.onEndRun(),
        );
        end.setPosition(0, -130, 0);
    }

    private buildInterstitial(root: Node): void {
        const tag = createNode('AdTag', root, 220, 32);
        tag.setPosition(0, 220, 0);
        paintPanel(tag, hexToColor('#666666'), 8);
        createLabel('T', tag, 'Ad · Interstitial', 16, hexToColor('#cccccc'), 210, 28, true);
        createLabel('H', root, 'Quick Break', 44, Color.WHITE, 560, 56, true).node.setPosition(0, 150, 0);
        createLabel('P', root, 'Thanks for playing BlockPop!', 22, hexToColor(COLOR_MUTED), 560, 40, false).node.setPosition(0, 90, 0);
        this.interCountLabel = createLabel('Count', root, '2', 72, hexToColor(COLOR_GOLD), 200, 90, true);
        this.interCountLabel.node.setPosition(0, 10, 0);
        this.interContinue = createButton(
            'Continue',
            root,
            {
                width: 420,
                height: 70,
                fill: hexToColor('#ff6b9d'),
                label: 'Continue',
                fontSize: 28,
                radius: 16,
            },
            () => {
                if (this._interLocked) return;
                this.interstitial!.active = false;
                const cb = this._onInterDone;
                this._onInterDone = null;
                if (cb) cb();
            },
        );
        this.interContinue.setPosition(0, -120, 0);
    }

    private buildRewarded(root: Node): void {
        const tag = createNode('AdTag', root, 240, 32);
        tag.setPosition(0, 200, 0);
        paintPanel(tag, hexToColor('#666666'), 8);
        createLabel('T', tag, 'Ad · Rewarded Video', 16, hexToColor('#cccccc'), 230, 28, true);
        this.rewardTitleLabel = createLabel('H', root, 'Watching Ad…', 40, Color.WHITE, 560, 50, true);
        this.rewardTitleLabel.node.setPosition(0, 120, 0);
        this.rewardCountLabel = createLabel('Count', root, '3', 72, hexToColor(COLOR_GOLD), 200, 90, true);
        this.rewardCountLabel.node.setPosition(0, 20, 0);
    }

    private buildGameover(root: Node): void {
        createLabel('H', root, 'Game Over', 48, Color.WHITE, 560, 60, true).node.setPosition(0, 180, 0);
        const p = createLabel('P', root, 'Score:', 24, hexToColor(COLOR_MUTED), 400, 32, false);
        p.node.setPosition(-40, 100, 0);
        this.goScoreLabel = createLabel('GS', root, '0', 28, Color.WHITE, 200, 36, true);
        this.goScoreLabel.node.setPosition(70, 100, 0);
        this.goBestLabel = createLabel('GB', root, '', 22, hexToColor(COLOR_GOLD), 400, 32, true);
        this.goBestLabel.node.setPosition(0, 50, 0);

        const again = createButton(
            'Again',
            root,
            {
                width: 420,
                height: 70,
                fill: hexToColor('#ff6b9d'),
                label: 'Try Again',
                fontSize: 28,
                radius: 16,
            },
            () => this.callbacks?.onAgain(),
        );
        again.setPosition(0, -40, 0);

        const home = createButton(
            'Home',
            root,
            {
                width: 420,
                height: 64,
                fill: hexToColor('#ffffff', 28),
                label: 'Home',
                fontSize: 24,
                textColor: hexToColor('#e8d8ff'),
                radius: 16,
                stroke: hexToColor('#ffffff', 40),
            },
            () => this.callbacks?.onHome(),
        );
        home.setPosition(0, -130, 0);
    }

    private makeOverlay(name: string): Node {
        const n = createNode(name, this.overlayLayer!, DESIGN_WIDTH, DESIGN_HEIGHT);
        alignFull(n);
        blockInput(n);
        const g = n.addComponent(Graphics);
        fillRoundRect(g, -DESIGN_WIDTH / 2, -DESIGN_HEIGHT / 2, DESIGN_WIDTH, DESIGN_HEIGHT, 0, hexToColor('#0a0514', 225));
        n.active = false;
        return n;
    }

    private relabel(btn: Node, text: string, size: number): void {
        const lab = btn.getComponentInChildren(Label);
        if (lab) {
            lab.string = text;
            lab.fontSize = size;
        }
    }
}
