/** Public surface of the engine. Pure TypeScript: no DOM, no Math.random. */
export * from "./code";
export * from "./difficulty";
export * from "./generate";
export * from "./grid";
export * from "./rules";
export * from "./solver";
export * from "./themes";
export * from "./types";
export { createRng, hashString, type Rng } from "./rng";
export { carveMaze, braid, deadEnds, type MazeAlgorithm } from "./maze";
export * from "./audit";
export * from "./score";
export * from "./play";
export * from "./names";
