/**
 * Speech recognition for Jarvis — wake-word detection *and* command capture,
 * both from the browser's built-in Web Speech API (no API key, no model
 * download). The same engine runs in two modes:
 *
 *   • "wake"    — continuously scanning for a wake phrase ("hello jarvis").
 *   • "command" — capturing the next utterance as an instruction.
 *
 * If a wake phrase and a command arrive in one breath ("hello jarvis, what's my
 * schedule") the trailing command is extracted immediately. A cloud provider
 * (Whisper) could replace the command-capture leg later behind the same API.
 */

/* Minimal ambient typings — the Web Speech API isn't in the standard TS DOM
   lib in a portable way, so we describe just what we use. */
type SpeechRecognitionAlternativeLike = { transcript: string };
type SpeechRecognitionResultLike = {
  0: SpeechRecognitionAlternativeLike;
  isFinal: boolean;
  length: number;
};
type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: { length: number; [i: number]: SpeechRecognitionResultLike };
};
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function recognitionSupported(): boolean {
  return getCtor() !== null;
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, "").replace(/\s+/g, " ").trim();
}

type Mode = "off" | "wake" | "command";

export type RecognitionCallbacks = {
  onWake: (trailingCommand: string | null) => void;
  onCommand: (text: string) => void;
  onInterim: (text: string) => void;
  onError: (error: string) => void;
  onListeningChange: (listening: boolean) => void;
};

export class RecognitionEngine {
  private rec: SpeechRecognitionLike | null = null;
  private mode: Mode = "off";
  private wakeWords: string[] = ["hello jarvis"];
  private lang = "en-GB";
  private commandTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private cb: RecognitionCallbacks) {}

  get supported(): boolean {
    return recognitionSupported();
  }

  setWakeWords(words: string[]) {
    this.wakeWords = words.map(normalize).filter(Boolean);
  }

  setLanguage(lang: string) {
    this.lang = lang;
    if (this.rec) this.rec.lang = lang;
  }

  /** Begin passive wake-word listening. */
  startWake() {
    this.mode = "wake";
    this.ensure();
  }

  /** Jump straight into capturing one command (used by the manual mic button). */
  startCommand() {
    this.mode = "command";
    this.armCommandTimeout();
    this.ensure();
  }

  stop() {
    this.mode = "off";
    this.clearTimer();
    if (this.rec) {
      try {
        this.rec.abort();
      } catch {
        /* ignore */
      }
    }
    this.cb.onListeningChange(false);
  }

  private ensure() {
    if (this.rec) return;
    const Ctor = getCtor();
    if (!Ctor) {
      this.cb.onError("unsupported");
      return;
    }
    const rec = new Ctor();
    rec.lang = this.lang;
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    rec.onresult = (e) => this.handleResult(e);
    rec.onerror = (e) => {
      // "no-speech" / "aborted" are routine; surface only real failures.
      if (e.error !== "no-speech" && e.error !== "aborted") this.cb.onError(e.error);
    };
    rec.onend = () => {
      // The browser stops recognition periodically; transparently resume
      // whenever we're still meant to be listening.
      if (this.mode !== "off") {
        try {
          rec.start();
        } catch {
          /* already starting */
        }
      } else {
        this.cb.onListeningChange(false);
      }
    };

    this.rec = rec;
    try {
      rec.start();
      this.cb.onListeningChange(true);
    } catch {
      /* start() throws if called while already running — safe to ignore */
    }
  }

  private handleResult(e: SpeechRecognitionEventLike) {
    let interim = "";
    let final = "";
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const res = e.results[i];
      const text = res[0].transcript;
      if (res.isFinal) final += text;
      else interim += text;
    }

    if (this.mode === "command") {
      if (interim) this.cb.onInterim(interim);
      if (final.trim()) {
        this.clearTimer();
        this.mode = "off";
        this.cb.onCommand(final.trim());
      } else if (interim) {
        this.armCommandTimeout();
      }
      return;
    }

    if (this.mode === "wake") {
      const haystack = normalize(final || interim);
      if (!haystack) return;
      const hit = this.wakeWords.find((w) => haystack.includes(w));
      if (hit) {
        // Everything the user said after the wake phrase is a candidate command.
        const idx = haystack.indexOf(hit) + hit.length;
        const trailing = haystack.slice(idx).trim();
        this.mode = "off";
        this.cb.onWake(trailing.length > 1 ? trailing : null);
      }
    }
  }

  private armCommandTimeout() {
    this.clearTimer();
    // If the user goes quiet after speaking, close the command out.
    this.commandTimer = setTimeout(() => {
      if (this.mode === "command") {
        this.mode = "off";
        this.cb.onCommand("");
      }
    }, 6000);
  }

  private clearTimer() {
    if (this.commandTimer) {
      clearTimeout(this.commandTimer);
      this.commandTimer = null;
    }
  }
}
