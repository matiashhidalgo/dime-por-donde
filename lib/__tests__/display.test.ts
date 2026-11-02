import { describe, expect, it, vi } from "vitest";
import { enterFullscreen, exitFullscreen, fullscreenSupported, isFullscreen, isIOS, isStandalone, shouldShowInstallHelp } from "../display";

const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1";
const ANDROID = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36";

describe("fullscreenSupported", () => {
  it("standard, prefixed and missing APIs", () => {
    expect(fullscreenSupported({ documentElement: { requestFullscreen: () => {} }, fullscreenEnabled: true })).toBe(true);
    expect(fullscreenSupported({ documentElement: { webkitRequestFullscreen: () => {} } })).toBe(true);
    expect(fullscreenSupported({ documentElement: {} })).toBe(false); // iPhone Safari
    expect(fullscreenSupported(undefined)).toBe(false);
  });
  it("respects a policy that blocks it", () => {
    expect(fullscreenSupported({ documentElement: { requestFullscreen: () => {} }, fullscreenEnabled: false })).toBe(false);
  });
});

describe("isFullscreen / enter / exit", () => {
  it("reads either prefix", () => {
    expect(isFullscreen({ fullscreenElement: {} as Element })).toBe(true);
    expect(isFullscreen({ webkitFullscreenElement: {} as Element })).toBe(true);
    expect(isFullscreen({ fullscreenElement: null })).toBe(false);
  });
  it("enter calls the available method; refusal and throws become false", async () => {
    const ok = vi.fn().mockResolvedValue(undefined);
    expect(await enterFullscreen({ documentElement: { requestFullscreen: ok } })).toBe(true);
    expect(ok).toHaveBeenCalled();
    const prefixed = vi.fn();
    expect(await enterFullscreen({ documentElement: { webkitRequestFullscreen: prefixed } })).toBe(true);
    expect(prefixed).toHaveBeenCalled();
    expect(await enterFullscreen({ documentElement: { requestFullscreen: () => Promise.reject(new Error("denied")) } })).toBe(false);
    expect(await enterFullscreen({ documentElement: { requestFullscreen: () => { throw new Error("sync"); } } })).toBe(false);
    expect(await enterFullscreen({ documentElement: {} })).toBe(false);
  });
  it("exit works the same way", async () => {
    const out = vi.fn();
    expect(await exitFullscreen({ webkitExitFullscreen: out })).toBe(true);
    expect(out).toHaveBeenCalled();
    expect(await exitFullscreen({ exitFullscreen: () => Promise.reject(new Error("x")) })).toBe(false);
    expect(await exitFullscreen({})).toBe(false);
  });
});

describe("isIOS / isStandalone", () => {
  it("detects iPhone, iPad and iPadOS-as-Mac; not Android or desktop", () => {
    expect(isIOS({ userAgent: IPHONE })).toBe(true);
    expect(isIOS({ userAgent: "Macintosh", platform: "MacIntel", maxTouchPoints: 5 })).toBe(true);
    expect(isIOS({ userAgent: "Macintosh", platform: "MacIntel", maxTouchPoints: 0 })).toBe(false);
    expect(isIOS({ userAgent: ANDROID })).toBe(false);
    expect(isIOS(undefined)).toBe(false);
  });
  it("standalone via navigator.standalone or display-mode", () => {
    expect(isStandalone({ standalone: true }, () => false)).toBe(true);
    expect(isStandalone({}, (q) => q === "(display-mode: standalone)")).toBe(true);
    expect(isStandalone({}, (q) => q === "(display-mode: fullscreen)")).toBe(true);
    expect(isStandalone({ standalone: false }, () => false)).toBe(false);
    expect(isStandalone({}, () => { throw new Error("no matchMedia"); })).toBe(false);
  });
});

describe("shouldShowInstallHelp", () => {
  it("only on iPhone-like browsers without fullscreen, not installed, not seen", () => {
    const base = { ios: true, fullscreen: false, standalone: false, seen: false };
    expect(shouldShowInstallHelp(base)).toBe(true);
    expect(shouldShowInstallHelp({ ...base, ios: false })).toBe(false);
    expect(shouldShowInstallHelp({ ...base, fullscreen: true })).toBe(false); // iPad
    expect(shouldShowInstallHelp({ ...base, standalone: true })).toBe(false);
    expect(shouldShowInstallHelp({ ...base, seen: true })).toBe(false);
  });
});
