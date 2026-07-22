"use client";

import dynamic from "next/dynamic";

const AISphere = dynamic(() => import("./AISphere"), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 flex items-center justify-center">
      <div
        aria-hidden
        className="h-56 w-56 animate-pulse-glow rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(59,130,246,0.5), transparent 65%)",
        }}
      />
    </div>
  ),
});

export function AISphereCanvas() {
  return <AISphere />;
}
