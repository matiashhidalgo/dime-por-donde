"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { type RelayState, THEMES, createCode } from "@/src/engine";
import { track } from "@/lib/analytics";
import { audio, installAudioUnlock } from "@/lib/audio";
import { cryptoRandom, useWakeLock } from "@/lib/hooks";
import { type Role, newEntryId, playedCodes, saveEntry, saveStreak } from "@/lib/history";
import { ExplorerView } from "./explorer/explorer-view";
import { GuideView } from "./guide/guide-view";
import { type CreateChoice, CreateScreen } from "./screens/create";
import { HistoryScreen } from "./screens/history";
import { HomeScreen } from "./screens/home";
import { JoinScreen } from "./screens/join";
import { LobbyScreen } from "./screens/lobby";
import { type ExpeditionEnd, ResultScreen } from "./screens/result";
import { NextMapScreen, StreakEndScreen, StreakResultScreen, type StreakSummary, summaryOf } from "./screens/streak";
import {
  type LiveGame,
  type Session,
  advanceStreak,
  clearLive,
  newStreak,
  relayFor,
  streakPlay,
  loadLive,
  otherRole,
  resumeSession,
  saveLive,
  startSession,
} from "./session";
import { Button } from "./ui";

type ScreenState =
  | { name: "home" }
  | { name: "create"; initial: CreateChoice }
  | { name: "join"; prefill?: string; replay?: boolean }
  | { name: "history" }
  | { name: "lobby" }
  | { name: "play"; startedAt: number }
  | { name: "result"; end: ExpeditionEnd }
  /** Racha: a map ended; the explorer's device shows the relay key, the other types it. */
  | { name: "streakResult"; end: ExpeditionEnd; relay?: RelayState; resumed?: boolean }
  /** Racha: between maps (the session already points at the next one). */
  | { name: "next"; last: "won" | "escaped" }
  | { name: "streakEnd"; summary: StreakSummary };

const DEFAULT_CHOICE: CreateChoice = { role: "guide", streak: false };

/**
 * The whole flow on one static page: home → setup → lobby → play → result.
 * v2: one Difícil expedition per code, no countdown — each player taps
 * «Empezar» on their own device whenever ready.
 */
export function GameApp() {
  const [screen, setScreen] = useState<ScreenState>({ name: "home" });
  const [session, setSession] = useState<Session | null>(null);
  const [confirmQuit, setConfirmQuit] = useState(false);
  const [resume, setResume] = useState<LiveGame | null>(null);
  const quitting = useRef(false);
  const screenRef = useRef(screen);
  screenRef.current = screen;

  useWakeLock(screen.name === "play");
  useEffect(() => installAudioUnlock(), []);

  // A reload mid-expedition offers to pick it back up.
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" && new URLSearchParams(window.location.search).has("dev")) return;
    setResume(loadLive());
  }, []);
  useEffect(() => {
    if (!session) return;
    const base = { code: session.code, role: session.role, creator: session.creator, streak: session.streak };
    if (screen.name === "play") saveLive({ ...base, startedAt: screen.startedAt, phase: "play" });
    else if (screen.name === "streakResult") saveLive({ ...base, startedAt: Date.now(), phase: "relay", relay: screen.relay, guess: screen.end.ending });
    else if (screen.name === "next") saveLive({ ...base, startedAt: Date.now(), phase: "next", guess: screen.last });
    else if (screen.name === "result" || screen.name === "streakEnd") clearLive();
  }, [screen, session]);

  // Mid-round, a reload or closing the tab asks first.
  useEffect(() => {
    if (screen.name !== "play") return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [screen.name]);

  // The browser's back button walks back through the app instead of leaving it.
  const inApp = screen.name !== "home";
  useEffect(() => {
    if (!inApp) return;
    if (!(window.history.state as { lab?: boolean } | null)?.lab) window.history.pushState({ ...window.history.state, lab: true }, "");
    const onPop = () => {
      const cur = screenRef.current;
      if (cur.name === "play") {
        window.history.pushState({ ...window.history.state, lab: true }, "");
        setConfirmQuit(true);
      } else {
        setSession(null);
        setScreen({ name: "home" });
      }
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [inApp]);

  // Dev-only playtest shortcut: /?dev=CODE&role=guide|explorer jumps straight into play.
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    (window as unknown as { __audio?: typeof audio }).__audio = audio;
    const q = new URLSearchParams(window.location.search);
    const code = q.get("dev");
    if (!code) return;
    try {
      // Racha: &map=i&hearts=h start at map i (0-based) with the asked role there.
      const role: Role = q.get("role") === "guide" ? "guide" : "explorer";
      const index = Math.max(0, Number(q.get("map")) || 0);
      const first = index % 2 === 0 ? role : otherRole(role);
      const streak = { ...newStreak(first), index, hearts: Math.max(1, Math.min(3, Number(q.get("hearts")) || 3)) };
      setSession(startSession(code, role, true, streak));
      setScreen({ name: "play", startedAt: Date.now() });
    } catch {
      // bad code: stay home
    }
  }, []);

  const home = () => {
    setSession(null);
    setScreen({ name: "home" });
    // Drop the in-app history entry so "back" from home leaves the site.
    if ((window.history.state as { lab?: boolean } | null)?.lab) window.history.back();
  };

  const create = (c: CreateChoice) => {
    const played = playedCodes();
    // A v2 "duo" code is a Racha (isStreakCode).
    const code = createCode({ mode: c.streak ? "duo" : "hard", random: cryptoRandom, isTaken: (x) => played.has(x) });
    setSession(startSession(code, c.role, true));
    clearLive();
    setResume(null);
    track("game_created", { role: c.role, streak: c.streak });
    setScreen({ name: "lobby" });
  };

  const join = (code: string, role: Role) => {
    setSession(startSession(code, role, false));
    clearLive();
    setResume(null);
    track("game_joined", { role });
    setScreen({ name: "lobby" });
  };

  const go = useCallback(() => setScreen({ name: "play", startedAt: Date.now() }), []);

  /** Leaving a Racha mid-way still counts the maps they got through. */
  const abandonStreak = (s: Session) => {
    if (!s.streak || s.streak.index === 0) return;
    const st = s.streak;
    saveStreak({ id: s.code, code: s.code, date: new Date().toISOString(), maps: st.index, seals: st.seals, heartsLost: st.heartsLost, escapes: st.escapes, end: "abandoned" });
  };

  /** Both devices go on from the same relay state: the next map, or the end of the streak. */
  const relayed = (s: Session, r: RelayState) => {
    if (r.result === "lost" || r.hearts <= 0) {
      setScreen({ name: "streakEnd", summary: summaryOf(r) });
      return;
    }
    setSession(startSession(s.code, s.role, s.creator, advanceStreak(s.streak!, r)));
    setScreen({ name: "next", last: r.result });
  };

  const quit = () => {
    if (quitting.current) return; // double tap
    quitting.current = true;
    window.setTimeout(() => (quitting.current = false), 500);
    clearLive();
    if (session && screen.name === "play") {
      saveEntry({
        id: newEntryId(),
        code: session.code,
        mode: session.mode,
        level: session.game.level,
        round: session.streak ? session.streak.index + 1 : 1,
        streakIndex: session.streak?.index,
        role: session.role,
        date: new Date().toISOString(),
        result: "abandoned",
        timeMs: null,
        pits: 0,
        stars: 0,
        rating: 0,
      });
      abandonStreak(session);
    }
    setConfirmQuit(false);
    home();
  };

  const title = (s: Session) => (s.streak ? `Racha · mapa ${s.streak.index + 1} · ${THEMES[s.game.theme].name}` : `Expedición · ${THEMES[s.game.theme].name}`);

  let content: React.ReactNode = null;
  switch (screen.name) {
    case "home":
      content = (
        <HomeScreen
          onCreate={() => setScreen({ name: "create", initial: DEFAULT_CHOICE })}
          onJoin={() => setScreen({ name: "join" })}
          onHistory={() => setScreen({ name: "history" })}
          resume={
            resume && {
              label: resumeLabel(resume),
              onResume: () => {
                setSession(resumeSession(resume));
                setResume(null);
                if (resume.phase === "relay") {
                  const ending = resume.relay?.result ?? resume.guess ?? "won";
                  setScreen({ name: "streakResult", end: { ending, timeMs: 0 }, relay: resume.relay, resumed: true });
                } else if (resume.phase === "next") {
                  setScreen({ name: "next", last: resume.guess === "escaped" ? "escaped" : "won" });
                } else {
                  setScreen({ name: "play", startedAt: resume.startedAt });
                }
              },
              onDiscard: () => {
                clearLive();
                setResume(null);
              },
            }
          }
        />
      );
      break;
    case "create":
      content = <CreateScreen initial={screen.initial} onBack={home} onCreate={create} />;
      break;
    case "join":
      content = <JoinScreen prefill={screen.prefill} replay={screen.replay} onBack={home} onJoin={join} />;
      break;
    case "history":
      content = <HistoryScreen onBack={home} onReplay={(code) => setScreen({ name: "join", prefill: code, replay: true })} />;
      break;
    case "lobby":
      if (session) content = <LobbyScreen session={session} onBack={home} onReady={go} />;
      break;
    case "play":
      if (session) {
        content =
          session.role === "guide" ? (
            <GuideView
              game={session.game}
              title={title(session)}
              startedAt={screen.startedAt}
              onEnd={(ending, ms) => setScreen(session.streak ? { name: "streakResult", end: { ending, timeMs: ms } } : { name: "result", end: { ending, timeMs: ms } })}
              onQuit={() => setConfirmQuit(true)}
            />
          ) : (
            <ExplorerView
              key={`${session.code}-${session.streak?.index ?? 0}-${screen.startedAt}`}
              game={session.game}
              title={title(session)}
              startedAt={screen.startedAt}
              play={session.streak && streakPlay(session.streak)}
              subtitle={session.streak ? `Explorador · mapa ${session.streak.index + 1} de la racha` : undefined}
              onEnd={(o) => {
                const end: ExpeditionEnd = { ending: o.ending, timeMs: o.timeMs, measured: { hearts: o.hearts, pits: o.pits, stars: o.stars, seals: o.seals, hurts: o.hurts } };
                if (!session.streak) setScreen({ name: "result", end });
                else setScreen({ name: "streakResult", end, relay: relayFor(session.streak, { result: o.ending, hearts: o.hearts, seals: o.seals, hurts: o.hurts }) });
              }}
              onQuit={() => setConfirmQuit(true)}
            />
          );
      }
      break;
    case "result":
      if (session)
        content = (
          <ResultScreen
            session={session}
            end={screen.end}
            onSwapAndNew={() => {
              const role = otherRole(session.role);
              setSession(null);
              setScreen({ name: "create", initial: { role, streak: false } });
            }}
            onHome={home}
          />
        );
      break;
    case "streakResult":
      if (session?.streak)
        content = (
          <StreakResultScreen
            key={`${session.code}-${session.streak.index}`}
            session={session}
            end={screen.end}
            relay={screen.relay}
            resumed={screen.resumed}
            onAccept={(r) => relayed(session, r)}
          />
        );
      break;
    case "next":
      if (session?.streak)
        content = (
          <NextMapScreen
            session={session}
            lastResult={screen.last}
            onStart={go}
            onHome={() => {
              abandonStreak(session);
              clearLive();
              home();
            }}
          />
        );
      break;
    case "streakEnd":
      if (session?.streak)
        content = (
          <StreakEndScreen
            code={session.code}
            summary={screen.summary}
            onAgain={() => {
              const role = otherRole(session.streak!.firstRole);
              setSession(null);
              setScreen({ name: "create", initial: { role, streak: true } });
            }}
            onHome={home}
          />
        );
      break;
  }

  return (
    <>
      {content}
      {confirmQuit && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="quit-title">
          <div className="w-full max-w-sm rounded-3xl bg-card p-6 shadow-2xl">
            <h2 id="quit-title" className="font-display text-2xl">¿Salir de la expedición?</h2>
            <p className="mt-2 text-sm text-muted">Se guarda como abandonada en tu historial. Tu pareja seguirá en su pantalla.</p>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <Button variant="secondary" onClick={() => setConfirmQuit(false)} autoFocus>
                Seguir
              </Button>
              <Button onClick={quit}>Salir</Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function resumeLabel(l: LiveGame): string {
  try {
    const s = resumeSession(l);
    const role = s.role === "guide" ? "guía" : "explorador";
    if (s.streak) {
      const where = l.phase === "relay" ? `fin del mapa ${s.streak.index + 1}` : l.phase === "next" ? `antes del mapa ${s.streak.index + 1}` : `mapa ${s.streak.index + 1}`;
      return `Racha · ${where} · ${role}`;
    }
    return `Expedición · ${THEMES[s.game.theme].name} · ${role}`;
  } catch {
    return "Expedición en curso";
  }
}
