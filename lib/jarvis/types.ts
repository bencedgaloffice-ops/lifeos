/**
 * Shared types for the LifeOS AI Companion ("Jarvis").
 *
 * The companion is deliberately split into small, independent units — voice
 * recognition, speech synthesis, wake-word matching, permissions, the command
 * engine and the visual orb — each of which speaks only in the types declared
 * here. Nothing else in the app needs to know how any single piece works.
 */

/** The orb's live state — drives every visual and audio cue. */
export type JarvisStatus =
  | "idle" // resting, slow breathing
  | "waking" // wake word just fired, startup flourish
  | "listening" // capturing the user's speech
  | "thinking" // resolving a command
  | "speaking" // talking back
  | "denied"; // a privileged action was refused

/**
 * Three tiers of trust. Higher levels unlock progressively more dangerous
 * capabilities and each requires its own explicit unlock.
 */
export type PermissionLevel = 1 | 2 | 3;

export const PERMISSION_LABELS: Record<PermissionLevel, string> = {
  1: "Assistant",
  2: "Operator",
  3: "Developer",
};

/** The passphrase that unlocks Level 2 (Operator). */
export const OPERATOR_PHRASE = "i allow it";

/** How long an elevated session stays unlocked before dropping back to L1. */
export const ELEVATED_SESSION_MS = 15 * 60 * 1000;

export type VoiceProviderId = "browser" | "openai" | "elevenlabs" | "piper";
export type RecognitionProviderId = "browser" | "whisper";

/** Everything the user can tune from the AI Settings panel. */
export type JarvisSettings = {
  enabled: boolean;
  alwaysListening: boolean;
  wakeWords: string[];
  // Voice
  voiceProvider: VoiceProviderId;
  voiceURI: string | null; // specific speechSynthesis voice
  rate: number; // 0.5 – 2
  pitch: number; // 0 – 2
  volume: number; // 0 – 1
  language: string; // BCP-47, e.g. "en-GB"
  responseLength: "concise" | "balanced" | "detailed";
  // Recognition
  recognitionProvider: RecognitionProviderId;
  // Memory / privacy
  rememberConversations: boolean;
  storeTranscripts: boolean;
  // Appearance
  accent: string; // orb hue as hex
  reducedMotion: boolean;
  soundEffects: boolean;
  // Developer
  developerUnlocked: boolean;
};

/** A parsed instruction ready for the state machine to run. */
export type JarvisCommand = {
  /** Coarse routing bucket. */
  kind: "navigate" | "read" | "write" | "developer" | "system" | "chat";
  /** Minimum trust required to run it. */
  level: PermissionLevel;
  /** A human label used in confirmations / notifications. */
  label: string;
  /** Whether the user should confirm before it runs (destructive edits). */
  confirm?: boolean;
  /** Opaque payload for the executor. */
  intent: string;
  args: Record<string, string>;
};

export type JarvisNotificationTone = "info" | "success" | "warning" | "granted" | "denied";

export type JarvisNotification = {
  id: string;
  tone: JarvisNotificationTone;
  title: string;
  body?: string;
  createdAt: number;
};

/** One exchanged line, shown in the transcript panel. */
export type TranscriptLine = {
  id: string;
  role: "user" | "jarvis";
  text: string;
};
