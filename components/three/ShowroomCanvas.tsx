"use client";

import dynamic from "next/dynamic";

/** The showroom is heavy (Three.js). Load it only on the client, after paint. */
const Showroom = dynamic(() => import("./Showroom"), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 flex items-center justify-center">
      <div
        aria-hidden
        className="h-40 w-40 animate-pulse-glow rounded-full"
        style={{ background: "radial-gradient(circle at 50% 50%, rgba(155,176,196,0.35), transparent 70%)" }}
      />
    </div>
  ),
});

export function ShowroomCanvas({ accent }: { accent?: string }) {
  return <Showroom accent={accent} />;
}
