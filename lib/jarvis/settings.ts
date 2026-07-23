/**
 * Jarvis settings — defaults plus a tiny localStorage-backed store.
 *
 * Settings are per-device by design: voice/wake-word preferences are about how
 * *this* machine's microphone and speakers behave, so they live in
 * localStorage rather than the database. The shape is versioned so future
 * fields merge cleanly over an older saved blob.
 */

import type { JarvisSettings } from "./types";

const STORAGE_KEY = "lifeos.jarvis.settings.v1";

export const DEFAULT_SETTINGS: JarvisSettings = {
  enabled: true,
  alwaysListening: false,
  wakeWords: ["hello jarvis", "hey jarvis"],
  voiceProvider: "browser",
  voiceURI: null,
  rate: 1,
  pitch: 0.9,
  volume: 1,
  language: "en-GB",
  responseLength: "balanced",
  recognitionProvider: "browser",
  rememberConversations: true,
  storeTranscripts: false,
  accent: "#ff2d3f",
  reducedMotion: false,
  soundEffects: true,
  developerUnlocked: false,
};

export function loadSettings(): JarvisSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<JarvisSettings>;
    // Merge so a newly added field always has a sane default.
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: JarvisSettings): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    /* storage full or blocked — non-fatal, settings simply won't persist */
  }
}
