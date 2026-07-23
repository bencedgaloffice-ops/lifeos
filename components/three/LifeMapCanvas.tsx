"use client";

import dynamic from "next/dynamic";
import type { LifeMapLocation } from "@/lib/types";

/** Three.js is heavy — load the scene only on the client. */
const LifeMap = dynamic(() => import("./LifeMap").then((m) => m.LifeMap), {
  ssr: false,
  loading: () => <MapFallback />,
});

function MapFallback() {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div
        aria-hidden
        className="h-40 w-40 animate-pulse-glow rounded-full"
        style={{
          background: "radial-gradient(circle at 50% 40%, rgba(103,232,249,0.25), transparent 65%)",
        }}
      />
    </div>
  );
}

export function LifeMapCanvas({
  locations,
  selectedId,
  onSelect,
  progress,
}: {
  locations: LifeMapLocation[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  progress?: Record<string, { total: number; completed: number }>;
}) {
  return <LifeMap locations={locations} selectedId={selectedId} onSelect={onSelect} progress={progress} />;
}
