"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, LogOut } from "lucide-react";
import { Logo } from "@/components/ui/Logo";
import { lifeNav, businessNav, utilityNav, sectionForPath, type NavSection } from "@/lib/nav";
import { greetingKey, initialsFromName } from "@/lib/format";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { cn } from "@/lib/utils";
import { MODULE_THEME, type ModuleKey } from "@/lib/module-theme";

type Props = {
  name: string;
  email: string;
  children: React.ReactNode;
};

/** Resolves which module "room" the current route belongs to, so the
 * ambient background can wash into that module's identity color. */
function activeModuleKey(pathname: string): ModuleKey {
  if (pathname === "/dashboard") return "overview";
  if (pathname.startsWith("/dashboard/business")) return "business";
  const match = pathname.match(/^\/dashboard\/([a-z]+)/);
  const key = match?.[1];
  return key && key in MODULE_THEME ? (key as ModuleKey) : "overview";
}

export function DashboardShell({ name, email, children }: Props) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { t, locale } = useLocale();
  const roomKey = activeModuleKey(pathname);
  const roomColor = MODULE_THEME[roomKey].color;

  const now = new Date();
  const dateLabel = new Intl.DateTimeFormat(locale === "hu" ? "hu-HU" : "en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(now);

  return (
    <div className="min-h-[100svh] bg-base text-white">
      {/* Ambient — washes into the active module's identity color, so
          switching sections reads as entering a different room. */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <AnimatePresence>
          <motion.div
            key={roomKey}
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="absolute -top-1/4 left-1/2 h-[60vh] w-[120vw] -translate-x-1/2"
            style={{
              background: `radial-gradient(ellipse 50% 50% at 50% 50%, ${roomColor}1F, transparent 70%)`,
            }}
          />
        </AnimatePresence>
      </div>

      <div className="mx-auto flex w-full max-w-[1600px]">
        {/* Sidebar (desktop) */}
        <aside className="sticky top-0 hidden h-[100svh] w-64 shrink-0 flex-col border-r border-hairline p-5 lg:flex">
          <SidebarContent pathname={pathname} />
        </aside>

        {/* Main column */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Topbar */}
          <header className="sticky top-0 z-30 border-b border-hairline bg-base/70 backdrop-blur-xl">
            <div className="flex items-center justify-between gap-4 px-5 py-4 sm:px-8">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setMobileOpen(true)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full glass lg:hidden"
                  aria-label="Open navigation"
                >
                  <Menu className="h-5 w-5" />
                </button>
                <div>
                  <p className="text-[0.95rem] font-semibold tracking-tight sm:text-lg">
                    {t(greetingKey(now))}, {name.split(" ")[0]}
                  </p>
                  <p className="text-xs text-white/40 sm:text-sm">{dateLabel}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="hidden text-right sm:block">
                  <p className="text-sm font-medium">{name}</p>
                  <p className="text-xs text-white/40">{email}</p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-accent to-violet-500 text-sm font-semibold">
                  {initialsFromName(name)}
                </div>
                <form action="/auth/signout" method="post">
                  <button
                    type="submit"
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full glass text-white/60 transition-colors hover:text-white"
                    aria-label={t("shell.signOut")}
                    title={t("shell.signOut")}
                  >
                    <LogOut className="h-4 w-4" />
                  </button>
                </form>
              </div>
            </div>
          </header>

          <main className="flex-1 px-5 py-7 sm:px-8 sm:py-9">{children}</main>
        </div>
      </div>

      {/* Mobile nav drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
            />
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-hairline bg-base p-5 lg:hidden"
            >
              <button
                onClick={() => setMobileOpen(false)}
                className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full glass"
                aria-label="Close navigation"
              >
                <X className="h-4 w-4" />
              </button>
              <SidebarContent
                pathname={pathname}
                onNavigate={() => setMobileOpen(false)}
              />
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

function SidebarContent({
  pathname,
  onNavigate,
}: {
  pathname: string;
  onNavigate?: () => void;
}) {
  const { t } = useLocale();
  const section = sectionForPath(pathname);
  const sectionNav = section === "business" ? businessNav : lifeNav;

  return (
    <>
      <Link
        href="/dashboard"
        onClick={onNavigate}
        className="mb-6 flex items-center gap-2.5 px-2"
      >
        <Logo className="h-7 w-7" />
        <span className="text-[0.95rem] font-semibold tracking-[0.06em]">LifeOS</span>
      </Link>

      <div className="mb-5 grid grid-cols-2 gap-1 rounded-full glass p-1">
        {(["life", "business"] as NavSection[]).map((s) => (
          <Link
            key={s}
            href={s === "life" ? "/dashboard" : "/dashboard/business"}
            onClick={onNavigate}
            className={cn(
              "rounded-full px-3 py-2 text-center text-xs font-semibold uppercase tracking-wider transition-colors",
              section === s
                ? s === "business"
                  ? "bg-blue-500/90 text-white"
                  : "bg-white text-black"
                : "text-white/45 hover:text-white/70",
            )}
          >
            {t(`shell.section.${s}`)}
          </Link>
        ))}
      </div>

      <nav className="flex flex-1 flex-col gap-1">
        {sectionNav.map((item) => (
          <NavLink key={item.href} item={item} pathname={pathname} onNavigate={onNavigate} />
        ))}

        <div className="my-3 h-px bg-hairline" />

        {utilityNav.map((item) => (
          <NavLink key={item.href} item={item} pathname={pathname} onNavigate={onNavigate} />
        ))}
      </nav>

      <div className="mt-4 rounded-2xl glass p-4">
        <p className="text-xs leading-relaxed text-white/45">{t("shell.privacyNote")}</p>
      </div>
    </>
  );
}

function NavLink({
  item,
  pathname,
  onNavigate,
}: {
  item: { key: string; href: string; icon: React.ComponentType<{ className?: string; strokeWidth?: number }> };
  pathname: string;
  onNavigate?: () => void;
}) {
  const { t } = useLocale();
  const Icon = item.icon;
  const active =
    item.href === "/dashboard" || item.href === "/dashboard/business"
      ? pathname === item.href
      : pathname.startsWith(item.href);
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={cn(
        "group relative flex items-center gap-3 rounded-2xl px-3.5 py-3 transition-all duration-300",
        active ? "glass text-white" : "text-white/50 hover:bg-white/[0.04] hover:text-white",
      )}
    >
      {active && (
        <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-accent shadow-glow-sm" />
      )}
      <Icon
        className={cn(
          "h-[18px] w-[18px] transition-colors",
          active ? "text-accent-soft" : "text-white/50 group-hover:text-white",
        )}
        strokeWidth={1.75}
      />
      <span className="text-sm font-medium">{t(`nav.${item.key}.label`)}</span>
    </Link>
  );
}
