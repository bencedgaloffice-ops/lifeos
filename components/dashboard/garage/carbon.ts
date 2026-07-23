import type { CSSProperties } from "react";

/** Shared carbon-fiber-weave texture used across My Garage surfaces —
 * a crosshatch generated from gradients so no texture asset is needed. */
export const carbonWeave: CSSProperties = {
  backgroundImage: [
    "repeating-linear-gradient(45deg, rgba(255,255,255,0.045) 0px, rgba(255,255,255,0.045) 1px, transparent 1px, transparent 5px)",
    "repeating-linear-gradient(-45deg, rgba(255,255,255,0.045) 0px, rgba(255,255,255,0.045) 1px, transparent 1px, transparent 5px)",
    "linear-gradient(180deg, #0c0c0e, #030304)",
  ].join(", "),
};

/** A soft automotive "showroom spotlight" wash, tinted by the module color. */
export function spotlight(color: string, opacity = 0.35): CSSProperties {
  return {
    backgroundImage: `radial-gradient(ellipse 70% 60% at 50% 0%, ${color}${Math.round(opacity * 255)
      .toString(16)
      .padStart(2, "0")}, transparent 70%)`,
  };
}
