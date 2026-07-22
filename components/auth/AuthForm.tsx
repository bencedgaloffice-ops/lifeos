"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Loader2, Mail } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Logo } from "@/components/ui/Logo";
import { easePremium } from "@/lib/motion";

type Mode = "signin" | "signup";

export function AuthForm() {
  const router = useRouter();
  const params = useSearchParams();
  const redirect = params.get("redirect") || "/dashboard";

  const [mode, setMode] = useState<Mode>("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkEmail, setCheckEmail] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createClient();

    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { display_name: name },
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });
        if (error) throw error;
        if (data.session) {
          router.push(redirect);
          router.refresh();
        } else {
          setCheckEmail(true);
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.push(redirect);
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  if (checkEmail) {
    return (
      <Shell>
        <div className="flex flex-col items-center text-center">
          <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl glass-strong text-accent-soft shadow-glow-sm">
            <Mail className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Confirm your email</h1>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-white/55">
            We sent a confirmation link to <span className="text-white">{email}</span>.
            Open it to activate your LifeOS and step inside.
          </p>
          <button
            onClick={() => {
              setCheckEmail(false);
              setMode("signin");
            }}
            className="mt-8 text-sm text-accent-soft transition-colors hover:text-white"
          >
            Back to sign in
          </button>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="mb-8 flex flex-col items-center text-center">
        <Link href="/" className="mb-6 flex items-center gap-2.5" aria-label="LifeOS home">
          <Logo className="h-8 w-8" />
          <span className="text-base font-semibold tracking-[0.15em]">LIFEOS</span>
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">
          {mode === "signin" ? "Enter your system" : "Create your LifeOS"}
        </h1>
        <p className="mt-2 text-sm text-white/45">
          {mode === "signin"
            ? "Your entire life, in one place."
            : "Begin building your life, intentionally."}
        </p>
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-3.5">
        {mode === "signup" && (
          <Field
            label="Name"
            type="text"
            value={name}
            onChange={setName}
            placeholder="Alex Rivera"
            autoComplete="name"
            required
          />
        )}
        <Field
          label="Email"
          type="email"
          value={email}
          onChange={setEmail}
          placeholder="you@example.com"
          autoComplete="email"
          required
        />
        <Field
          label="Password"
          type="password"
          value={password}
          onChange={setPassword}
          placeholder="••••••••"
          autoComplete={mode === "signin" ? "current-password" : "new-password"}
          minLength={6}
          required
        />

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
              {mode === "signin" ? "Enter LifeOS" : "Create account"}
              <ArrowRight className="h-4 w-4 transition-transform duration-500 group-hover:translate-x-1" />
            </>
          )}
        </button>
      </form>

      <p className="mt-7 text-center text-sm text-white/45">
        {mode === "signin" ? "New to LifeOS?" : "Already have a system?"}{" "}
        <button
          onClick={() => {
            setMode(mode === "signin" ? "signup" : "signin");
            setError(null);
          }}
          className="font-medium text-accent-soft transition-colors hover:text-white"
        >
          {mode === "signin" ? "Create your account" : "Sign in"}
        </button>
      </p>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-[100svh] items-center justify-center overflow-hidden bg-base px-5 py-16">
      {/* Ambient glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 h-[70vh] w-[70vh] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-40 blur-3xl"
        style={{ background: "radial-gradient(circle, rgba(59,130,246,0.22), transparent 60%)" }}
      />
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: easePremium }}
        className="relative w-full max-w-md rounded-[2rem] glass-strong p-8 shadow-glass sm:p-10"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent"
        />
        {children}
      </motion.div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  ...props
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium uppercase tracking-wider text-white/45">
        {label}
      </span>
      <input
        {...props}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-hairline bg-white/[0.03] px-4 py-3 text-[0.95rem] text-white placeholder-white/25 outline-none transition-colors focus:border-accent/60 focus:bg-white/[0.05]"
      />
    </label>
  );
}
