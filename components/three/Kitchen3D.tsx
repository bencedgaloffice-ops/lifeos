"use client";

import React, { useRef, useState, useMemo, useEffect, useContext, Suspense, Component, type ReactNode } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  OrbitControls,
  ContactShadows,
  Environment,
  Html,
  MeshReflectorMaterial,
  RoundedBox,
  PerformanceMonitor,
  AdaptiveDpr,
  Lightformer,
} from "@react-three/drei";
import { EffectComposer, Bloom, Vignette, N8AO } from "@react-three/postprocessing";
import { Lightbulb, LightbulbOff, Sun, Moon, Droplets, Flame, CookingPot } from "lucide-react";
import * as THREE from "three";
import { cn } from "@/lib/utils";
import { KitchenModel } from "./KitchenModel";

/**
 * LifeOS Kitchen — luxury villa edition.
 *
 * A symmetrical, generously-scaled modern villa kitchen: polished white marble
 * floor with gold veining, a black marble feature wall, champagne-gold reveals,
 * warm wood ceiling battens and indirect cove lighting.
 *
 * The composition reads left-to-right as STORE -> PREPARE -> COOK:
 * refrigeration on the left, the island dead centre, the chef's cooking zone on
 * axis behind it, pantry on the right.
 *
 * Everything is generated procedurally (no downloaded assets). The public API
 * is unchanged, so the existing route, module, auth and Supabase wiring keep
 * working exactly as before; a real GLB can still be dropped in via `modelUrl`.
 */

/* ------------------------------------------------------------------ types */

export type KitchenObject = "fridge" | "freezer" | "pantry" | "island" | "oven" | "sink";

export type KitchenControlLabels = {
  lights: string;
  day: string;
  night: string;
  water: string;
  stove: string;
  oven: string;
};

export type FoodItem = {
  /** Stable identity. Placement is derived from this, which is what makes the
   * twin persistent: the same item lands in the same spot every time. */
  id: string;
  name: string;
  quantity: string | null;
  expires_at: string | null;
};
export type FridgeInventory = { fridge: FoodItem[]; freezer: FoodItem[]; pantry: FoodItem[] };

/* -------------------------------------------------------- texture helpers */

function canvasTex(
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
  repeat: [number, number] = [1, 1],
  size = 1024,
) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  draw(c.getContext("2d")!, size, size);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/** Height field -> tangent-space normal map (Sobel). Gives surfaces real relief
 * so light travels across them instead of reading as flat colour. */
function heightToNormal(
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
  repeat: [number, number] = [1, 1],
  strength = 2,
  size = 256,
) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#808080";
  ctx.fillRect(0, 0, size, size);
  draw(ctx, size, size);
  const src = ctx.getImageData(0, 0, size, size).data;
  const out = ctx.createImageData(size, size);
  const at = (x: number, y: number) => src[((y + size) % size) * size * 4 + (((x + size) % size) * 4)] / 255;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx =
        at(x - 1, y - 1) + 2 * at(x - 1, y) + at(x - 1, y + 1) -
        (at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1));
      const dy =
        at(x - 1, y - 1) + 2 * at(x, y - 1) + at(x + 1, y - 1) -
        (at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1));
      const nx = dx * strength;
      const ny = dy * strength;
      const len = Math.hypot(nx, ny, 1) || 1;
      const i = (y * size + x) * 4;
      out.data[i] = ((nx / len) * 0.5 + 0.5) * 255;
      out.data[i + 1] = ((ny / len) * 0.5 + 0.5) * 255;
      out.data[i + 2] = ((1 / len) * 0.5 + 0.5) * 255;
      out.data[i + 3] = 255;
    }
  }
  ctx.putImageData(out, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  return t;
}

/** Branching mineral vein, shared by both marbles. */
function drawVein(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  len: number,
  width: number,
  colour: string,
  branch: number,
) {
  ctx.strokeStyle = colour;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.beginPath();
  let x = x0;
  let y = y0;
  ctx.moveTo(x, y);
  let ang = Math.random() * Math.PI * 2;
  for (let s = 0; s < len; s++) {
    ang += (Math.random() - 0.5) * 0.55;
    x += Math.cos(ang) * 9;
    y += Math.sin(ang) * 9;
    ctx.lineTo(x, y);
  }
  ctx.stroke();
  if (branch > 0) for (let b = 0; b < 2; b++) drawVein(ctx, x, y, len * 0.45, width * 0.55, colour, branch - 1);
}

/* --------------------------------------------------------- base materials */

const GOLD = { color: "#c9a227", metalness: 1, roughness: 0.17, envMapIntensity: 2 } as const;
const GOLD_MAT = new THREE.MeshStandardMaterial(GOLD);
const STEEL = new THREE.MeshStandardMaterial({ color: "#cfd3d8", roughness: 0.22, metalness: 0.95, envMapIntensity: 1.5 });
const BLACKGLASS = new THREE.MeshStandardMaterial({ color: "#0b0d10", roughness: 0.09, metalness: 0.6, envMapIntensity: 1.8 });
const CERAMIC = new THREE.MeshStandardMaterial({ color: "#f2eee6", roughness: 0.4 });
const LEATHER = new THREE.MeshStandardMaterial({ color: "#141519", roughness: 0.55, metalness: 0.05 });

/* ------------------------------------------------------------ interaction */

const HoverCtx = React.createContext(false);

function Hoverable({
  name,
  hint,
  onActivate,
  children,
  labelY = 1,
}: {
  name: string;
  hint: string;
  onActivate: () => void;
  children: ReactNode;
  labelY?: number;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <group
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        setHovered(false);
        document.body.style.cursor = "default";
      }}
      onClick={(e) => {
        e.stopPropagation();
        onActivate();
      }}
    >
      <HoverCtx.Provider value={hovered}>{children}</HoverCtx.Provider>
      {hovered && (
        <Html center position={[0, labelY, 0]} distanceFactor={6} zIndexRange={[10, 0]}>
          <div className="pointer-events-none whitespace-nowrap rounded-full border border-[#c9a227]/40 bg-black/70 px-3 py-1 text-[11px] font-medium tracking-wide text-[#f0e2b8] backdrop-blur">
            {name} <span className="text-white/35">· {hint}</span>
          </div>
        </Html>
      )}
    </group>
  );
}

/** Slim champagne-gold bar handle; lights when its appliance is hovered. */
function GoldHandle({
  position,
  length = 0.8,
  vertical = true,
}: {
  position: [number, number, number];
  length?: number;
  vertical?: boolean;
}) {
  const hovered = useContext(HoverCtx);
  return (
    <mesh position={position} rotation={vertical ? [0, 0, 0] : [0, 0, Math.PI / 2]} castShadow>
      <cylinderGeometry args={[0.012, 0.012, length, 14]} />
      <meshStandardMaterial {...GOLD} emissive="#ffd98a" emissiveIntensity={hovered ? 0.6 : 0} />
    </mesh>
  );
}

/* ----------------------------------------------------------- food helpers */

function daysLeft(iso: string | null) {
  return iso ? (new Date(iso).getTime() - Date.now()) / 86_400_000 : Number.POSITIVE_INFINITY;
}

type FoodKind = "milk" | "egg" | "cheese" | "meat" | "fish" | "butter" | "yogurt" | "water" | "juice" | "fruit" | "veg" | "other";

function categorize(name: string): FoodKind {
  const n = name.toLowerCase();
  if (/milk|tej/.test(n)) return "milk";
  if (/egg|tojás|tojas/.test(n)) return "egg";
  if (/cheese|sajt/.test(n)) return "cheese";
  if (/chicken|beef|meat|pork|csirke|hús|hus|marha|bacon|ham|sonka/.test(n)) return "meat";
  if (/fish|hal|salmon|lazac|tuna/.test(n)) return "fish";
  if (/butter|vaj/.test(n)) return "butter";
  if (/yog|joghurt|kefir/.test(n)) return "yogurt";
  if (/water|víz|viz|ásvány/.test(n)) return "water";
  if (/juice|lé|cola|soda|drink|ital|üdítő|beer|sör|wine|bor/.test(n)) return "juice";
  if (/apple|alma|orange|narancs|banana|banán|fruit|gyümölcs|berry|grape|szőlő|lemon|citrom|pear|körte/.test(n)) return "fruit";
  if (/tomato|paradicsom|lettuce|saláta|cucumber|uborka|carrot|répa|pepper|paprika|veg|zöldség|onion|hagyma|potato|krumpli/.test(n)) return "veg";
  return "other";
}

function fillFrom(q: string | null) {
  if (!q) return 0.7;
  const pct = q.match(/(\d+)\s*%/);
  return pct ? Math.min(1, Math.max(0.06, Number(pct[1]) / 100)) : 0.72;
}
function countFrom(q: string | null, fallback: number) {
  if (!q) return fallback;
  const m = q.match(/\d+/);
  return m ? Math.min(10, Math.max(0, Number(m[0]))) : fallback;
}

/* ------------------------------------------- deterministic human placement */

/** FNV-1a. The same string always hashes to the same number. */
function hashId(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** xorshift32 — a deterministic 0..1 stream from a seed. */
function rng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 4294967296;
  };
}

export type Placement = {
  /** Sideways drift along the shelf. */
  dx: number;
  /** Depth: positive is toward the door. */
  dz: number;
  /** Yaw — nothing in a real fridge is perfectly square to the shelf. */
  ry: number;
  /** Slight lean, for the few things resting against something else. */
  tilt: number;
  scale: number;
  /** Which geometry / label variant this item uses. */
  variant: number;
};

/**
 * Human placement, not showroom placement.
 *
 * A real fridge is not a product shot: most things sit slightly off-square,
 * a few are dead straight because they happened to land that way, and depth is
 * governed by how often you reach for something. Whatever needs using up has
 * been pulled to the front; the rest gets pushed in behind it.
 *
 * Every value comes from the item's own id, so it is stable forever — the twin
 * persists rather than re-rolling a fresh arrangement on every mount.
 *
 * `urgency` runs 0..1, where 1 means "use me first".
 */
function placeItem(id: string, urgency: number): Placement {
  const r = rng(hashId(id));
  const tidy = r();
  const rough = r();
  return {
    dx: (r() - 0.5) * 0.055,
    dz: (urgency - 0.5) * 0.17 + (r() - 0.5) * 0.05,
    // A quarter of everything is square-on, the rest is rotated a little.
    ry: tidy > 0.74 ? (r() - 0.5) * 0.06 : (r() - 0.5) * 1.1,
    tilt: rough > 0.86 ? (r() - 0.5) * 0.1 : 0,
    scale: 0.9 + r() * 0.22,
    variant: Math.floor(r() * 6),
  };
}

/** 1 for "about to expire", falling to 0 for things with weeks left. Drives
 * both shelf order and how far forward an item sits. */
function urgencyOf(item: FoodItem): number {
  const d = daysLeft(item.expires_at);
  if (!Number.isFinite(d)) return 0.18;
  return THREE.MathUtils.clamp(1 - d / 10, 0, 1);
}

/* ------------------------------------------------ premium object materials */

const RUBBER = new THREE.MeshStandardMaterial({ color: "#0a0b0d", roughness: 0.96, metalness: 0 });
/** Fridge interior liner: the slightly soft, slightly warm white of real ABS. */
const LINER = new THREE.MeshStandardMaterial({ color: "#eff2f3", roughness: 0.42, metalness: 0.04 });
/** Tempered shelf glass. Deliberately NOT a transmission material — those cost
 * a full extra render pass each and previously collapsed the framerate here.
 * Low opacity with near-zero roughness and a strong env contribution reads as
 * thick glass at a fraction of the price. */
const SHELF_GLASS = new THREE.MeshStandardMaterial({
  color: "#dbecf3",
  roughness: 0.04,
  metalness: 0.06,
  transparent: true,
  opacity: 0.24,
  envMapIntensity: 2.4,
  side: THREE.DoubleSide,
});
/** Crisper drawer / door bin fronts — thicker, cloudier than shelf glass. */
const CLEAR_PLASTIC = new THREE.MeshStandardMaterial({
  color: "#e4f0f5",
  roughness: 0.14,
  metalness: 0,
  transparent: true,
  opacity: 0.19,
  envMapIntensity: 1.5,
  side: THREE.DoubleSide,
});
/** Bottle and jar walls. Open-ended cylinders in two shells give a visible
 * glass thickness at the silhouette, which is what actually sells "glass". */
const BOTTLE_GLASS = new THREE.MeshStandardMaterial({
  color: "#dcecf2",
  roughness: 0.05,
  metalness: 0.04,
  transparent: true,
  opacity: 0.2,
  envMapIntensity: 2.2,
  side: THREE.DoubleSide,
});
const RAIL_MAT = new THREE.MeshStandardMaterial({ color: "#949aa0", roughness: 0.28, metalness: 0.92 });
const DIFFUSER = new THREE.MeshStandardMaterial({ color: "#f7fbff", roughness: 0.85, transparent: true, opacity: 0.92 });
const FILM = new THREE.MeshStandardMaterial({
  color: "#eef6f8",
  roughness: 0.18,
  transparent: true,
  opacity: 0.22,
  side: THREE.DoubleSide,
  depthWrite: false,
});

/* ---------------------------------------------------------- label textures */

/**
 * Plausible packaging labels — a masthead band, a block of copy, a nutrition
 * panel and a barcode. Six different colourways so a shelf reads as competing
 * brands rather than six copies of one product.
 *
 * Drawn once, lazily (needs `document`), and shared by every instance. The
 * randomness is seeded, so a label looks the same on every reload.
 */
let _labels: THREE.Texture[] | null = null;
function labelTextures(): THREE.Texture[] {
  if (_labels) return _labels;
  const palettes: [string, string, string][] = [
    ["#f5f7f9", "#1f4e8c", "#c8202f"],
    ["#fffdf4", "#2f6b3a", "#c98a1f"],
    ["#f7f2ea", "#8a2230", "#2b2b2b"],
    ["#eef4f8", "#0d2a4a", "#7fa8d4"],
    ["#fdf6ec", "#a8611f", "#3d2c1e"],
    ["#f2f7f2", "#3b6e4a", "#c9b45e"],
  ];
  _labels = palettes.map(([bg, ink, accent], pi) =>
    canvasTex(
      (ctx, w, h) => {
        const r = rng(7919 + pi * 104729);
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, w, h);
        // masthead
        ctx.fillStyle = ink;
        ctx.fillRect(0, h * 0.09, w, h * 0.19);
        ctx.fillStyle = accent;
        ctx.fillRect(0, h * 0.3, w, h * 0.018);
        // brand mark inside the masthead
        ctx.fillStyle = bg;
        ctx.globalAlpha = 0.92;
        ctx.fillRect(w * 0.1, h * 0.145, w * (0.34 + r() * 0.3), h * 0.075);
        ctx.globalAlpha = 1;
        // body copy, as type-sized blocks (no font dependency)
        ctx.fillStyle = ink;
        for (let line = 0; line < 5; line++) {
          ctx.globalAlpha = 0.5 - line * 0.06;
          ctx.fillRect(w * 0.11, h * (0.4 + line * 0.072), w * (0.28 + r() * 0.46), h * 0.02);
        }
        ctx.globalAlpha = 1;
        // nutrition panel
        ctx.strokeStyle = ink;
        ctx.lineWidth = Math.max(1, h * 0.005);
        ctx.strokeRect(w * 0.6, h * 0.7, w * 0.3, h * 0.22);
        for (let row = 0; row < 4; row++) {
          ctx.globalAlpha = 0.35;
          ctx.fillRect(w * 0.63, h * (0.75 + row * 0.04), w * 0.24, h * 0.012);
        }
        ctx.globalAlpha = 1;
        // barcode
        ctx.fillStyle = "#111318";
        for (let b = 0; b < 28; b++) {
          if (r() > 0.4) ctx.fillRect(w * 0.09 + b * (w * 0.0125), h * 0.78, w * 0.006, h * 0.13);
        }
      },
      [1, 1],
      256,
    ),
  );
  return _labels;
}

/**
 * Six irregular produce shells. Real vegetables are lumpy and no two are alike,
 * so each variant is a differently-displaced icosahedron; instances then pick a
 * variant, a scale and a rotation from their own seed, which means a crisper
 * full of tomatoes never reads as a row of identical spheres.
 */
let _produce: THREE.BufferGeometry[] | null = null;
function produceGeometries(): THREE.BufferGeometry[] {
  if (_produce) return _produce;
  _produce = Array.from({ length: 6 }, (_, v) => {
    const g = new THREE.IcosahedronGeometry(1, 2);
    const p = g.attributes.position as THREE.BufferAttribute;
    const r = rng(1000 + v * 9781);
    const amp = 0.09 + r() * 0.13;
    const sx = 0.84 + r() * 0.34;
    const sy = 0.8 + r() * 0.44;
    const sz = 0.86 + r() * 0.28;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      const y = p.getY(i);
      const z = p.getZ(i);
      const n =
        Math.sin(x * 3.1 + v) * Math.cos(y * 2.7 - v * 1.3) * Math.sin(z * 3.4 + v * 2.1) +
        0.4 * Math.sin(x * 6.2 - y * 5.1 + z * 4.7);
      const k = 1 + n * amp;
      p.setXYZ(i, x * k * sx, y * k * sy, z * k * sz);
    }
    g.computeVertexNormals();
    return g;
  });
  return _produce;
}

/* -------------------------------------------------------------- food props */

/** Shared prop for anything placed by the placement engine. */
type Placed = { position: [number, number, number]; place: Placement };

/** Apply a placement to a group: drift, depth, yaw, lean, size. */
function placedProps({ position, place }: Placed) {
  return {
    position: [position[0] + place.dx, position[1], position[2] + place.dz] as [number, number, number],
    rotation: [place.tilt, place.ry, place.tilt * 0.6] as [number, number, number],
    scale: place.scale,
  };
}

/**
 * A real bottle: liquid you can see through the wall, a meniscus on top of it,
 * a double-shell wall so the glass has visible thickness at the silhouette, a
 * tapered shoulder and neck, a moulded cap, and a printed label band.
 */
function Bottle({
  position,
  place,
  colour,
  fill,
  r = 0.042,
  h = 0.29,
}: Placed & { colour: string; fill: number; r?: number; h?: number }) {
  const labels = labelTextures();
  const bodyH = h * 0.7;
  const lh = Math.max(0.015, bodyH * 0.94 * fill);
  const base = -h / 2;
  return (
    <group {...placedProps({ position, place })}>
      {/* liquid — drawn first so it reads through the wall */}
      <mesh position={[0, base + lh / 2 + 0.006, 0]}>
        <cylinderGeometry args={[r * 0.93, r * 0.93, lh, 20]} />
        <meshStandardMaterial color={colour} roughness={0.3} metalness={0.02} transparent opacity={0.94} />
      </mesh>
      {/* the flat, bright surface of the liquid */}
      <mesh position={[0, base + lh + 0.006, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[r * 0.93, 20]} />
        <meshStandardMaterial color={colour} roughness={0.04} metalness={0.14} />
      </mesh>

      {/* wall, in two open shells — this is what gives glass its thickness */}
      <mesh material={BOTTLE_GLASS} position={[0, base + bodyH / 2, 0]}>
        <cylinderGeometry args={[r, r * 0.98, bodyH, 22, 1, true]} />
      </mesh>
      <mesh material={BOTTLE_GLASS} position={[0, base + bodyH / 2, 0]} scale={[0.93, 1, 0.93]}>
        <cylinderGeometry args={[r, r * 0.98, bodyH * 0.998, 22, 1, true]} />
      </mesh>
      {/* punted base */}
      <mesh position={[0, base + 0.004, 0]} material={BOTTLE_GLASS}>
        <cylinderGeometry args={[r * 0.98, r * 0.9, 0.008, 22]} />
      </mesh>
      {/* shoulder taper + neck */}
      <mesh material={BOTTLE_GLASS} position={[0, base + bodyH + h * 0.09, 0]}>
        <cylinderGeometry args={[r * 0.42, r, h * 0.18, 22, 1, true]} />
      </mesh>
      <mesh material={BOTTLE_GLASS} position={[0, base + bodyH + h * 0.22, 0]}>
        <cylinderGeometry args={[r * 0.4, r * 0.42, h * 0.1, 18, 1, true]} />
      </mesh>
      {/* moulded cap with a knurled skirt */}
      <mesh position={[0, base + bodyH + h * 0.3, 0]}>
        <cylinderGeometry args={[r * 0.46, r * 0.46, h * 0.09, 18]} />
        <meshStandardMaterial color="#2b3037" roughness={0.42} metalness={0.15} />
      </mesh>
      <mesh position={[0, base + bodyH + h * 0.27, 0]} material={GOLD_MAT}>
        <cylinderGeometry args={[r * 0.47, r * 0.47, h * 0.014, 18]} />
      </mesh>

      {/* printed label */}
      <mesh position={[0, base + bodyH * 0.44, 0]}>
        <cylinderGeometry args={[r * 1.012, r * 1.005, bodyH * 0.46, 22, 1, true]} />
        <meshStandardMaterial
          map={labels[place.variant % labels.length]}
          roughness={0.74}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}

/**
 * A gable-top milk carton. Instantly readable as milk in a way a cylinder never
 * is: square body, the two slanted roof panels folded to a ridge, the crimped
 * seam along the top, and a screw spout off to one side.
 */
function Carton({ position, place, h = 0.24, w = 0.075 }: Placed & { h?: number; w?: number }) {
  const labels = labelTextures();
  const bodyH = h * 0.74;
  const base = -h / 2;
  const tex = labels[place.variant % labels.length];
  return (
    <group {...placedProps({ position, place })}>
      <mesh position={[0, base + bodyH / 2, 0]}>
        <boxGeometry args={[w, bodyH, w]} />
        <meshStandardMaterial map={tex} roughness={0.78} />
      </mesh>
      {/* gable roof: two panels leaning to a ridge */}
      {[-1, 1].map((s) => (
        <mesh
          key={s}
          position={[0, base + bodyH + h * 0.1, (s * w) / 4]}
          rotation={[s * 0.72, 0, 0]}
          castShadow
        >
          <boxGeometry args={[w, w * 0.78, 0.004]} />
          <meshStandardMaterial color="#f0ece2" roughness={0.8} />
        </mesh>
      ))}
      {/* crimped top seam */}
      <mesh position={[0, base + bodyH + h * 0.21, 0]}>
        <boxGeometry args={[w * 1.005, h * 0.035, 0.006]} />
        <meshStandardMaterial color="#e6e0d3" roughness={0.85} />
      </mesh>
      {/* screw spout, offset like the real thing */}
      <mesh position={[w * 0.22, base + bodyH + h * 0.09, w * 0.2]} rotation={[0.72, 0, 0]}>
        <cylinderGeometry args={[w * 0.16, w * 0.16, h * 0.05, 14]} />
        <meshStandardMaterial color="#b8352f" roughness={0.4} />
      </mesh>
    </group>
  );
}

/** Egg tray with a moulded pulp base, dimpled wells, and a hinged lid folded
 * back — eggs sit down in the wells rather than balancing on a flat plate. */
function EggTray({ position, place, count }: Placed & { count: number }) {
  const n = Math.min(10, Math.max(0, Math.round(count)));
  const r = rng(hashId(`eggs${place.variant}`));
  return (
    <group {...placedProps({ position, place })}>
      <mesh>
        <boxGeometry args={[0.32, 0.028, 0.15]} />
        <meshStandardMaterial color="#d5cec0" roughness={0.94} />
      </mesh>
      {/* wells: a shallow dish under each egg */}
      {Array.from({ length: 10 }).map((_, i) => (
        <mesh key={`w${i}`} position={[-0.128 + (i % 5) * 0.064, 0.015, -0.036 + Math.floor(i / 5) * 0.072]}>
          <cylinderGeometry args={[0.026, 0.02, 0.014, 12, 1, true]} />
          <meshStandardMaterial color="#c8c1b2" roughness={0.96} side={THREE.DoubleSide} />
        </mesh>
      ))}
      {/* the lid, folded back against the shelf */}
      <mesh position={[0, 0.06, -0.115]} rotation={[-1.24, 0, 0]}>
        <boxGeometry args={[0.32, 0.14, 0.006]} />
        <meshStandardMaterial color="#d5cec0" roughness={0.94} />
      </mesh>
      {/* eggs — each slightly different in size, tint and lean */}
      {Array.from({ length: n }).map((_, i) => (
        <mesh
          key={i}
          position={[-0.128 + (i % 5) * 0.064, 0.036, -0.036 + Math.floor(i / 5) * 0.072]}
          rotation={[(r() - 0.5) * 0.3, r() * 3, (r() - 0.5) * 0.3]}
          scale={[1, 1.28 + r() * 0.1, 1]}
          castShadow
        >
          <sphereGeometry args={[0.0235 + r() * 0.003, 14, 12]} />
          <meshStandardMaterial color={r() > 0.6 ? "#e8d3ae" : "#f3e6cd"} roughness={0.74} />
        </mesh>
      ))}
    </group>
  );
}

/**
 * A supermarket meat tray: white polystyrene base with a lip, the product
 * inside, an absorbent pad under it, and cling film stretched over the top with
 * a printed label stuck on.
 */
function Tray({ position, place, colour, fill }: Placed & { colour: string; fill: number }) {
  const labels = labelTextures();
  const w = 0.15 + 0.14 * fill;
  return (
    <group {...placedProps({ position, place })}>
      {/* tray base + raised lip */}
      <mesh>
        <boxGeometry args={[w + 0.03, 0.016, 0.2]} />
        <meshStandardMaterial color="#f1efec" roughness={0.62} />
      </mesh>
      {[
        [(w + 0.03) / 2, 0, 0.004, 0.2],
        [-(w + 0.03) / 2, 0, 0.004, 0.2],
      ].map(([x], i) => (
        <mesh key={i} position={[x as number, 0.014, 0]}>
          <boxGeometry args={[0.005, 0.026, 0.2]} />
          <meshStandardMaterial color="#f1efec" roughness={0.62} />
        </mesh>
      ))}
      {[0.1, -0.1].map((z) => (
        <mesh key={z} position={[0, 0.014, z]}>
          <boxGeometry args={[w + 0.03, 0.026, 0.005]} />
          <meshStandardMaterial color="#f1efec" roughness={0.62} />
        </mesh>
      ))}
      {/* absorbent pad */}
      <mesh position={[0, 0.011, 0]}>
        <boxGeometry args={[w - 0.004, 0.004, 0.17]} />
        <meshStandardMaterial color="#e9e6e0" roughness={0.95} />
      </mesh>
      {/* product */}
      <mesh position={[0, 0.026, 0]}>
        <boxGeometry args={[w - 0.012, 0.028, 0.155]} />
        <meshStandardMaterial color={colour} roughness={0.58} />
      </mesh>
      {/* cling film */}
      <mesh position={[0, 0.042, 0]} material={FILM}>
        <boxGeometry args={[w + 0.032, 0.004, 0.202]} />
      </mesh>
      {/* stuck-on label */}
      <mesh position={[w * 0.16, 0.045, 0.03]} rotation={[-Math.PI / 2, 0, 0.14]}>
        <planeGeometry args={[0.07, 0.05]} />
        <meshStandardMaterial map={labels[place.variant % labels.length]} roughness={0.85} />
      </mesh>
    </group>
  );
}

/**
 * A single piece of produce. Uses one of six irregular shells, scaled and
 * rotated from its own seed and given a slightly varied tint, so a crisper
 * never reads as a row of cloned spheres.
 */
function Produce({ position, place, colour, r = 0.05 }: Placed & { colour: string; r?: number }) {
  const geos = produceGeometries();
  const geo = geos[place.variant % geos.length];
  // Vary the tint a touch per item — nothing in nature is one flat colour.
  const tint = useMemo(() => {
    const c = new THREE.Color(colour);
    const j = rng(hashId(`${colour}${place.variant}${place.dx}`));
    c.offsetHSL((j() - 0.5) * 0.035, (j() - 0.5) * 0.12, (j() - 0.5) * 0.09);
    return c;
  }, [colour, place.variant, place.dx]);
  return (
    <mesh
      geometry={geo}
      position={[position[0] + place.dx, position[1], position[2] + place.dz]}
      rotation={[place.ry * 1.4, place.ry, place.tilt * 3]}
      scale={r * place.scale}
    >
      {/* No shadow casting: these sit inside a cabinet lit by its own point
          light, so they never appear in the room's shadow map — paying for a
          shadow-pass draw call each would be pure waste. */}
      <meshStandardMaterial color={tint} roughness={0.66} metalness={0} />
    </mesh>
  );
}

/** A printed cardboard pack — pantry staples, freezer boxes, cereal. */
function Pack({
  position,
  place,
  w = 0.11,
  h = 0.2,
  d = 0.06,
}: Placed & { w?: number; h?: number; d?: number }) {
  const labels = labelTextures();
  const tex = labels[place.variant % labels.length];
  return (
    <group {...placedProps({ position, place })}>
      <mesh position={[0, h / 2, 0]}>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial map={tex} roughness={0.86} />
      </mesh>
      {/* creased top flap */}
      <mesh position={[0, h - 0.002, 0]}>
        <boxGeometry args={[w * 1.004, 0.004, d * 1.004]} />
        <meshStandardMaterial color="#cbb493" roughness={0.9} />
      </mesh>
    </group>
  );
}

/** A glass storage jar: contents visible through a double-shell wall, a metal
 * screw lid, and a hand-written-looking label. */
function Jar({
  position,
  place,
  colour,
  r = 0.058,
  h = 0.22,
  fill = 0.66,
}: Placed & { colour: string; r?: number; h?: number; fill?: number }) {
  const lh = Math.max(0.02, h * 0.82 * fill);
  const base = -h / 2;
  return (
    <group {...placedProps({ position, place })}>
      {/* contents, sitting on the bottom */}
      <mesh position={[0, base + lh / 2 + 0.008, 0]}>
        <cylinderGeometry args={[r * 0.9, r * 0.88, lh, 18]} />
        <meshStandardMaterial color={colour} roughness={0.9} />
      </mesh>
      <mesh position={[0, base + lh + 0.008, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[r * 0.9, 18]} />
        <meshStandardMaterial color={colour} roughness={0.95} />
      </mesh>
      {/* wall, two shells */}
      <mesh material={BOTTLE_GLASS}>
        <cylinderGeometry args={[r, r, h, 20, 1, true]} />
      </mesh>
      <mesh material={BOTTLE_GLASS} scale={[0.93, 1, 0.93]}>
        <cylinderGeometry args={[r, r, h * 0.998, 20, 1, true]} />
      </mesh>
      <mesh position={[0, base + 0.005, 0]} material={BOTTLE_GLASS}>
        <cylinderGeometry args={[r, r * 0.94, 0.01, 20]} />
      </mesh>
      {/* threaded neck + metal lid */}
      <mesh position={[0, h / 2 - 0.012, 0]} material={BOTTLE_GLASS}>
        <cylinderGeometry args={[r * 0.86, r, 0.024, 20, 1, true]} />
      </mesh>
      <mesh position={[0, h / 2 + 0.012, 0]} material={GOLD_MAT}>
        <cylinderGeometry args={[r * 0.9, r * 0.9, 0.026, 20]} />
      </mesh>
      {/* label */}
      <mesh position={[0, -h * 0.06, 0]}>
        <cylinderGeometry args={[r * 1.01, r * 1.01, h * 0.34, 20, 1, true]} />
        <meshStandardMaterial color="#f6f1e6" roughness={0.92} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

/* -------------------------------------------------------------- atmosphere */

function DustMotes({ on }: { on: boolean }) {
  const pts = useRef<THREE.Points>(null);
  const geo = useMemo(() => {
    const n = 110;
    const a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      a[i * 3] = -6 + Math.random() * 4;
      a[i * 3 + 1] = 0.4 + Math.random() * 2.8;
      a[i * 3 + 2] = -2.4 + Math.random() * 5;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(a, 3));
    return g;
  }, []);
  useFrame((s, dt) => {
    if (!pts.current) return;
    pts.current.visible = on;
    if (!on) return;
    const p = pts.current.geometry.attributes.position as THREE.BufferAttribute;
    const t = s.clock.elapsedTime;
    for (let i = 0; i < p.count; i++) {
      let y = p.getY(i) + Math.sin(t * 0.25 + i) * dt * 0.05 + dt * 0.01;
      if (y > 3.2) y = 0.4;
      p.setY(i, y);
    }
    p.needsUpdate = true;
  });
  return (
    <points ref={pts} geometry={geo}>
      <pointsMaterial size={0.014} color="#fff2da" transparent opacity={0.3} depthWrite={false} sizeAttenuation />
    </points>
  );
}

function ColdAir({ position, on }: { position: [number, number, number]; on: boolean }) {
  const g = useRef<THREE.Points>(null);
  const geo = useMemo(() => {
    const n = 34;
    const a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      a[i * 3] = (Math.random() - 0.5) * 0.9;
      a[i * 3 + 1] = Math.random() * 1.7;
      a[i * 3 + 2] = (Math.random() - 0.5) * 0.5;
    }
    const bg = new THREE.BufferGeometry();
    bg.setAttribute("position", new THREE.BufferAttribute(a, 3));
    return bg;
  }, []);
  useFrame((_, dt) => {
    if (!g.current) return;
    g.current.visible = on;
    if (!on) return;
    const p = g.current.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      let y = p.getY(i) - dt * 0.3;
      if (y < 0) y = 1.7;
      p.setY(i, y);
    }
    p.needsUpdate = true;
  });
  return (
    <points ref={g} geometry={geo} position={position}>
      <pointsMaterial size={0.02} color="#dff2ff" transparent opacity={0.3} depthWrite={false} />
    </points>
  );
}

function Breathing({ children, amount = 0.03, speed = 0.5 }: { children: ReactNode; amount?: number; speed?: number }) {
  const g = useRef<THREE.Group>(null);
  useFrame((s) => {
    if (!g.current) return;
    const t = s.clock.elapsedTime * speed;
    g.current.rotation.z = Math.sin(t) * amount;
    g.current.rotation.x = Math.cos(t * 0.7) * amount * 0.6;
  });
  return <group ref={g}>{children}</group>;
}

/* ------------------------------------------------------------------ audio */

/**
 * The kitchen soundstage — entirely synthesized.
 *
 * A real kitchen is never silent: a compressor cycles, a fan turns, the room
 * itself has a floor of noise. All of it is built here out of oscillators and
 * filtered noise, so there are no audio files to ship, nothing to fail to load,
 * and no licensing to worry about.
 *
 * Layers:
 *   compressor  58 Hz fundamental + a detuned partial, lowpassed — the hum
 *   fan         noise through a narrow bandpass, the bearing whine on top
 *   freezer     a colder, lower rumble with more mechanical grain
 *   room        very low broadband floor, always on once audio is unlocked
 *
 * One-shots: `seal()` for the gasket peeling off the frame (and the softer thud
 * of it closing), `rails()` for a drawer running out on its slides.
 *
 * Browsers refuse to start audio before a user gesture, so the graph is built
 * lazily on the first interaction; every call before that is a silent no-op
 * rather than an error.
 */
type SoundEngine = {
  ctx: AudioContext;
  master: GainNode;
  compressor: GainNode;
  fan: GainNode;
  freezer: GainNode;
  noise: AudioBuffer;
};

let _audio: SoundEngine | null = null;
let _audioFailed = false;

/** Two seconds of white noise, looped. Cheaper and more controllable than a
 * ScriptProcessor, and one buffer serves every noise-based layer. */
function makeNoise(ctx: AudioContext): AudioBuffer {
  const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

function loopNoise(ctx: AudioContext, buf: AudioBuffer): AudioBufferSourceNode {
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  src.start();
  return src;
}

function audioEngine(): SoundEngine | null {
  if (_audio) return _audio;
  if (_audioFailed) return null;
  try {
    const Ctor =
      window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) {
      _audioFailed = true;
      return null;
    }
    const ctx = new Ctor();
    const noise = makeNoise(ctx);

    const master = ctx.createGain();
    master.gain.value = 0.85;
    master.connect(ctx.destination);

    /* --- room ambience: always on, barely there --- */
    const roomLp = ctx.createBiquadFilter();
    roomLp.type = "lowpass";
    roomLp.frequency.value = 340;
    const room = ctx.createGain();
    room.gain.value = 0.006;
    loopNoise(ctx, noise).connect(roomLp).connect(room).connect(master);

    /* --- compressor hum --- */
    const compressor = ctx.createGain();
    compressor.gain.value = 0;
    const humLp = ctx.createBiquadFilter();
    humLp.type = "lowpass";
    humLp.frequency.value = 210;
    humLp.connect(compressor).connect(master);
    for (const [freq, level] of [
      [58, 1],
      [116.6, 0.34],
      [174, 0.12],
    ] as const) {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.value = level;
      osc.connect(g).connect(humLp);
      osc.start();
    }

    /* --- fan: air through a narrow band, plus bearing whine --- */
    const fan = ctx.createGain();
    fan.gain.value = 0;
    fan.connect(master);
    const fanBp = ctx.createBiquadFilter();
    fanBp.type = "bandpass";
    fanBp.frequency.value = 430;
    fanBp.Q.value = 1.1;
    loopNoise(ctx, noise).connect(fanBp).connect(fan);
    const whine = ctx.createOscillator();
    whine.type = "triangle";
    whine.frequency.value = 1180;
    const whineG = ctx.createGain();
    whineG.gain.value = 0.012;
    whine.connect(whineG).connect(fan);
    whine.start();

    /* --- freezer: colder, lower, grainier --- */
    const freezer = ctx.createGain();
    freezer.gain.value = 0;
    freezer.connect(master);
    const frBp = ctx.createBiquadFilter();
    frBp.type = "bandpass";
    frBp.frequency.value = 165;
    frBp.Q.value = 0.7;
    loopNoise(ctx, noise).connect(frBp).connect(freezer);
    const frOsc = ctx.createOscillator();
    frOsc.type = "sine";
    frOsc.frequency.value = 43;
    const frG = ctx.createGain();
    frG.gain.value = 0.5;
    frOsc.connect(frG).connect(freezer);
    frOsc.start();

    _audio = { ctx, master, compressor, fan, freezer, noise };
    return _audio;
  } catch {
    _audioFailed = true;
    return null;
  }
}

/** Ramp a continuous layer toward a level. */
function setLayer(which: "compressor" | "fan" | "freezer", level: number, seconds = 0.6) {
  const e = audioEngine();
  if (!e) return;
  if (e.ctx.state === "suspended") void e.ctx.resume();
  e[which].gain.setTargetAtTime(level, e.ctx.currentTime, seconds);
}

/**
 * The gasket. Opening peels the seal off the frame — a bright, short burst of
 * noise with a fast decay. Closing is the opposite: a duller thud with a
 * downward pitch sweep, the sound of a heavy door meeting a rubber stop.
 */
function playSeal(opening: boolean) {
  const e = audioEngine();
  if (!e) return;
  if (e.ctx.state === "suspended") void e.ctx.resume();
  const t = e.ctx.currentTime;

  const src = e.ctx.createBufferSource();
  src.buffer = e.noise;
  const bp = e.ctx.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.setValueAtTime(opening ? 900 : 320, t);
  bp.frequency.exponentialRampToValueAtTime(opening ? 240 : 110, t + 0.16);
  bp.Q.value = 0.9;
  const g = e.ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(opening ? 0.1 : 0.14, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + (opening ? 0.18 : 0.26));
  src.connect(bp).connect(g).connect(e.master);
  src.start(t);
  src.stop(t + 0.4);

  // The body of the door, only on closing.
  if (!opening) {
    const thud = e.ctx.createOscillator();
    thud.type = "sine";
    thud.frequency.setValueAtTime(96, t);
    thud.frequency.exponentialRampToValueAtTime(44, t + 0.2);
    const tg = e.ctx.createGain();
    tg.gain.setValueAtTime(0.16, t);
    tg.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
    thud.connect(tg).connect(e.master);
    thud.start(t);
    thud.stop(t + 0.32);
  }
}

/** A drawer running out on its slides: narrow, high, and gated for the length
 * of the travel rather than fired as a click. */
function playRails(seconds = 0.5) {
  const e = audioEngine();
  if (!e) return;
  if (e.ctx.state === "suspended") void e.ctx.resume();
  const t = e.ctx.currentTime;
  const src = e.ctx.createBufferSource();
  src.buffer = e.noise;
  const bp = e.ctx.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.setValueAtTime(1500, t);
  bp.frequency.linearRampToValueAtTime(760, t + seconds);
  bp.Q.value = 5.5;
  const g = e.ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.035, t + 0.05);
  g.gain.setTargetAtTime(0.0001, t + seconds * 0.7, 0.09);
  src.connect(bp).connect(g).connect(e.master);
  src.start(t);
  src.stop(t + seconds + 0.4);
}

/**
 * Keep an appliance's continuous layers running while it's in focus. The fan
 * rides slightly louder than the compressor when a door is open, because that's
 * exactly what you hear standing in front of an open fridge.
 */
function useApplianceHum(active: boolean, kind: "fridge" | "freezer" = "fridge") {
  useEffect(() => {
    if (kind === "freezer") {
      setLayer("freezer", active ? 0.05 : 0, active ? 0.4 : 0.8);
      return;
    }
    setLayer("compressor", active ? 0.045 : 0.012, active ? 0.5 : 1);
    setLayer("fan", active ? 0.05 : 0, active ? 0.35 : 0.9);
  }, [active, kind]);
}

/** Fire a one-shot when a boolean flips, skipping the initial mount so the
 * kitchen doesn't slam every door the moment it loads. */
function useEdgeSound(value: boolean, fire: (rising: boolean) => void) {
  const prev = useRef<boolean | null>(null);
  useEffect(() => {
    if (prev.current === null) {
      prev.current = value;
      return;
    }
    if (prev.current !== value) {
      prev.current = value;
      fire(value);
    }
    // Only when the value actually flips — without deps this re-ran on every
    // render of the appliance, which is every frame that changes `lit`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
}

/* --------------------------------------------------------- door mechanics */

/**
 * Door mechanics with real sequencing.
 *
 * A premium fridge door does not simply rotate. The handle travels first, the
 * gasket releases with a short suction, and only then does the mass of the door
 * start to swing. Closing runs the same sequence backwards, with damping that
 * climbs as the door nears the frame — which is what a soft-close hinge
 * actually feels like: quick through the middle, deliberate at the end.
 *
 * Returns refs so the caller can drive whatever geometry it likes: `pull` for
 * handle travel and seal separation, `swing` for the rotation itself.
 */
function useDoorMechanics(open: boolean, stiffness = 30) {
  const pull = useRef(0);
  const swing = useRef(0);
  const vel = useRef(0);
  const broken = useRef(false);

  useFrame((_, dt) => {
    const step = Math.min(dt, 0.05);

    // Handle travel: quick, short, and it never overshoots.
    pull.current += ((open ? 1 : 0) - pull.current) * Math.min(1, step * 10);

    // The door can only start moving once the gasket has let go.
    const gate = THREE.MathUtils.smoothstep(pull.current, 0.3, 0.78);
    const target = open ? gate : 0;

    // Soft close: damping rises steeply over the last few degrees.
    const damping = open ? 11 : 11 + (1 - swing.current) * 34;
    vel.current += (target - swing.current) * stiffness * step - vel.current * damping * step;
    swing.current = Math.max(0, swing.current + vel.current * step);

    // Gasket sound, fired on the crossing rather than every frame.
    const isBroken = swing.current > 0.02;
    if (isBroken !== broken.current) {
      broken.current = isBroken;
      playSeal(isBroken);
    }
  });

  return { pull, swing };
}

/* -------------------------------------------------------------- appliances */

/* --------------------------------------------------- appliance sub-assembly */

/**
 * A hinge barrel — the visible pivot hardware. Real appliance doors are hung on
 * chunky cylindrical hinges you can see at the top and bottom of the gap; their
 * absence is one of the things that makes a 3D fridge read as a game prop.
 */
function Hinge({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh rotation={[0, 0, 0]} material={STEEL}>
        <cylinderGeometry args={[0.019, 0.019, 0.062, 14]} />
      </mesh>
      <mesh position={[0, 0.036, 0]} material={STEEL}>
        <cylinderGeometry args={[0.011, 0.011, 0.014, 12]} />
      </mesh>
      <mesh position={[0, -0.036, 0]} material={STEEL}>
        <cylinderGeometry args={[0.011, 0.011, 0.014, 12]} />
      </mesh>
    </group>
  );
}

/**
 * The magnetic gasket: a hollow rubber frame around the inside edge of a door.
 * Built as four bars rather than one box so there is a genuine opening through
 * the middle, and so the profile catches light along its edges like real EPDM.
 */
function Gasket({ w, h, depth = 0.02 }: { w: number; h: number; depth?: number }) {
  const t = 0.026;
  return (
    <group>
      {[h / 2 - t / 2, -h / 2 + t / 2].map((y) => (
        <mesh key={y} position={[0, y, 0]} material={RUBBER}>
          <boxGeometry args={[w, t, depth]} />
        </mesh>
      ))}
      {[w / 2 - t / 2, -w / 2 + t / 2].map((x) => (
        <mesh key={x} position={[x, 0, 0]} material={RUBBER}>
          <boxGeometry args={[t, h - t * 2, depth]} />
        </mesh>
      ))}
    </group>
  );
}

/**
 * An LED strip: an aluminium housing with a frosted diffuser in front of it,
 * plus the emissive face itself. Real appliance lighting is never a bare glowing
 * rectangle — you see the channel it sits in.
 */
function LedStrip({
  position,
  length,
  lit,
  colour = "#eaf6ff",
  vertical = false,
}: {
  position: [number, number, number];
  length: number;
  lit: number;
  colour?: string;
  vertical?: boolean;
}) {
  const args: [number, number, number] = vertical ? [0.018, length, 0.012] : [length, 0.018, 0.012];
  const dif: [number, number, number] = vertical ? [0.011, length * 0.97, 0.006] : [length * 0.97, 0.011, 0.006];
  return (
    <group position={position}>
      <mesh material={RAIL_MAT}>
        <boxGeometry args={args} />
      </mesh>
      <mesh position={[0, 0, 0.008]} material={DIFFUSER}>
        <boxGeometry args={dif} />
      </mesh>
      <mesh position={[0, 0, 0.011]}>
        <boxGeometry args={[dif[0] * 0.94, dif[1] * 0.94, 0.002]} />
        <meshStandardMaterial color={colour} emissive={colour} emissiveIntensity={0.15 + lit * 3.4} toneMapped />
      </mesh>
    </group>
  );
}

/**
 * A pair of drawer slides. Two telescoping sections per side, so the drawer
 * visibly runs out on hardware rather than sliding through thin air.
 */
function DrawerRails({ width, depth, y }: { width: number; depth: number; y: number }) {
  return (
    <group position={[0, y, 0]}>
      {[-width / 2, width / 2].map((x) => (
        <group key={x} position={[x, 0, 0]}>
          <mesh material={RAIL_MAT}>
            <boxGeometry args={[0.014, 0.026, depth]} />
          </mesh>
          <mesh position={[0, -0.02, depth * 0.06]} material={RAIL_MAT}>
            <boxGeometry args={[0.01, 0.016, depth * 0.9]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/**
 * A temperature sensor pod with a status LED and a small digital readout.
 * Emissive segments rather than real type — legible as a display at this
 * distance without dragging a font into the 3D scene.
 */
function TempSensor({
  position,
  lit,
  cold = false,
}: {
  position: [number, number, number];
  lit: number;
  cold?: boolean;
}) {
  const colour = cold ? "#8fd8ff" : "#a8e8c0";
  return (
    <group position={position}>
      <mesh material={LINER}>
        <boxGeometry args={[0.11, 0.05, 0.016]} />
      </mesh>
      {/* status LED */}
      <mesh position={[-0.04, 0, 0.011]}>
        <cylinderGeometry args={[0.005, 0.005, 0.004, 10]} />
        <meshStandardMaterial color={colour} emissive={colour} emissiveIntensity={1.2 + lit * 2.4} />
      </mesh>
      {/* readout: three seven-segment-ish digits */}
      <mesh position={[0.012, 0, 0.01]}>
        <planeGeometry args={[0.062, 0.03]} />
        <meshStandardMaterial color="#0a0d10" roughness={0.5} />
      </mesh>
      {[0, 1, 2].map((d) => (
        <group key={d} position={[-0.006 + d * 0.018, 0, 0.012]}>
          {[0.008, -0.008].map((sy) => (
            <mesh key={sy} position={[0, sy, 0]}>
              <planeGeometry args={[0.009, 0.002]} />
              <meshStandardMaterial color={colour} emissive={colour} emissiveIntensity={0.5 + lit * 1.6} />
            </mesh>
          ))}
          <mesh position={[0.0045, 0, 0]}>
            <planeGeometry args={[0.002, 0.017]} />
            <meshStandardMaterial color={colour} emissive={colour} emissiveIntensity={0.5 + lit * 1.6} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/**
 * A retaining bin on the inside of a door — the moulded shelf bottles actually
 * stand in. Floor, a clear front wall to hold things back, and two end cheeks.
 */
function DoorBin({
  position,
  width,
  height = 0.11,
  depth = 0.13,
}: {
  position: [number, number, number];
  width: number;
  height?: number;
  depth?: number;
}) {
  return (
    <group position={position}>
      <mesh material={LINER}>
        <boxGeometry args={[width, 0.012, depth]} />
      </mesh>
      <mesh position={[0, height / 2, depth / 2 - 0.006]} material={CLEAR_PLASTIC}>
        <boxGeometry args={[width, height, 0.008]} />
      </mesh>
      {[-width / 2 + 0.005, width / 2 - 0.005].map((x) => (
        <mesh key={x} position={[x, height / 2 - 0.01, 0]} material={LINER}>
          <boxGeometry args={[0.01, height * 0.8, depth]} />
        </mesh>
      ))}
    </group>
  );
}

/* --------------------------------------------- refrigeration column */

/**
 * The freezer drawer — the bottom section of the refrigeration column.
 *
 * A real French-door fridge puts the freezer underneath as a pull-out drawer,
 * not in a separate cabinet: one insulated box, one compressor, a mullion
 * between the two climates. This renders inside the Fridge's cabinet and shares
 * its shell, so it is a compartment rather than a second appliance.
 *
 * The travel is weighted heavier than a door, because a loaded freezer basket
 * is heavy, and it soft-closes on the last centimetre.
 */
function FreezerDrawer({
  open,
  onSelect,
  label,
  frost,
  items,
  /** Cabinet geometry, so the drawer fits the column it lives in. */
  width,
  height,
  depth,
  wall,
  y,
}: {
  open: boolean;
  onSelect: (k: KitchenObject) => void;
  label: string;
  frost: THREE.Texture;
  items: FoodItem[];
  width: number;
  height: number;
  depth: number;
  wall: number;
  y: number;
}) {
  const d = useRef<THREE.Group>(null);
  const vel = useRef(0);
  const travel = useRef(0);
  useApplianceHum(open, "freezer");
  useEdgeSound(open, (opening) => {
    playSeal(opening);
    playRails(0.55);
  });

  // Integrate and apply in the same callback. Split across two useFrame calls
  // the apply ran first and rendered the *previous* frame's position, which
  // showed up as the drawer lagging a frame behind the spring.
  useFrame((_, dt) => {
    const step = Math.min(dt, 0.05);
    // Heavier mass than a door, and soft-close damping as it returns home.
    const damping = open ? 13 : 13 + (1 - travel.current / 0.46) * 22;
    vel.current += ((open ? 0.46 : 0) - travel.current) * 52 * step - vel.current * damping * step;
    travel.current = Math.max(0, travel.current + vel.current * step);
    if (d.current) d.current.position.z = travel.current;
  });

  const iw = width - wall * 2;
  const ih = height - wall * 2;
  const packs = items.slice(0, 4);

  return (
    <Hoverable name={label} hint="open" onActivate={() => onSelect("freezer")} labelY={y + height / 2 + 0.2}>
      <group position={[0, y, 0]}>
        {/* insulated cavity + liner inside the shared cabinet shell */}
        <mesh position={[0, 0, 0.01]}>
          <boxGeometry args={[width - 0.02, height - 0.014, depth - 0.03]} />
          <meshStandardMaterial color="#d8d4cc" roughness={0.95} />
        </mesh>
        <mesh position={[0, 0, wall / 2]} material={LINER}>
          <boxGeometry args={[iw, ih, depth - wall]} />
        </mesh>
        <mesh position={[0, 0, -depth / 2 + wall + 0.008]}>
          <planeGeometry args={[iw - 0.01, ih - 0.01]} />
          <meshStandardMaterial
            color="#f2fbff"
            roughness={0.4}
            emissive="#bfe4ff"
            emissiveIntensity={open ? 0.7 : 0.05}
          />
        </mesh>
        {/* the visible cut edge of the insulation around the drawer opening */}
        {[
          { p: [0, ih / 2 + wall / 2, depth / 2 - (depth - wall) / 2], a: [iw, wall, depth - wall] },
          { p: [0, -ih / 2 - wall / 2, depth / 2 - (depth - wall) / 2], a: [iw, wall, depth - wall] },
          { p: [-width / 2 + wall / 2, 0, depth / 2 - (depth - wall) / 2], a: [wall, ih, depth - wall] },
          { p: [width / 2 - wall / 2, 0, depth / 2 - (depth - wall) / 2], a: [wall, ih, depth - wall] },
        ].map((s, i) => (
          <mesh key={i} position={s.p as [number, number, number]} material={LINER}>
            <boxGeometry args={s.a as [number, number, number]} />
          </mesh>
        ))}
        <LedStrip position={[0, ih / 2 - 0.05, -depth / 2 + wall + 0.05]} length={iw - 0.16} lit={open ? 1 : 0} colour="#d6efff" />
        <TempSensor position={[iw / 2 - 0.13, ih / 2 - 0.06, -depth / 2 + wall + 0.06]} lit={open ? 1 : 0} cold />
        <DrawerRails width={iw - 0.05} depth={depth - wall - 0.1} y={-ih / 2 + 0.06} />

        <group ref={d}>
          {/* front panel: glass face, insulated core, liner, gasket */}
          <RoundedBox
            args={[width, height, 0.026]}
            radius={0.008}
            smoothness={3}
            position={[0, 0, depth / 2 + 0.04]}
            castShadow
            material={BLACKGLASS}
          />
          <mesh position={[0, 0, depth / 2 + 0.018]}>
            <boxGeometry args={[width - 0.014, height - 0.014, 0.042]} />
            <meshStandardMaterial color="#d8d4cc" roughness={0.95} />
          </mesh>
          <mesh position={[0, 0, depth / 2 - 0.006]} material={LINER}>
            <boxGeometry args={[width - 0.02, height - 0.02, 0.012]} />
          </mesh>
          <group position={[0, 0, depth / 2 - 0.018]}>
            <Gasket w={width - 0.05} h={height - 0.05} />
          </group>
          <GoldHandle position={[0, height / 2 - 0.11, depth / 2 + 0.08]} length={width * 0.62} vertical={false} />

          {/* wire basket rather than a solid slab */}
          <group position={[0, -ih / 2 + 0.12, depth / 2 - 0.34]}>
            <mesh material={RAIL_MAT}>
              <boxGeometry args={[iw - 0.08, 0.008, depth - wall - 0.14]} />
            </mesh>
            {[-(depth - wall - 0.14) / 2, (depth - wall - 0.14) / 2].map((z) => (
              <mesh key={z} position={[0, 0.11, z]} material={RAIL_MAT}>
                <boxGeometry args={[iw - 0.08, 0.22, 0.007]} />
              </mesh>
            ))}
            {[-(iw - 0.08) / 2, (iw - 0.08) / 2].map((x) => (
              <mesh key={x} position={[x, 0.11, 0]} material={RAIL_MAT}>
                <boxGeometry args={[0.007, 0.22, depth - wall - 0.14]} />
              </mesh>
            ))}
            {Array.from({ length: 11 }).map((_, i) => (
              <mesh key={i} position={[-(iw - 0.14) / 2 + i * ((iw - 0.14) / 10), 0.005, 0]} material={RAIL_MAT}>
                <boxGeometry args={[0.005, 0.005, depth - wall - 0.14]} />
              </mesh>
            ))}
          </group>

          {/* frozen goods: printed packs with frost crusted over them */}
          {packs.map((it, i) => {
            const p = placeItem(it.id, urgencyOf(it));
            return (
              <group
                key={it.id}
                position={[
                  -(iw - 0.5) / 2 + i * ((iw - 0.5) / 3) + p.dx * 0.6,
                  -ih / 2 + 0.22,
                  depth / 2 - 0.34 + p.dz * 0.4,
                ]}
                rotation={[0, p.ry * 0.5, 0]}
              >
                <mesh>
                  <boxGeometry args={[0.17, 0.17, 0.26]} />
                  <meshStandardMaterial map={labelTextures()[p.variant % 6]} roughness={0.9} />
                </mesh>
                <mesh scale={1.035}>
                  <boxGeometry args={[0.17, 0.17, 0.26]} />
                  <meshStandardMaterial map={frost} transparent opacity={0.55} roughness={1} depthWrite={false} />
                </mesh>
              </group>
            );
          })}
        </group>
        <ColdAir position={[0, 0, depth / 2 + 0.12]} on={open} />
      </group>
    </Hoverable>
  );
}

/**
 * The refrigeration column: French doors over a freezer drawer, in one cabinet.
 *
 * Built the way the real appliance is built. Front to back: an outer
 * steel-and-glass shell, then the insulated wall cavity, then the ABS liner
 * forming the actual food compartment. The 75mm between shell and liner is real
 * geometry and its cut edge is visible all around the opening — that thickness
 * is the difference between reading as a hollow box and reading as an appliance.
 *
 * Top to bottom: fresh-food compartment behind two French doors, an insulated
 * mullion, then the freezer drawer sharing the same shell.
 *
 * Crucially, a lot of the construction detail only shows with the doors open, so
 * the *closed* cabinet carries its own detail too: recessed shadow gaps between
 * the doors, a flush control display, an ice and water dispenser recess, a brand
 * badge, a kickplate and adjustable feet. That is what you actually see standing
 * back in the room.
 */
function Fridge({
  selected,
  freezerOpen,
  onSelect,
  label,
  freezerLabel,
  items,
  freezerItems,
  frost,
}: {
  selected: boolean;
  freezerOpen: boolean;
  onSelect: (k: KitchenObject) => void;
  label: string;
  freezerLabel: string;
  items: FoodItem[];
  freezerItems: FoodItem[];
  frost: THREE.Texture;
}) {
  const l = useRef<THREE.Group>(null);
  const r = useRef<THREE.Group>(null);
  const lHandle = useRef<THREE.Group>(null);
  const rHandle = useRef<THREE.Group>(null);
  const [lit, setLit] = useState(0);
  useApplianceHum(selected);
  const { pull, swing } = useDoorMechanics(selected, 30);

  useFrame(() => {
    if (l.current) l.current.rotation.y = swing.current * 2.0;
    if (r.current) r.current.rotation.y = -swing.current * 2.0;
    const travel = pull.current * 0.014 * (1 - swing.current);
    if (lHandle.current) lHandle.current.position.z = 0.075 + travel;
    if (rHandle.current) rHandle.current.position.z = 0.075 + travel;
    const want = THREE.MathUtils.clamp((swing.current - 0.06) / 0.45, 0, 1);
    if (Math.abs(want - lit) > 0.02) setLit(want);
  });

  /**
   * Sort every category by urgency, then hand each item a placement.
   * Order is meaningful: index 0 is whatever needs eating first, and the
   * placement engine pulls high-urgency items toward the front of the shelf,
   * so the arrangement itself tells you what to use up.
   */
  const buckets = useMemo(() => {
    const b: Record<FoodKind, FoodItem[]> = {
      milk: [], egg: [], cheese: [], meat: [], fish: [], butter: [],
      yogurt: [], water: [], juice: [], fruit: [], veg: [], other: [],
    };
    items.forEach((i) => b[categorize(i.name)].push(i));
    (Object.keys(b) as FoodKind[]).forEach((k) =>
      b[k].sort((x, y) => daysLeft(x.expires_at) - daysLeft(y.expires_at)),
    );
    return b;
  }, [items]);

  const drinks = useMemo(() => items.filter((i) => ["water", "juice"].includes(categorize(i.name))), [items]);
  const fruitC = ["#b8352f", "#d4761f", "#3f7d2f", "#7d3f6a", "#c2452f", "#5d8f2f"];
  const vegC = ["#a83232", "#3f8f45", "#2f7d5a", "#c9761f", "#7d9a3a", "#8f4b2f"];

  /* ---- cabinet geometry ---------------------------------------------------
     One column, split into two climates. Everything below derives from these
     so the two sections always meet cleanly at the mullion. */
  const W = 1.75;
  const H = 2.42;
  const D = 0.78;
  const WALL = 0.075; // insulated cavity thickness — visible at the opening
  const PLINTH = 0.09; // kickplate height
  const FZ_H = 0.66; // freezer drawer section
  const MULL = 0.05; // insulated divider between the climates
  const FZ_Y = PLINTH + FZ_H / 2;
  const FRESH_BOTTOM = PLINTH + FZ_H + MULL;
  const FRESH_H = H - FRESH_BOTTOM;
  const FRESH_Y = FRESH_BOTTOM + FRESH_H / 2;
  const IW = W - WALL * 2;
  const IH = FRESH_H - WALL * 2;

  /* Depth budget. The cavity runs from CAV_BACK to CAV_FRONT (the door plane).
     Door bins protrude BIN_D into that cavity when the doors are shut, so the
     shelves have to stop short of them — in a real French-door fridge the
     shelves are deliberately shallower than the box for exactly this reason.
     Deriving both from one budget keeps them from ever intersecting again. */
  const CAV_FRONT = D / 2;
  const CAV_BACK = -D / 2 + WALL;
  const BIN_D = 0.135;
  const SHELF_D = CAV_FRONT - BIN_D - 0.02 - CAV_BACK;
  const SHELF_Z = CAV_BACK + SHELF_D / 2;
  /** Where an LED channel sits, just off the liner's back wall. */
  const LED_Z = CAV_BACK + 0.06 - SHELF_Z;

  /** Shelf heights in world space, inside the fresh compartment. */
  const SH = [FRESH_BOTTOM + 0.5, FRESH_BOTTOM + 0.92, FRESH_BOTTOM + 1.32];

  return (
    <group position={[-3.1, 0, -3.05]}>
      {/* ---------- kickplate + adjustable feet (visible from the room) ------ */}
      <mesh position={[0, PLINTH / 2, 0.02]}>
        <boxGeometry args={[W - 0.05, PLINTH, D - 0.06]} />
        <meshStandardMaterial color="#0a0b0d" roughness={0.6} metalness={0.3} />
      </mesh>
      <mesh position={[0, PLINTH - 0.012, D / 2 - 0.01]} material={GOLD_MAT}>
        <boxGeometry args={[W - 0.05, 0.014, 0.014]} />
      </mesh>
      {[-W / 2 + 0.09, W / 2 - 0.09].map((x) =>
        [D / 2 - 0.09, -D / 2 + 0.09].map((z) => (
          <mesh key={`${x}${z}`} position={[x, 0.022, z]} material={STEEL}>
            <cylinderGeometry args={[0.021, 0.024, 0.044, 12]} />
          </mesh>
        )),
      )}

      {/* ---------- outer shell, spanning both climates ---------- */}
      <Hoverable name={label} hint="open" onActivate={() => onSelect("fridge")} labelY={H + 0.18}>
        <RoundedBox
          args={[W, H - PLINTH, D]}
          radius={0.014}
          smoothness={3}
          position={[0, PLINTH + (H - PLINTH) / 2, 0]}
          castShadow
          receiveShadow
        >
          <meshStandardMaterial color="#101216" roughness={0.26} metalness={0.42} envMapIntensity={1.4} />
        </RoundedBox>

        {/* ---------- FRESH FOOD COMPARTMENT ---------- */}
        {/* insulated wall cavity */}
        <mesh position={[0, FRESH_Y, 0.01]}>
          <boxGeometry args={[W - 0.02, FRESH_H - 0.014, D - 0.03]} />
          <meshStandardMaterial color="#d8d4cc" roughness={0.95} metalness={0} />
        </mesh>
        {/* inner liner: the actual food compartment */}
        <mesh position={[0, FRESH_Y, WALL / 2]} material={LINER}>
          <boxGeometry args={[IW, IH, D - WALL]} />
        </mesh>
        <mesh position={[0, FRESH_Y, -D / 2 + WALL + 0.008]}>
          <planeGeometry args={[IW - 0.01, IH - 0.01]} />
          <meshStandardMaterial
            color="#f7fafb"
            roughness={0.36}
            metalness={0.06}
            emissive="#e8f4ff"
            emissiveIntensity={0.04 + lit * 0.55}
          />
        </mesh>
        {/* the visible cut edge of the wall around the opening */}
        {[
          { p: [0, H - WALL / 2 - 0.007, D / 2 - (D - WALL) / 2], a: [IW, WALL, D - WALL] },
          { p: [0, FRESH_BOTTOM + WALL / 2 + 0.007, D / 2 - (D - WALL) / 2], a: [IW, WALL, D - WALL] },
          { p: [-W / 2 + WALL / 2, FRESH_Y, D / 2 - (D - WALL) / 2], a: [WALL, IH, D - WALL] },
          { p: [W / 2 - WALL / 2, FRESH_Y, D / 2 - (D - WALL) / 2], a: [WALL, IH, D - WALL] },
        ].map((s, i) => (
          <mesh key={i} position={s.p as [number, number, number]} material={LINER}>
            <boxGeometry args={s.a as [number, number, number]} />
          </mesh>
        ))}

        {/* ---------- glass shelves on moulded supports ---------- */}
        {SH.map((y, si) => (
          <group key={y} position={[0, y, SHELF_Z]}>
            <mesh material={SHELF_GLASS}>
              <boxGeometry args={[IW - 0.03, 0.014, SHELF_D]} />
            </mesh>
            <mesh position={[0, 0, SHELF_D / 2]} material={GOLD_MAT}>
              <boxGeometry args={[IW - 0.03, 0.02, 0.012]} />
            </mesh>
            {[-(IW - 0.03) / 2 + 0.008, (IW - 0.03) / 2 - 0.008].map((x) => (
              <mesh key={x} position={[x, -0.012, 0]} material={LINER}>
                <boxGeometry args={[0.016, 0.022, SHELF_D - 0.01]} />
              </mesh>
            ))}
            <LedStrip position={[0, 0.2, LED_Z]} length={IW - 0.16} lit={lit} />
            {si === 2 && <TempSensor position={[(IW - 0.03) / 2 - 0.1, 0.13, LED_Z + 0.01]} lit={lit} />}
          </group>
        ))}

        {/* ---------- TOP SHELF: dairy compartment + eggs ---------- */}
        <group position={[0.44, SH[2] + 0.28, 0.02]}>
          <mesh material={LINER}>
            <boxGeometry args={[0.4, 0.012, 0.2]} />
          </mesh>
          {[-0.2, 0.2].map((x) => (
            <mesh key={x} position={[x, 0.05, 0]} material={LINER}>
              <boxGeometry args={[0.01, 0.1, 0.2]} />
            </mesh>
          ))}
          <mesh position={[0, 0.05, -0.1]} material={LINER}>
            <boxGeometry args={[0.4, 0.1, 0.01]} />
          </mesh>
          <mesh position={[0, 0.09, 0.075]} rotation={[0.62, 0, 0]} material={CLEAR_PLASTIC}>
            <boxGeometry args={[0.4, 0.11, 0.008]} />
          </mesh>
        </group>

        {buckets.milk.slice(0, 3).map((it, i) => (
          <Carton key={it.id} position={[-0.56 + i * 0.17, SH[2] + 0.13, 0.02]} place={placeItem(it.id, urgencyOf(it))} />
        ))}
        {buckets.egg.slice(0, 1).map((it) => (
          <EggTray
            key={it.id}
            position={[-0.06, SH[2] + 0.087, 0.0]}
            place={placeItem(it.id, urgencyOf(it))}
            count={countFrom(it.quantity, 10)}
          />
        ))}
        {buckets.butter.slice(0, 2).map((it, i) => (
          <group
            key={it.id}
            position={[0.34 + i * 0.14, SH[2] + 0.09, 0.01]}
            rotation={[0, placeItem(it.id, 0.2).ry * 0.5, 0]}
          >
            <mesh>
              <boxGeometry args={[0.115, 0.042, 0.07]} />
              <meshStandardMaterial color="#f6e9b8" roughness={0.62} />
            </mesh>
            <mesh position={[0.048, 0.001, 0]}>
              <boxGeometry args={[0.024, 0.045, 0.073]} />
              <meshStandardMaterial color="#d9c98f" roughness={0.35} metalness={0.5} />
            </mesh>
          </group>
        ))}
        {buckets.yogurt.slice(0, 4).map((it, i) => {
          const p = placeItem(it.id, urgencyOf(it));
          return (
            <group
              key={it.id}
              position={[-0.12 + (i % 2) * 0.11 + p.dx, SH[2] + 0.122, -0.16 + Math.floor(i / 2) * 0.1 + p.dz * 0.4]}
              rotation={[0, p.ry, 0]}
            >
              <mesh>
                <cylinderGeometry args={[0.049, 0.042, 0.068, 16]} />
                <meshStandardMaterial color="#eef1f3" roughness={0.48} />
              </mesh>
              <mesh position={[0, 0.036, 0]}>
                <cylinderGeometry args={[0.05, 0.05, 0.004, 16]} />
                <meshStandardMaterial color="#c9ccd1" roughness={0.28} metalness={0.72} />
              </mesh>
              <mesh position={[0, -0.004, 0]}>
                <cylinderGeometry args={[0.0495, 0.0435, 0.05, 16, 1, true]} />
                <meshStandardMaterial map={labelTextures()[p.variant % 6]} roughness={0.7} side={THREE.DoubleSide} />
              </mesh>
            </group>
          );
        })}

        {/* ---------- MIDDLE SHELF: proteins ---------- */}
        {buckets.meat.slice(0, 2).map((it, i) => (
          <Tray
            key={it.id}
            position={[-0.4 + i * 0.44, SH[1] + 0.015, 0.02]}
            place={placeItem(it.id, urgencyOf(it))}
            colour="#bc5555"
            fill={fillFrom(it.quantity)}
          />
        ))}
        {buckets.fish.slice(0, 1).map((it) => (
          <Tray
            key={it.id}
            position={[0.46, SH[1] + 0.015, -0.04]}
            place={placeItem(it.id, urgencyOf(it))}
            colour="#d3a09c"
            fill={fillFrom(it.quantity)}
          />
        ))}
        {buckets.cheese.slice(0, 3).map((it, i) => {
          const p = placeItem(it.id, urgencyOf(it));
          return (
            <group
              key={it.id}
              position={[-0.58 + i * 0.15 + p.dx, SH[1] + 0.04, 0.1 + p.dz * 0.5]}
              rotation={[0, p.ry, p.tilt]}
            >
              <mesh>
                <boxGeometry args={[0.07 + 0.1 * fillFrom(it.quantity), 0.06, 0.11]} />
                <meshStandardMaterial color="#f0c04a" roughness={0.56} />
              </mesh>
              <mesh position={[0, 0.001, -0.002]} scale={[1.02, 0.7, 1.03]}>
                <boxGeometry args={[0.07 + 0.1 * fillFrom(it.quantity), 0.06, 0.11]} />
                <meshStandardMaterial color="#f6f2e6" roughness={0.9} />
              </mesh>
            </group>
          );
        })}
        {buckets.other.slice(0, 3).map((it, i) => (
          <Jar
            key={it.id}
            position={[0.0 + i * 0.15, SH[1] + 0.1, -0.14]}
            place={placeItem(it.id, urgencyOf(it))}
            colour="#9c6b3f"
            r={0.045}
            h={0.14}
            fill={fillFrom(it.quantity)}
          />
        ))}

        {/* ---------- BOTTOM SHELF: fruit ---------- */}
        {buckets.fruit.slice(0, 9).map((it, i) => (
          <Produce
            key={it.id}
            position={[-0.58 + (i % 5) * 0.28, SH[0] + 0.062, -0.08 + Math.floor(i / 5) * 0.19]}
            place={placeItem(it.id, urgencyOf(it))}
            colour={fruitC[hashId(it.id) % fruitC.length]}
          />
        ))}

        {/* ---------- CRISPER DRAWER on real slides ---------- */}
        <DrawerRails width={IW - 0.06} depth={SHELF_D} y={FRESH_BOTTOM + 0.26} />
        <group position={[0, FRESH_BOTTOM + 0.1, SHELF_Z]}>
          <mesh material={LINER}>
            <boxGeometry args={[IW - 0.09, 0.012, SHELF_D - 0.02]} />
          </mesh>
          <mesh position={[0, 0.09, (SHELF_D - 0.02) / 2]} material={CLEAR_PLASTIC}>
            <boxGeometry args={[IW - 0.09, 0.19, 0.01]} />
          </mesh>
          {[-(IW - 0.09) / 2, (IW - 0.09) / 2].map((x) => (
            <mesh key={x} position={[x, 0.09, 0]} material={CLEAR_PLASTIC}>
              <boxGeometry args={[0.01, 0.19, SHELF_D - 0.02]} />
            </mesh>
          ))}
          <mesh position={[0, 0.15, (SHELF_D - 0.02) / 2 + 0.008]} material={GOLD_MAT}>
            <boxGeometry args={[0.3, 0.018, 0.014]} />
          </mesh>
          <mesh position={[(IW - 0.09) / 2 - 0.16, 0.16, (SHELF_D - 0.02) / 2 + 0.008]} material={RAIL_MAT}>
            <boxGeometry args={[0.07, 0.012, 0.008]} />
          </mesh>
        </group>
        {buckets.veg.slice(0, 10).map((it, i) => (
          <Produce
            key={it.id}
            position={[-0.6 + (i % 5) * 0.3, FRESH_BOTTOM + 0.14, -0.06 + Math.floor(i / 5) * 0.18]}
            place={placeItem(it.id, urgencyOf(it))}
            colour={vegC[hashId(it.id) % vegC.length]}
            r={0.055}
          />
        ))}

        <ColdAir position={[0, FRESH_BOTTOM, 0.45]} on={selected} />
        {lit > 0.05 && (
          <pointLight position={[0, FRESH_Y, 0.24]} intensity={lit * 2.4} distance={2.3} decay={2} color="#eef8ff" />
        )}

        {/* ---------- hinge hardware on the fresh-food doors ---------- */}
        {[-W / 2 + 0.02, W / 2 - 0.02].map((x) =>
          [H - 0.11, FRESH_BOTTOM + 0.11].map((y) => <Hinge key={`${x}${y}`} position={[x, y, D / 2 - 0.02]} />),
        )}

        {/* ---------- FRENCH DOORS ---------- */}
        {[
          { ref: l, handleRef: lHandle, x: -W / 2, s: 1 },
          { ref: r, handleRef: rHandle, x: W / 2, s: -1 },
        ].map((d, di) => (
          <group key={di} ref={d.ref} position={[d.x, FRESH_Y, D / 2]}>
            {/* outer glass panel */}
            <RoundedBox
              args={[W / 2 - 0.006, FRESH_H - 0.008, 0.026]}
              radius={0.008}
              smoothness={3}
              position={[(d.s * W) / 4, 0, 0.049]}
              castShadow
              material={BLACKGLASS}
            />
            {/* insulated core — the door has real thickness */}
            <mesh position={[(d.s * W) / 4, 0, 0.024]}>
              <boxGeometry args={[W / 2 - 0.018, FRESH_H - 0.02, 0.046]} />
              <meshStandardMaterial color="#d8d4cc" roughness={0.95} />
            </mesh>
            {/* moulded inner liner */}
            <mesh position={[(d.s * W) / 4, 0, 0.0]} material={LINER}>
              <boxGeometry args={[W / 2 - 0.024, FRESH_H - 0.026, 0.012]} />
            </mesh>
            {/* magnetic gasket, standing proud of the liner */}
            <group position={[(d.s * W) / 4, 0, -0.012]}>
              <Gasket w={W / 2 - 0.045} h={FRESH_H - 0.05} />
            </group>
            {/* handle on mounting posts */}
            <group ref={d.handleRef} position={[0, 0, 0.075]}>
              <group position={[d.s * (W / 2 - 0.055), 0, 0]}>
                <GoldHandle position={[0, 0, 0]} length={FRESH_H * 0.86} />
              </group>
            </group>

            {/* --- CLOSED-DOOR EXTERIOR DETAIL, left door only --- */}
            {di === 0 && (
              <>
                {/* flush touch control panel */}
                <group position={[(d.s * W) / 4 + 0.16, FRESH_H / 2 - 0.3, 0.063]}>
                  <mesh>
                    <boxGeometry args={[0.3, 0.13, 0.006]} />
                    <meshStandardMaterial color="#05070a" roughness={0.16} metalness={0.5} />
                  </mesh>
                  {/* temperature readouts, one per climate */}
                  {[-0.07, 0.07].map((x, k) => (
                    <group key={x} position={[x, 0.022, 0.005]}>
                      {[0, 1].map((dg) => (
                        <group key={dg} position={[-0.012 + dg * 0.024, 0, 0]}>
                          {[0.014, -0.014].map((sy) => (
                            <mesh key={sy} position={[0, sy, 0]}>
                              <planeGeometry args={[0.014, 0.003]} />
                              <meshStandardMaterial
                                color={k ? "#8fd8ff" : "#a8e8c0"}
                                emissive={k ? "#8fd8ff" : "#a8e8c0"}
                                emissiveIntensity={1.6}
                              />
                            </mesh>
                          ))}
                          <mesh position={[0.007, 0, 0]}>
                            <planeGeometry args={[0.003, 0.028]} />
                            <meshStandardMaterial
                              color={k ? "#8fd8ff" : "#a8e8c0"}
                              emissive={k ? "#8fd8ff" : "#a8e8c0"}
                              emissiveIntensity={1.6}
                            />
                          </mesh>
                        </group>
                      ))}
                    </group>
                  ))}
                  {/* capacitive touch keys */}
                  {[-0.1, -0.033, 0.033, 0.1].map((x) => (
                    <mesh key={x} position={[x, -0.04, 0.005]}>
                      <circleGeometry args={[0.008, 14]} />
                      <meshStandardMaterial color="#7f8894" emissive="#5f6a78" emissiveIntensity={0.5} />
                    </mesh>
                  ))}
                </group>

                {/* ice and water dispenser recess */}
                <group position={[(d.s * W) / 4 + 0.16, -0.12, 0.05]}>
                  {/* the recess itself: a lit alcove cut into the door face */}
                  <mesh position={[0, 0, -0.02]}>
                    <boxGeometry args={[0.24, 0.3, 0.05]} />
                    <meshStandardMaterial color="#15181c" roughness={0.5} metalness={0.3} />
                  </mesh>
                  <mesh position={[0, 0.13, -0.005]}>
                    <boxGeometry args={[0.22, 0.02, 0.03]} />
                    <meshStandardMaterial color="#dff0ff" emissive="#bfe4ff" emissiveIntensity={1.1} />
                  </mesh>
                  {/* water spout */}
                  <mesh position={[-0.05, 0.07, 0.0]} material={STEEL}>
                    <cylinderGeometry args={[0.011, 0.011, 0.05, 12]} />
                  </mesh>
                  {/* ice chute */}
                  <mesh position={[0.055, 0.075, 0.0]} material={STEEL}>
                    <cylinderGeometry args={[0.026, 0.026, 0.035, 14]} />
                  </mesh>
                  {/* dispenser paddle */}
                  <mesh position={[0, -0.03, 0.005]} rotation={[0.18, 0, 0]} material={RAIL_MAT}>
                    <boxGeometry args={[0.17, 0.11, 0.008]} />
                  </mesh>
                  {/* drip tray with a grille */}
                  <mesh position={[0, -0.125, 0.005]} material={RAIL_MAT}>
                    <boxGeometry args={[0.2, 0.012, 0.05]} />
                  </mesh>
                  {Array.from({ length: 6 }).map((_, i) => (
                    <mesh key={i} position={[-0.075 + i * 0.03, -0.118, 0.005]} material={STEEL}>
                      <boxGeometry args={[0.006, 0.004, 0.05]} />
                    </mesh>
                  ))}
                  {/* gold surround, so the recess reads as designed hardware */}
                  {[0.155, -0.155].map((y) => (
                    <mesh key={y} position={[0, y, 0.002]} material={GOLD_MAT}>
                      <boxGeometry args={[0.26, 0.012, 0.012]} />
                    </mesh>
                  ))}
                  {[-0.125, 0.125].map((x) => (
                    <mesh key={x} position={[x, 0, 0.002]} material={GOLD_MAT}>
                      <boxGeometry args={[0.012, 0.32, 0.012]} />
                    </mesh>
                  ))}
                </group>
              </>
            )}

            {/* brand badge on the right door */}
            {di === 1 && (
              <group position={[(d.s * W) / 4, FRESH_H / 2 - 0.16, 0.063]}>
                <mesh material={GOLD_MAT}>
                  <boxGeometry args={[0.19, 0.016, 0.005]} />
                </mesh>
                <mesh position={[0, -0.03, 0]} material={GOLD_MAT}>
                  <boxGeometry args={[0.1, 0.007, 0.004]} />
                </mesh>
              </group>
            )}

            {/* Retaining bins, and bottles standing in them (left door only).
                Local -z points into the cabinet, so the bins must sit at a
                NEGATIVE z to protrude into the cavity — at a positive z they
                were buried in the door's insulation and the bottles floated out
                in front of the closed doors. The bins are also flipped 180° so
                their retaining wall faces away from the door, which is the way
                round a real door bin holds a bottle in. */}
            {[FRESH_H / 2 - 0.42, 0, -FRESH_H / 2 + 0.42].map((y, bi) => {
              const bottle = di === 0 ? drinks[bi] : undefined;
              const binZ = -0.012 - BIN_D / 2;
              return (
                <group key={y}>
                  <group position={[(d.s * W) / 4, y, binZ]} rotation={[0, Math.PI, 0]}>
                    <DoorBin position={[0, 0, 0]} width={W / 2 - 0.09} depth={BIN_D} />
                  </group>
                  {bottle && (
                    <Bottle
                      position={[(d.s * W) / 4 - 0.16 + bi * 0.06, y + 0.16, binZ]}
                      place={placeItem(bottle.id, urgencyOf(bottle))}
                      colour={categorize(bottle.name) === "water" ? "#c4e2f7" : "#c8873a"}
                      fill={fillFrom(bottle.quantity)}
                      h={0.31}
                    />
                  )}
                </group>
              );
            })}
          </group>
        ))}

        {/* ---------- centre mullion between the French doors ---------- */}
        <mesh position={[0, FRESH_Y, D / 2 + 0.03]} material={STEEL}>
          <boxGeometry args={[0.012, FRESH_H - 0.03, 0.03]} />
        </mesh>

        {/* ---------- insulated divider between the two climates ---------- */}
        <mesh position={[0, PLINTH + FZ_H + MULL / 2, 0.01]}>
          <boxGeometry args={[W - 0.01, MULL, D - 0.02]} />
          <meshStandardMaterial color="#0d0f12" roughness={0.35} metalness={0.4} />
        </mesh>
        <mesh position={[0, PLINTH + FZ_H + MULL / 2, D / 2 + 0.005]} material={GOLD_MAT}>
          <boxGeometry args={[W - 0.02, 0.012, 0.012]} />
        </mesh>
      </Hoverable>

      {/* ---------- FREEZER DRAWER, in the same cabinet ---------- */}
      <FreezerDrawer
        open={freezerOpen}
        onSelect={onSelect}
        label={freezerLabel}
        frost={frost}
        items={freezerItems}
        width={W}
        height={FZ_H}
        depth={D}
        wall={WALL}
        y={FZ_Y}
      />
    </group>
  );
}


/**
 * Full-height pantry: a real cabinet carcass with a back panel, solid timber
 * shelves on visible supports, gold-framed glass doors on hinges, and cove
 * lighting in a channel under each shelf.
 *
 * Contents follow the same frequency-of-use rule as the fridge: whatever the
 * user is running through sits at the front of a shelf, and the deeper rows are
 * the things nobody has reached for in weeks.
 */
function Pantry({
  selected,
  onSelect,
  label,
  items,
}: {
  selected: boolean;
  onSelect: (k: KitchenObject) => void;
  label: string;
  items: FoodItem[];
}) {
  const l = useRef<THREE.Group>(null);
  const r = useRef<THREE.Group>(null);
  const [lit, setLit] = useState(0);
  const { swing } = useDoorMechanics(selected, 28);

  useFrame(() => {
    if (l.current) l.current.rotation.y = swing.current * 2.0;
    if (r.current) r.current.rotation.y = -swing.current * 2.0;
    const want = THREE.MathUtils.clamp((swing.current - 0.05) / 0.45, 0, 1);
    if (Math.abs(want - lit) > 0.02) setLit(want);
  });

  const jarColours = ["#e2d3ad", "#c9b48a", "#e8dcc4", "#b99b6a", "#d8c9a6", "#c2a97e"];
  const SHELVES = [0.45, 0.86, 1.27, 1.68, 2.05];

  /** Split the real pantry contents across the shelves, urgent items first so
   * they land on the middle shelves at eye level and toward the front. */
  const byShelf = useMemo(() => {
    const sorted = [...items].sort((a, b) => daysLeft(a.expires_at) - daysLeft(b.expires_at));
    const rows: FoodItem[][] = SHELVES.map(() => []);
    // Eye-level shelves fill first — that's where things you use actually live.
    const order = [2, 3, 1, 4, 0];
    sorted.forEach((it, i) => rows[order[i % order.length]].push(it));
    return rows;
  }, [items]);

  return (
    <Hoverable name={label} hint="open" onActivate={() => onSelect("pantry")} labelY={2.5}>
      <group position={[3.1, 0, -3.05]}>
        {/* carcass + back panel */}
        <RoundedBox
          args={[1.75, 2.35, 0.78]}
          radius={0.012}
          smoothness={3}
          position={[0, 1.175, 0]}
          castShadow
          receiveShadow
        >
          <meshStandardMaterial color="#101216" roughness={0.3} metalness={0.32} />
        </RoundedBox>
        <mesh position={[0, 1.2, 0.02]}>
          <boxGeometry args={[1.58, 2.1, 0.7]} />
          <meshStandardMaterial color="#b08d5f" roughness={0.72} />
        </mesh>
        <mesh position={[0, 1.2, -0.31]}>
          <planeGeometry args={[1.52, 2.04]} />
          <meshStandardMaterial color="#d9bb8c" roughness={0.7} emissive="#ffcf85" emissiveIntensity={0.06 + lit * 0.6} />
        </mesh>

        {SHELVES.map((y, si) => (
          <group key={y} position={[0, y, 0.04]}>
            {/* solid timber shelf with a bullnosed gold front edge */}
            <mesh castShadow receiveShadow>
              <boxGeometry args={[1.55, 0.032, 0.62]} />
              <meshStandardMaterial color="#8a6b45" roughness={0.66} />
            </mesh>
            <mesh position={[0, 0.02, 0.31]} material={GOLD_MAT}>
              <boxGeometry args={[1.55, 0.014, 0.014]} />
            </mesh>
            {/* shelf supports, so it isn't floating */}
            {[-0.765, 0.765].map((x) => (
              <mesh key={x} position={[x, -0.024, 0]}>
                <boxGeometry args={[0.018, 0.02, 0.6]} />
                <meshStandardMaterial color="#6f5636" roughness={0.7} />
              </mesh>
            ))}
            {/* cove lighting in a channel under the shelf above */}
            <LedStrip position={[0, 0.17, -0.27]} length={1.4} lit={lit} colour="#ffe6bd" />

            {/* real contents where we have them, decanted staples otherwise */}
            {byShelf[si].slice(0, 5).map((it, i) => {
              const p = placeItem(it.id, urgencyOf(it));
              // Alternate jars and printed packs so a shelf reads as a real
              // pantry rather than a row of matched canisters.
              return (hashId(it.id) & 1) === 0 ? (
                <Jar
                  key={it.id}
                  position={[-0.6 + i * 0.3, 0.13, 0]}
                  place={p}
                  colour={jarColours[hashId(it.id) % jarColours.length]}
                  fill={fillFrom(it.quantity)}
                />
              ) : (
                <Pack key={it.id} position={[-0.6 + i * 0.3, 0.018, 0]} place={p} />
              );
            })}
            {/* fill the rest of the shelf with decanted staples */}
            {Array.from({ length: Math.max(0, 5 - byShelf[si].length) }).map((_, k) => {
              const i = byShelf[si].length + k;
              const key = `pantry-${si}-${i}`;
              return (
                <Jar
                  key={key}
                  position={[-0.6 + i * 0.3, 0.13, 0]}
                  place={placeItem(key, 0.15)}
                  colour={jarColours[(si + i) % jarColours.length]}
                  fill={0.4 + ((hashId(key) % 50) / 100)}
                />
              );
            })}
          </group>
        ))}

        {lit > 0.05 && (
          <pointLight position={[0, 1.3, 0.25]} intensity={lit * 2.1} distance={2.4} decay={2} color="#ffd9a0" />
        )}

        {/* hinge hardware */}
        {[-0.855, 0.855].map((x) =>
          [2.24, 0.11].map((y) => <Hinge key={`${x}${y}`} position={[x, y, 0.37]} />),
        )}

        {/* glass doors in gold frames */}
        {[
          { ref: l, x: -0.875, s: 1 },
          { ref: r, x: 0.875, s: -1 },
        ].map((d, i) => (
          <group key={i} ref={d.ref} position={[d.x, 1.175, 0.4]}>
            {/* glazing */}
            <mesh position={[d.s * 0.4375, 0, 0]} material={SHELF_GLASS}>
              <boxGeometry args={[0.83, 2.29, 0.016]} />
            </mesh>
            {/* frame: rails top and bottom, stiles either side */}
            {[-1.15, 1.15].map((y) => (
              <mesh key={y} position={[d.s * 0.4375, y, 0.005]} material={GOLD_MAT}>
                <boxGeometry args={[0.875, 0.05, 0.032]} />
              </mesh>
            ))}
            {[0.015, d.s * 0.86].map((x, k) => (
              <mesh key={k} position={[x, 0, 0.005]} material={GOLD_MAT}>
                <boxGeometry args={[0.032, 2.35, 0.032]} />
              </mesh>
            ))}
            {/* gasket on the closing stile, so the door meets something */}
            <mesh position={[d.s * 0.855, 0, -0.012]} material={RUBBER}>
              <boxGeometry args={[0.014, 2.3, 0.014]} />
            </mesh>
            <GoldHandle position={[d.s * 0.79, 0, 0.055]} length={1.4} />
          </group>
        ))}
      </group>
    </Hoverable>
  );
}

function WaterStream({ on }: { on: boolean }) {
  const m = useRef<THREE.Mesh>(null);
  useFrame((s) => {
    if (!m.current) return;
    m.current.visible = on;
    const mat = m.current.material as THREE.MeshStandardMaterial;
    mat.opacity = on ? 0.42 + Math.sin(s.clock.elapsedTime * 22) * 0.12 : 0;
  });
  return (
    <mesh ref={m} position={[-1.0, 1.2, 0.3]} visible={false}>
      <cylinderGeometry args={[0.011, 0.02, 0.46, 10]} />
      <meshStandardMaterial color="#cfeaff" transparent opacity={0} roughness={0.1} />
    </mesh>
  );
}

/* -------------------------------------------------------------------- room */

function Scene({
  selected,
  onSelect,
  labels,
  controls,
  inventory,
  lightsOn,
  night,
  water,
  stove,
  oven,
  onToggleWater,
  onToggleStove,
}: {
  selected: KitchenObject | null;
  onSelect: (k: KitchenObject) => void;
  labels: Record<KitchenObject, string>;
  controls: KitchenControlLabels;
  inventory: FridgeInventory;
  lightsOn: boolean;
  night: boolean;
  water: boolean;
  stove: boolean;
  oven: boolean;
  onToggleWater: () => void;
  onToggleStove: () => void;
}) {
  const marbleWhite = useMemo(
    () =>
      canvasTex((ctx, w, h) => {
        ctx.fillStyle = "#d8d4cb";
        ctx.fillRect(0, 0, w, h);
        for (let i = 0; i < 24; i++) {
          const g = ctx.createRadialGradient(Math.random() * w, Math.random() * h, 8, Math.random() * w, Math.random() * h, 130 + Math.random() * 150);
          g.addColorStop(0, "rgba(213,210,203,0.28)");
          g.addColorStop(1, "rgba(213,210,203,0)");
          ctx.fillStyle = g;
          ctx.fillRect(0, 0, w, h);
        }
        for (let i = 0; i < 5; i++) drawVein(ctx, Math.random() * w, Math.random() * h, 44, 3.2, "rgba(178,174,168,0.5)", 2);
        for (let i = 0; i < 7; i++) drawVein(ctx, Math.random() * w, Math.random() * h, 38, 2.1, "rgba(201,162,39,0.95)", 2);
        for (let i = 0; i < 5; i++) drawVein(ctx, Math.random() * w, Math.random() * h, 28, 1.0, "rgba(235,205,120,0.9)", 1);
      }, [3, 3]),
    [],
  );
  const marbleBlack = useMemo(
    () =>
      canvasTex((ctx, w, h) => {
        ctx.fillStyle = "#0d0f12";
        ctx.fillRect(0, 0, w, h);
        for (let i = 0; i < 16; i++) {
          const g = ctx.createRadialGradient(Math.random() * w, Math.random() * h, 10, Math.random() * w, Math.random() * h, 140 + Math.random() * 140);
          g.addColorStop(0, "rgba(48,52,60,0.5)");
          g.addColorStop(1, "rgba(48,52,60,0)");
          ctx.fillStyle = g;
          ctx.fillRect(0, 0, w, h);
        }
        for (let i = 0; i < 6; i++) drawVein(ctx, Math.random() * w, Math.random() * h, 42, 2.3, "rgba(200,203,210,0.48)", 2);
        for (let i = 0; i < 4; i++) drawVein(ctx, Math.random() * w, Math.random() * h, 32, 1.2, "rgba(201,162,39,0.55)", 1);
      }, [2, 2]),
    [],
  );
  const woodTex = useMemo(
    () =>
      canvasTex((ctx, w, h) => {
        ctx.fillStyle = "#5b4530";
        ctx.fillRect(0, 0, w, h);
        for (let i = 0; i < 220; i++) {
          const y = Math.random() * h;
          ctx.strokeStyle = `rgba(${90 + Math.random() * 50},${65 + Math.random() * 40},${38 + Math.random() * 26},0.4)`;
          ctx.lineWidth = Math.random() * 2 + 0.3;
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.bezierCurveTo(w * 0.3, y + 6, w * 0.7, y - 6, w, y);
          ctx.stroke();
        }
      }, [1, 4]),
    [],
  );
  const frost = useMemo(
    () =>
      canvasTex((ctx, w, h) => {
        ctx.clearRect(0, 0, w, h);
        for (let i = 0; i < 1100; i++) {
          ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.85})`;
          ctx.beginPath();
          ctx.arc(Math.random() * w, Math.random() * h, Math.random() * 2.6 + 0.4, 0, Math.PI * 2);
          ctx.fill();
        }
      }),
    [],
  );
  const stoneRelief = useMemo(
    () =>
      heightToNormal(
        (ctx, w, h) => {
          for (let i = 0; i < 900; i++) {
            const v = 128 + (Math.random() - 0.5) * 40;
            ctx.fillStyle = `rgb(${v},${v},${v})`;
            ctx.beginPath();
            ctx.arc(Math.random() * w, Math.random() * h, 1 + Math.random() * 3, 0, Math.PI * 2);
            ctx.fill();
          }
        },
        [1, 1],
        0.8,
      ),
    [],
  );

  // Restore surface relief lost in the rebuild. Gold, steel, lacquer and
  // plaster had colour and roughness but no micro-relief, so they read as flat
  // plastic. Normal maps are texture lookups — no per-frame cost.
  useMemo(() => {
    // brushed metal: fine directional scratches, as on real appliance steel
    const brushed = heightToNormal(
      (ctx, w, h) => {
        for (let i = 0; i < 2600; i++) {
          const y = Math.random() * h;
          const v = 128 + (Math.random() - 0.5) * 90;
          ctx.strokeStyle = `rgb(${v},${v},${v})`;
          ctx.lineWidth = Math.random() * 1.4 + 0.2;
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(w, y + (Math.random() - 0.5) * 2);
          ctx.stroke();
        }
      },
      [3, 3],
      1.1,
      256,
    );
    STEEL.normalMap = brushed;
    STEEL.normalScale = new THREE.Vector2(0.3, 0.3);
    // gold: very fine polish lines so highlights break up instead of being a
    // single flat sheen
    GOLD_MAT.normalMap = brushed;
    GOLD_MAT.normalScale = new THREE.Vector2(0.1, 0.1);
    // sprayed lacquer: subtle orange-peel, as real cabinet doors have
    const peel = heightToNormal(
      (ctx, w, h) => {
        for (let i = 0; i < 900; i++) {
          const v = 128 + (Math.random() - 0.5) * 60;
          ctx.fillStyle = `rgb(${v},${v},${v})`;
          ctx.beginPath();
          ctx.arc(Math.random() * w, Math.random() * h, 3 + Math.random() * 9, 0, Math.PI * 2);
          ctx.fill();
        }
      },
      [4, 4],
      0.8,
      256,
    );
    BLACKGLASS.normalMap = peel;
    BLACKGLASS.normalScale = new THREE.Vector2(0.1, 0.1);
    [STEEL, GOLD_MAT, BLACKGLASS].forEach((m) => (m.needsUpdate = true));
  }, []);

  const blackMarbleMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        map: marbleBlack,
        normalMap: stoneRelief,
        normalScale: new THREE.Vector2(0.18, 0.18),
        roughness: 0.15,
        metalness: 0.4,
        envMapIntensity: 1.6,
      }),
    [marbleBlack, stoneRelief],
  );
  const woodMat = useMemo(() => new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.78, metalness: 0.02 }), [woodTex]);

  const view = useMemo(
    () =>
      canvasTex((ctx, w, h) => {
        const g = ctx.createLinearGradient(0, 0, 0, h);
        if (night) {
          g.addColorStop(0, "#0a1230");
          g.addColorStop(0.65, "#16204d");
          g.addColorStop(1, "#0b1226");
        } else {
          g.addColorStop(0, "#9fd2ff");
          g.addColorStop(0.55, "#e8f4ff");
          g.addColorStop(0.62, "#cfe4bd");
          g.addColorStop(1, "#93b87c");
        }
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
        if (night) {
          ctx.fillStyle = "rgba(255,255,255,0.85)";
          for (let i = 0; i < 60; i++) ctx.fillRect(Math.random() * w, Math.random() * h * 0.6, 1.6, 1.6);
        } else {
          const sun = ctx.createRadialGradient(w * 0.74, h * 0.22, 4, w * 0.74, h * 0.22, w * 0.3);
          sun.addColorStop(0, "rgba(255,251,235,0.95)");
          sun.addColorStop(1, "rgba(255,251,235,0)");
          ctx.fillStyle = sun;
          ctx.fillRect(0, 0, w, h);
        }
      }),
    [night],
  );

  const day = !night;

  return (
    <>
      {/* polished white-marble floor with gold veins */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[20, 18]} />
        <MeshReflectorMaterial
          map={marbleWhite}
          normalMap={stoneRelief}
          normalScale={new THREE.Vector2(0.12, 0.12)}
          resolution={512}
          mixBlur={0.9}
          mixStrength={1.4}
          blur={[300, 90]}
          roughness={0.34}
          depthScale={1}
          minDepthThreshold={0.4}
          maxDepthThreshold={1.35}
          color="#e9e6df"
          metalness={0.08}
        />
      </mesh>

      {/* black marble feature wall + gold reveals */}
      <mesh position={[0, 1.75, -3.5]} receiveShadow material={blackMarbleMat}>
        <boxGeometry args={[16, 3.5, 0.25]} />
      </mesh>
      <mesh position={[0, 3.49, -3.36]} material={GOLD_MAT}>
        <boxGeometry args={[16, 0.03, 0.04]} />
      </mesh>
      <mesh position={[0, 0.03, -3.36]} material={GOLD_MAT}>
        <boxGeometry args={[16, 0.05, 0.03]} />
      </mesh>

      {/* pale side walls keep the room bright and spacious */}
      <mesh position={[-7.2, 1.75, 0]} receiveShadow>
        <boxGeometry args={[0.25, 3.5, 9]} />
        <meshStandardMaterial color="#e8e4dc" roughness={0.95} />
      </mesh>
      <mesh position={[7.2, 1.75, 0]} receiveShadow>
        <boxGeometry args={[0.25, 3.5, 9]} />
        <meshStandardMaterial color="#e8e4dc" roughness={0.95} />
      </mesh>

      {/* ceiling + warm wood battens + indirect cove light */}
      <mesh position={[0, 3.5, 0]} rotation={[Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[16, 9]} />
        <meshStandardMaterial color="#f1ede5" roughness={0.95} />
      </mesh>
      {[-3.2, -1.6, 0, 1.6, 3.2].map((x) => (
        <mesh key={x} position={[x, 3.4, -0.6]} castShadow material={woodMat}>
          <boxGeometry args={[0.3, 0.12, 6.6]} />
        </mesh>
      ))}
      <mesh position={[0, 3.34, -3.2]}>
        <boxGeometry args={[15, 0.02, 0.05]} />
        <meshStandardMaterial color="#fff3dd" emissive="#ffd79a" emissiveIntensity={lightsOn ? 0.9 : 0.05} />
      </mesh>

      {/* window wall (left) */}
      <group position={[-7.05, 1.85, 0.4]} rotation={[0, Math.PI / 2, 0]}>
        <mesh>
          <planeGeometry args={[4.6, 2.3]} />
          <meshBasicMaterial map={view} />
        </mesh>
        {[1.2, -1.2].map((y) => (
          <mesh key={y} position={[0, y, 0.02]} material={GOLD_MAT}>
            <boxGeometry args={[4.8, 0.05, 0.06]} />
          </mesh>
        ))}
        {[-2.35, 0, 2.35].map((x) => (
          <mesh key={x} position={[x, 0, 0.02]} material={GOLD_MAT}>
            <boxGeometry args={[0.05, 2.4, 0.06]} />
          </mesh>
        ))}
      </group>
      <pointLight position={[-5.6, 2.2, 0.4]} intensity={day ? 5 : 1.4} distance={13} decay={2} color={day ? "#f2f7ff" : "#9fb4ff"} />

      {/* CENTRE: chef's cooking zone, on axis */}
      {/* Width kept inside the flanking tall cabinets (which start at
          x = +/-1.055) — at 3.0 this panel ran straight through them. */}
      <mesh position={[0, 1.72, -3.34]}>
        <planeGeometry args={[2.06, 1.0]} />
        <meshStandardMaterial
          map={marbleWhite}
          emissive="#ffbf6a"
          emissiveMap={marbleWhite}
          emissiveIntensity={lightsOn ? 0.55 : 0.15}
          toneMapped={false}
        />
      </mesh>
      {[2.24, 1.2].map((y) => (
        <mesh key={y} position={[0, y, -3.32]} material={GOLD_MAT}>
          <boxGeometry args={[2.1, 0.04, 0.05]} />
        </mesh>
      ))}
      <pointLight position={[0, 1.7, -2.9]} intensity={lightsOn ? 0.8 : 0.25} distance={4} decay={2} color="#ffc178" />

      {/* symmetrical base run either side of the cooking zone */}
      {[-0.55, 0.55].map((x) => (
        <group key={x} position={[x, 0, -3.02]}>
          <RoundedBox args={[1.0, 0.9, 0.72]} radius={0.01} smoothness={3} position={[0, 0.45, 0]} castShadow receiveShadow>
            <meshStandardMaterial color="#101216" roughness={0.3} metalness={0.3} />
          </RoundedBox>
          <GoldHandle position={[0, 0.72, 0.37]} length={0.4} vertical={false} />
        </group>
      ))}
      <mesh position={[0, 0.93, -3.02]} castShadow material={blackMarbleMat}>
        <boxGeometry args={[2.1, 0.06, 0.78]} />
      </mesh>

      {/* range hood: warm wood + gold */}
      <mesh position={[0, 2.75, -3.0]} castShadow material={woodMat}>
        <boxGeometry args={[1.5, 0.7, 0.62]} />
      </mesh>
      <mesh position={[0, 2.4, -3.0]} material={GOLD_MAT}>
        <boxGeometry args={[1.54, 0.035, 0.66]} />
      </mesh>

      {/* professional cooktop */}
      <Hoverable name={controls.stove} hint={stove ? "off" : "on"} onActivate={onToggleStove} labelY={0.5}>
        <group position={[0, 0.97, -3.02]}>
          <mesh material={BLACKGLASS}>
            <boxGeometry args={[1.15, 0.035, 0.62]} />
          </mesh>
          {[
            [-0.28, -0.13],
            [0.28, -0.13],
            [-0.28, 0.13],
            [0.28, 0.13],
          ].map(([x, z], i) => (
            <mesh key={i} position={[x, 0.024, z]} rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[0.06, 0.095, 22]} />
              <meshStandardMaterial color="#1b1c20" emissive="#ff4a1c" emissiveIntensity={stove ? 1.8 : 0.06} side={THREE.DoubleSide} />
            </mesh>
          ))}
        </group>
      </Hoverable>
      {stove && <pointLight position={[0, 1.06, -3.0]} intensity={1} distance={1.8} color="#ff6a2a" />}

      {/* stacked ovens */}
      <Hoverable name={labels.oven} hint="inspect" onActivate={() => onSelect("oven")} labelY={1.3}>
        <group position={[1.9, 1.15, -3.32]}>
          {[0, 0.66].map((dy, i) => (
            <group key={i} position={[0, dy, 0]}>
              <RoundedBox args={[0.9, 0.58, 0.09]} radius={0.008} smoothness={3} material={BLACKGLASS} />
              <mesh position={[0, 0, 0.05]}>
                <planeGeometry args={[0.66, 0.4]} />
                <meshStandardMaterial color="#2a1608" emissive="#ff8a3a" emissiveIntensity={oven ? 1.7 : 0.25} />
              </mesh>
              <GoldHandle position={[0, 0.24, 0.07]} length={0.74} vertical={false} />
            </group>
          ))}
        </group>
      </Hoverable>

      {/* STORE: refrigeration left, pantry right — the freezer is the bottom
          drawer of the refrigeration column, not a separate box. */}
      <Fridge
        selected={selected === "fridge"}
        freezerOpen={selected === "freezer"}
        onSelect={onSelect}
        label={labels.fridge}
        freezerLabel={labels.freezer}
        items={inventory.fridge}
        freezerItems={inventory.freezer}
        frost={frost}
      />
      <Pantry selected={selected === "pantry"} onSelect={onSelect} label={labels.pantry} items={inventory.pantry} />

      {/* Tall cabinetry flanking each column, filling the run so the back wall
          reads as integrated joinery rather than two boxes with gaps between
          them. Mirrored, to keep the villa's symmetry. */}
      {[-1.635, 1.635].map((x) => (
        <group key={x} position={[x, 0, -3.05]}>
          <mesh position={[0, 0.045, 0.02]}>
            <boxGeometry args={[1.1, 0.09, 0.66]} />
            <meshStandardMaterial color="#0a0b0d" roughness={0.6} metalness={0.3} />
          </mesh>
          <RoundedBox
            args={[1.15, 2.33, 0.72]}
            radius={0.012}
            smoothness={3}
            position={[0, 1.255, 0]}
            castShadow
            receiveShadow
          >
            <meshStandardMaterial color="#101216" roughness={0.28} metalness={0.38} envMapIntensity={1.3} />
          </RoundedBox>
          {/* two tall doors with a shadow gap between them */}
          {[-0.29, 0.29].map((dx) => (
            <group key={dx} position={[dx, 1.255, 0.365]}>
              <mesh material={BLACKGLASS}>
                <boxGeometry args={[0.565, 2.31, 0.022]} />
              </mesh>
              <GoldHandle position={[dx > 0 ? -0.25 : 0.25, 0, 0.03]} length={1.9} />
            </group>
          ))}
          {/* gold reveal lines at counter and cornice height */}
          {[0.93, 2.24].map((y) => (
            <mesh key={y} position={[0, y, 0.38]} material={GOLD_MAT}>
              <boxGeometry args={[1.15, 0.014, 0.016]} />
            </mesh>
          ))}
        </group>
      ))}

      {/* PREPARE: the island, dead centre */}
      <Hoverable name={labels.island} hint="inspect" onActivate={() => onSelect("island")} labelY={1.6}>
        <group position={[0, 0, -0.3]}>
          <RoundedBox args={[3.6, 0.9, 1.6]} radius={0.012} smoothness={3} position={[0, 0.45, 0]} castShadow receiveShadow>
            <meshStandardMaterial color="#0f1114" roughness={0.28} metalness={0.35} />
          </RoundedBox>
          <mesh position={[0, 0.945, 0]} castShadow material={blackMarbleMat}>
            <boxGeometry args={[3.9, 0.1, 1.85]} />
          </mesh>
          {[-1.95, 1.95].map((x) => (
            <mesh key={x} position={[x, 0.47, 0]} castShadow material={blackMarbleMat}>
              <boxGeometry args={[0.1, 0.95, 1.85]} />
            </mesh>
          ))}
          <mesh position={[0, 0.045, 0.81]} material={GOLD_MAT}>
            <boxGeometry args={[3.6, 0.03, 0.03]} />
          </mesh>
          <mesh position={[1.15, 1.0, -0.15]} material={BLACKGLASS}>
            <boxGeometry args={[0.86, 0.02, 0.48]} />
          </mesh>
          <mesh position={[0.2, 1.02, 0.22]} rotation={[0, 0.25, 0]} castShadow material={woodMat}>
            <boxGeometry args={[0.56, 0.032, 0.36]} />
          </mesh>
          <group position={[-0.4, 1.03, -0.3]}>
            <mesh material={CERAMIC}>
              <cylinderGeometry args={[0.2, 0.11, 0.09, 18]} />
            </mesh>
            {["#b8352f", "#d4761f", "#3f7d2f"].map((c, i) => (
              <mesh key={i} position={[(i - 1) * 0.07, 0.1, 0]}>
                <sphereGeometry args={[0.058, 12, 12]} />
                <meshStandardMaterial color={c} roughness={0.55} />
              </mesh>
            ))}
          </group>
        </group>
      </Hoverable>

      {/* island sink + gold gooseneck tap */}
      <Hoverable name={labels.sink} hint={water ? `${controls.water} off` : controls.water} onActivate={onToggleWater} labelY={1.45}>
        <group position={[-1.0, 1.0, 0.28]}>
          <mesh rotation={[Math.PI / 2, 0, 0]} material={STEEL}>
            <boxGeometry args={[0.62, 0.42, 0.02]} />
          </mesh>
          <mesh position={[0, 0.22, -0.16]} material={GOLD_MAT}>
            <cylinderGeometry args={[0.021, 0.021, 0.44, 12]} />
          </mesh>
          <mesh position={[0, 0.43, -0.08]} rotation={[Math.PI / 3, 0, 0]} material={GOLD_MAT}>
            <cylinderGeometry args={[0.021, 0.021, 0.24, 12]} />
          </mesh>
          <mesh position={[0, 0.45, 0.02]} material={GOLD_MAT}>
            <cylinderGeometry args={[0.019, 0.019, 0.1, 12]} />
          </mesh>
        </group>
      </Hoverable>
      <WaterStream on={water} />

      {/* bar stools facing the island */}
      {[-1.1, 0, 1.1].map((x) => (
        <group key={x} position={[x, 0, 1.0]}>
          <mesh position={[0, 0.66, 0]} rotation={[0.1, 0, 0]} castShadow material={LEATHER}>
            <boxGeometry args={[0.42, 0.07, 0.36]} />
          </mesh>
          <mesh position={[0, 0.34, 0]} material={GOLD_MAT}>
            <cylinderGeometry args={[0.026, 0.03, 0.62, 14]} />
          </mesh>
          <mesh position={[0, 0.02, 0]} material={GOLD_MAT}>
            <cylinderGeometry args={[0.2, 0.2, 0.03, 24]} />
          </mesh>
        </group>
      ))}

      {/* slim gold pendants over the island */}
      {[-1.1, 0, 1.1].map((x) => (
        <group key={x} position={[x, 0, -0.3]}>
          <mesh position={[0, 3.1, 0]} material={GOLD_MAT}>
            <cylinderGeometry args={[0.006, 0.006, 0.8, 8]} />
          </mesh>
          <mesh position={[0, 2.6, 0]} castShadow material={GOLD_MAT}>
            <cylinderGeometry args={[0.075, 0.075, 0.26, 20]} />
          </mesh>
          <mesh position={[0, 2.47, 0]}>
            <circleGeometry args={[0.07, 18]} />
            <meshStandardMaterial color="#fff3d6" emissive="#ffd08a" emissiveIntensity={lightsOn ? 2.0 : 0.1} />
          </mesh>
          {lightsOn && <pointLight position={[0, 2.35, 0]} intensity={1.1} distance={4} decay={2} color="#ffdca6" />}
        </group>
      ))}

      {/* recessed ceiling downlights */}
      {[
        [-3.2, -2.2],
        [0, -2.2],
        [3.2, -2.2],
        [-3.2, 1.4],
        [0, 1.4],
        [3.2, 1.4],
      ].map(([x, z], i) => (
        <group key={i} position={[x, 3.46, z]}>
          <mesh>
            <cylinderGeometry args={[0.075, 0.075, 0.03, 18]} />
            <meshStandardMaterial color="#fff6e6" emissive="#ffedcf" emissiveIntensity={lightsOn ? 1.1 : 0.04} />
          </mesh>
          {lightsOn && <pointLight position={[0, -0.2, 0]} intensity={0.55} distance={5.5} decay={2} color="#ffeacb" />}
        </group>
      ))}

      {/* orchid on the island end — a little life */}
      <group position={[1.75, 1.0, 0.25]}>
        <mesh material={CERAMIC}>
          <cylinderGeometry args={[0.1, 0.08, 0.22, 16]} />
        </mesh>
        <Breathing amount={0.03} speed={0.45}>
          {Array.from({ length: 7 }).map((_, i) => (
            <mesh key={i} position={[(i % 3) * 0.09 - 0.09, 0.3 + (i % 4) * 0.07, ((i % 2) - 0.5) * 0.12]}>
              <sphereGeometry args={[0.035, 10, 10]} />
              <meshStandardMaterial color={i % 2 ? "#f2e4ea" : "#e7d3dd"} roughness={0.75} />
            </mesh>
          ))}
        </Breathing>
      </group>

      <DustMotes on={day} />
      <ContactShadows position={[0, 0.012, 0]} opacity={0.78} scale={24} blur={2.2} far={7} resolution={1024} color="#171410" />
    </>
  );
}

/* ------------------------------------------------------------------ camera */

const POSES: Record<string, { cam: [number, number, number]; tgt: [number, number, number] }> = {
  /* Pulled in from 5.9 and swung left. The old pose sat ~9m from the
     refrigeration column, which reduced every piece of appliance detail to a
     handful of pixels — the room read as flat boxes no matter how much
     construction was underneath. This frames the back-wall run properly. */
  home: { cam: [1.5, 1.58, 4.15], tgt: [-0.9, 1.3, -2.6] },
  fridge: { cam: [-3.1, 1.78, -1.0], tgt: [-3.1, 1.62, -2.7] },
  /* The freezer is the bottom drawer of the same column now, so its pose drops
     low and looks down into the open basket. */
  freezer: { cam: [-3.1, 1.05, -1.35], tgt: [-3.1, 0.34, -2.75] },
  pantry: { cam: [3.1, 1.6, -0.7], tgt: [3.1, 1.25, -2.7] },
  island: { cam: [0, 1.85, 2.5], tgt: [0, 1.0, -0.3] },
  oven: { cam: [1.9, 1.5, -1.4], tgt: [1.9, 1.2, -3.1] },
  sink: { cam: [-1.0, 1.75, 1.6], tgt: [-1.0, 1.05, 0.2] },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CameraRig({ controlsRef, focus }: { controlsRef: React.MutableRefObject<any>; focus: KitchenObject | null }) {
  const { camera } = useThree();
  const anim = useRef<{ fc: THREE.Vector3; ft: THREE.Vector3; tc: THREE.Vector3; tt: THREE.Vector3; p: number } | null>(null);
  useEffect(() => {
    const c = controlsRef.current;
    if (!c) return;
    const pose = POSES[focus ?? "home"] ?? POSES.home;
    anim.current = {
      fc: camera.position.clone(),
      ft: c.target.clone(),
      tc: new THREE.Vector3(...pose.cam),
      tt: new THREE.Vector3(...pose.tgt),
      p: 0,
    };
    c.enabled = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus]);
  useFrame((_, dt) => {
    const c = controlsRef.current;
    const a = anim.current;
    if (!c || !a) return;
    a.p = Math.min(1, a.p + dt / 1.7);
    // quintic ease-in-out: barely perceptible start and a long, soft settle
    const e = a.p < 0.5 ? 16 * Math.pow(a.p, 5) : 1 - Math.pow(-2 * a.p + 2, 5) / 2;
    camera.position.lerpVectors(a.fc, a.tc, e);
    c.target.lerpVectors(a.ft, a.tt, e);
    c.update();
    if (a.p >= 1) {
      anim.current = null;
      c.enabled = true;
    }
  });
  return null;
}

/* ----------------------------------------------------------------- wrapper */

class ModelBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export default function Kitchen3D({
  selected,
  onSelect,
  onDeselect,
  labels,
  controls,
  inventory,
  modelUrl,
}: {
  selected: KitchenObject | null;
  onSelect: (k: KitchenObject) => void;
  onDeselect?: () => void;
  labels: Record<KitchenObject, string>;
  controls: KitchenControlLabels;
  inventory: FridgeInventory;
  modelUrl?: string | null;
}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const controlsRef = useRef<any>(null);
  const [heavyFx, setHeavyFx] = useState(true);
  const [lightsOn, setLightsOn] = useState(true);
  const [night, setNight] = useState(false);
  const [water, setWater] = useState(false);
  const [stove, setStove] = useState(false);
  const [oven, setOven] = useState(false);

  // Escape closes whatever is open and returns the camera to the room.
  useEffect(() => {
    if (!onDeselect) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDeselect();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onDeselect]);

  const scene = (
    <Scene
      selected={selected}
      onSelect={onSelect}
      labels={labels}
      controls={controls}
      inventory={inventory}
      lightsOn={lightsOn}
      night={night}
      water={water}
      stove={stove}
      oven={oven}
      onToggleWater={() => setWater((v) => !v)}
      onToggleStove={() => setStove((v) => !v)}
    />
  );

  const btn = (active: boolean, onClick: () => void, Icon: typeof Sun, text: string) => (
    <button
      onClick={onClick}
      className={cn(
        "pointer-events-auto inline-flex w-full items-center gap-2 rounded-full border px-3 py-2 text-xs font-medium backdrop-blur transition-colors",
        active ? "border-[#c9a227]/60 bg-[#c9a227]/20 text-[#f4e3b0]" : "border-white/15 bg-black/45 text-white/60 hover:text-white",
      )}
    >
      <Icon className="h-4 w-4 flex-none" />
      <span>{text}</span>
    </button>
  );

  return (
    <>
      <Canvas
        shadows
        dpr={[1, 1.5]}
        /* Must match POSES.home, or the first frame renders from the old wide
           shot and then visibly snaps once CameraRig takes over. */
        camera={{ position: [1.5, 1.58, 4.15], fov: 40 }}
        gl={{ antialias: true, alpha: false, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 0.92 }}
        style={{ touchAction: "none" }}
        onPointerMissed={() => onDeselect?.()}
      >
        <color attach="background" args={[night ? "#080a10" : "#171a1f"]} />
        <fog attach="fog" args={[night ? "#080a10" : "#171a1f", 22, 46]} />

        <ambientLight intensity={night ? 0.1 : 0.2} />
        <hemisphereLight args={["#fff6ea", "#5a5348", night ? 0.12 : 0.3]} />
        <directionalLight
          position={[-5, 6, 4]}
          intensity={night ? 0.22 : 2.3}
          color={night ? "#9fb4ff" : "#fff4e4"}
          castShadow
          shadow-mapSize={[1024, 1024]}
          shadow-bias={-0.0004}
          shadow-camera-left={-9}
          shadow-camera-right={9}
          shadow-camera-top={9}
          shadow-camera-bottom={-9}
        />
        <Suspense fallback={null}>
          <Environment key={night ? "n" : "d"} resolution={256} frames={1} environmentIntensity={night ? 0.28 : 0.5}>
            {/* ceiling bounce — broad, soft, slightly warm */}
            <Lightformer form="rect" intensity={night ? 0.35 : 1.0} color="#fff3e2" position={[0, 6, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[14, 9, 1]} />
            {/* the window: a tall bright panel on the left. This is what draws
                the long vertical highlight down polished gold and marble. */}
            <Lightformer form="rect" intensity={night ? 0.6 : 3.0} color={night ? "#b9c8ff" : "#eef6ff"} position={[-9, 2.2, 0.4]} rotation={[0, Math.PI / 2, 0]} scale={[7, 3.4, 1]} />
            {/* opposite soft fill so metals aren't black on their far side */}
            <Lightformer form="rect" intensity={night ? 0.2 : 0.45} color="#fff0dd" position={[9, 2.2, 1]} rotation={[0, -Math.PI / 2, 0]} scale={[7, 3, 1]} />
            {/* warm low kicker: gives the gold its amber depth */}
            <Lightformer form="rect" intensity={night ? 0.35 : 0.6} color="#ffcf92" position={[0, 0.6, 7]} rotation={[0, Math.PI, 0]} scale={[10, 1.6, 1]} />
            {/* narrow strips read as specular glints in the gold edges */}
            <Lightformer form="rect" intensity={night ? 0.8 : 1.6} color="#ffffff" position={[-2.4, 4.2, 2.4]} rotation={[Math.PI / 2.6, 0, 0]} scale={[0.5, 5, 1]} />
            <Lightformer form="rect" intensity={night ? 0.8 : 1.6} color="#ffffff" position={[2.4, 4.2, 2.4]} rotation={[Math.PI / 2.6, 0, 0]} scale={[0.5, 5, 1]} />
          </Environment>
        </Suspense>

        {modelUrl ? (
          <ModelBoundary fallback={scene}>
            <Suspense fallback={null}>
              <KitchenModel url={modelUrl} />
            </Suspense>
            <ContactShadows position={[0, 0.01, 0]} opacity={0.45} scale={24} blur={2.8} far={10} resolution={512} color="#2a2620" />
          </ModelBoundary>
        ) : (
          <>
            {scene}
            <CameraRig controlsRef={controlsRef} focus={selected} />
          </>
        )}

        <PerformanceMonitor onDecline={() => setHeavyFx(false)} onIncline={() => setHeavyFx(true)} />
        <AdaptiveDpr pixelated={false} />

        <OrbitControls
          ref={controlsRef}
          enablePan={false}
          minDistance={2.2}
          maxDistance={12}
          minPolarAngle={0.6}
          maxPolarAngle={Math.PI / 2.08}
          target={[0, 1.35, -1.6]}
          enableDamping
          dampingFactor={0.07}
        />

        {heavyFx ? (
          <EffectComposer multisampling={0} enableNormalPass>
            <N8AO aoRadius={0.7} intensity={2.6} distanceFalloff={0.9} quality="low" halfRes />
            <Bloom luminanceThreshold={0.78} luminanceSmoothing={0.9} intensity={0.42} mipmapBlur radius={0.65} />
            <Vignette eskil={false} offset={0.3} darkness={0.42} />
          </EffectComposer>
        ) : (
          <EffectComposer multisampling={0} enableNormalPass={false}>
            <Bloom luminanceThreshold={0.8} luminanceSmoothing={0.9} intensity={0.34} mipmapBlur radius={0.6} />
            <Vignette eskil={false} offset={0.3} darkness={0.42} />
          </EffectComposer>
        )}
      </Canvas>

      {/* appliance controls — left column */}
      <div className="pointer-events-none absolute left-4 top-1/2 z-20 flex w-36 -translate-y-1/2 flex-col gap-2">
        {btn(lightsOn, () => setLightsOn((v) => !v), lightsOn ? Lightbulb : LightbulbOff, controls.lights)}
        {btn(night, () => setNight((v) => !v), night ? Moon : Sun, night ? controls.night : controls.day)}
        {btn(water, () => setWater((v) => !v), Droplets, controls.water)}
        {btn(stove, () => setStove((v) => !v), Flame, controls.stove)}
        {btn(oven, () => setOven((v) => !v), CookingPot, controls.oven)}
      </div>
    </>
  );
}
