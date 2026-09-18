import { _decorator, Component } from 'cc';
import { AD_UNIT, SIM_INTERSTITIAL_SECONDS, SIM_REWARD_SECONDS } from './core/AdConfig';
import { WxAdapter, type WxBannerAd, type WxInterstitialAd, type WxRewardedVideoAd } from './WxAdapter';

const { ccclass } = _decorator;

export interface AdHost {
    showBannerStub(): void;
    hideBannerStub(): void;
    showRewardedSim(seconds: number, title: string, onDone: (ended: boolean) => void): void;
    showInterstitialSim(seconds: number, onDone: () => void): void;
}

/**
 * WeChat IAA bridge.
 * Uses wx.createBannerAd / createInterstitialAd / createRewardedVideoAd when `wx` exists,
 * otherwise runs the in-game simulated countdown stubs (Creator preview / browser).
 */
@ccclass('AdBridge')
export class AdBridge extends Component {
    public host: AdHost | null = null;

    private _banner: WxBannerAd | null = null;
    private _interstitial: WxInterstitialAd | null = null;
    private _rewarded: WxRewardedVideoAd | null = null;
    private _rewardedHandler: ((res: { isEnded: boolean }) => void) | null = null;
    private _interstitialHandler: (() => void) | null = null;

    public init(host: AdHost): void {
        this.host = host;
        this.setupWxAds();
        this.showBanner();
    }

    public showBanner(): void {
        if (this._banner) {
            Promise.resolve(this._banner.show()).catch(() => {
                this.host?.showBannerStub();
            });
            return;
        }
        this.host?.showBannerStub();
    }

    public hideBanner(): void {
        if (this._banner) {
            try {
                this._banner.hide();
            } catch (e) {
                /* ignore */
            }
        }
        this.host?.hideBannerStub();
    }

    /**
     * Interstitial after every N line-clear events.
     * wx.createInterstitialAd
     */
    public showInterstitial(onDone: () => void): void {
        const wx = WxAdapter.getWx();
        if (wx && this._interstitial) {
            this._interstitialHandler = onDone;
            Promise.resolve(this._interstitial.show()).catch(() => {
                Promise.resolve(this._interstitial!.load())
                    .then(() => this._interstitial!.show())
                    .catch(() => this.host?.showInterstitialSim(SIM_INTERSTITIAL_SECONDS, onDone));
            });
            return;
        }
        this.host?.showInterstitialSim(SIM_INTERSTITIAL_SECONDS, onDone);
    }

    /**
     * Rewarded video for revive / hint.
     * wx.createRewardedVideoAd
     */
    public showRewarded(title: string, onSuccess: () => void, onSkip?: () => void): void {
        const wx = WxAdapter.getWx();
        if (wx && this._rewarded) {
            this._rewardedHandler = (res) => {
                if (res && res.isEnded) onSuccess();
                else if (onSkip) onSkip();
            };
            Promise.resolve(this._rewarded.show()).catch(() => {
                Promise.resolve(this._rewarded!.load())
                    .then(() => this._rewarded!.show())
                    .catch(() => this.host?.showRewardedSim(SIM_REWARD_SECONDS, title, (ended) => {
                        if (ended) onSuccess();
                        else if (onSkip) onSkip();
                    }));
            });
            return;
        }
        this.host?.showRewardedSim(SIM_REWARD_SECONDS, title, (ended) => {
            if (ended) onSuccess();
            else if (onSkip) onSkip();
        });
    }

    private setupWxAds(): void {
        const wx = WxAdapter.getWx();
        if (!wx) return;

        try {
            // wx.createBannerAd
            const size = WxAdapter.getWindowSize();
            this._banner = wx.createBannerAd({
                adUnitId: AD_UNIT.banner,
                adIntervals: 30,
                style: {
                    left: 0,
                    top: size.height - 80,
                    width: Math.min(360, size.width),
                },
            });
            this._banner.onLoad(() => this.host?.hideBannerStub());
            this._banner.onError((err) => {
                console.warn('[AdBridge] banner error', err);
                this.host?.showBannerStub();
            });
            this._banner.onResize((res) => {
                const win = WxAdapter.getWindowSize();
                this._banner!.style.top = win.height - res.height;
                this._banner!.style.left = (win.width - res.width) / 2;
            });
        } catch (e) {
            console.warn('[AdBridge] createBannerAd failed', e);
        }

        try {
            // wx.createInterstitialAd
            this._interstitial = wx.createInterstitialAd({ adUnitId: AD_UNIT.interstitial });
            this._interstitial.onError((err) => console.warn('[AdBridge] interstitial error', err));
            this._interstitial.onClose(() => {
                const cb = this._interstitialHandler;
                this._interstitialHandler = null;
                if (cb) cb();
            });
        } catch (e) {
            console.warn('[AdBridge] createInterstitialAd failed', e);
        }

        try {
            // wx.createRewardedVideoAd
            this._rewarded = wx.createRewardedVideoAd({ adUnitId: AD_UNIT.rewarded });
            this._rewarded.onError((err) => console.warn('[AdBridge] rewarded error', err));
            this._rewarded.onClose((res) => {
                const cb = this._rewardedHandler;
                this._rewardedHandler = null;
                if (cb) cb(res || { isEnded: false });
            });
        } catch (e) {
            console.warn('[AdBridge] createRewardedVideoAd failed', e);
        }
    }

    onDestroy(): void {
        try {
            this._banner?.destroy();
        } catch (e) { /* ignore */ }
        try {
            this._interstitial?.destroy();
        } catch (e) { /* ignore */ }
        try {
            this._rewarded?.destroy();
        } catch (e) { /* ignore */ }
    }
}
