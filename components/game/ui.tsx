"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

/** Shared pieces for the game shell. Tap targets are ≥ 44px everywhere. */

type Variant = "primary" | "secondary" | "ghost" | "teal";

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: "md" | "lg" }) {
  return (
    <button
      {...props}
      className={cn(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl px-5 font-medium transition-[transform,background-color,opacity] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40",
        size === "lg" && "min-h-14 px-6 text-lg",
        variant === "primary" && "bg-accent text-accent-ink shadow-[0_6px_20px_-8px_var(--accent)] hover:brightness-105",
        variant === "teal" && "bg-accent-2 text-white hover:brightness-105 dark:text-[#10201e]",
        variant === "secondary" && "border border-border bg-card hover:bg-border/40",
        variant === "ghost" && "hover:bg-border/50",
        className,
      )}
    />
  );
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn("rounded-3xl border border-border bg-card p-5 shadow-[0_12px_40px_-24px_rgba(60,40,30,0.35)] sm:p-6", className)}>
      {children}
    </div>
  );
}

export function Screen({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <main className={cn("app-glow min-h-dvh px-4 pb-10 pt-[max(1rem,env(safe-area-inset-top))] sm:px-6", className)}>
      <div className="mx-auto w-full max-w-lg">{children}</div>
    </main>
  );
}

export function TopBar({ title, onBack, right }: { title?: string; onBack?: () => void; right?: ReactNode }) {
  return (
    <header className="mb-5 flex min-h-12 items-center gap-2">
      {onBack && (
        <button
          onClick={onBack}
          aria-label="Volver"
          className="-ml-2 flex h-11 w-11 items-center justify-center rounded-full hover:bg-border/50"
        >
          <ArrowLeft size={22} />
        </button>
      )}
      {title && <h1 className="font-display text-2xl tracking-tight">{title}</h1>}
      <div className="ml-auto">{right}</div>
    </header>
  );
}

/** Big tappable radio-card group. */
export function ChoiceGroup<T extends string>({
  label,
  value,
  options,
  onChange,
  columns = 2,
}: {
  label: string;
  value: T;
  options: { value: T; title: string; hint?: string; icon?: ReactNode }[];
  onChange: (v: T) => void;
  columns?: 2 | 3 | 4;
}) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium text-muted">{label}</legend>
      <div
        role="radiogroup"
        className={cn("grid gap-2", columns === 2 && "grid-cols-2", columns === 3 && "grid-cols-3", columns === 4 && "grid-cols-2 sm:grid-cols-4")}
      >
        {options.map((o, i) => {
          const on = o.value === value;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={on}
              // Radio pattern: one tab stop, arrows move and select.
              tabIndex={on ? 0 : -1}
              onClick={() => onChange(o.value)}
              onKeyDown={(e) => {
                const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
                if (!step) return;
                e.preventDefault();
                const next = (i + step + options.length) % options.length;
                onChange(options[next].value);
                const group = e.currentTarget.parentElement;
                (group?.children[next] as HTMLElement | undefined)?.focus();
              }}
              className={cn(
                "flex min-h-14 flex-col items-start justify-center rounded-2xl border px-3.5 py-2.5 text-left transition-colors",
                on ? "border-accent bg-accent/10 ring-1 ring-accent" : "border-border bg-card hover:bg-border/30",
              )}
            >
              <span className="flex items-center gap-2 font-medium">
                {o.icon}
                {o.title}
              </span>
              {o.hint && <span className="mt-0.5 text-xs leading-snug text-muted">{o.hint}</span>}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

export function Stars({ value, max = 3, size = 22 }: { value: number; max?: number; size?: number }) {
  return (
    <span className="inline-flex gap-1" role="img" aria-label={`${value} de ${max} estrellas`}>
      {Array.from({ length: max }, (_, i) => (
        <svg key={i} width={size} height={size} viewBox="0 0 24 24" aria-hidden>
          <path
            d="M12 2.5l2.9 6 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.2 1.3-6.6L2.5 9.3l6.6-.8z"
            fill={i < value ? "#f2b84b" : "none"}
            stroke={i < value ? "#c98b1c" : "currentColor"}
            strokeOpacity={i < value ? 1 : 0.35}
            strokeWidth={1.4}
            strokeLinejoin="round"
          />
        </svg>
      ))}
    </span>
  );
}
