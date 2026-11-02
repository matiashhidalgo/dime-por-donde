/**
 * Full screen and «install to the home screen» detection. Everything takes
 * the browser objects as arguments (and tolerates missing pieces), so it is
 * testable without a DOM and never throws.
 */

interface FsElement {
  requestFullscreen?: (opts?: { navigationUI?: "auto" | "hide" | "show" }) => Promise<void> | void;
  webkitRequestFullscreen?: () => Promise<void> | void;
  msRequestFullscreen?: () => Promise<void> | void;
}
interface FsDocument {
  fullscreenEnabled?: boolean;
  webkitFullscreenEnabled?: boolean;
  fullscreenElement?: Element | null;
  webkitFullscreenElement?: Element | null;
  exitFullscreen?: () => Promise<void> | void;
  webkitExitFullscreen?: () => Promise<void> | void;
  documentElement?: FsElement;
}

/** True where a page can ask for full screen (Android Chrome, desktop, iPad; not iPhone Safari). */
export function fullscreenSupported(doc: FsDocument | undefined): boolean {
  if (!doc) return false;
  const el = doc.documentElement;
  const can = !!(el && (el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen));
  if (!can) return false;
  // `false` means blocked (e.g. by an iframe policy); undefined means «not reported».
  return doc.fullscreenEnabled !== false && doc.webkitFullscreenEnabled !== false;
}

export function isFullscreen(doc: FsDocument | undefined): boolean {
  return !!(doc && (doc.fullscreenElement || doc.webkitFullscreenElement));
}

/** Enters full screen; resolves false (never throws) if the browser refuses. */
export async function enterFullscreen(doc: FsDocument | undefined): Promise<boolean> {
  try {
    const el = doc?.documentElement;
    if (!el) return false;
    const fn = el.requestFullscreen ?? el.webkitRequestFullscreen ?? el.msRequestFullscreen;
    if (!fn) return false;
    await fn.call(el, { navigationUI: "hide" });
    return true;
  } catch {
    return false;
  }
}

export async function exitFullscreen(doc: FsDocument | undefined): Promise<boolean> {
  try {
    if (!doc) return false;
    const fn = doc.exitFullscreen ?? doc.webkitExitFullscreen;
    if (!fn) return false;
    await fn.call(doc);
    return true;
  } catch {
    return false;
  }
}

export interface NavigatorLike {
  userAgent?: string;
  platform?: string;
  maxTouchPoints?: number;
  standalone?: boolean;
}

/** iPhone, iPod or iPad (iPadOS 13+ says «Macintosh» but has a touch screen). */
export function isIOS(nav: NavigatorLike | undefined): boolean {
  if (!nav) return false;
  const ua = nav.userAgent ?? "";
  if (/iPhone|iPad|iPod/.test(ua)) return true;
  return nav.platform === "MacIntel" && (nav.maxTouchPoints ?? 0) > 1;
}

/** Running from the home screen already (iOS flag or the display-mode media query). */
export function isStandalone(nav: NavigatorLike | undefined, matches: (q: string) => boolean): boolean {
  try {
    if (nav?.standalone === true) return true;
    return matches("(display-mode: standalone)") || matches("(display-mode: fullscreen)") || matches("(display-mode: minimal-ui)");
  } catch {
    return false;
  }
}

/**
 * The «Agregar a pantalla de inicio» help: only where the page can't go full
 * screen by itself (iPhone Safari), isn't installed yet, and was never shown.
 */
export function shouldShowInstallHelp(o: { ios: boolean; fullscreen: boolean; standalone: boolean; seen: boolean }): boolean {
  return o.ios && !o.fullscreen && !o.standalone && !o.seen;
}
