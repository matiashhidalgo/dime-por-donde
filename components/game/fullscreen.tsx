"use client";

import { useCallback, useEffect, useState } from "react";
import { Maximize, Minimize, Share, SquarePlus, X } from "lucide-react";
import { enterFullscreen, exitFullscreen, fullscreenSupported, isFullscreen, isIOS, isStandalone, shouldShowInstallHelp } from "@/lib/display";
import { readJSON, writeJSON } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { Button } from "./ui";

/**
 * Full screen for phones. Where the Fullscreen API exists (Android Chrome,
 * desktop, iPad) the header gets a «Pantalla completa» button that turns into
 * «Salir» and follows `fullscreenchange`. On iPhone Safari pages can't go full
 * screen, so there's no button: a one-time help explains «Agregar a pantalla
 * de inicio» (the manifest then opens the game without browser bars).
 */

type FsState = { ready: boolean; supported: boolean; active: boolean };

export function useFullscreen(): FsState & { toggle: () => void } {
  const [st, setSt] = useState<FsState>({ ready: false, supported: false, active: false });
  useEffect(() => {
    const read = () => setSt({ ready: true, supported: fullscreenSupported(document), active: isFullscreen(document) });
    read();
    // Both spellings: Safari (iPad) still fires the prefixed one.
    document.addEventListener("fullscreenchange", read);
    document.addEventListener("webkitfullscreenchange", read);
    return () => {
      document.removeEventListener("fullscreenchange", read);
      document.removeEventListener("webkitfullscreenchange", read);
    };
  }, []);
  const toggle = useCallback(() => {
    void (isFullscreen(document) ? exitFullscreen(document) : enterFullscreen(document));
  }, []);
  return { ...st, toggle };
}

/** Header button. Renders nothing where full screen isn't available. */
export function FullscreenButton({ className }: { className?: string }) {
  const { supported, active, toggle } = useFullscreen();
  if (!supported) return null;
  const Icon = active ? Minimize : Maximize;
  const label = active ? "Salir de pantalla completa" : "Pantalla completa";
  return (
    <button
      onClick={toggle}
      aria-label={label}
      title={label}
      className={cn("flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-full border border-border px-3 text-sm hover:bg-border/40", className)}
    >
      <Icon size={18} aria-hidden />
      <span className="hidden sm:inline">{active ? "Salir" : "Pantalla completa"}</span>
    </button>
  );
}

const INSTALL_KEY = "laberinto.install-help.v1";

/** True once the help should be on screen (decided on the client, after hydration). */
export function useInstallHelp(): [boolean, () => void] {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const nav = navigator as Navigator & { standalone?: boolean };
    const should = shouldShowInstallHelp({
      ios: isIOS(nav),
      fullscreen: fullscreenSupported(document),
      standalone: isStandalone(nav, (q) => window.matchMedia(q).matches),
      seen: readJSON<boolean>(INSTALL_KEY, false) === true,
    });
    if (!should) return;
    // Remembered as soon as it appears: «una vez» means once, even if they never tap the button.
    writeJSON(INSTALL_KEY, true);
    setShow(true);
  }, []);
  return [show, () => setShow(false)];
}

/**
 * The iPhone help: three steps. Not a name for anything in the game, only the
 * browser's own controls, drawn with icons.
 */
export function InstallHelp({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [onClose]);
  const steps = [
    { icon: <Share size={20} aria-hidden />, text: "En Safari, toca el botón Compartir, en la barra de abajo." },
    { icon: <SquarePlus size={20} aria-hidden />, text: "Elige «Agregar a pantalla de inicio»." },
    { icon: <Maximize size={20} aria-hidden />, text: "Abre el juego desde su ícono nuevo: se ve sin barras del navegador." },
  ];
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/45 p-3 sm:items-center" onPointerDown={(e) => e.stopPropagation()}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="install-title"
        className="w-full max-w-sm rounded-3xl border border-border bg-card p-5 shadow-2xl pb-[max(1.25rem,env(safe-area-inset-bottom))]"
      >
        <div className="flex items-start gap-2">
          <h2 id="install-title" className="flex-1 font-display text-2xl leading-tight">
            Juega a pantalla completa
          </h2>
          <button onClick={onClose} aria-label="Cerrar la ayuda" className="-mr-2 -mt-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full hover:bg-border/50">
            <X size={20} />
          </button>
        </div>
        <p className="mt-1 text-sm text-muted">El iPhone no deja que una página ocupe toda la pantalla, pero se puede instalar en el inicio. Son tres toques.</p>
        <ol className="mt-4 space-y-3">
          {steps.map((s, i) => (
            <li key={i} className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-accent-2/12 text-accent-2" aria-hidden>
                {s.icon}
              </span>
              <span className="text-sm">
                <span className="mr-1.5 font-semibold text-muted">{i + 1}.</span>
                {s.text}
              </span>
            </li>
          ))}
        </ol>
        <Button className="mt-5 w-full" onClick={onClose} autoFocus>
          Entendido
        </Button>
      </div>
    </div>
  );
}
