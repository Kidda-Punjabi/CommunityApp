/** Display name — change here to rename the game everywhere in UI. */
export const LANE_RUNNER_DISPLAY_NAME = "Lane Runner";

export const LANE_RUNNER_GAME_TYPE = "lane_runner" as const;

/** Lives per round. */
export const LANE_RUNNER_LIVES = 3;

/** Coins added to lifetime balance per correct gate answer. */
export const CORRECT_ANSWER_COIN_REWARD = 2;

/** Coins added when catching a lane gold pickup. */
export const LANE_PICKUP_COIN_REWARD = 1;

/** Bonus coins when all KIDDA letters are collected in one cycle. */
export const KIDDA_SPELL_COIN_BONUS = 50;

/** Base gate travel time at progress 0→1 before speed ramp (ms). ~4.5s */
export const BASE_GATE_FALL_MS = 4500;

/** Coin/letter travel time at base speed (ms). */
export const BASE_COLLECTIBLE_FALL_MS = 4200;

/** Delay before gate fall starts — 0 when collectibles run in a separate beat first. */
export const GATE_START_DELAY_MS = 0;

/** Lane gold pickups spawned per gate question. */
export const COINS_PER_GATE = 3;

/** Stagger between each coin spawn at the start of a gate round (ms). */
export const COIN_SPAWN_STAGGER_MS = 700;

/** @deprecated Collectibles resolve on transition end — no contact hold. */
export const COLLECTIBLE_CONTACT_HOLD_MS = 0;

/** Every N ms of active play, speed increases by SPEED_RAMP_RATE. */
export const SPEED_RAMP_INTERVAL_MS = 20_000;

/** +4% speed per ramp step (0.04). */
export const SPEED_RAMP_RATE = 0.04;

/** Maximum speed boost (+60% over base). */
export const SPEED_RAMP_MAX_BOOST = 0.6;

/** Letter spawn window (active play time between spawns). */
export const LETTER_SPAWN_MIN_MS = 25_000;
export const LETTER_SPAWN_MAX_MS = 35_000;

/** Horizontal swipe distance (px) to change lane. */
export const SWIPE_THRESHOLD_PX = 42;

export {
  CONTACT_TOP_PERCENT,
  HORIZON_TOP_PERCENT,
  LANE_CONTACT_X,
  LANE_HORIZON_X,
  laneBoundaryX,
  laneBoundarySegment,
  laneX,
  laneY,
  scaleAtProgress,
} from "./lane-geometry";

export const GATE_START_SCALE = 0.28;
export const GATE_END_SCALE = 1;
export const COIN_START_SCALE = 0.18;
export const COIN_END_SCALE = 0.85;
export const LETTER_START_SCALE = 0.2;
export const LETTER_END_SCALE = 0.9;

export const DASH_SCROLL_SPEED = 1.4;
export const DASH_CYCLE_PX = 24;

export const SPRING_EASING = "cubic-bezier(0.34, 1.56, 0.64, 1)";

/** Fall motion — ease-in so objects accelerate toward the contact line (constant world speed feel). */
export const FALL_MOTION_EASING = "cubic-bezier(0.35, 0, 0.85, 0.45)";

/** Brief road flash when a gate resolves (ms). */
export const ROAD_FLASH_MS = 360;

export const GATE_ADVANCE_MS = 320;
export const COLLECTIBLE_REMOVE_MS = 500;
export const COIN_POP_MS = 550;
export const KIDDA_CELEBRATION_MS = 2200;
