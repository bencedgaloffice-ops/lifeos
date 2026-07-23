"use client";

import { AnimatePresence, motion } from "framer-motion";
import { JarvisProvider, useJarvis } from "@/lib/jarvis/useJarvis";
import { JarvisWidget } from "./JarvisWidget";
import { JarvisNotifications } from "./JarvisNotifications";
import { CommandPalette } from "./CommandPalette";
import { JarvisSettingsPanel } from "./JarvisSettingsPanel";

/**
 * Single mount point for the AI companion: the state-machine provider plus the
 * always-on surfaces (floating orb widget, holographic notifications, command
 * palette, settings panel and the activation dim). Dropped once into the
 * dashboard (persistent, every page) and once onto the landing page (a compact
 * voice-access orb).
 *
 * The settings panel and the full-screen dim live here — as siblings of the
 * widget — rather than inside it, because the widget's draggable container
 * carries a transform, which would otherwise become the containing block for
 * their `position: fixed` and knock them off the viewport.
 */
export function JarvisRoot({
  variant = "dashboard",
  userName,
  children,
}: {
  variant?: "dashboard" | "landing";
  userName?: string;
  children?: React.ReactNode;
}) {
  return (
    <JarvisProvider userName={userName}>
      {children}
      <ActivationDim />
      <JarvisWidget variant={variant} />
      <JarvisNotifications />
      <CommandPalette />
      <SettingsHost />
    </JarvisProvider>
  );
}

function SettingsHost() {
  const { settingsOpen, setSettingsOpen } = useJarvis();
  return <JarvisSettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} />;
}

/** Subtle screen darken + red vignette whenever the companion is engaged. */
function ActivationDim() {
  const { status, settings } = useJarvis();
  const active = status !== "idle";
  return (
    <AnimatePresence>
      {active && !settings.reducedMotion && (
        <motion.div
          aria-hidden
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="pointer-events-none fixed inset-0 z-[55]"
          style={{
            background:
              "radial-gradient(ellipse 60% 60% at 100% 100%, rgba(255,45,63,0.12), transparent 55%), rgba(0,0,0,0.26)",
          }}
        />
      )}
    </AnimatePresence>
  );
}
