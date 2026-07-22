"use client";

import { useState } from "react";
import { Settings, Lock, Check, Loader2, LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ModuleHeader, Panel, Field, inputClass } from "@/components/dashboard/ui";

export function SettingsModule() {
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);

    if (next.length < 4) {
      setStatus("error");
      setMessage("Use at least 4 characters.");
      return;
    }
    if (next !== confirm) {
      setStatus("error");
      setMessage("Passwords don't match.");
      return;
    }

    setStatus("saving");
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password: next });
    if (error) {
      setStatus("error");
      setMessage(error.message);
      return;
    }
    setStatus("saved");
    setMessage("Password updated.");
    setNext("");
    setConfirm("");
    setTimeout(() => setStatus("idle"), 2500);
  }

  return (
    <div>
      <ModuleHeader
        icon={Settings}
        title="Settings"
        subtitle="Your LifeOS, your keys."
      />

      <div className="grid max-w-xl gap-4">
        <Panel>
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl glass-strong text-accent-soft">
              <Lock className="h-4 w-4" strokeWidth={1.75} />
            </div>
            <div>
              <h2 className="text-base font-semibold tracking-tight">Password</h2>
              <p className="text-xs text-white/40">The single key that unlocks your system.</p>
            </div>
          </div>

          <form onSubmit={changePassword} className="grid gap-4">
            <Field label="New password">
              <input
                type="password"
                value={next}
                onChange={(e) => setNext(e.target.value)}
                placeholder="••••••••"
                autoComplete="new-password"
                className={inputClass}
              />
            </Field>
            <Field label="Confirm new password">
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="••••••••"
                autoComplete="new-password"
                className={inputClass}
              />
            </Field>

            {message && (
              <p
                className={
                  status === "error"
                    ? "rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-2.5 text-sm text-red-200"
                    : "rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-2.5 text-sm text-emerald-200"
                }
              >
                {message}
              </p>
            )}

            <div>
              <button
                type="submit"
                disabled={status === "saving"}
                className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-medium text-black shadow-[0_10px_40px_-12px_rgba(59,130,246,0.7)] transition-transform hover:-translate-y-0.5 disabled:opacity-60"
              >
                {status === "saving" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : status === "saved" ? (
                  <Check className="h-4 w-4" />
                ) : null}
                Update password
              </button>
            </div>
          </form>
        </Panel>

        <Panel>
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold">Session</h2>
              <p className="text-xs text-white/40">Signed in on this device.</p>
            </div>
            <form action="/auth/signout" method="post">
              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-full glass px-4 py-2.5 text-sm text-white/70 transition-colors hover:text-white"
              >
                <LogOut className="h-4 w-4" /> Lock LifeOS
              </button>
            </form>
          </div>
        </Panel>
      </div>
    </div>
  );
}
