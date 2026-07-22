"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Loader2, Lock, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { OWNER_EMAIL } from "@/lib/supabase/config";
import { Logo } from "@/components/ui/Logo";
import { easePremium } from "@/lib/motion";

/**
 * A single-password lock screen for a personal LifeOS.
 * First launch → choose a password. After that → enter it. No email, no
 * accounts. The password unlocks the one hidden owner identity that carries
 * all your data.
 */
export function AuthForm() {
  const router = useRouter();
  const params = useSearchParams();
  const redirect = params.get("redirect") || "/dashboard";

  const [ready, setReady] = useState(false);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const supabase = createClient();
        const { data } = await supabase.rpc("lifeos_is_initialized");
        setNeedsSetup(data === false);
      } finally {
        setReady(true);
      }
    })();
  }, []);

  async function signIn(pw: string) {
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: OWNER_EMAIL,
      password: pw,
    });
    if (error) throw new Error("Incorrect password.");
    router.push(redirect);
    router.refresh();
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createClient();

    try {
      if (needsSetup) {
        if (password.length < 4) throw new Error("Use at least 4 characters.");
        if (password !== confirm) throw new Error("Passwords don't match.");
        const { data, error } = await supabase.rpc("lifeos_initialize", {
          new_password: password,
        });
        if (error) throw error;
        if (!data) throw new Error("Already set up — refresh and sign in.");
        await signIn(password);
      } else {
        await signIn(password);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-[100svh] items-center justify-center overflow-hidden bg-base px-5 py-16">
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 h-[70vh] w-[70vh] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-40 blur-3xl"
        style={{ background: "radial-gradient(circle, rgba(59,130,246,0.22), transparent 60%)" }}
      />
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: easePremium }}
        className="relative w-full max-w-sm rounded-[2rem] glass-strong p-8 shadow-glass sm:p-10"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent"
        />

        <div className="mb-8 flex flex-col items-center text-center">
          <Link href="/" className="mb-6 flex items-center gap-2.5" aria-label="LifeOS home">
            <Logo className="h-8 w-8" />
            <span className="text-base font-semibold tracking-[0.15em]">LIFEOS</span>
          </Link>
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl glass text-accent-soft shadow-glow-sm">
            {needsSetup ? <ShieldCheck className="h-5 w-5" /> : <Lock className="h-5 w-5" />}
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {needsSetup ? "Set your password" : "Welcome back"}
          </h1>
          <p className="mt-2 text-sm text-white/45">
            {needsSetup
              ? "Choose the password that unlocks your LifeOS."
              : "Enter your password to open your system."}
          </p>
        </div>

        {!ready ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-white/40" />
          </div>
        ) : (
          <form onSubmit={onSubmit} className="flex flex-col gap-3.5">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              autoComplete={needsSetup ? "new-password" : "current-password"}
              autoFocus
              required
              className="w-full rounded-xl border border-hairline bg-white/[0.03] px-4 py-3 text-[0.95rem] text-white placeholder-white/25 outline-none transition-colors focus:border-accent/60 focus:bg-white/[0.05]"
            />
            {needsSetup && (
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Confirm password"
                autoComplete="new-password"
                required
                className="w-full rounded-xl border border-hairline bg-white/[0.03] px-4 py-3 text-[0.95rem] text-white placeholder-white/25 outline-none transition-colors focus:border-accent/60 focus:bg-white/[0.05]"
              />
            )}

            {error && (
              <p className="rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-2.5 text-sm text-red-200">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="group mt-2 inline-flex items-center justify-center gap-2 rounded-full bg-white px-6 py-3.5 text-[0.95rem] font-medium text-black shadow-[0_10px_40px_-12px_rgba(59,130,246,0.7)] transition-all duration-500 ease-premium hover:-translate-y-0.5 hover:shadow-[0_16px_60px_-14px_rgba(59,130,246,0.95)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  {needsSetup ? "Create & enter" : "Enter LifeOS"}
                  <ArrowRight className="h-4 w-4 transition-transform duration-500 group-hover:translate-x-1" />
                </>
              )}
            </button>
          </form>
        )}

        <p className="mt-7 text-center text-xs text-white/35">
          {needsSetup
            ? "You can change this anytime in Settings."
            : "Private to you · encrypted at rest."}
        </p>
      </motion.div>
    </div>
  );
}
