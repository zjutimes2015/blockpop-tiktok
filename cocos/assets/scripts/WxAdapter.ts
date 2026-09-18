import { sys } from 'cc';
import { LS_BEST } from './core/Constants';

/**
 * Minimal typings for the WeChat Mini Game `wx` global.
 * Present at runtime only after a 微信小游戏 build; missing in Creator preview.
 */
export interface WxSystemInfo {
    windowWidth: number;
    windowHeight: number;
    screenWidth?: number;
    screenHeight?: number;
}

export interface WxBannerAd {
    show(): Promise<unknown> | void;
    hide(): void;
    destroy(): void;
    onLoad(cb: () => void): void;
    onError(cb: (err: { errMsg?: string; errCode?: number }) => void): void;
    onResize(cb: (res: { width: number; height: number }) => void): void;
    style: { left: number; top: number; width: number; height?: number };
}

export interface WxInterstitialAd {
    show(): Promise<unknown> | void;
    load(): Promise<unknown> | void;
    destroy(): void;
    onLoad(cb: () => void): void;
    onError(cb: (err: { errMsg?: string; errCode?: number }) => void): void;
    onClose(cb: () => void): void;
}

export interface WxRewardedVideoAd {
    show(): Promise<unknown> | void;
    load(): Promise<unknown> | void;
    destroy(): void;
    onLoad(cb: () => void): void;
    onError(cb: (err: { errMsg?: string; errCode?: number }) => void): void;
    onClose(cb: (res: { isEnded: boolean }) => void): void;
}

export interface WxMiniGame {
    createBannerAd(opts: {
        adUnitId: string;
        adIntervals?: number;
        style: { left: number; top: number; width: number };
    }): WxBannerAd;
    createInterstitialAd(opts: { adUnitId: string }): WxInterstitialAd;
    createRewardedVideoAd(opts: { adUnitId: string }): WxRewardedVideoAd;
    getSystemInfoSync(): WxSystemInfo;
    setStorageSync(key: string, value: string): void;
    getStorageSync(key: string): string;
}

declare const wx: WxMiniGame | undefined;

/**
 * WeChat Mini Game adapter: storage + wx detection.
 * Creator preview / browser uses `sys.localStorage` (HTML5 localStorage).
 */
export class WxAdapter {
    static getWx(): WxMiniGame | null {
        try {
            if (typeof wx !== 'undefined' && wx && typeof wx.getSystemInfoSync === 'function') {
                return wx;
            }
        } catch (e) {
            /* ignore */
        }
        return null;
    }

    static isWeChat(): boolean {
        return !!this.getWx() || sys.platform === sys.Platform.WECHAT_GAME;
    }

    static getStorage(key: string, fallback = ''): string {
        const api = this.getWx();
        if (api && typeof api.getStorageSync === 'function') {
            try {
                const v = api.getStorageSync(key);
                return v == null ? fallback : String(v);
            } catch (e) {
                return fallback;
            }
        }
        try {
            return sys.localStorage.getItem(key) || fallback;
        } catch (e) {
            return fallback;
        }
    }

    static setStorage(key: string, value: string): void {
        const api = this.getWx();
        if (api && typeof api.setStorageSync === 'function') {
            try {
                api.setStorageSync(key, value);
                return;
            } catch (e) {
                /* fall through */
            }
        }
        try {
            sys.localStorage.setItem(key, value);
        } catch (e) {
            /* ignore quota / private mode */
        }
    }

    static loadBest(): number {
        const n = parseInt(this.getStorage(LS_BEST, '0'), 10);
        return Number.isFinite(n) ? n : 0;
    }

    static saveBest(score: number): number {
        const prev = this.loadBest();
        const best = Math.max(prev, score);
        this.setStorage(LS_BEST, String(best));
        return best;
    }

    static getWindowSize(): { width: number; height: number } {
        const api = this.getWx();
        if (api) {
            try {
                const info = api.getSystemInfoSync();
                return { width: info.windowWidth, height: info.windowHeight };
            } catch (e) {
                /* ignore */
            }
        }
        return { width: 375, height: 667 };
    }
}
