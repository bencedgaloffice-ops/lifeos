"use client";

import dynamic from "next/dynamic";

/** Leaflet touches `window`, so load the real map only on the client. */
const RealLifeMap = dynamic(() => import("./RealLifeMap").then((m) => m.RealLifeMap), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 flex items-center justify-center rounded-3xl" style={{ background: "#05070A" }}>
      <div
        aria-hidden
        className="h-24 w-24 animate-pulse-glow rounded-full"
        style={{ background: "radial-gradient(circle at 50% 40%, rgba(103,232,249,0.25), transparent 65%)" }}
      />
    </div>
  ),
});

export function RealLifeMapCanvas({ onNavigate }: { onNavigate?: (href: string) => void }) {
  return <RealLifeMap onNavigate={onNavigate} />;
}
