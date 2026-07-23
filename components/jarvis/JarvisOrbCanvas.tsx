"use client";

import dynamic from "next/dynamic";
import type { JarvisStatus } from "@/lib/jarvis/types";

/** Three.js is heavy — load the orb only on the client, after paint. */
const JarvisOrb = dynamic(() => import("./JarvisOrb"), {
  ssr: false,
  loading: () => <OrbFallback />,
});

function OrbFallback() {
  return (
    <div
      aria-hidden
      className="h-full w-full animate-pulse-glow rounded-full"
      style={{
        background:
          "radial-gradient(circle at 50% 45%, rgba(255,45,63,0.5), rgba(255,45,63,0.08) 55%, transparent 72%)",
      }}
    />
  );
}

export function JarvisOrbCanvas(props: {
  status: JarvisStatus;
  accent?: string;
  reducedMotion?: boolean;
}) {
  return <JarvisOrb {...props} />;
}
