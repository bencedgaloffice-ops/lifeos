/**
 * Speech recognition for Jarvis — wake-word detection *and* command capture,
 * both from the browser's built-in Web Speech API (no API key, no model
 * download). The engine runs in two stages:
 *
 *   • "wake"    — continuously scanning for a wake phrase ("hello jarvis").
 *   • "command" — capturing the next utterance as an instruction, for a
 *                 bounded ~12s window.
 *
 * Reliability note: Chrome's SpeechRecognition ends the session (`onend`)
 * shortly after each final result — including right after the wake phrase. The
 * old design reused one long-lived session across both stages, so the command
 * stage often attached to an already-dead recogniser and never re-opened the
 * mic. This version instead **starts a fresh recognition session per stage**
 * (and transparently resurrects one that ends early while a stage is still
 * active), so "Hello Jarvis" → command listening works every time.
 *
 * A cloud recogniser (Whisper) could replace the command-capture leg later
 * behind this same API without changing any callers.
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

/** How long the mic stays open for a command before giving up. */
const COMMAND_WINDOW_MS = 12000;

export type RecognitionCallbacks = {
  onWake: (trailingCommand: string | null) => void;
  onCommand: (text: string) => void;
  onInterim: (text: string) => void;
  onError: (error: string) => void;
  onListeningChange: (listening: boolean) => void;
  /** Optional structured logging for the [JARVIS] developer console trace. */
  onLog?: (message: string) => void;
};

export class RecognitionEngine {
  private rec: SpeechRecognitionLike | null = null;
  private mode: Mode = "off";
  private wakeWords: string[] = ["hello jarvis"];
  private lang = "en-GB";
  private commandTimer: ReturnType<typeof setTimeout> | null = null;
  /** Guards against onend→restart storms. */
  private restarting = false;

  constructor(private cb: RecognitionCallbacks) {}

  get supported(): boolean {
    return recognitionSupported();
  }

  private log(msg: string) {
    this.cb.onLog?.(msg);
  }

  setWakeWords(words: string[]) {
    this.wakeWords = words.map(normalize).filter(Boolean);
  }

  setLanguage(lang: string) {
    this.lang = lang;
    if (this.rec) this.rec.lang = lang;
  }

  /** Begin passive wake-word listening (fresh session). */
  startWake() {
    this.mode = "wake";
    this.clearTimer();
    this.restart();
  }

  /** Open the mic to capture one command (fresh session, bounded window). */
  startCommand() {
    this.mode = "command";
    this.armCommandTimeout();
    this.restart();
  }

  stop() {
    this.mode = "off";
    this.clearTimer();
    this.teardown();
    this.cb.onListeningChange(false);
  }

  /** Tear down the current recogniser without triggering an auto-restart. */
  private teardown() {
    const rec = this.rec;
    this.rec = null;
    if (rec) {
      rec.onend = null;
      rec.onresult = null;
      rec.onerror = null;
      try {
        rec.abort();
      } catch {
        /* ignore */
      }
    }
  }

  /** Abort any existing session and start a brand-new one for the current mode. */
  private restart() {
    if (this.mode === "off") return;
    this.teardown();

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
      if (e.error !== "no-speech" && e.error !== "aborted") {
        this.log(`Recognition error: ${e.error}`);
        this.cb.onError(e.error);
      }
    };
    rec.onend = () => {
      // The browser ends sessions after each result / pause. While a stage is
      // still active, resurrect a fresh session so listening never silently dies.
      if (this.mode !== "off" && this.rec === rec) {
        this.restarting = true;
        setTimeout(() => {
          this.restarting = false;
          if (this.mode !== "off") this.restart();
        }, 120);
      } else {
        this.cb.onListeningChange(false);
      }
    };

    this.rec = rec;
    try {
      rec.start();
      this.cb.onListeningChange(true);
    } catch {
      // start() throws if the previous session hasn't fully released; retry shortly.
      if (!this.restarting) setTimeout(() => this.mode !== "off" && this.restart(), 200);
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
        this.teardown();
        this.cb.onCommand(final.trim());
      } else if (interim) {
        // Speech is flowing — extend the window a little.
        this.armCommandTimeout();
      }
      return;
    }

    if (this.mode === "wake") {
      const haystack = normalize(final || interim);
      if (!haystack) return;
      const hit = this.wakeWords.find((w) => haystack.includes(w));
      if (hit) {
        const idx = haystack.indexOf(hit) + hit.length;
        const trailing = haystack.slice(idx).trim();
        this.mode = "off";
        this.teardown();
        this.log(`Wake word matched: "${hit}"`);
        this.cb.onWake(trailing.length > 1 ? trailing : null);
      }
    }
  }

  private armCommandTimeout() {
    this.clearTimer();
    this.commandTimer = setTimeout(() => {
      if (this.mode === "command") {
        this.mode = "off";
        this.teardown();
        this.log("Command window timed out (no speech)");
        this.cb.onCommand("");
      }
    }, COMMAND_WINDOW_MS);
  }

  private clearTimer() {
    if (this.commandTimer) {
      clearTimeout(this.commandTimer);
      this.commandTimer = null;
    }
  }
}
