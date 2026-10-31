/**
 * Name, copy and URL shown to the world. Change the game's visible name here
 * (and only here): page title, home screen, share card, icons all read it.
 */
const vercelUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL;

export const SITE = {
  name: "Dime por dónde",
  tagline: "Un laberinto, dos pantallas y una videollamada",
  description:
    "Juego cooperativo para dos por videollamada: una persona explora el laberinto entre la niebla y la otra la guía con el mapa. Sin cuentas ni descargas.",
  /** Production URL: Vercel provides it at build time; set NEXT_PUBLIC_SITE_URL to override. */
  url: process.env.NEXT_PUBLIC_SITE_URL ?? (vercelUrl ? `https://${vercelUrl}` : "http://localhost:3000"),
  locale: "es_MX",
  /** Brand colors (light theme accent + paper). */
  accent: "#d9634c",
  accent2: "#2a8a80",
  paper: "#f7f1e8",
  ink: "#2b2530",
} as const;
