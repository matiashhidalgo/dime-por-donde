"use client";

import { useState } from "react";
import { Check, Copy, Ear } from "lucide-react";
import { SPOKEN } from "@/lib/phrases";
import { cn } from "@/lib/utils";

/** The code, big and grouped 4-4 so it's easy to read out loud. */
export function CodeDisplay({ code, size = "lg" }: { code: string; size?: "md" | "lg" }) {
  const [copied, setCopied] = useState(false);
  const [spoken, setSpoken] = useState(false);
  const groups = [code.slice(0, 4), code.slice(4)];

  const copy = async () => {
    const text = `${groups[0]}-${groups[1]}`;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Older browsers: select-and-copy fallback.
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
      } catch {
        // nothing else to try
      }
      ta.remove();
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex items-center gap-2 sm:gap-3" aria-label={`Código ${code.split("").join(" ")}`}>
        {groups.map((g, gi) => (
          <div key={gi} className="flex gap-1 sm:gap-1.5">
            {g.split("").map((ch, i) => (
              <span
                key={i}
                aria-hidden
                className={cn(
                  "flex items-center justify-center rounded-xl border border-border bg-background font-mono font-semibold shadow-inner",
                  // vw-clamped so 8 boxes + dash always fit a 320px-wide phone card
                  size === "lg"
                    ? "h-[min(4rem,11vw)] w-[min(3rem,7.4vw)] text-[min(2.25rem,6.6vw)]"
                    : "h-11 w-[min(2rem,7vw)] text-2xl",
                )}
              >
                {ch}
              </span>
            ))}
            {gi === 0 && <span aria-hidden className="mx-0.5 self-center text-2xl text-muted">–</span>}
          </div>
        ))}
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <button
          onClick={copy}
          className="flex min-h-11 items-center gap-2 rounded-full border border-border px-4 text-sm hover:bg-border/40"
        >
          {copied ? <Check size={16} /> : <Copy size={16} />}
          {copied ? "Copiado" : "Copiar"}
        </button>
        <button
          onClick={() => setSpoken((s) => !s)}
          aria-expanded={spoken}
          className="flex min-h-11 items-center gap-2 rounded-full border border-border px-4 text-sm hover:bg-border/40"
        >
          <Ear size={16} />
          Ayuda para dictar
        </button>
      </div>
      {spoken && (
        <ol className="grid w-full grid-flow-col grid-rows-4 gap-x-4 gap-y-1 rounded-2xl bg-background/60 p-3 text-sm">
          {code.split("").map((ch, i) => (
            <li key={i} className="flex gap-2">
              <span className="w-4 text-muted tabular-nums">{i + 1}</span>
              <span>{SPOKEN[ch] ?? `el número ${ch}`}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
