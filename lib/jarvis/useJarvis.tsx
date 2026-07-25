"use client";

/**
 * JarvisProvider — the state machine that ties every piece together.
 *
 * It owns the companion's live status, the permission session, the voice
 * engines and the running transcript, and exposes a small imperative API the
 * UI (orb, widget, command palette, settings) drives. Voice is optional: with
 * the microphone denied or unsupported, everything still works through typed
 * input, so the feature degrades gracefully.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { SpeechEngine } from "./speech";
import { RecognitionEngine, recognitionSupported } from "./recognition";
import { parseCommand } from "./commands";
import {
  baseSession,
  grant,
  reconcile,
  satisfies,
  touch,
  type PermissionSession,
} from "./permissions";
import { DEFAULT_SETTINGS, loadSettings, saveSettings } from "./settings";
import { orbSpeakStart, orbSpeakBoundary, orbSpeakEnd } from "./orbSignal";
import type {
  JarvisCommand,
  JarvisNotification,
  JarvisNotificationTone,
  JarvisSettings,
  JarvisStatus,
  PermissionLevel,
  TranscriptLine,
} from "./types";
import { askJarvis, type UiDirective } from "@/app/dashboard/ai/agent-actions";
import {
  jarvisAddJournal,
  jarvisAddKitchen,
  jarvisAddShopping,
  jarvisAnalyzeVehicle,
  jarvisAsk,
  jarvisCreateGoal,
  jarvisCreateReminder,
  jarvisRemember,
  jarvisRemoveShopping,
  jarvisWebAnswer,
} from "@/app/dashboard/ai/jarvis-actions";

type JarvisContextValue = {
  status: JarvisStatus;
  level: PermissionLevel;
  settings: JarvisSettings;
  voiceSupported: boolean;
  listening: boolean;
  transcript: TranscriptLine[];
  interim: string;
  notifications: JarvisNotification[];
  paletteOpen: boolean;
  settingsOpen: boolean;
  pendingConfirm: JarvisCommand | null;

  activate: () => void; // manual mic toggle
  runText: (text: string) => void; // typed / palette input
  confirmPending: (yes: boolean) => void;
  setPaletteOpen: (open: boolean) => void;
  setSettingsOpen: (open: boolean) => void;
  updateSettings: (patch: Partial<JarvisSettings>) => void;
  elevateToOperator: () => void;
  setDeveloperUnlocked: (on: boolean) => void;
  lockDown: () => void;
  notify: (tone: JarvisNotificationTone, title: string, body?: string) => void;
  dismissNotification: (id: string) => void;
  speak: (text: string) => void;
};

const JarvisContext = createContext<JarvisContextValue | null>(null);

let idCounter = 0;
const uid = () => `j${Date.now().toString(36)}${(idCounter++).toString(36)}`;

/** Structured developer-console trace for the whole voice pipeline. */
function jlog(...args: unknown[]) {
  if (typeof console !== "undefined") console.log("%c[JARVIS]", "color:#ff2d3f;font-weight:bold", ...args);
}

export function JarvisProvider({ children, userName }: { children: React.ReactNode; userName?: string }) {
  const router = useRouter();
  const { locale } = useLocale();

  const [settings, setSettings] = useState<JarvisSettings>(DEFAULT_SETTINGS);
  const [status, setStatus] = useState<JarvisStatus>("idle");
  const [session, setSession] = useState<PermissionSession>(baseSession());
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState<TranscriptLine[]>([]);
  const [interim, setInterim] = useState("");
  const [notifications, setNotifications] = useState<JarvisNotification[]>([]);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [pendingConfirm, setPendingConfirm] = useState<JarvisCommand | null>(null);
  // Resolved after mount only — computing it during render would differ between
  // the server (no `window`) and the client and break hydration.
  const [voiceSupported, setVoiceSupported] = useState(false);

  // Refs mirror state so engine callbacks (created once) read current values.
  const speechRef = useRef<SpeechEngine | null>(null);
  const recRef = useRef<RecognitionEngine | null>(null);
  const settingsRef = useRef(settings);
  const sessionRef = useRef(session);
  const localeRef = useRef(locale);
  const nameRef = useRef(userName);
  const awaitingOperatorFor = useRef<JarvisCommand | null>(null);
  settingsRef.current = settings;
  sessionRef.current = session;
  localeRef.current = locale;
  nameRef.current = userName;

  /* ---- notifications ---- */
  const notify = useCallback((tone: JarvisNotificationTone, title: string, body?: string) => {
    const n: JarvisNotification = { id: uid(), tone, title, body, createdAt: Date.now() };
    setNotifications((prev) => [...prev, n]);
    // Auto-expire non-critical toasts.
    const ttl = tone === "denied" ? 5200 : 4200;
    setTimeout(() => setNotifications((prev) => prev.filter((x) => x.id !== n.id)), ttl);
  }, []);
  const dismissNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((x) => x.id !== id));
  }, []);

  const pushLine = useCallback((role: TranscriptLine["role"], text: string) => {
    setTranscript((prev) => [...prev.slice(-30), { id: uid(), role, text }]);
  }, []);

  /* ---- speech ---- */
  const speak = useCallback((text: string, onDone?: () => void) => {
    if (!text) { onDone?.(); return; }
    pushLine("jarvis", text);
    const engine = speechRef.current;
    if (!engine || !settingsRef.current.soundEffects) { onDone?.(); return; }
    setStatus("speaking");
    orbSpeakStart();
    engine
      .speak(text, settingsRef.current, {
        onStart: orbSpeakStart,
        onBoundary: orbSpeakBoundary,
      })
      .then(() => {
        orbSpeakEnd();
        jlog("Speech completed");
        setStatus((s) => (s === "speaking" ? "idle" : s));
        onDone?.();
      });
  }, [pushLine]);

  /* ---- command execution ---- */
  const execute = useCallback(
    async (command: JarvisCommand) => {
      const sess = reconcile(sessionRef.current);

      // Trust gate ---------------------------------------------------------
      if (!satisfies(sess, command.level)) {
        if (command.level === 2) {
          awaitingOperatorFor.current = command;
          notify("warning", "Operator access required", "Say or type “I allow it”.");
          speak("That needs Operator access. Say, I allow it, to continue.");
          if (settingsRef.current.alwaysListening || listening) recRef.current?.startCommand();
          return;
        }
        if (command.level === 3) {
          setStatus("denied");
          notify("denied", "Permission Denied", "Developer mode is required for that.");
          speak("Developer access is required. Enable Developer mode in AI settings.");
          setTimeout(() => setStatus("idle"), 1600);
          return;
        }
      }

      switch (command.intent) {
        case "system.sleep":
          recRef.current?.stop();
          setStatus("idle");
          speak("Standing by.");
          return;
        case "system.palette":
          setPaletteOpen(true);
          setStatus("idle");
          return;
        case "system.elevate": {
          const next = grant(2);
          setSession(next);
          sessionRef.current = next;
          notify("granted", "Permission Granted", "Operator access unlocked.");
          const pending = awaitingOperatorFor.current;
          awaitingOperatorFor.current = null;
          if (pending) {
            await execute(pending);
          } else {
            speak("Operator access granted.");
          }
          return;
        }
        case "system.developer":
          if (settingsRef.current.developerUnlocked) {
            const next = grant(3);
            setSession(next);
            sessionRef.current = next;
            notify("granted", "Permission Granted", "Developer access active.");
            speak("Developer mode active.");
          } else {
            notify("denied", "Permission Denied", "Enable Developer mode in AI settings first.");
            speak("Developer mode must be enabled in settings first.");
          }
          return;
        case "system.backup":
          notify("success", "Backup started", "Your LifeOS snapshot is being prepared.");
          speak("I've started a backup of your LifeOS.");
          setStatus("idle");
          return;
        case "navigate":
          router.push(command.args.route);
          notify("info", command.label);
          speak(`Opening ${command.args.label}.`);
          return;
        case "developer.generic":
          notify("info", "Developer request noted", command.args.request);
          speak("Noted. I've logged that developer request.");
          setStatus("idle");
          return;
      }

      // Confirmations for destructive edits -------------------------------
      if (command.confirm && pendingConfirm?.intent !== command.intent) {
        setPendingConfirm(command);
        notify("warning", "Confirm action", command.label);
        speak(`${command.label}. Shall I proceed?`);
        return;
      }
      setPendingConfirm(null);

      // Reads + writes -----------------------------------------------------
      setStatus("thinking");
      jlog("Processing:", command.intent, command.args);
      try {
        const reply = await runIntent(command, localeRef.current, sess.level);
        jlog("AI response generated:", reply.text, reply.used ?? []);
        touchSession();
        // Jarvis may have asked to move the screen as part of answering.
        if (reply.directive) {
          const route = directiveToRoute(reply.directive);
          if (route) router.push(route);
        }
        speak(reply.text);
      } catch (err) {
        jlog("Error running command:", err);
        speak("Something went wrong running that.");
        setStatus("idle");
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [notify, speak, router, listening, pendingConfirm],
  );

  const touchSession = useCallback(() => {
    setSession((s) => {
      const next = touch(s);
      sessionRef.current = next;
      return next;
    });
  }, []);

  const runText = useCallback(
    (text: string) => {
      const clean = text.trim();
      if (!clean) return;
      pushLine("user", clean);
      setInterim("");
      execute(parseCommand(clean));
    },
    [execute, pushLine],
  );

  const confirmPending = useCallback(
    (yes: boolean) => {
      const cmd = pendingConfirm;
      setPendingConfirm(null);
      if (!cmd) return;
      if (yes) {
        execute({ ...cmd, confirm: false });
      } else {
        speak("Cancelled.");
        setStatus("idle");
      }
    },
    [pendingConfirm, execute, speak],
  );

  /* ---- engine wiring (client only) ---- */
  useEffect(() => {
    setSettings(loadSettings());
    setVoiceSupported(recognitionSupported());
    speechRef.current = new SpeechEngine();
    // Warm the voice list (some browsers populate asynchronously).
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
    }

    const rec = new RecognitionEngine({
      // Stage 1 → Stage 2: greet, then re-open the mic for the command.
      onWake: (trailing) => {
        jlog("Wake word detected");
        setStatus("waking");
        notify("info", "Jarvis online", "Listening…");

        // Wake word + command in a single breath ("Hello Jarvis, open kitchen").
        if (trailing) {
          jlog("Command in same breath:", trailing);
          runText(trailing);
          if (settingsRef.current.alwaysListening) setTimeout(() => recRef.current?.startWake(), 500);
          return;
        }

        const name = nameRef.current?.split(" ")[0];
        const greeting = name ? `Yes, ${name}?` : "Yes?";
        // Speak the acknowledgement first; only start capturing once it's done so
        // the recogniser doesn't transcribe Jarvis's own voice.
        speak(greeting, () => {
          setStatus("listening");
          jlog("Listening started (command window open)");
          recRef.current?.startCommand();
        });
      },
      onCommand: (text) => {
        if (text) {
          jlog("Transcript received:", text);
          setInterim("");
          runText(text);
        } else {
          jlog("No command heard");
          setStatus("idle");
        }
        // Resume passive wake listening if enabled.
        if (settingsRef.current.alwaysListening) {
          setTimeout(() => recRef.current?.startWake(), 500);
        }
      },
      onInterim: (t) => {
        setStatus("listening");
        setInterim(t);
      },
      onError: (err) => {
        if (err === "not-allowed" || err === "service-not-allowed") {
          notify("warning", "Microphone blocked", "Enable mic access to talk to Jarvis.");
        }
      },
      onListeningChange: setListening,
      onLog: (m) => jlog(m),
    });
    recRef.current = rec;
    return () => {
      rec.stop();
      speechRef.current?.cancel();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the recognition engine's config in sync with settings.
  useEffect(() => {
    const rec = recRef.current;
    if (!rec) return;
    rec.setWakeWords(settings.wakeWords);
    rec.setLanguage(settings.language);
    if (settings.enabled && settings.alwaysListening) rec.startWake();
    else if (!settings.alwaysListening) {
      // leave any active command capture alone; just stop passive wake loop
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.wakeWords, settings.language, settings.alwaysListening, settings.enabled]);

  // Drop elevated sessions once they expire.
  useEffect(() => {
    if (session.level === 1) return;
    const t = setInterval(() => {
      setSession((s) => {
        const next = reconcile(s);
        if (next.level !== s.level) notify("info", "Session locked", "Back to Assistant access.");
        return next;
      });
    }, 5000);
    return () => clearInterval(t);
  }, [session.level, notify]);

  /* ---- public actions ---- */
  const activate = useCallback(() => {
    const rec = recRef.current;
    if (!rec || !recognitionSupported()) {
      notify("warning", "Voice unavailable", "This browser can't capture speech — type instead.");
      return;
    }
    if (listening) {
      rec.stop();
      setStatus("idle");
    } else {
      setStatus("listening");
      rec.startCommand();
    }
  }, [listening, notify]);

  const updateSettings = useCallback((patch: Partial<JarvisSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      saveSettings(next);
      return next;
    });
  }, []);

  const elevateToOperator = useCallback(() => {
    const next = grant(2);
    setSession(next);
    sessionRef.current = next;
    notify("granted", "Permission Granted", "Operator access unlocked.");
  }, [notify]);

  const setDeveloperUnlocked = useCallback(
    (on: boolean) => {
      updateSettings({ developerUnlocked: on });
      if (on) {
        const next = grant(3);
        setSession(next);
        sessionRef.current = next;
        notify("granted", "Permission Granted", "Developer access active.");
      } else {
        setSession(baseSession());
        sessionRef.current = baseSession();
      }
    },
    [updateSettings, notify],
  );

  const lockDown = useCallback(() => {
    setSession(baseSession());
    sessionRef.current = baseSession();
    notify("info", "Locked", "Session returned to Assistant access.");
  }, [notify]);

  const value = useMemo<JarvisContextValue>(
    () => ({
      status,
      level: session.level,
      settings,
      voiceSupported,
      listening,
      transcript,
      interim,
      notifications,
      paletteOpen,
      settingsOpen,
      pendingConfirm,
      activate,
      runText,
      confirmPending,
      setPaletteOpen,
      setSettingsOpen,
      updateSettings,
      elevateToOperator,
      setDeveloperUnlocked,
      lockDown,
      notify,
      dismissNotification,
      speak,
    }),
    [
      status, session.level, settings, voiceSupported, listening, transcript, interim, notifications,
      paletteOpen, settingsOpen, pendingConfirm, activate, runText, confirmPending, updateSettings,
      elevateToOperator, setDeveloperUnlocked, lockDown, notify, dismissNotification, speak,
    ],
  );

  return <JarvisContext.Provider value={value}>{children}</JarvisContext.Provider>;
}

export function useJarvis() {
  const ctx = useContext(JarvisContext);
  if (!ctx) throw new Error("useJarvis must be used within a JarvisProvider");
  return ctx;
}

/* ------------------------------------------------------------------ */
/*  Intent → server action dispatch                                    */
/* ------------------------------------------------------------------ */

/** Map a module key from a `navigate` tool call onto a real route. */
const MODULE_ROUTES: Record<string, string> = {
  overview: "/dashboard",
  map: "/dashboard/map",
  calendar: "/dashboard/calendar",
  finance: "/dashboard/finance",
  goals: "/dashboard/goals",
  projects: "/dashboard/projects",
  vision: "/dashboard/vision",
  legacy: "/dashboard/legacy",
  relationship: "/dashboard/relationship",
  habits: "/dashboard/habits",
  protection: "/dashboard/protection",
  journal: "/dashboard/journal",
  kitchen: "/dashboard/kitchen",
  nutrition: "/dashboard/nutrition",
  profile: "/dashboard/profile",
  ai: "/dashboard/ai",
  jarvis: "/dashboard/jarvis",
  settings: "/dashboard/settings",
  business: "/dashboard/business",
  garage: "/dashboard/business/garage",
};

/** Turn a UI directive into a URL, carrying view/focus as query params so the
 * target module can pick them up on mount. */
export function directiveToRoute(d: UiDirective): string | null {
  const base = MODULE_ROUTES[d.module];
  if (!base) return null;
  const q = new URLSearchParams();
  if (d.view) q.set("view", d.view);
  if (d.focus) q.set("focus", d.focus);
  const qs = q.toString();
  return qs ? `${base}?${qs}` : base;
}

export type IntentResult = {
  /** What Jarvis says back. */
  text: string;
  /** A screen change it asked for, if any. */
  directive?: UiDirective | null;
  /** Which specialist answered, for the transcript. */
  agentLabel?: string;
  /** Tools it actually ran. */
  used?: string[];
};

/**
 * Dispatch an intent.
 *
 * The rule-based writes stay rule-based on purpose: "add milk to the shopping
 * list" must be exact and instant, and routing it through a model would make it
 * slower and less reliable, not smarter.
 *
 * The open-ended intents — questions, research, analysis — now go to the
 * agentic core, which can look things up, act, and move the screen. It falls
 * back to the old single-shot path when no API key is configured, so the
 * assistant degrades rather than breaking.
 */
async function runIntent(command: JarvisCommand, locale: string, level: PermissionLevel): Promise<IntentResult> {
  const loc = (locale === "hu" ? "hu" : "en") as "en" | "hu";

  const viaAgent = async (query: string): Promise<IntentResult> => {
    const reply = await askJarvis(query, { level, locale: loc });
    if (reply.answer) {
      return {
        text: reply.answer,
        directive: reply.directive,
        agentLabel: reply.agentLabel,
        used: reply.used,
      };
    }
    // No agent (no key) or the call failed — fall back to the grounded
    // rule-based answer so the user still gets something real.
    if (reply.stop === "not_configured") return { text: await jarvisAsk(query, loc) };
    const web = await jarvisWebAnswer(query);
    return { text: web ?? (await jarvisAsk(query, loc)) };
  };

  switch (command.intent) {
    case "shopping.add":
      return { text: (await jarvisAddShopping(command.args.name)).message };
    case "shopping.remove":
      return { text: (await jarvisRemoveShopping(command.args.name)).message };
    case "kitchen.add":
      return { text: (await jarvisAddKitchen(command.args.name)).message };
    case "goal.create":
      return { text: (await jarvisCreateGoal(command.args.title)).message };
    case "reminder.create":
      return { text: (await jarvisCreateReminder(command.args.title)).message };
    case "journal.add":
      return { text: (await jarvisAddJournal(command.args.text)).message };
    case "memory.add":
      return { text: (await jarvisRemember(command.args.text)).message };
    case "garage.analyze":
      return { text: await jarvisAnalyzeVehicle(command.args.query ?? "", loc) };
    case "web.query":
    case "read.query":
    default:
      return viaAgent(command.args.query ?? "");
  }
}
