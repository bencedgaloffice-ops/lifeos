/**
 * Permission engine for Jarvis.
 *
 * Three tiers of trust:
 *   L1 Assistant  — always available: answer questions, read data, navigate.
 *   L2 Operator   — unlocked by the spoken/typed passphrase "I allow it";
 *                   may create and edit LifeOS data.
 *   L3 Developer  — unlocked separately (a distinct confirmation), never by
 *                   accident; may alter layouts, theme and modules.
 *
 * An elevated session is time-boxed: after {@link ELEVATED_SESSION_MS} of
 * inactivity it silently drops back to L1, so a granted permission never
 * lingers indefinitely.
 */

import {
  ELEVATED_SESSION_MS,
  OPERATOR_PHRASE,
  type PermissionLevel,
} from "./types";

export type PermissionSession = {
  level: PermissionLevel;
  /** Epoch ms at which the elevated grant expires (Infinity for L1). */
  expiresAt: number;
};

export function baseSession(): PermissionSession {
  return { level: 1, expiresAt: Infinity };
}

/** Normalize a phrase for comparison: lowercase, stripped punctuation. */
function normalize(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Does the spoken/typed phrase satisfy the Level 2 unlock? */
export function isOperatorPhrase(phrase: string): boolean {
  return normalize(phrase) === OPERATOR_PHRASE;
}

/** Grant a level, returning a fresh time-boxed session. */
export function grant(level: PermissionLevel): PermissionSession {
  if (level === 1) return baseSession();
  return { level, expiresAt: Date.now() + ELEVATED_SESSION_MS };
}

/** Bump the expiry on an already-elevated session (activity keeps it alive). */
export function touch(session: PermissionSession): PermissionSession {
  if (session.level === 1) return session;
  return { ...session, expiresAt: Date.now() + ELEVATED_SESSION_MS };
}

/** Collapse an expired elevated session back to L1. */
export function reconcile(session: PermissionSession): PermissionSession {
  if (session.level > 1 && Date.now() > session.expiresAt) return baseSession();
  return session;
}

/** Does the current session clear the level a command requires? */
export function satisfies(session: PermissionSession, required: PermissionLevel): boolean {
  return reconcile(session).level >= required;
}
