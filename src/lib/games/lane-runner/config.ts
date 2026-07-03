/** Display name — change here to rename the game everywhere in UI. */
export const LANE_RUNNER_DISPLAY_NAME = "Lane Runner";

export const LANE_RUNNER_GAME_TYPE = "lane_runner" as const;

/** Primary difficulty lever — ms for gate fall from horizon to contact line. */
export const GATE_FALL_MS = 5800;

/** Delay after a round starts before the gate begins falling (coin gets this head start). */
export const GATE_START_DELAY_MS = 1000;

/** Coin travel time — longer than gate so it resolves before the question arrives. */
export const COIN_FALL_MS = 4200;

/** Brief pause at the contact line before catch/miss resolves (widens catch window). */
export const COIN_CONTACT_HOLD_MS = 380;

/** Horizontal swipe distance (px) to change lane. */
export const SWIPE_THRESHOLD_PX = 42;

/** Lane horizontal centers (% of road width). */
export const LANE_CENTER_PERCENT = [16.67, 50, 83.33] as const;

export const HORIZON_TOP_PERCENT = 6;
export const CONTACT_TOP_PERCENT = 78;
export const GATE_START_SCALE = 0.28;
export const GATE_END_SCALE = 1;
export const COIN_START_SCALE = 0.18;
export const COIN_END_SCALE = 0.85;

export const ROAD_DIVIDER_ROTATE_DEG = 6;
export const DASH_SCROLL_SPEED = 1.4;
export const DASH_CYCLE_PX = 24;

export const SPRING_EASING = "cubic-bezier(0.34, 1.56, 0.64, 1)";

/** Brief road flash when a gate resolves (ms). */
export const ROAD_FLASH_MS = 360;
