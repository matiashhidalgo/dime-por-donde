/**
 * Themes: palette + the vocabulary both players use out loud.
 * Landmarks are "kind + variant" so every zone gets a phrase nobody can
 * confuse ("el hongo gigante", not just "un hongo").
 */

export const THEME_IDS = ["forest", "cave", "ice", "desert"] as const;
export type ThemeId = (typeof THEME_IDS)[number];

export interface Palette {
  /** Explorer view (Canvas 2.5D). */
  skyTop: string;
  skyBottom: string;
  floor: string;
  floorAlt: string;
  wallTop: string;
  wallFace: string;
  shadow: string;
  fog: string;
  glow: string;
  accent: string;
  /** Guide map (SVG, cartographer style). */
  paper: string;
  ink: string;
}

export interface LandmarkKind {
  id: string;
  name: string;
  /** Full descriptors, already gender-agreed. */
  variants: readonly string[];
}

export interface Theme {
  id: ThemeId;
  name: string;
  palette: Palette;
  labels: { pit: string; ice: string };
  landmarks: readonly LandmarkKind[];
}

export const THEMES: Record<ThemeId, Theme> = {
  forest: {
    id: "forest",
    name: "Bosque",
    palette: {
      skyTop: "#cfe8d8", skyBottom: "#f3eedb", floor: "#d9e7c4", floorAlt: "#cfe0b8",
      wallTop: "#7fa97a", wallFace: "#557f5a", shadow: "rgba(38,64,44,0.28)", fog: "#aec4a3",
      glow: "#fff4c2", accent: "#e07a5f", paper: "#f4ecd8", ink: "#3c3a2e",
    },
    labels: { pit: "pozo", ice: "estanque congelado" },
    landmarks: [
      { id: "tree", name: "árbol", variants: ["árbol grande", "árbol seco", "árbol con flores"] },
      { id: "mushroom", name: "hongo", variants: ["hongo rojo", "hongo gigante", "hongo con puntos"] },
      { id: "log", name: "tronco", variants: ["tronco hueco", "tronco con musgo", "tronco partido"] },
      { id: "rock", name: "roca", variants: ["roca musgosa", "roca partida", "roca redonda"] },
      { id: "bush", name: "arbusto", variants: ["arbusto de moras", "arbusto florido", "arbusto espinoso"] },
      { id: "pond", name: "charco", variants: ["charco con ranas", "charco con nenúfares", "charco pequeño"] },
      { id: "sign", name: "letrero", variants: ["letrero torcido", "letrero viejo", "letrero pintado"] },
      { id: "stump", name: "tocón", variants: ["tocón con hacha", "tocón ancho", "tocón con hongos"] },
    ],
  },
  cave: {
    id: "cave",
    name: "Cueva",
    palette: {
      skyTop: "#1d1a2e", skyBottom: "#2b2540", floor: "#4a4466", floorAlt: "#433d5e",
      wallTop: "#6c6294", wallFace: "#342e4f", shadow: "rgba(8,6,20,0.45)", fog: "#1f1c30",
      glow: "#ffd58f", accent: "#7fd1c7", paper: "#ebe5d6", ink: "#2d2a3a",
    },
    labels: { pit: "grieta", ice: "lago helado" },
    landmarks: [
      { id: "stalagmite", name: "estalagmita", variants: ["estalagmita alta", "estalagmita doble", "estalagmita rota"] },
      { id: "crystal", name: "cristal", variants: ["cristal azul", "cristal rosa", "cristal verde"] },
      { id: "mushroom", name: "hongo", variants: ["hongo brillante", "hongo gigante", "hongo dormido"] },
      { id: "puddle", name: "charco", variants: ["charco burbujeante", "charco de lodo", "charco pequeño"] },
      { id: "chest", name: "cofre", variants: ["cofre viejo", "cofre abierto", "cofre roto"] },
      { id: "cart", name: "vagoneta", variants: ["vagoneta volcada", "vagoneta oxidada", "vagoneta llena"] },
      { id: "pickaxe", name: "pico", variants: ["pico clavado", "pico oxidado", "pico doble"] },
      { id: "bat", name: "murciélago", variants: ["murciélago dormido", "murciélago gordito", "murciélagos en grupo"] },
    ],
  },
  ice: {
    id: "ice",
    name: "Hielo",
    palette: {
      skyTop: "#dcecf7", skyBottom: "#f6fbff", floor: "#eef6fb", floorAlt: "#e3eef7",
      wallTop: "#a9cbe6", wallFace: "#6d95bb", shadow: "rgba(40,70,110,0.22)", fog: "#bccfe2",
      glow: "#ffffff", accent: "#f28482", paper: "#f2f0ea", ink: "#2f3b4a",
    },
    labels: { pit: "grieta en el hielo", ice: "pista de hielo" },
    landmarks: [
      { id: "snowman", name: "muñeco de nieve", variants: ["muñeco con bufanda", "muñeco con sombrero", "muñeco sin cabeza"] },
      { id: "pine", name: "pino", variants: ["pino alto", "pino chueco", "pino pequeño"] },
      { id: "igloo", name: "iglú", variants: ["iglú grande", "iglú pequeño", "iglú derretido"] },
      { id: "block", name: "bloque de hielo", variants: ["bloque azul", "bloque cuadrado", "bloque roto"] },
      { id: "sled", name: "trineo", variants: ["trineo rojo", "trineo volteado", "trineo viejo"] },
      { id: "penguin", name: "pingüino", variants: ["pingüino dormido", "pingüino con gorro", "pingüino bebé"] },
      { id: "campfire", name: "fogata", variants: ["fogata encendida", "fogata apagada", "fogata con olla"] },
      { id: "rock", name: "roca", variants: ["roca nevada", "roca partida", "roca grande"] },
    ],
  },
  desert: {
    id: "desert",
    name: "Atardecer en el desierto",
    palette: {
      skyTop: "#f6a57a", skyBottom: "#7a64a8", floor: "#f3cfa2", floorAlt: "#eec493",
      wallTop: "#dc8f63", wallFace: "#a95b3f", shadow: "rgba(90,40,40,0.28)", fog: "#d89c7e",
      glow: "#ffe6a8", accent: "#5b8e7d", paper: "#f6ead2", ink: "#4a3428",
    },
    labels: { pit: "pozo de arena", ice: "arena resbalosa" },
    landmarks: [
      { id: "cactus", name: "cactus", variants: ["cactus alto", "cactus con flor", "cactus de tres brazos"] },
      { id: "statue", name: "estatua", variants: ["estatua de gato", "estatua sin nariz", "estatua gigante"] },
      { id: "palm", name: "palmera", variants: ["palmera doble", "palmera inclinada", "palmera con cocos"] },
      { id: "jar", name: "vasija", variants: ["vasija rota", "vasija alta", "vasija pintada"] },
      { id: "column", name: "columna", variants: ["columna rota", "columna caída", "columna doble"] },
      { id: "camel", name: "camello", variants: ["camello dormido", "camello con montura", "camello bebé"] },
      { id: "rock", name: "roca", variants: ["roca roja", "roca en arco", "roca redonda"] },
      { id: "skull", name: "cráneo", variants: ["cráneo de vaca", "cráneo con cuernos", "cráneo pequeño"] },
    ],
  },
};
