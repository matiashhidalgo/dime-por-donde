/**
 * Analytics stub. Wire a provider when the project needs real tracking:
 * - Vercel Analytics: `npm i @vercel/analytics`, add <Analytics /> to layout.tsx
 * - Plausible/Umami: add the script tag in layout.tsx
 * Until then, track() logs in dev and no-ops in prod, so you can
 * instrument events from day one without changing call sites later.
 */
type EventProps = Record<string, string | number | boolean>;

export function track(event: string, props?: EventProps) {
  if (process.env.NODE_ENV === "development") {
    console.debug(`[analytics] ${event}`, props ?? {});
  }
  // Forward to a real provider here when wired.
}
