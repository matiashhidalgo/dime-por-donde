"use client";

import { useEffect, useState } from "react";
import { Lightbulb, X } from "lucide-react";
import { HINT_TEXT, type HintId, hintSeen, markHint } from "@/lib/hints";
import { cn } from "@/lib/utils";

/**
 * A one-sentence hint the FIRST time something shows up on this device. It is
 * remembered as soon as it's shown, so it never nags; the X closes it earlier.
 * Read in an effect (never during render) so server and client markup match.
 */
export function FirstHint({ id, className }: { id: Exclude<HintId, "tour">; className?: string }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (hintSeen(id)) return;
    markHint(id);
    setShow(true);
  }, [id]);
  if (!show) return null;
  return (
    <div role="note" className={cn("flex items-start gap-2 rounded-2xl border border-accent/50 bg-card px-3 py-2 text-sm shadow-md", className)}>
      <Lightbulb size={16} className="mt-0.5 shrink-0 text-accent" aria-hidden />
      <p className="min-w-0 flex-1">{HINT_TEXT[id]}</p>
      <button onClick={() => setShow(false)} aria-label="Cerrar la pista" className="-m-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full hover:bg-border/50">
        <X size={16} />
      </button>
    </div>
  );
}
