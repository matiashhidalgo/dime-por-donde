/**
 * Balance knobs for the v2 expedition rules (GAME_SPEC_V2.md §3). Everything
 * here changes how a round FEELS, never which maze a code makes — so tweak
 * freely; the generator and its golden fingerprints don't read this file.
 *
 * Calibrated with `npm run calibrate` (scripts/calibrate.ts): a simulated
 * pair that follows the solver's route, takes wrong turns and steps into pits
 * next to the route when the guide "slips". Numbers in GAME_SPEC_V2.md anexo.
 */

export const TUNING = {
  /** Shared lives. A pit or burning out costs one; 0 ends the expedition. */
  hearts: 3,

  candle: {
    /** Moves a full candle lasts (one input that goes somewhere = one move, slides included). */
    max: 100,
    /**
     * Sight radius by remaining light, brightest first: at ≥ 50 % you see 3
     * steps, ≥ 25 % → 2, anything left → 1, empty → only your own cell.
     */
    levels: [
      { atLeast: 0.5, radius: 3 },
      { atLeast: 0.25, radius: 2 },
      { atLeast: 0.0001, radius: 1 },
    ],
    /** Moves you can stumble on in total darkness before it costs a heart. */
    darkGrace: 8,
    /** After burning out, the candle relights to this fraction (0.5 = sight 3 again, briefly). */
    relight: 0.5,
    /** A lantern (single use) fills the candle completely. */
    lanternRefill: 1,
    /** A small candle on the route (the old flags; single use) adds this fraction. */
    candleRefill: 0.5,
  },

  pit: {
    /** Landing spots are drawn from the farthest share of the reachable floor (by walking distance from the pit). */
    farFraction: 0.35,
    /** Never land this close (walking distance) to the exit — a fall can't be a shortcut. */
    exitMargin: 8,
  },

  trials: {
    /** Candle lost per paid failure in a trial (fraction of a full candle). */
    failLight: 0.12,
    /** Every Nth paid failure at the same station also costs a heart. */
    heartEvery: 3,
    /** Wrong lock combinations that are free before failures start to cost. */
    lockFreeTries: 3,
    /** Wrong seal keys (bad checksum, another station's key) that are free. */
    keyFreeTries: 1,
    /**
     * Wrong complete answers that are free at the piano and the tangram,
     * whoever plays them (a guide's mistakes travel in the key and are
     * charged the same way).
     */
    pianoFreeTries: 1,
    tangramFreeTries: 1,
  },

  seal: {
    /** Each seal relights the candle by this fraction (1 = full). */
    candleRefill: 1,
    /** Every Nth seal gives back a lost heart (1 = every seal). */
    healEvery: 1,
  },

  swirl: {
    /** v1 codes only. Inverted controls last the map's swirl steps × this. */
    stepsFactor: 1.5,
    /** Extra fog while inverted: sight radius minus this (never below 1 while the candle burns). */
    fog: 1,
  },

  /** v2: a swirl lays curse number k (GAME_SPEC_V2.md anexo etapa 3). */
  curse: {
    /** Moves a curse lasts before lifting on its own (drawn per curse). */
    steps: [14, 22] as readonly [number, number],
    /** Curse kinds and how often each is drawn. */
    weights: { turn: 1, blind: 1, hungry: 1, masked: 1, mirror: 1 },
    /** «Ceguera»: sight never goes above this while it lasts. */
    blindRadius: 1,
    /** «Hambre»: candle units burned per move. */
    hungryBurn: 2,
    /** A cure with no guide mistakes relights this fraction of the candle… */
    cureRefill: 0.2,
    /** …minus this much per guide mistake carried in the key (never below 0). */
    cureFailLight: 0.05,
  },

  /** «Salida de emergencia»: leave with 1 or 2 seals, only when in danger. */
  emergency: {
    /** Danger = this many hearts or fewer (or the candle out). */
    hearts: 1,
  },

  /**
   * La Sombra (GAME_SPEC_V2.md, anexo etapa 5). A patrol that moves one step
   * per explorer step. v2 maps only; v1 codes never have one.
   */
  shadow: {
    /** Chance a v2 map has a Sombra. In a streak it rises per map index, up to `cap`. */
    chance: { base: 0.66, perMap: 0.04, cap: 0.92 },
    /** Patrol length in cells (a closed loop or a there-and-back). */
    routeLength: [12, 40] as readonly [number, number],
    /** Chance of a closed loop when the maze has one of the right length (else there-and-back). */
    loopShare: 0.4,
    /** Chance it moves a cell every tick (else every 2 ticks). Streak: rises per map to `cap`. */
    fast: { base: 0.3, perMap: 0.05, cap: 0.7 },
    /** «Cazador»: chance and streak growth. */
    hunter: { base: 0.22, perMap: 0.06, cap: 0.6 },
    /** Passage distance within which a hunter turns toward the explorer. */
    hunterRadius: 4,
    /** A chase lasts at most this many ticks; then it gives up and goes back to its route. */
    chaseTicks: 8,
    /** From this map index of a streak a second body (same route, half a lap behind) may appear… */
    twoBodiesFrom: 5,
    /** …with this chance (never with a hunter). */
    twoBodiesChance: 0.5,
    /** Touching it: hearts lost… */
    hurt: 1,
    /** …and this fraction of a full candle (never below empty). */
    lightLoss: 0.15,
    /** Ticks the explorer is immune after a touch (no chained hits). */
    immune: 3,
    /** Ticks the Sombra walks away from the explorer after touching. */
    retreat: 3,
    /** A lantern picked up stuns a Sombra within this walking distance… */
    lanternRange: 8,
    /** …for this many ticks (it freezes and cannot touch). */
    lanternStun: 6,
    /** The heartbeat is heard from this walking distance (cells). Display only. */
    hearRange: 9,
    /** A fair path exists with at most ceil(ratio × normal route) + slack ticks (waiting included). */
    fairRatio: 1.5,
    fairSlack: 3,
    /** Seed attempts before giving up and leaving the map without a Sombra. */
    attempts: 40,
  },

  /**
   * Racha. Two levels (anexo etapa 3): the MAP level is the map index and
   * both devices use it (it changes the map and the trials, so it can't
   * depend on anything only one device knows); the PLAY level is index +
   * escapes × escapeBump and only the explorer's device uses it.
   * `pits` and the figures thresholds change what streak maps look like.
   */
  streak: {
    /**
     * Pit change on map i: min(cap, round(atStart + i × perMap)). Negative =
     * pits removed (a streak starts gentler than a single expedition and
     * climbs past it); positive = extra pits placed beside the route.
     */
    pits: { atStart: -12, perMap: 2, cap: 6 },
    /** Figures lean to «more alike» from this map index on (0 = never)… */
    figuresHarderFrom: 2,
    /** …and to «most alike» from this one. */
    figuresHardestFrom: 5,
    /** Candle size per play level: max × (start − shrink × level), never below `floor`. */
    candleStart: 1.5,
    candleShrink: 0.1,
    candleFloor: 0.65,
    /** One free lock try fewer every this many play levels (never below 1). */
    lockFreeEvery: 2,
    /** From this play level on, no free wrong seal key. */
    keyFreeUntil: 3,
    /** An emergency exit adds this many play levels to every map after it. */
    escapeBump: 2,
    /** Hearts the streak goes on with after an emergency exit. */
    heartsAfterEscape: 1,
    /** Every Nth seal heals in a streak (single expeditions use seal.healEvery). */
    healEvery: 1,
  },
} as const;
