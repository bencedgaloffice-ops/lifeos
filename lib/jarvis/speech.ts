/**
 * Speech synthesis for Jarvis.
 *
 * The public surface is provider-agnostic: {@link SpeechEngine} is what the
 * rest of the app talks to, and it delegates to a {@link VoiceProvider}. Today
 * the only bundled provider is the browser's built-in `speechSynthesis`, which
 * needs no API key and ships a British male voice on every major platform —
 * exactly the calm, professional timbre the companion wants. OpenAI, ElevenLabs
 * and Piper can be added later as additional providers (they require network
 * credentials) without touching any calling code.
 */

import type { JarvisSettings } from "./types";

export type SpeakOptions = {
  onStart?: () => void;
  onEnd?: () => void;
  /** Fires as each word begins — used to pulse the orb in time with speech. */
  onBoundary?: () => void;
  signal?: AbortSignal;
};

export interface VoiceProvider {
  readonly id: string;
  /** Speak text, resolving when playback finishes (or is cancelled). */
  speak(text: string, settings: JarvisSettings, opts?: SpeakOptions): Promise<void>;
  cancel(): void;
  /** Voices this provider can offer, for the settings picker. */
  listVoices(): { uri: string; name: string; lang: string }[];
}

/* ------------------------------------------------------------------ */
/*  Browser provider — Web Speech API                                  */
/* ------------------------------------------------------------------ */

function synth(): SpeechSynthesis | null {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return null;
  return window.speechSynthesis;
}

/**
 * Pick the most JARVIS-appropriate installed voice: prefer an explicitly
 * chosen one, else a British male, else any English voice, else the default.
 */
export function pickVoice(settings: JarvisSettings): SpeechSynthesisVoice | null {
  const s = synth();
  if (!s) return null;
  const voices = s.getVoices();
  if (!voices.length) return null;

  if (settings.voiceURI) {
    const exact = voices.find((v) => v.voiceURI === settings.voiceURI);
    if (exact) return exact;
  }

  const lang = settings.language.toLowerCase();
  const maleHints = ["male", "daniel", "arthur", "george", "oliver", "james", "brian", "google uk english male"];
  const byLang = voices.filter((v) => v.lang.toLowerCase().startsWith(lang.slice(0, 2)));
  const gbFirst = [...byLang].sort((a, b) => {
    const aGB = a.lang.toLowerCase().includes("gb") ? -1 : 0;
    const bGB = b.lang.toLowerCase().includes("gb") ? -1 : 0;
    return aGB - bGB;
  });
  const male = gbFirst.find((v) => maleHints.some((h) => v.name.toLowerCase().includes(h)));
  return male ?? gbFirst[0] ?? voices[0] ?? null;
}

class BrowserVoiceProvider implements VoiceProvider {
  readonly id = "browser";

  speak(text: string, settings: JarvisSettings, opts?: SpeakOptions): Promise<void> {
    const s = synth();
    if (!s || !text.trim()) {
      opts?.onEnd?.();
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => {
      s.cancel(); // never overlap utterances
      const utter = new SpeechSynthesisUtterance(text);
      const voice = pickVoice(settings);
      if (voice) utter.voice = voice;
      utter.lang = settings.language;
      utter.rate = settings.rate;
      utter.pitch = settings.pitch;
      utter.volume = settings.volume;

      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        opts?.onEnd?.();
        resolve();
      };
      utter.onstart = () => opts?.onStart?.();
      utter.onboundary = () => opts?.onBoundary?.();
      utter.onend = finish;
      utter.onerror = finish;

      if (opts?.signal) {
        opts.signal.addEventListener("abort", () => {
          s.cancel();
          finish();
        });
      }
      s.speak(utter);
    });
  }

  cancel(): void {
    synth()?.cancel();
  }

  listVoices() {
    const s = synth();
    if (!s) return [];
    return s.getVoices().map((v) => ({ uri: v.voiceURI, name: v.name, lang: v.lang }));
  }
}

/* ------------------------------------------------------------------ */
/*  Engine — the single object the app talks to                        */
/* ------------------------------------------------------------------ */

export class SpeechEngine {
  private provider: VoiceProvider = new BrowserVoiceProvider();

  isSupported(): boolean {
    return synth() !== null;
  }

  listVoices() {
    return this.provider.listVoices();
  }

  speak(text: string, settings: JarvisSettings, opts?: SpeakOptions): Promise<void> {
    if (!settings.soundEffects && !text) return Promise.resolve();
    return this.provider.speak(text, settings, opts);
  }

  cancel(): void {
    this.provider.cancel();
  }
}
