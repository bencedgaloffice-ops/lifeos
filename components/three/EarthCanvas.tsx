"use client";

import dynamic from "next/dynamic";

/** Earth is heavy (Three.js). Load it only on the client, after paint. */
const Earth = dynamic(() => import("./Earth"), {
  ssr: false,
  loading: () => <EarthFallback />,
});

function EarthFallback() {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div
        aria-hidden
        className="h-[46vh] w-[46vh] max-h-[520px] max-w-[520px] animate-pulse-glow rounded-full"
        style={{
          background:
            "radial-gradient(circle at 50% 40%, rgba(59,130,246,0.35), rgba(59,130,246,0.05) 55%, transparent 70%)",
        }}
      />
    </div>
  );
}

export function EarthCanvas() {
  return <Earth />;
}
