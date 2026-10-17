export type PlacementStep = "U1" | "U2" | "S";

export type PlacementState = {
  start: number;
  L: number;
  assumed: number;
  stopS: boolean;
  dropped: boolean;
  ceiling: number;
  step: PlacementStep;
  uPass: number[];
  sPass: number[];
  phase: "ask" | "sound" | "done";
  soundIndex: number;
  soundMiss: boolean;
  timedOut: boolean;
};

export type PlacementScores = {
  understanding: number;
  speaking: number;
  kiddaLevel: number;
  soundIssue: boolean;
  timedOut: boolean;
};

const START_BY_SUM = [1, 1, 2, 3, 4, 5, 6] as const;

export function startLevelFromProfile(understand: number, reply: number): number {
  const sum = Math.min(6, Math.max(0, understand + reply));
  return START_BY_SUM[sum];
}

export function initialPlacementState(start: number): PlacementState {
  return {
    start,
    L: start,
    assumed: start - 1,
    stopS: false,
    dropped: false,
    ceiling: 10,
    step: "U1",
    uPass: [],
    sPass: [],
    phase: "ask",
    soundIndex: 0,
    soundMiss: false,
    timedOut: false,
  };
}

function withPass(levels: number[], level: number): number[] {
  return levels.includes(level) ? levels : [...levels, level];
}

function advance(state: PlacementState): PlacementState {
  const L = state.L + 1;
  if (L > 9 || L >= state.ceiling) {
    return { ...state, L, phase: "done" };
  }
  return { ...state, L, step: "U1" };
}

function failUnderstanding(state: PlacementState): PlacementState {
  if (state.L === state.start && state.L > 1 && !state.dropped) {
    const L = Math.max(1, state.L - 2);
    return {
      ...state,
      dropped: true,
      ceiling: state.L,
      L,
      assumed: L - 1,
      stopS: false,
      sPass: [],
      uPass: state.uPass.filter((level) => level <= L - 1),
      step: "U1",
    };
  }
  if (state.L === 1) {
    return { ...state, phase: "sound", soundIndex: 0 };
  }
  return { ...state, phase: "done" };
}

function afterUnderstandingPass(state: PlacementState): PlacementState {
  const next = { ...state, uPass: withPass(state.uPass, state.L) };
  if (!next.stopS) return { ...next, step: "S" };
  return advance(next);
}

export function applyPlacementAnswer(state: PlacementState, correct: boolean): PlacementState {
  if (state.phase === "done") return state;
  if (state.phase === "sound") {
    const soundIndex = state.soundIndex + 1;
    const soundMiss = state.soundMiss || !correct;
    return {
      ...state,
      soundIndex,
      soundMiss,
      phase: soundIndex >= 2 ? "done" : "sound",
    };
  }

  if (state.step === "U1") {
    if (!correct) return { ...state, step: "U2" };
    return afterUnderstandingPass(state);
  }
  if (state.step === "U2") {
    if (!correct) return failUnderstanding(state);
    return afterUnderstandingPass(state);
  }

  const next = {
    ...state,
    sPass: correct ? withPass(state.sPass, state.L) : state.sPass,
    stopS: state.stopS || !correct,
  };
  return advance(next);
}

export function finishPlacement(state: PlacementState, timedOut = false): PlacementState {
  if (state.phase === "sound") {
    return { ...state, phase: "done", timedOut };
  }
  return { ...state, phase: "done", timedOut: timedOut || state.timedOut };
}

function highestRun(assumed: number, passes: number[]): number {
  let highest = 0;
  for (let level = 1; level <= 9; level += 1) {
    if (level <= assumed || passes.includes(level)) highest = level;
    else break;
  }
  return highest;
}

export function scorePlacement(state: PlacementState): PlacementScores {
  const understanding = highestRun(state.assumed, state.uPass);
  const speaking = Math.min(understanding, highestRun(state.assumed, state.sPass));
  return {
    understanding,
    speaking,
    kiddaLevel: speaking,
    soundIssue: state.soundMiss,
    timedOut: state.timedOut,
  };
}

export function replayPlacement(start: number, answers: boolean[]): PlacementState {
  return answers.reduce((state, correct) => applyPlacementAnswer(state, correct), initialPlacementState(start));
}
