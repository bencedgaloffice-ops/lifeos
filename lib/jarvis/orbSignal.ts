/**
 * A tiny module-level signal the speech engine writes and the orb reads on
 * every animation frame — deliberately *outside* React so word-by-word speech
 * pulses never trigger re-renders. Any number of orbs (widget, console,
 * landing) read the same live signal.
 */
export const orbSignal = {
  /** True while an utterance is being spoken. */
  speaking: false,
  /** performance.now() timestamp of the most recent word boundary. */
  lastPulseAt: -Infinity,
};

export function orbSpeakStart() {
  orbSignal.speaking = true;
  orbSignal.lastPulseAt = now();
}

export function orbSpeakBoundary() {
  orbSignal.lastPulseAt = now();
}

export function orbSpeakEnd() {
  orbSignal.speaking = false;
}

function now() {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}
