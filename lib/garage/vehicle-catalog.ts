/**
 * The vehicle catalog — the data layer of the garage engine.
 *
 * Nothing here is hard-wired into the 3D scene: the showroom reads a model
 * URL and a free-form specs bag off each vehicle row, and falls back to these
 * per-brand defaults when a field is missing. Supporting thousands more
 * vehicles is a data exercise (add rows / extend this map or the DB), never a
 * code change. A standardized GLB (real-world scale, any origin — the engine
 * re-centers and re-scales it) is all a new model needs.
 */

import type { VehicleSpecs } from "@/lib/types";

/** A real, CORS-enabled sample GLB used to demonstrate dynamic model loading. */
export const DEMO_CAR_GLB =
  "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/ToyCar/glTF-Binary/ToyCar.glb";

type BrandInfo = { country: string };

/** Origin country per European marque — used to prefill the spec panel. */
export const BRAND_CATALOG: Record<string, BrandInfo> = {
  bmw: { country: "Germany" },
  audi: { country: "Germany" },
  "mercedes-benz": { country: "Germany" },
  mercedes: { country: "Germany" },
  volkswagen: { country: "Germany" },
  vw: { country: "Germany" },
  porsche: { country: "Germany" },
  opel: { country: "Germany" },
  "land rover": { country: "United Kingdom" },
  jaguar: { country: "United Kingdom" },
  "aston martin": { country: "United Kingdom" },
  bentley: { country: "United Kingdom" },
  ferrari: { country: "Italy" },
  lamborghini: { country: "Italy" },
  maserati: { country: "Italy" },
  "alfa romeo": { country: "Italy" },
  fiat: { country: "Italy" },
  peugeot: { country: "France" },
  renault: { country: "France" },
  citroen: { country: "France" },
  bugatti: { country: "France" },
  volvo: { country: "Sweden" },
  koenigsegg: { country: "Sweden" },
  skoda: { country: "Czech Republic" },
  seat: { country: "Spain" },
  cupra: { country: "Spain" },
  cadillac: { country: "United States" },
  tesla: { country: "United States" },
  toyota: { country: "Japan" },
  lexus: { country: "Japan" },
};

export function brandCountry(brand: string): string | undefined {
  return BRAND_CATALOG[brand.trim().toLowerCase()]?.country;
}

/** Merge stored specs with brand defaults, so the panel always has a country. */
export function resolveSpecs(brand: string, specs: VehicleSpecs | null | undefined): VehicleSpecs {
  const base: VehicleSpecs = { ...(specs ?? {}) };
  if (!base.country) {
    const c = brandCountry(brand);
    if (c) base.country = c;
  }
  return base;
}
