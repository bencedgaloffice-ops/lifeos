"use client";

import dynamic from "next/dynamic";
import type { KitchenObject, KitchenControlLabels, FridgeInventory } from "./Kitchen3D";

/** The kitchen scene is heavy (Three.js). Load it only on the client. */
const Kitchen3D = dynamic(() => import("./Kitchen3D"), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 flex items-center justify-center">
      <div
        aria-hidden
        className="h-40 w-40 animate-pulse-glow rounded-full"
        style={{ background: "radial-gradient(circle at 50% 50%, rgba(249,115,22,0.3), transparent 70%)" }}
      />
    </div>
  ),
});

export function Kitchen3DCanvas(props: {
  selected: KitchenObject | null;
  onSelect: (k: KitchenObject) => void;
  onDeselect?: () => void;
  labels: Record<KitchenObject, string>;
  controls: KitchenControlLabels;
  inventory: FridgeInventory;
  modelUrl?: string | null;
}) {
  return <Kitchen3D {...props} />;
}

export type { KitchenObject, KitchenControlLabels, FridgeInventory };
