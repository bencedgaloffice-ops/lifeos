"use client";

import { useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import {
  Settings,
  Lock,
  Check,
  Loader2,
  LogOut,
  Globe2,
  CalendarDays,
  Copy,
  RefreshCcw,
  Link2,
  Unlink,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { locales, localeLabels, type Locale } from "@/lib/i18n/translations";
import { ModuleHeader, Panel, Field, inputClass } from "@/components/dashboard/ui";
import { rotateCalendarToken, saveLocale, disconnectGoogle, syncGoogleNow } from "@/app/dashboard/settings/actions";
import { cn } from "@/lib/utils";

export function SettingsModule({
  feedToken,
  googleConfigured,
  googleConnection,
  googleImported,
}: {
  feedToken: string | null;
  googleConfigured: boolean;
  googleConnection: { syncEnabled: boolean; lastSyncedAt: string | null } | null;
  googleImported: { count: number; latestEventDate: string | null };
}) {
  const { t, tList, locale, setLocale } = useLocale();
  const searchParams = useSearchParams();
  const googleStatus = searchParams.get("google");
  const [googlePending, startGoogleTransition] = useTransition();
  const googleSteps = tList("settings.calendarGoogleSteps");
  const appleSteps = tList("settings.calendarAppleSteps");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [messageKey, setMessageKey] = useState<string | null>(null);
  const [rawMessage, setRawMessage] = useState<string | null>(null);

  const [token, setToken] = useState(feedToken);
  const [rotating, startRotate] = useTransition();
  const [copied, setCopied] = useState(false);

  const feedUrl =
    token && typeof window !== "undefined"
      ? `${window.location.origin}/api/calendar/${token}`
      : null;

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setMessageKey(null);
    setRawMessage(null);

    if (next.length < 4) {
      setStatus("error");
      setMessageKey("settings.errorShort");
      return;
    }
    if (next !== confirm) {
      setStatus("error");
      setMessageKey("settings.errorMismatch");
      return;
    }

    setStatus("saving");
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password: next });
    if (error) {
      setStatus("error");
      setRawMessage(error.message);
      return;
    }
    setStatus("saved");
    setMessageKey("settings.passwordUpdated");
    setNext("");
    setConfirm("");
    setTimeout(() => setStatus("idle"), 2500);
  }

  function pickLocale(l: Locale) {
    setLocale(l);
    // Fire-and-forget persistence to the profile row.
    startRotate(() => saveLocale(l));
  }

  function generateToken() {
    startRotate(async () => {
      const fresh = await rotateCalendarToken();
      if (fresh) setToken(fresh);
    });
  }

  async function copyFeed() {
    if (!feedUrl) return;
    try {
      await navigator.clipboard.writeText(feedUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable — the URL is visible and selectable anyway.
    }
  }

  const message = messageKey ? t(messageKey) : rawMessage;

  return (
    <div>
      <ModuleHeader icon={Settings} title={t("settings.title")} subtitle={t("settings.subtitle")} />

      <div className="grid max-w-2xl gap-4">
        {/* Language */}
        <Panel>
          <CardHead icon={Globe2} title={t("settings.languageTitle")} hint={t("settings.languageHint")} />
          <div className="flex gap-2">
            {locales.map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => pickLocale(l)}
                aria-pressed={locale === l}
                className={cn(
                  "flex-1 rounded-2xl border px-4 py-3.5 text-sm font-medium transition-all duration-300",
                  locale === l
                    ? "border-accent/60 bg-accent/12 text-white shadow-glow-sm"
                    : "border-hairline bg-white/[0.02] text-white/55 hover:text-white",
                )}
              >
                {localeLabels[l]}
              </button>
            ))}
          </div>
        </Panel>

        {/* Calendar sync */}
        <Panel>
          <CardHead
            icon={CalendarDays}
            title={t("settings.calendarTitle")}
            hint={t("settings.calendarHint")}
          />

          {!token ? (
            <div className="flex flex-col items-start gap-3">
              <p className="text-sm text-white/45">{t("settings.calendarNoFeed")}</p>
              <button
                onClick={generateToken}
                disabled={rotating}
                className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-medium text-black transition-transform hover:-translate-y-0.5 disabled:opacity-60"
              >
                {rotating ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarDays className="h-4 w-4" />}
                {t("settings.calendarGenerate")}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <code className="min-w-0 flex-1 truncate rounded-xl border border-hairline bg-white/[0.03] px-3.5 py-2.5 font-mono text-xs text-white/70">
                  {feedUrl ?? "…"}
                </code>
                <button
                  onClick={copyFeed}
                  className="inline-flex h-[38px] shrink-0 items-center gap-1.5 rounded-xl glass px-3 text-xs text-white/70 transition-colors hover:text-white"
                >
                  {copied ? <Check className="h-3.5 w-3.5 text-emerald-300" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? t("settings.calendarCopied") : t("settings.calendarCopy")}
                </button>
                <button
                  onClick={generateToken}
                  disabled={rotating}
                  title={t("settings.calendarRegenerate")}
                  aria-label={t("settings.calendarRegenerate")}
                  className="inline-flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-xl glass text-white/60 transition-colors hover:text-white disabled:opacity-50"
                >
                  <RefreshCcw className={cn("h-3.5 w-3.5", rotating && "animate-spin")} />
                </button>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <StepsCard title={t("settings.calendarGoogleTitle")} steps={googleSteps} />
                <StepsCard title={t("settings.calendarAppleTitle")} steps={appleSteps} />
              </div>

              <p className="text-xs leading-relaxed text-white/35">{t("settings.calendarOneWay")}</p>
            </div>
          )}
        </Panel>

        {/* Google Calendar — what's actually imported today */}
        <Panel>
          <CardHead icon={CalendarDays} title={t("settings.google.importedTitle")} hint={t("settings.google.hint")} />

          {googleImported.count === 0 ? (
            <p className="text-sm text-white/45">{t("settings.google.importedNone")}</p>
          ) : (
            <div className="flex items-center justify-between text-sm">
              <span className="text-white/80">{t("settings.google.importedCount", { n: googleImported.count })}</span>
              {googleImported.latestEventDate && (
                <span className="text-white/40">
                  {t("settings.google.latestEvent")}: {new Date(googleImported.latestEventDate).toLocaleDateString(locale === "hu" ? "hu-HU" : "en-US")}
                </span>
              )}
            </div>
          )}
          <p className="mt-3 text-xs leading-relaxed text-white/35">{t("settings.google.importedHint")}</p>
        </Panel>

        {/* Google Calendar — optional full two-way OAuth upgrade */}
        <Panel>
          <CardHead icon={Link2} title={t("settings.google.twoWayTitle")} hint={t("settings.google.twoWayHint")} />

          {googleStatus && (
            <p
              className={cn(
                "mb-4 rounded-xl border px-4 py-2.5 text-sm",
                googleStatus === "connected"
                  ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-200"
                  : "border-red-500/25 bg-red-500/10 text-red-200",
              )}
            >
              {googleStatus === "connected" && t("settings.google.connectSuccess")}
              {googleStatus === "not_configured" && t("settings.google.notConfigured")}
              {googleStatus === "no_refresh_token" && t("settings.google.noRefreshToken")}
              {googleStatus === "error" && t("settings.google.connectError")}
            </p>
          )}

          {!googleConnection ? (
            <a
              href={googleConfigured ? "/api/auth/google/start" : undefined}
              aria-disabled={!googleConfigured}
              className={cn(
                "inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-medium text-black transition-transform",
                googleConfigured ? "hover:-translate-y-0.5" : "pointer-events-none opacity-50",
              )}
            >
              <Link2 className="h-4 w-4" />
              {t("settings.google.connect")}
            </a>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="inline-flex items-center gap-1.5 text-emerald-300">
                  <Check className="h-3.5 w-3.5" />
                  {t("settings.google.connected")}
                </span>
                <span className="text-white/40">
                  {t("settings.google.lastSynced")}:{" "}
                  {googleConnection.lastSyncedAt ? new Date(googleConnection.lastSyncedAt).toLocaleString(locale === "hu" ? "hu-HU" : "en-US") : t("settings.google.never")}
                </span>
              </div>

              {!googleConnection.syncEnabled && (
                <p className="rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-2.5 text-xs text-amber-200">
                  {t("settings.google.disabledHint")}
                </p>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => startGoogleTransition(() => syncGoogleNow())}
                  disabled={googlePending}
                  className="inline-flex items-center gap-1.5 rounded-full glass px-4 py-2 text-xs font-medium text-white/70 transition-colors hover:text-white disabled:opacity-50"
                >
                  <RefreshCcw className={cn("h-3.5 w-3.5", googlePending && "animate-spin")} />
                  {t("settings.google.syncNow")}
                </button>
                <button
                  onClick={() => startGoogleTransition(() => disconnectGoogle())}
                  disabled={googlePending}
                  className="inline-flex items-center gap-1.5 rounded-full glass px-4 py-2 text-xs font-medium text-red-300/80 transition-colors hover:text-red-300 disabled:opacity-50"
                >
                  <Unlink className="h-3.5 w-3.5" />
                  {t("settings.google.disconnect")}
                </button>
              </div>
            </div>
          )}
        </Panel>

        {/* Password */}
        <Panel>
          <CardHead icon={Lock} title={t("settings.passwordTitle")} hint={t("settings.passwordHint")} />

          <form onSubmit={changePassword} className="grid gap-4">
            <Field label={t("settings.newPassword")}>
              <input
                type="password"
                value={next}
                onChange={(e) => setNext(e.target.value)}
                placeholder="••••••••"
                autoComplete="new-password"
                className={inputClass}
              />
            </Field>
            <Field label={t("settings.confirmNewPassword")}>
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
                {t("settings.updatePassword")}
              </button>
            </div>
          </form>
        </Panel>

        {/* Session */}
        <Panel>
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold">{t("settings.sessionTitle")}</h2>
              <p className="text-xs text-white/40">{t("settings.sessionHint")}</p>
            </div>
            <form action="/auth/signout" method="post">
              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-full glass px-4 py-2.5 text-sm text-white/70 transition-colors hover:text-white"
              >
                <LogOut className="h-4 w-4" /> {t("settings.lock")}
              </button>
            </form>
          </div>
        </Panel>
      </div>
    </div>
  );
}

function CardHead({
  icon: Icon,
  title,
  hint,
}: {
  icon: typeof Settings;
  title: string;
  hint: string;
}) {
  return (
    <div className="mb-5 flex items-center gap-3">
      <div className="flex h-9 w-9 items-center justify-center rounded-xl glass-strong text-accent-soft">
        <Icon className="h-4 w-4" strokeWidth={1.75} />
      </div>
      <div>
        <h2 className="text-base font-semibold tracking-tight">{title}</h2>
        <p className="text-xs text-white/40">{hint}</p>
      </div>
    </div>
  );
}

function StepsCard({ title, steps }: { title: string; steps: string[] }) {
  return (
    <div className="rounded-2xl bg-white/[0.03] p-4">
      <p className="mb-2 text-sm font-medium">{title}</p>
      <ol className="space-y-1.5">
        {steps.map((s, i) => (
          <li key={i} className="flex gap-2 text-xs leading-relaxed text-white/55">
            <span className="text-accent-soft">{i + 1}.</span>
            {s}
          </li>
        ))}
      </ol>
    </div>
  );
}
