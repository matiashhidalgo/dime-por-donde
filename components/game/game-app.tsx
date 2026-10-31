"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DIFFICULTIES, THEMES, createCode } from "@/src/engine";
import { track } from "@/lib/analytics";
import { audio, installAudioUnlock } from "@/lib/audio";
import { cryptoRandom, useWakeLock } from "@/lib/hooks";
import { ROLE_NAME, type Role, newEntryId, playedCodes, saveEntry } from "@/lib/history";
import { startTip } from "@/lib/phrases";
import { ExplorerView } from "./explorer/explorer-view";
import { GuideView } from "./guide/guide-view";
import { CountdownScreen } from "./screens/countdown";
import { type CreateChoice, CreateScreen } from "./screens/create";
import { HistoryScreen } from "./screens/history";
import { HomeScreen } from "./screens/home";
import { JoinScreen } from "./screens/join";
import { LobbyScreen } from "./screens/lobby";
import { ResultScreen } from "./screens/result";
import {
  type LiveGame,
  type RoundRecord,
  type Session,
  clearLive,
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
  | { name: "countdown" }
  | { name: "play"; startedAt: number }
  | { name: "result"; timeMs: number; measured?: { pits: number; stars: number } };

const DEFAULT_CHOICE: CreateChoice = { mode: "easy", role: "guide", timed: true };

/** The whole flow on one static page: home → setup → ritual → play → result. */
export function GameApp() {
  const [screen, setScreen] = useState<ScreenState>({ name: "home" });
  const [session, setSession] = useState<Session | null>(null);
  const [confirmQuit, setConfirmQuit] = useState(false);
  const [rounds, setRounds] = useState<RoundRecord[]>([]);
  const [resume, setResume] = useState<LiveGame | null>(null);
  const quitting = useRef(false);
  const screenRef = useRef(screen);
  screenRef.current = screen;

  useWakeLock(screen.name === "play" || screen.name === "countdown");
  useEffect(() => installAudioUnlock(), []);

  // A reload mid-round offers to pick it back up (same clock).
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" && new URLSearchParams(window.location.search).has("dev")) return;
    setResume(loadLive());
  }, []);
  useEffect(() => {
    if (screen.name === "play" && session) {
      saveLive({ code: session.code, role: session.role, round: session.round, timed: session.timed, creator: session.creator, startedAt: screen.startedAt, rounds });
    } else if (screen.name === "result") {
      clearLive();
    }
  }, [screen, session, rounds]);

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
      } else if (cur.name === "countdown") {
        window.history.pushState({ ...window.history.state, lab: true }, "");
        setScreen({ name: "lobby" });
      } else {
        setSession(null);
        setRounds([]);
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
      setSession(startSession(code, q.get("role") === "guide" ? "guide" : "explorer", true, false));
      setScreen({ name: "play", startedAt: Date.now() });
    } catch {
      // bad code: stay home
    }
  }, []);

  const home = () => {
    setSession(null);
    setRounds([]);
    setScreen({ name: "home" });
    // Drop the in-app history entry so "back" from home leaves the site.
    if ((window.history.state as { lab?: boolean } | null)?.lab) window.history.back();
  };

  const create = (c: CreateChoice) => {
    const played = playedCodes();
    const code = createCode({ mode: c.mode, random: cryptoRandom, isTaken: (x) => played.has(x) });
    setSession(startSession(code, c.role, c.timed, true));
    setRounds([]);
    clearLive();
    setResume(null);
    track("game_created", { mode: c.mode, role: c.role });
    setScreen({ name: "lobby" });
  };

  const join = (code: string, role: Role, timed: boolean) => {
    setSession(startSession(code, role, timed, false));
    setRounds([]);
    clearLive();
    setResume(null);
    track("game_joined", { role });
    setScreen({ name: "lobby" });
  };

  const go = useCallback((startedAt: number) => setScreen({ name: "play", startedAt }), []);

  const quit = () => {
    if (quitting.current) return; // double tap
    quitting.current = true;
    window.setTimeout(() => (quitting.current = false), 500);
    clearLive();
    if (session && screen.name === "play") {
      const game = session.games[session.round];
      saveEntry({
        id: newEntryId(),
        code: session.code,
        mode: session.mode,
        level: game.level,
        round: session.round + 1,
        role: session.role,
        date: new Date().toISOString(),
        result: "abandoned",
        timeMs: null,
        pits: 0,
        stars: 0,
        rating: 0,
      });
    }
    setConfirmQuit(false);
    home();
  };

  const roundLabel = (s: Session) => {
    const g = s.games[s.round];
    const base = `${DIFFICULTIES[g.level].name} · ${THEMES[g.theme].name}`;
    return s.mode === "duo" ? `Ronda ${s.round + 1} de ${s.games.length} · ${base}` : base;
  };

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
                setRounds(resume.rounds);
                setResume(null);
                setScreen({ name: "play", startedAt: resume.startedAt });
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
      if (session) content = <LobbyScreen session={session} onBack={home} onReady={() => setScreen({ name: "countdown" })} />;
      break;
    case "countdown":
      if (session)
        content = (
          <CountdownScreen
            label={`${roundLabel(session)} · eres ${session.role === "guide" ? "guía" : "explorador"}`}
            swapTo={session.round > 0 ? ROLE_NAME[session.role].toLowerCase() : undefined}
            tip={session.round > 0 ? startTip(`${session.code}-${session.round}`, session.role) : undefined}
            onBack={() => setScreen({ name: "lobby" })}
            onGo={go}
          />
        );
      break;
    case "play":
      if (session) {
        const game = session.games[session.round];
        const arrived = (ms: number) => setScreen({ name: "result", timeMs: ms });
        content =
          session.role === "guide" ? (
            <GuideView game={game} title={roundLabel(session)} startedAt={screen.startedAt} timed={session.timed} onArrived={arrived} onQuit={() => setConfirmQuit(true)} />
          ) : (
            <ExplorerView
              key={`${session.code}-${session.round}`}
              game={game}
              title={roundLabel(session)}
              startedAt={screen.startedAt}
              timed={session.timed}
              onArrived={(o) => setScreen({ name: "result", timeMs: o.timeMs, measured: { pits: o.pits, stars: o.stars } })}
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
            timeMs={screen.timeMs}
            measured={screen.measured}
            previous={rounds}
            onNextRound={(record) => {
              setRounds((rs) => [...rs.filter((r) => r.round !== record.round), record]);
              setSession({ ...session, round: session.round + 1, role: otherRole(session.role) });
              setScreen({ name: "countdown" });
            }}
            onSwapAndNew={() => {
              const mode = session.mode;
              const role = otherRole(session.role);
              setSession(null);
              setRounds([]);
              setScreen({ name: "create", initial: { mode, role, timed: session.timed } });
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
            <h2 id="quit-title" className="font-display text-2xl">¿Salir de la partida?</h2>
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
    const g = s.games[s.round];
    const round = s.mode === "duo" ? `Ronda ${s.round + 1} · ` : "";
    return `${round}${DIFFICULTIES[g.level].name} · ${THEMES[g.theme].name} · ${l.role === "guide" ? "guía" : "explorador"}`;
  } catch {
    return "Partida en curso";
  }
}
