/**
 * A tiny React-free signal that lets the landing page tell the Earth canvas to
 * dive its camera into the globe when "Enter LifeOS" is pressed. Kept outside
 * React so the per-frame camera read never causes re-renders — the same pattern
 * as the Jarvis orb signal.
 */
export const enterSignal = {
  /** True once the entry sequence has begun. */
  entering: false,
};

export function beginEnter() {
  enterSignal.entering = true;
}

export function resetEnter() {
  enterSignal.entering = false;
}
