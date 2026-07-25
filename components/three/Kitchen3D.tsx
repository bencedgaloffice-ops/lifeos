"use client";

import React, { useRef, useState, useMemo, useEffect, useContext, Suspense, Component, type ReactNode } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, ContactShadows, Environment, Html, MeshReflectorMaterial, RoundedBox, PerformanceMonitor, AdaptiveDpr } from "@react-three/drei";
import { EffectComposer, Bloom, Vignette, N8AO } from "@react-three/postprocessing";
import { Lightbulb, LightbulbOff, Sun, Moon, Droplets, Flame, CookingPot } from "lucide-react";
import * as THREE from "three";
import { cn } from "@/lib/utils";
import { KitchenModel } from "./KitchenModel";

/* Error boundary so a missing/bad GLB never crashes the page — it just
   falls back to the hand-built kitchen scene. */
class ModelBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

/**
 * The Kitchen digital twin — dark-luxury design pass.
 *
 * A moody, high-end modern kitchen modelled on the reference interior: matte
 * black cabinetry, a faceted angular island with a warm bronze-terrazzo
 * waterfall top, a back-lit onyx splash, a copper-patina hood, sculptural
 * teardrop pendants and round-pedestal bar stools. Real, toggleable appliances
 * (lights, day/night, faucet, stove, oven) live in a control column on the
 * left. Inventory objects (fridge, freezer, pantry, island) stay clickable for
 * their real data; the fridge opens its lit doors when selected. Built from
 * primitives so it needs no downloaded assets.
 */

export type KitchenObject = "fridge" | "freezer" | "pantry" | "island" | "oven" | "sink";

export type KitchenControlLabels = {
  lights: string;
  day: string;
  night: string;
  water: string;
  stove: string;
  oven: string;
};

const BLACK = new THREE.MeshStandardMaterial({ color: "#131519", roughness: 0.48, metalness: 0.2 });
const BLACK2 = new THREE.MeshStandardMaterial({ color: "#17191e", roughness: 0.55, metalness: 0.18 });
const WALL = new THREE.MeshStandardMaterial({ color: "#b9b5ae", roughness: 0.97 });
const STEEL = new THREE.MeshStandardMaterial({ color: "#c6cacf", roughness: 0.24, metalness: 0.92, envMapIntensity: 1.4 });
const DARKMETAL = new THREE.MeshStandardMaterial({ color: "#202329", roughness: 0.35, metalness: 0.8 });
const GLASS = new THREE.MeshStandardMaterial({ color: "#0a1116", roughness: 0.06, metalness: 0.3, transparent: true, opacity: 0.55 });
const CERAMIC = new THREE.MeshStandardMaterial({ color: "#efeae0", roughness: 0.4, metalness: 0.05 });
const LEATHER = new THREE.MeshStandardMaterial({ color: "#0c0d10", roughness: 0.5, metalness: 0.1 });

function makeTexture(draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void, repeat: [number, number] = [1, 1]) {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 512;
  const ctx = c.getContext("2d")!;
  draw(ctx, 512, 512);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat[0], repeat[1]);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/**
 * Converts a procedurally-drawn height field into a tangent-space NORMAL map
 * (Sobel gradient). This is the single biggest thing separating "flat coloured
 * plastic" from a surface that reads as physically present: it gives wood its
 * grain depth, tile its recessed grout, steel its brushed micro-scratches and
 * plaster its tooth — all reacting correctly to light as the camera moves.
 * Costs nothing per frame (it's just another texture lookup).
 */
function heightToNormal(
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
  repeat: [number, number] = [1, 1],
  strength = 2.2,
  size = 512,
) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#808080";
  ctx.fillRect(0, 0, size, size);
  draw(ctx, size, size);
  const src = ctx.getImageData(0, 0, size, size).data;
  const out = ctx.createImageData(size, size);
  const at = (x: number, y: number) => {
    const xx = (x + size) % size;
    const yy = (y + size) % size;
    return src[(yy * size + xx) * 4] / 255;
  };
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // Sobel gradients
      const dx =
        at(x - 1, y - 1) + 2 * at(x - 1, y) + at(x - 1, y + 1) -
        (at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1));
      const dy =
        at(x - 1, y - 1) + 2 * at(x, y - 1) + at(x + 1, y - 1) -
        (at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1));
      const nx = dx * strength;
      const ny = dy * strength;
      const nz = 1;
      const len = Math.hypot(nx, ny, nz) || 1;
      const i = (y * size + x) * 4;
      out.data[i] = ((nx / len) * 0.5 + 0.5) * 255;
      out.data[i + 1] = ((ny / len) * 0.5 + 0.5) * 255;
      out.data[i + 2] = ((nz / len) * 0.5 + 0.5) * 255;
      out.data[i + 3] = 255;
    }
  }
  ctx.putImageData(out, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  return t;
}

/** Procedural micro-imperfection map: subtle smudges/grain so no surface reads
 * as a perfectly uniform CG plane. Used as a roughness map. */
function microRoughness(base = 128, blotch = 26) {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = `rgb(${base},${base},${base})`;
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 260; i++) {
    const v = base + (Math.random() - 0.5) * blotch * 2;
    ctx.fillStyle = `rgba(${v},${v},${v},0.5)`;
    ctx.beginPath();
    ctx.arc(Math.random() * 256, Math.random() * 256, 6 + Math.random() * 34, 0, Math.PI * 2);
    ctx.fill();
  }
  // fine grain
  const img = ctx.getImageData(0, 0, 256, 256);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 12;
    img.data[i] += n;
    img.data[i + 1] += n;
    img.data[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(3, 3);
  return t;
}

/** Frost / condensation speckle used on cold surfaces and frozen packs. */
function frostTexture(density = 900, alpha = 0.75) {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const ctx = c.getContext("2d")!;
  ctx.clearRect(0, 0, 256, 256);
  for (let i = 0; i < density; i++) {
    const r = Math.random() * 2.6 + 0.4;
    ctx.fillStyle = `rgba(255,255,255,${Math.random() * alpha})`;
    ctx.beginPath();
    ctx.arc(Math.random() * 256, Math.random() * 256, r, 0, Math.PI * 2);
    ctx.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/** Low, continuous compressor hum via WebAudio (no asset). Starts only after a
 * real user gesture, so it never trips browser autoplay policy. */
function useApplianceHum(active: boolean) {
  const ref = useRef<{ ctx: AudioContext; gain: GainNode } | null>(null);
  useEffect(() => {
    if (!active) {
      if (ref.current) ref.current.gain.gain.setTargetAtTime(0, ref.current.ctx.currentTime, 0.25);
      return;
    }
    if (!ref.current) {
      try {
        const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (!Ctor) return;
        const ctx = new Ctor();
        const osc = ctx.createOscillator();
        osc.type = "sine";
        osc.frequency.value = 62; // deep compressor tone
        const osc2 = ctx.createOscillator();
        osc2.type = "triangle";
        osc2.frequency.value = 124;
        const g2 = ctx.createGain();
        g2.gain.value = 0.25;
        const lp = ctx.createBiquadFilter();
        lp.type = "lowpass";
        lp.frequency.value = 220;
        const gain = ctx.createGain();
        gain.gain.value = 0;
        osc.connect(lp);
        osc2.connect(g2).connect(lp);
        lp.connect(gain).connect(ctx.destination);
        osc.start();
        osc2.start();
        ref.current = { ctx, gain };
      } catch {
        return;
      }
    }
    const { ctx, gain } = ref.current;
    if (ctx.state === "suspended") void ctx.resume();
    gain.gain.setTargetAtTime(0.045, ctx.currentTime, 0.5);
  }, [active]);
  useEffect(() => () => void ref.current?.ctx.close().catch(() => {}), []);
}

/** Days until expiry (null-safe); smaller = more urgent. */
function daysLeft(iso: string | null): number {
  if (!iso) return Number.POSITIVE_INFINITY;
  return (new Date(iso).getTime() - Date.now()) / 86_400_000;
}

export type FoodItem = { name: string; quantity: string | null; expires_at: string | null };
export type FridgeInventory = { fridge: FoodItem[]; freezer: FoodItem[]; pantry: FoodItem[] };

type FoodKind = "milk" | "egg" | "cheese" | "meat" | "fish" | "butter" | "yogurt" | "water" | "juice" | "fruit" | "veg" | "other";

function categorize(name: string): FoodKind {
  const n = name.toLowerCase();
  if (/milk|tej/.test(n)) return "milk";
  if (/egg|tojás|tojas/.test(n)) return "egg";
  if (/cheese|sajt/.test(n)) return "cheese";
  if (/chicken|beef|meat|pork|csirke|hús|hus|marha|sertés|sertes|bacon|szalonna|ham|sonka/.test(n)) return "meat";
  if (/fish|hal|salmon|lazac|tuna/.test(n)) return "fish";
  if (/butter|vaj/.test(n)) return "butter";
  if (/yog|joghurt|kefir/.test(n)) return "yogurt";
  if (/water|víz|viz|ásvány|asvany/.test(n)) return "water";
  if (/juice|lé|cola|soda|drink|ital|üdítő|udito|beer|sör|sor|wine|bor/.test(n)) return "juice";
  if (/apple|alma|orange|narancs|banana|banán|fruit|gyümölcs|gyumolcs|berry|bogyó|grape|szőlő|szolo|lemon|citrom|pear|körte/.test(n)) return "fruit";
  if (/tomato|paradicsom|lettuce|saláta|salata|cucumber|uborka|carrot|répa|repa|pepper|paprika|veg|zöldség|zoldseg|onion|hagyma|potato|krumpli/.test(n)) return "veg";
  return "other";
}

/** 0..1 fill from a quantity string ("60%", "1.5L", "500g" → heuristic). */
function fillFrom(q: string | null): number {
  if (!q) return 0.7;
  const pct = q.match(/(\d+)\s*%/);
  if (pct) return Math.min(1, Math.max(0.06, Number(pct[1]) / 100));
  return 0.72;
}
function countFrom(q: string | null, fallback: number): number {
  if (!q) return fallback;
  const m = q.match(/\d+/);
  return m ? Math.min(30, Math.max(0, Number(m[0]))) : fallback;
}

/** Translucent bottle with a visible liquid level. */
function Bottle({ position, color, fill, r = 0.045, h = 0.3 }: { position: [number, number, number]; color: string; fill: number; r?: number; h?: number }) {
  const lh = Math.max(0.02, h * 0.86 * fill);
  return (
    <group position={position}>
      <mesh>
        <cylinderGeometry args={[r, r, h, 16]} />
        <meshStandardMaterial color="#cfe6ef" roughness={0.08} metalness={0.05} transparent opacity={0.34} />
      </mesh>
      <mesh position={[0, -h / 2 + lh / 2 + 0.02, 0]}>
        <cylinderGeometry args={[r * 0.82, r * 0.82, lh, 16]} />
        <meshStandardMaterial color={color} roughness={0.4} />
      </mesh>
      <mesh position={[0, h / 2 + 0.02, 0]} material={DARKMETAL}>
        <cylinderGeometry args={[r * 0.55, r * 0.55, 0.05, 12]} />
      </mesh>
    </group>
  );
}

/** Egg tray — renders exactly `count` eggs so it visibly empties. */
function EggTray({ position, count }: { position: [number, number, number]; count: number }) {
  const cells: [number, number][] = [];
  for (let r = 0; r < 2; r++) for (let c = 0; c < 5; c++) cells.push([c, r]);
  return (
    <group position={position}>
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[0.34, 0.03, 0.16]} />
        <meshStandardMaterial color="#d8d2c4" roughness={0.9} />
      </mesh>
      {cells.slice(0, Math.min(10, Math.round(count))).map(([c, r], i) => (
        <mesh key={i} position={[-0.14 + c * 0.07, 0.04, -0.04 + r * 0.08]} scale={[1, 1.25, 1]}>
          <sphereGeometry args={[0.026, 12, 12]} />
          <meshStandardMaterial color="#f3e3c7" roughness={0.7} />
        </mesh>
      ))}
    </group>
  );
}

/** A packaged tray of meat/fish that shrinks with quantity. */
function MeatTray({ position, color, fill }: { position: [number, number, number]; color: string; fill: number }) {
  const w = 0.14 + 0.16 * fill;
  return (
    <group position={position}>
      <mesh>
        <boxGeometry args={[w + 0.03, 0.03, 0.2]} />
        <meshStandardMaterial color="#e9e9ec" roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.03, 0]}>
        <boxGeometry args={[w, 0.05, 0.16]} />
        <meshStandardMaterial color={color} roughness={0.55} />
      </mesh>
      <mesh position={[0, 0.065, 0]}>
        <boxGeometry args={[w + 0.03, 0.005, 0.2]} />
        <meshStandardMaterial color="#ffffff" roughness={0.12} transparent opacity={0.24} />
      </mesh>
    </group>
  );
}

/** Cheese wedge that shrinks with quantity. */
function Cheese({ position, fill }: { position: [number, number, number]; fill: number }) {
  const w = 0.08 + 0.14 * fill;
  return (
    <mesh position={position}>
      <boxGeometry args={[w, 0.09, 0.13]} />
      <meshStandardMaterial color="#f2c14e" roughness={0.55} />
    </mesh>
  );
}

function Tub({ position, color }: { position: [number, number, number]; color: string }) {
  return (
    <mesh position={position}>
      <cylinderGeometry args={[0.055, 0.05, 0.07, 16]} />
      <meshStandardMaterial color={color} roughness={0.5} />
    </mesh>
  );
}

function Produce({ position, color, r = 0.05 }: { position: [number, number, number]; color: string; r?: number }) {
  return (
    <mesh position={position}>
      <sphereGeometry args={[r, 14, 14]} />
      <meshStandardMaterial color={color} roughness={0.6} />
    </mesh>
  );
}

/** Dust motes suspended in the window light — the classic architectural-viz
 * atmosphere cue. Drift slowly and twinkle as they catch the sun. */
function DustMotes({ on }: { on: boolean }) {
  const pts = useRef<THREE.Points>(null);
  const geo = useMemo(() => {
    const n = 130;
    const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      arr[i * 3] = -4.4 + Math.random() * 3.2;
      arr[i * 3 + 1] = 0.4 + Math.random() * 3.0;
      arr[i * 3 + 2] = -1.6 + Math.random() * 3.6;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(arr, 3));
    return g;
  }, []);
  useFrame((s, dt) => {
    if (!pts.current) return;
    pts.current.visible = on;
    if (!on) return;
    const p = pts.current.geometry.attributes.position as THREE.BufferAttribute;
    const t = s.clock.elapsedTime;
    for (let i = 0; i < p.count; i++) {
      // slow convection drift, not linear fall
      let y = p.getY(i) + Math.sin(t * 0.25 + i) * dt * 0.06 + dt * 0.012;
      if (y > 3.4) y = 0.4;
      p.setY(i, y);
      p.setX(i, p.getX(i) + Math.sin(t * 0.18 + i * 1.7) * dt * 0.02);
    }
    p.needsUpdate = true;
    (pts.current.material as THREE.PointsMaterial).opacity = 0.28 + Math.sin(t * 0.7) * 0.06;
  });
  return (
    <points ref={pts} geometry={geo}>
      <pointsMaterial size={0.016} color="#fff4e0" transparent opacity={0.3} depthWrite={false} sizeAttenuation />
    </points>
  );
}

/** Almost-imperceptible emissive pulse — the way real LED drivers breathe. */
function PulseEmissive({
  base,
  amount = 0.12,
  speed = 1.1,
  position,
  children,
}: {
  base: number;
  amount?: number;
  speed?: number;
  position?: [number, number, number];
  children?: ReactNode;
}) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((s) => {
    const m = ref.current?.material as THREE.MeshStandardMaterial | undefined;
    if (m) m.emissiveIntensity = base * (1 + Math.sin(s.clock.elapsedTime * speed) * amount);
  });
  return (
    <mesh ref={ref} position={position}>
      {children}
    </mesh>
  );
}

/** Gentle life: leaves breathe, LED strips pulse almost imperceptibly. */
function Breathing({ children, amount = 0.02, speed = 0.6 }: { children: ReactNode; amount?: number; speed?: number }) {
  const g = useRef<THREE.Group>(null);
  useFrame((s) => {
    if (!g.current) return;
    const t = s.clock.elapsedTime * speed;
    g.current.rotation.z = Math.sin(t) * amount;
    g.current.rotation.x = Math.cos(t * 0.7) * amount * 0.6;
  });
  return <group ref={g}>{children}</group>;
}

/** Wall clock whose hands show the real current time and actually move. */
function Clock() {
  const min = useRef<THREE.Group>(null);
  const hr = useRef<THREE.Group>(null);
  useFrame(() => {
    const d = new Date();
    const m = d.getMinutes() + d.getSeconds() / 60;
    const h = (d.getHours() % 12) + m / 60;
    if (min.current) min.current.rotation.z = -(m / 60) * Math.PI * 2;
    if (hr.current) hr.current.rotation.z = -(h / 12) * Math.PI * 2;
  });
  return (
    <group position={[-2.4, 3.35, -2.78]}>
      <mesh material={CERAMIC} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.28, 0.28, 0.05, 36]} />
      </mesh>
      <mesh position={[0, 0, 0.03]}>
        <circleGeometry args={[0.24, 36]} />
        <meshStandardMaterial color="#f6f4ee" roughness={0.6} />
      </mesh>
      {Array.from({ length: 12 }).map((_, i) => (
        <mesh key={i} position={[Math.sin((i / 12) * Math.PI * 2) * 0.2, Math.cos((i / 12) * Math.PI * 2) * 0.2, 0.035]}>
          <boxGeometry args={[0.012, 0.03, 0.005]} />
          <meshStandardMaterial color="#1c2027" />
        </mesh>
      ))}
      <group ref={hr}>
        <mesh position={[0, 0.055, 0.04]}>
          <boxGeometry args={[0.018, 0.12, 0.008]} />
          <meshStandardMaterial color="#1c2027" />
        </mesh>
      </group>
      <group ref={min}>
        <mesh position={[0, 0.08, 0.045]}>
          <boxGeometry args={[0.012, 0.18, 0.008]} />
          <meshStandardMaterial color="#1c2027" />
        </mesh>
      </group>
      <mesh position={[0, 0, 0.05]}>
        <cylinderGeometry args={[0.014, 0.014, 0.01, 12]} />
        <meshStandardMaterial color="#c19a5b" metalness={1} roughness={0.3} />
      </mesh>
    </group>
  );
}

/** Drifting cold-air particles that appear when a cold appliance is open. */
function ColdAir({ position, on }: { position: [number, number, number]; on: boolean }) {
  const g = useRef<THREE.Points>(null);
  const geo = useMemo(() => {
    const n = 40;
    const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 1.0;
      arr[i * 3 + 1] = Math.random() * 1.8;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 0.6;
    }
    const bg = new THREE.BufferGeometry();
    bg.setAttribute("position", new THREE.BufferAttribute(arr, 3));
    return bg;
  }, []);
  useFrame((_, dt) => {
    if (!g.current) return;
    g.current.visible = on;
    const pos = g.current.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      let y = pos.getY(i) - dt * 0.35;
      if (y < 0) y = 1.8;
      pos.setY(i, y);
    }
    pos.needsUpdate = true;
  });
  return (
    <points ref={g} geometry={geo} position={position} visible={false}>
      <pointsMaterial size={0.02} color="#dff2ff" transparent opacity={0.35} depthWrite={false} />
    </points>
  );
}

/** Cinematic camera that eases toward whatever object is selected. */
const CAMERA_POSES: Record<string, { cam: [number, number, number]; tgt: [number, number, number] }> = {
  home: { cam: [5.8, 3.2, 5.8], tgt: [0.3, 1, -0.2] },
  fridge: { cam: [-2.5, 1.7, 0.9], tgt: [-3.4, 1.2, -1.8] },
  freezer: { cam: [-2.4, 1.1, 0.7], tgt: [-3.4, 0.5, -1.4] },
  pantry: { cam: [3.5, 1.7, 0.5], tgt: [4.9, 1.3, -2.1] },
  island: { cam: [0.4, 2.1, 3.4], tgt: [0.4, 1.0, 0.4] },
  oven: { cam: [2.3, 1.6, 0.7], tgt: [3.9, 1.35, -2.0] },
  sink: { cam: [-0.2, 1.9, 2.8], tgt: [-0.2, 1.05, 1.0] },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CameraFocus({ controlsRef, focus }: { controlsRef: React.MutableRefObject<any>; focus: KitchenObject | null }) {
  const { camera } = useThree();
  const anim = useRef<{ fromC: THREE.Vector3; fromT: THREE.Vector3; toC: THREE.Vector3; toT: THREE.Vector3; p: number } | null>(null);
  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;
    const pose = CAMERA_POSES[focus ?? "home"] ?? CAMERA_POSES.home;
    anim.current = {
      fromC: camera.position.clone(),
      fromT: controls.target.clone(),
      toC: new THREE.Vector3(...pose.cam),
      toT: new THREE.Vector3(...pose.tgt),
      p: 0,
    };
    controls.enabled = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus]);
  useFrame((_, dt) => {
    const controls = controlsRef.current;
    const a = anim.current;
    if (!controls || !a) return;
    a.p = Math.min(1, a.p + dt / 1.15);
    const e = a.p < 0.5 ? 2 * a.p * a.p : 1 - Math.pow(-2 * a.p + 2, 2) / 2;
    camera.position.lerpVectors(a.fromC, a.toC, e);
    controls.target.lerpVectors(a.fromT, a.toT, e);
    controls.update();
    if (a.p >= 1) {
      anim.current = null;
      controls.enabled = true;
    }
  });
  return null;
}

/** Organized, inventory-driven refrigerator interior. */
function FridgeInterior({ items }: { items: FoodItem[] }) {
  // Smart organization: within every shelf group the soonest-expiring item is
  // sorted first, and first == front-most position, so what needs eating shows
  // up at the front of the shelf where you actually see it.
  const buckets = useMemo(() => {
    const b: Record<FoodKind, FoodItem[]> = { milk: [], egg: [], cheese: [], meat: [], fish: [], butter: [], yogurt: [], water: [], juice: [], fruit: [], veg: [], other: [] };
    items.forEach((it) => b[categorize(it.name)].push(it));
    (Object.keys(b) as FoodKind[]).forEach((k) => b[k].sort((x, y) => daysLeft(x.expires_at) - daysLeft(y.expires_at)));
    return b;
  }, [items]);

  // Condensation film on the cold glass — subtle, only where light catches it.
  const condensation = useMemo(() => frostTexture(420, 0.22), []);

  const fruitColors = ["#c0392b", "#e67e22", "#27ae60", "#8e44ad", "#f1c40f"];
  const vegColors = ["#c0392b", "#2ecc71", "#27ae60", "#e67e22", "#16a085"];

  return (
    <group position={[0, 0, 0.32]}>
      {/* TOP shelf (y≈1.78): milk, eggs, butter, yogurt, drinks */}
      {buckets.milk.slice(0, 2).map((it, i) => (
        <Bottle key={`m${i}`} position={[-0.36 + i * 0.16, 1.94, 0.15 - i * 0.18]} color="#f7f7f2" fill={fillFrom(it.quantity)} />
      ))}
      {buckets.egg.slice(0, 1).map((it, i) => (
        <EggTray key={`e${i}`} position={[0.12, 1.81, 0]} count={countFrom(it.quantity, 10)} />
      ))}
      {buckets.butter.slice(0, 1).map((_, i) => (
        <mesh key={`b${i}`} position={[0.36, 1.83, 0.08]}>
          <boxGeometry args={[0.14, 0.05, 0.08]} />
          <meshStandardMaterial color="#f4e2a1" roughness={0.6} />
        </mesh>
      ))}
      {buckets.yogurt.slice(0, 3).map((_, i) => (
        <Tub key={`y${i}`} position={[0.28 + (i % 2) * 0.1, 1.83, -0.12]} color="#eef0f2" />
      ))}

      {/* MIDDLE shelf (y≈1.18): meat, fish, cheese, prepared meals */}
      {buckets.meat.slice(0, 2).map((it, i) => (
        <MeatTray key={`me${i}`} position={[-0.3 + i * 0.36, 1.2, 0.16 - i * 0.22]} color="#c65b5b" fill={fillFrom(it.quantity)} />
      ))}
      {buckets.fish.slice(0, 1).map((it, i) => (
        <MeatTray key={`f${i}`} position={[0.3, 1.2, -0.14]} color="#d6a3a0" fill={fillFrom(it.quantity)} />
      ))}
      {buckets.cheese.slice(0, 2).map((it, i) => (
        <Cheese key={`c${i}`} position={[-0.34 + i * 0.16, 1.24, 0.14]} fill={fillFrom(it.quantity)} />
      ))}

      {/* BOTTOM shelf (y≈0.58): fruit, containers */}
      {buckets.fruit.slice(0, 8).map((it, i) => (
        <Produce key={`fr${i}`} position={[-0.4 + (i % 4) * 0.24, 0.63, -0.12 + Math.floor(i / 4) * 0.2]} color={fruitColors[i % fruitColors.length]} />
      ))}
      {buckets.other.slice(0, 3).map((_, i) => (
        <mesh key={`o${i}`} position={[-0.3 + i * 0.3, 0.64, 0.16]}>
          <boxGeometry args={[0.2, 0.12, 0.16]} />
          <meshStandardMaterial color="#dfe6ea" roughness={0.2} transparent opacity={0.45} />
        </mesh>
      ))}

      {/* Condensation film on the cold glass shelves */}
      {[0.55, 1.15, 1.75].map((y) => (
        <mesh key={`cond${y}`} position={[0, y - 0.31, -0.02]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[1.06, 0.76]} />
          <meshStandardMaterial map={condensation} transparent opacity={0.3} depthWrite={false} roughness={0.1} />
        </mesh>
      ))}

      {/* Vegetable drawer (transparent, below bottom shelf) */}
      <mesh position={[0, 0.2, 0.06]}>
        <boxGeometry args={[1.05, 0.34, 0.78]} />
        <meshStandardMaterial color="#e6f0f2" roughness={0.15} metalness={0.1} transparent opacity={0.3} />
      </mesh>
      {/* condensation on the crisper lid */}
      <mesh position={[0, 0.375, 0.06]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[1.02, 0.74]} />
        <meshStandardMaterial map={condensation} transparent opacity={0.34} depthWrite={false} />
      </mesh>
      {buckets.veg.slice(0, 8).map((it, i) => (
        <Produce key={`v${i}`} position={[-0.4 + (i % 4) * 0.26, 0.2, -0.12 + Math.floor(i / 4) * 0.22]} color={vegColors[i % vegColors.length]} r={0.055} />
      ))}
    </group>
  );
}

/** Lets nested parts (e.g. handles) react to their appliance being hovered. */
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
  children: React.ReactNode;
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
        <Html center position={[0, labelY, 0]} distanceFactor={9} zIndexRange={[10, 0]}>
          <div className="pointer-events-none whitespace-nowrap rounded-full border border-white/20 bg-black/75 px-2.5 py-1 text-[11px] font-medium text-white/90 backdrop-blur">
            {name} <span className="text-white/40">· {hint}</span>
          </div>
        </Html>
      )}
    </group>
  );
}

function Handle({ position, length = 0.6, vertical = false }: { position: [number, number, number]; length?: number; vertical?: boolean }) {
  // Subtly lights up when its appliance is hovered — the "grab me" cue.
  const hovered = useContext(HoverCtx);
  return (
    <mesh position={position} rotation={vertical ? [0, 0, 0] : [0, 0, Math.PI / 2]}>
      <cylinderGeometry args={[0.014, 0.014, length, 14]} />
      <meshStandardMaterial
        color={hovered ? "#e8e2d4" : "#202329"}
        roughness={0.3}
        metalness={0.85}
        emissive="#ffd9a0"
        emissiveIntensity={hovered ? 0.5 : 0}
        envMapIntensity={1.3}
      />
    </mesh>
  );
}

/** Sculptural teardrop pendant (Secto-style), dark with a glowing base. */
function Pendant({ x, on }: { x: number; on: boolean }) {
  const geo = useMemo(() => {
    const pts: THREE.Vector2[] = [];
    const prof: [number, number][] = [
      [0.17, 0],
      [0.21, 0.1],
      [0.22, 0.22],
      [0.18, 0.34],
      [0.11, 0.46],
      [0.07, 0.56],
      [0.06, 0.66],
      [0.06, 0.82],
    ];
    prof.forEach(([r, y]) => pts.push(new THREE.Vector2(r, y)));
    return new THREE.LatheGeometry(pts, 28);
  }, []);
  return (
    <group position={[x, 0, 0.6]}>
      <mesh position={[0, 3.5, 0]} material={DARKMETAL}>
        <cylinderGeometry args={[0.008, 0.008, 1.0, 8]} />
      </mesh>
      <mesh position={[0, 2.35, 0]} geometry={geo}>
        <meshStandardMaterial color="#1a1c20" roughness={0.5} metalness={0.4} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 2.36, 0]}>
        <circleGeometry args={[0.15, 24]} />
        <meshStandardMaterial color="#fff2d2" emissive="#ffcf85" emissiveIntensity={on ? 4 : 0.15} />
      </mesh>
      {on && <pointLight position={[0, 2.2, 0]} intensity={4.5} distance={4.5} decay={2} color="#ffdca6" />}
    </group>
  );
}

/** Freezer whose drawer slides open (revealing lit baskets) when selected. */
function Freezer({ selected, onSelect, label }: { selected: boolean; onSelect: (k: KitchenObject) => void; label: string }) {
  const drawer = useRef<THREE.Group>(null);
  const vel = useRef(0);
  const frost = useMemo(() => frostTexture(1100, 0.85), []);
  // Spring-damped travel: the drawer has mass, so it eases out and settles
  // instead of snapping — resistance you can feel.
  useFrame((_, dt) => {
    if (!drawer.current) return;
    const target = selected ? 0.55 : 0;
    const k = 90, c = 15;
    const step = Math.min(dt, 0.05);
    vel.current += (target - drawer.current.position.z) * k * step - vel.current * c * step;
    drawer.current.position.z += vel.current * step;
  });
  return (
    <Hoverable name={label} hint="inspect" onActivate={() => onSelect("freezer")} labelY={0.95}>
      <group position={[-3.4, 0.35, -1.4]}>
        <RoundedBox args={[1.3, 0.7, 1.0]} radius={0.014} smoothness={3} castShadow material={BLACK} />
        <mesh position={[0, 0, 0.02]} material={CERAMIC}>
          <boxGeometry args={[1.15, 0.56, 0.9]} />
        </mesh>
        <mesh position={[0, 0, -0.35]}>
          <planeGeometry args={[1.1, 0.5]} />
          <meshStandardMaterial color="#eaf6ff" emissive="#bfe4ff" emissiveIntensity={selected ? 0.85 : 0.14} />
        </mesh>
        <group ref={drawer}>
          <RoundedBox args={[1.3, 0.7, 0.06]} radius={0.01} smoothness={3} position={[0, 0, 0.5]} castShadow material={BLACK} />
          <Handle position={[0, 0.14, 0.54]} length={0.7} />
          <mesh position={[0, -0.12, 0.22]} material={STEEL}>
            <boxGeometry args={[1.0, 0.32, 0.55]} />
          </mesh>
          {[
            ["#cfe4ff", -0.3],
            ["#e8d8c0", 0],
            ["#d9c0c0", 0.3],
          ].map(([c, x], i) => (
            <group key={i} position={[x as number, -0.04, 0.24]}>
              <mesh>
                <boxGeometry args={[0.22, 0.18, 0.32]} />
                <meshStandardMaterial color={c as string} roughness={0.85} />
              </mesh>
              {/* frost rime on the frozen pack */}
              <mesh scale={1.03}>
                <boxGeometry args={[0.22, 0.18, 0.32]} />
                <meshStandardMaterial map={frost} transparent opacity={0.55} roughness={1} depthWrite={false} />
              </mesh>
            </group>
          ))}
        </group>
      </group>
    </Hoverable>
  );
}

/** Pantry whose twin doors swing open (revealing lit, stocked shelves). */
function Pantry({ selected, onSelect, label }: { selected: boolean; onSelect: (k: KitchenObject) => void; label: string }) {
  const l = useRef<THREE.Group>(null);
  const r = useRef<THREE.Group>(null);
  useFrame(() => {
    const t = selected ? 1 : 0;
    if (l.current) l.current.rotation.y = THREE.MathUtils.lerp(l.current.rotation.y, t * 2.0, 0.12);
    if (r.current) r.current.rotation.y = THREE.MathUtils.lerp(r.current.rotation.y, -t * 2.0, 0.12);
  });
  return (
    <Hoverable name={label} hint="inspect" onActivate={() => onSelect("pantry")} labelY={2.4}>
      <group position={[4.9, 1.1, -2.4]}>
        <RoundedBox args={[1.0, 2.2, 0.7]} radius={0.014} smoothness={3} castShadow material={BLACK} />
        <mesh position={[0, 0, -0.02]} material={CERAMIC}>
          <boxGeometry args={[0.9, 2.05, 0.62]} />
        </mesh>
        <mesh position={[0, 0, -0.32]}>
          <planeGeometry args={[0.86, 2.0]} />
          <meshStandardMaterial color="#fff" emissive="#ffe6b0" emissiveIntensity={selected ? 0.7 : 0.12} />
        </mesh>
        {[-0.7, -0.2, 0.3, 0.75].map((y) => (
          <mesh key={y} position={[0, y, 0.02]} material={STEEL}>
            <boxGeometry args={[0.86, 0.03, 0.55]} />
          </mesh>
        ))}
        {[
          [-0.25, -0.5, "#b5854f"],
          [0.22, -0.5, "#7a9c5a"],
          [-0.2, 0, "#c0655a"],
          [0.22, 0.03, "#d8b26a"],
          [0, 0.55, "#8a6f4a"],
        ].map(([x, y, c], i) => (
          <mesh key={i} position={[x as number, y as number, 0.12]}>
            <boxGeometry args={[0.2, 0.28, 0.18]} />
            <meshStandardMaterial color={c as string} roughness={0.7} />
          </mesh>
        ))}
        <group ref={l} position={[-0.5, 0, 0.35]}>
          <mesh position={[0.25, 0, 0]} castShadow material={BLACK}>
            <boxGeometry args={[0.5, 2.2, 0.06]} />
          </mesh>
          <Handle position={[0.44, 0, 0.06]} length={1.4} vertical />
        </group>
        <group ref={r} position={[0.5, 0, 0.35]}>
          <mesh position={[-0.25, 0, 0]} castShadow material={BLACK}>
            <boxGeometry args={[0.5, 2.2, 0.06]} />
          </mesh>
          <Handle position={[-0.44, 0, 0.06]} length={1.4} vertical />
        </group>
      </group>
    </Hoverable>
  );
}

/** Faceted island with a bronze waterfall top and a front drawer that opens. */
function Island({ selected, onSelect, label, geo, mat }: { selected: boolean; onSelect: (k: KitchenObject) => void; label: string; geo: THREE.BufferGeometry; mat: THREE.Material }) {
  const drawer = useRef<THREE.Group>(null);
  useFrame(() => {
    if (drawer.current) drawer.current.position.z = THREE.MathUtils.lerp(drawer.current.position.z, selected ? 1.28 : 0.78, 0.15);
  });
  return (
    <Hoverable name={label} hint="inspect" onActivate={() => onSelect("island")} labelY={1.7}>
      <group position={[0.4, 0, 0.6]}>
        <mesh geometry={geo} castShadow receiveShadow material={BLACK} />
        <mesh position={[0, 0.955, 0]} castShadow material={mat}>
          <boxGeometry args={[3.0, 0.13, 1.62]} />
        </mesh>
        {/* front drawer (slides toward the stools) */}
        <group ref={drawer} position={[0, 0.62, 0.78]}>
          <mesh castShadow material={BLACK2}>
            <boxGeometry args={[1.2, 0.26, 0.06]} />
          </mesh>
          <Handle position={[0, 0, 0.05]} length={0.5} />
          <mesh position={[0, -0.02, -0.28]} material={STEEL}>
            <boxGeometry args={[1.1, 0.2, 0.55]} />
          </mesh>
          {[-0.3, -0.1, 0.1, 0.3].map((x) => (
            <mesh key={x} position={[x, 0.03, -0.28]} material={STEEL}>
              <boxGeometry args={[0.03, 0.02, 0.4]} />
            </mesh>
          ))}
        </group>
        {/* styling props on top */}
        <group position={[0.8, 1.03, 0.1]}>
          <mesh material={CERAMIC}>
            <cylinderGeometry args={[0.2, 0.11, 0.1, 20]} />
          </mesh>
          {[
            ["#7d1f2b", -0.06, 0.04],
            ["#9c4a1e", 0.06, 0.02],
            ["#3a5f2a", 0, -0.06],
          ].map(([c, x, z], i) => (
            <mesh key={i} position={[x as number, 0.11, z as number]}>
              <sphereGeometry args={[0.06, 16, 16]} />
              <meshStandardMaterial color={c as string} roughness={0.55} />
            </mesh>
          ))}
        </group>
        <mesh position={[-0.7, 1.03, 0.15]} rotation={[0, 0.3, 0]} castShadow>
          <boxGeometry args={[0.5, 0.03, 0.32]} />
          <meshStandardMaterial color="#5a3d24" roughness={0.7} />
        </mesh>
      </group>
    </Hoverable>
  );
}

/** Round-pedestal bar stool with a curved black seat. */
function Stool({ x }: { x: number }) {
  return (
    <group position={[x, 0, 1.75]}>
      <mesh position={[0, 0.66, 0]} rotation={[0.12, 0, 0]} castShadow material={LEATHER}>
        <boxGeometry args={[0.4, 0.06, 0.34]} />
      </mesh>
      <mesh position={[0, 0.66, -0.18]} rotation={[0.5, 0, 0]} castShadow material={LEATHER}>
        <boxGeometry args={[0.4, 0.06, 0.16]} />
      </mesh>
      <mesh position={[0, 0.34, 0]} material={DARKMETAL}>
        <cylinderGeometry args={[0.03, 0.035, 0.64, 16]} />
      </mesh>
      <mesh position={[0, 0.02, 0]} material={DARKMETAL}>
        <cylinderGeometry args={[0.2, 0.2, 0.03, 28]} />
      </mesh>
    </group>
  );
}

function Fridge({ selected, onSelect, label, items }: { selected: boolean; onSelect: (k: KitchenObject) => void; label: string; items: FoodItem[] }) {
  const left = useRef<THREE.Group>(null);
  const right = useRef<THREE.Group>(null);
  const led = useRef(0);
  const vel = useRef(0);
  const swing = useRef(0);
  const [ledOn, setLedOn] = useState(0);
  useApplianceHum(selected);
  useFrame((_, dt) => {
    // Spring-damped door swing: a heavy door accelerates slowly, carries
    // momentum, then settles — rather than a linear snap.
    const target = selected ? 1 : 0;
    const step = Math.min(dt, 0.05);
    const k = 55, c = 12;
    vel.current += (target - swing.current) * k * step - vel.current * c * step;
    swing.current += vel.current * step;
    if (left.current) left.current.rotation.y = swing.current * 2.05;
    if (right.current) right.current.rotation.y = -swing.current * 2.05;
    // Interior LED fades in only once the door is genuinely ajar.
    const lit = THREE.MathUtils.clamp((swing.current - 0.08) / 0.5, 0, 1);
    led.current = THREE.MathUtils.lerp(led.current, lit, 0.12);
    if (Math.abs(led.current - ledOn) > 0.01) setLedOn(led.current);
  });
  const doorDrinks = useMemo(() => items.filter((i) => ["water", "juice"].includes(categorize(i.name))), [items]);
  return (
    <Hoverable name={label} hint="inspect" onActivate={() => onSelect("fridge")} labelY={2.5}>
      <group position={[-3.4, 0, -2.2]}>
        {/* body + fingerprint-resistant liner */}
        <RoundedBox args={[1.3, 2.2, 1.0]} radius={0.014} smoothness={3} position={[0, 1.1, 0]} castShadow material={BLACK} />
        <mesh position={[0, 1.15, 0.05]}>
          <boxGeometry args={[1.16, 1.92, 0.9]} />
          <meshStandardMaterial color="#eef1f3" roughness={0.35} metalness={0.35} envMapIntensity={1.2} />
        </mesh>
        {/* back panel glows when open */}
        <mesh position={[0, 1.15, -0.36]}>
          <planeGeometry args={[1.12, 1.86]} />
          <meshStandardMaterial color="#f4fbff" emissive="#eaf6ff" emissiveIntensity={0.12 + ledOn * 1.1} />
        </mesh>
        {/* glass shelves */}
        {[0.55, 1.15, 1.75].map((y) => (
          <mesh key={y} position={[0, y, 0.1]} material={GLASS}>
            <boxGeometry args={[1.12, 0.03, 0.82]} />
          </mesh>
        ))}
        {/* LED strips top + per-shelf */}
        {[2.02, 1.55, 0.95].map((y, i) => (
          <mesh key={i} position={[0, y, 0.34]}>
            <boxGeometry args={[1.05, 0.02, 0.03]} />
            <meshStandardMaterial color="#eaf6ff" emissive="#dcefff" emissiveIntensity={0.25 + ledOn * 3} />
          </mesh>
        ))}
        {/* inventory-driven food */}
        <FridgeInterior items={items} />
        {/* cold-air wisp + interior light when open */}
        <ColdAir position={[0, 0.2, 0.5]} on={selected} />
        {ledOn > 0.05 && <pointLight position={[0, 1.3, 0.35]} intensity={ledOn * 2.4} distance={2.2} decay={2} color="#eef7ff" />}

        {/* doors with rubber seals, premium handles, and door-shelf drinks */}
        <group ref={left} position={[-0.65, 1.1, 0.5]}>
          <RoundedBox args={[0.65, 2.2, 0.08]} radius={0.01} smoothness={3} position={[0.325, 0, 0]} castShadow material={BLACK} />
          <mesh position={[0.325, 0, -0.045]}>
            <boxGeometry args={[0.58, 2.05, 0.02]} />
            <meshStandardMaterial color="#0a0b0d" roughness={0.9} />
          </mesh>
          <Handle position={[0.58, 0, 0.08]} length={1.0} vertical />
          {doorDrinks.slice(0, 3).map((it, i) => (
            <Bottle key={i} position={[0.34, 0.2 - i * 0.5, 0.12]} color={categorize(it.name) === "water" ? "#bfe0ff" : "#d68a3a"} fill={fillFrom(it.quantity)} h={0.34} />
          ))}
        </group>
        <group ref={right} position={[0.65, 1.1, 0.5]}>
          <RoundedBox args={[0.65, 2.2, 0.08]} radius={0.01} smoothness={3} position={[-0.325, 0, 0]} castShadow material={BLACK} />
          <mesh position={[-0.325, 0, -0.045]}>
            <boxGeometry args={[0.58, 2.05, 0.02]} />
            <meshStandardMaterial color="#0a0b0d" roughness={0.9} />
          </mesh>
          <Handle position={[-0.58, 0, 0.08]} length={1.0} vertical />
        </group>
      </group>
    </Hoverable>
  );
}

function WaterStream({ on }: { on: boolean }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((s) => {
    if (!ref.current) return;
    ref.current.visible = on;
    const m = ref.current.material as THREE.MeshStandardMaterial;
    m.opacity = on ? 0.45 + Math.sin(s.clock.elapsedTime * 22) * 0.12 : 0;
  });
  return (
    <mesh ref={ref} position={[-0.2, 1.18, 1.0]} visible={false}>
      <cylinderGeometry args={[0.012, 0.022, 0.5, 10]} />
      <meshStandardMaterial color="#cdeaff" transparent opacity={0} roughness={0.1} metalness={0} />
    </mesh>
  );
}

function Steam({ on }: { on: boolean }) {
  const g = useRef<THREE.Group>(null);
  useFrame((s) => {
    if (!g.current) return;
    g.current.visible = on;
    g.current.children.forEach((child, i) => {
      const t = (s.clock.elapsedTime * 0.5 + i * 0.33) % 1;
      child.position.y = t * 0.5;
      child.scale.setScalar(0.04 + t * 0.12);
      const m = (child as THREE.Mesh).material as THREE.MeshStandardMaterial;
      m.opacity = on ? (1 - t) * 0.3 : 0;
    });
  });
  return (
    <group ref={g} position={[2.38, 1.15, -2.17]} visible={false}>
      {[0, 1, 2].map((i) => (
        <mesh key={i}>
          <sphereGeometry args={[0.1, 12, 12]} />
          <meshStandardMaterial color="#ffffff" transparent opacity={0} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}

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
  // Real surfaces are never uniformly rough — vary roughness per-pixel so
  // reflections break up instead of reading as flat CG.
  useMemo(() => {
    const matte = microRoughness(150, 34);
    const metal = microRoughness(74, 26);
    BLACK.roughnessMap = matte;
    BLACK2.roughnessMap = matte;
    WALL.roughnessMap = microRoughness(210, 22);
    STEEL.roughnessMap = metal;
    DARKMETAL.roughnessMap = metal;

    // --- Surface relief (normal maps) ---
    // Brushed stainless: fine directional scratches, like real appliance steel.
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
      [2, 2],
      1.1,
      256,
    );
    STEEL.normalMap = brushed;
    STEEL.normalScale = new THREE.Vector2(0.28, 0.28);
    DARKMETAL.normalMap = brushed;
    DARKMETAL.normalScale = new THREE.Vector2(0.2, 0.2);

    // Matte lacquer cabinetry: very subtle orange-peel, as real sprayed doors have.
    const orangePeel = heightToNormal(
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
    BLACK.normalMap = orangePeel;
    BLACK.normalScale = new THREE.Vector2(0.16, 0.16);
    BLACK2.normalMap = orangePeel;
    BLACK2.normalScale = new THREE.Vector2(0.12, 0.12);

    // Plaster wall tooth.
    const plaster = heightToNormal(
      (ctx, w, h) => {
        for (let i = 0; i < 5200; i++) {
          const v = 128 + (Math.random() - 0.5) * 70;
          ctx.fillStyle = `rgb(${v},${v},${v})`;
          ctx.fillRect(Math.random() * w, Math.random() * h, 2, 2);
        }
      },
      [6, 6],
      1.0,
      256,
    );
    WALL.normalMap = plaster;
    WALL.normalScale = new THREE.Vector2(0.5, 0.5);

    [BLACK, BLACK2, WALL, STEEL, DARKMETAL].forEach((m) => (m.needsUpdate = true));
  }, []);

  const wood = useMemo(
    () =>
      makeTexture((ctx, w, h) => {
        ctx.fillStyle = "#a9855b";
        ctx.fillRect(0, 0, w, h);
        const planks = 6;
        const pw = w / planks;
        const shades = ["#ad895e", "#a07c53", "#b28f63", "#9a774f", "#a98457", "#a07d55"];
        for (let i = 0; i < planks; i++) {
          ctx.fillStyle = shades[i % shades.length];
          ctx.fillRect(i * pw, 0, pw - 2, h);
          ctx.strokeStyle = "rgba(70,50,30,0.18)";
          ctx.lineWidth = 1;
          for (let g = 0; g < 16; g++) {
            const x = i * pw + Math.random() * pw;
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.bezierCurveTo(x + 4, h * 0.33, x - 4, h * 0.66, x, h);
            ctx.stroke();
          }
          ctx.fillStyle = "rgba(50,34,18,0.5)";
          ctx.fillRect(i * pw + pw - 2, 0, 2, h);
        }
        ctx.fillStyle = "rgba(50,34,18,0.4)";
        for (let y = 0; y < h; y += h / 4) ctx.fillRect(0, y, w, 2);
      }, [5, 5]),
    [],
  );

  // Warm bronze terrazzo for the island / counters
  const bronze = useMemo(
    () =>
      makeTexture((ctx, w, h) => {
        ctx.fillStyle = "#5c3f28";
        ctx.fillRect(0, 0, w, h);
        const cols = ["#b87333", "#d9a441", "#8a5a2b", "#2f2013", "#caa877", "#7a4a22"];
        for (let i = 0; i < 1400; i++) {
          ctx.fillStyle = cols[i % cols.length];
          ctx.globalAlpha = 0.5 + Math.random() * 0.5;
          const r = 1 + Math.random() * 3.5;
          ctx.beginPath();
          ctx.arc(Math.random() * w, Math.random() * h, r, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }),
    [],
  );

  // Back-lit onyx splash — glowing amber marble
  const onyx = useMemo(
    () =>
      makeTexture((ctx, w, h) => {
        const g = ctx.createLinearGradient(0, 0, w, h);
        g.addColorStop(0, "#f6e6c4");
        g.addColorStop(0.4, "#e8c98a");
        g.addColorStop(0.7, "#caa15a");
        g.addColorStop(1, "#f2dcb0");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = "rgba(120,70,30,0.35)";
        for (let i = 0; i < 14; i++) {
          ctx.lineWidth = Math.random() * 3 + 0.5;
          ctx.beginPath();
          let x = Math.random() * w;
          let y = 0;
          ctx.moveTo(x, y);
          while (y < h) {
            x += (Math.random() - 0.5) * 90;
            y += h / 7;
            ctx.lineTo(x, y);
          }
          ctx.stroke();
        }
      }),
    [],
  );

  // Copper-patina hood tiles
  const copper = useMemo(
    () =>
      makeTexture((ctx, w, h) => {
        ctx.fillStyle = "#2c1d12";
        ctx.fillRect(0, 0, w, h);
        const cols = ["#5a3a1f", "#7a4a24", "#3a2614", "#8a5a2e", "#241610"];
        for (let i = 0; i < 900; i++) {
          ctx.fillStyle = cols[i % cols.length];
          ctx.globalAlpha = 0.35 + Math.random() * 0.4;
          const r = 4 + Math.random() * 16;
          ctx.beginPath();
          ctx.arc(Math.random() * w, Math.random() * h, r, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
        ctx.strokeStyle = "rgba(10,6,3,0.6)";
        ctx.lineWidth = 2;
        for (let i = 0; i <= 4; i++) {
          ctx.beginPath();
          ctx.moveTo((i * w) / 4, 0);
          ctx.lineTo((i * w) / 4, h);
          ctx.moveTo(0, (i * h) / 4);
          ctx.lineTo(w, (i * h) / 4);
          ctx.stroke();
        }
      }, [2, 1]),
    [],
  );

  // Wood grain relief + plank seams.
  const woodNormal = useMemo(
    () =>
      heightToNormal(
        (ctx, w, h) => {
          const planks = 6;
          const pw = w / planks;
          for (let i = 0; i < planks; i++) {
            for (let g = 0; g < 40; g++) {
              const x = i * pw + Math.random() * pw;
              const v = 128 + (Math.random() - 0.5) * 64;
              ctx.strokeStyle = `rgb(${v},${v},${v})`;
              ctx.lineWidth = Math.random() * 1.6 + 0.3;
              ctx.beginPath();
              ctx.moveTo(x, 0);
              ctx.bezierCurveTo(x + 4, h * 0.33, x - 4, h * 0.66, x, h);
              ctx.stroke();
            }
            ctx.fillStyle = "#3a3a3a"; // seam groove
            ctx.fillRect(i * pw + pw - 2, 0, 2, h);
          }
          for (let y = 0; y < h; y += h / 4) {
            ctx.fillStyle = "#3a3a3a";
            ctx.fillRect(0, y, w, 2);
          }
        },
        [5, 5],
        1.6,
        256,
      ),
    [],
  );
  // Marble/terrazzo aggregate relief.
  const stoneNormal = useMemo(
    () =>
      heightToNormal(
        (ctx, w, h) => {
          for (let i = 0; i < 1200; i++) {
            const v = 128 + (Math.random() - 0.5) * 46;
            ctx.fillStyle = `rgb(${v},${v},${v})`;
            ctx.beginPath();
            ctx.arc(Math.random() * w, Math.random() * h, 1 + Math.random() * 3.5, 0, Math.PI * 2);
            ctx.fill();
          }
        },
        [1, 1],
        0.9,
        256,
      ),
    [],
  );

  const bronzeMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        map: bronze,
        normalMap: stoneNormal,
        normalScale: new THREE.Vector2(0.35, 0.35),
        roughness: 0.35,
        metalness: 0.45,
        envMapIntensity: 1.3,
      }),
    [bronze, stoneNormal],
  );
  const copperMat = useMemo(() => new THREE.MeshStandardMaterial({ map: copper, roughness: 0.45, metalness: 0.7, envMapIntensity: 1.2 }), [copper]);

  // Faceted angular island base (waterfall wedge)
  const islandGeo = useMemo(() => {
    const shape = new THREE.Shape();
    const topW = 1.4;
    const botW = 0.82;
    const hgt = 0.9;
    shape.moveTo(-topW, hgt);
    shape.lineTo(topW, hgt);
    shape.lineTo(botW, 0);
    shape.lineTo(-botW, 0);
    shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 1.5, bevelEnabled: false });
    geo.translate(0, 0, -0.75);
    return geo;
  }, []);

  const windowView = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 256;
    c.height = 256;
    const ctx = c.getContext("2d")!;
    if (night) {
      const g = ctx.createLinearGradient(0, 0, 0, 256);
      g.addColorStop(0, "#0b1436");
      g.addColorStop(0.6, "#16204d");
      g.addColorStop(1, "#0a1128");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 256, 256);
      ctx.fillStyle = "rgba(240,244,255,0.95)";
      ctx.beginPath();
      ctx.arc(70, 60, 20, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.8)";
      for (let i = 0; i < 40; i++) ctx.fillRect(Math.random() * 256, Math.random() * 150, 1.4, 1.4);
    } else {
      const g = ctx.createLinearGradient(0, 0, 0, 256);
      g.addColorStop(0, "#a9d8ff");
      g.addColorStop(0.55, "#e9f4ff");
      g.addColorStop(0.6, "#d6e8c4");
      g.addColorStop(1, "#9cbf82");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 256, 256);
      const sun = ctx.createRadialGradient(190, 60, 4, 190, 60, 70);
      sun.addColorStop(0, "rgba(255,250,230,0.95)");
      sun.addColorStop(1, "rgba(255,250,230,0)");
      ctx.fillStyle = sun;
      ctx.fillRect(0, 0, 256, 256);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, [night]);

  return (
    <>
      {/* Warm oak floor with soft reflection */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[18, 16]} />
        <MeshReflectorMaterial
          map={wood}
          normalMap={woodNormal}
          normalScale={new THREE.Vector2(0.55, 0.55)}
          resolution={256}
          mixBlur={1.4}
          mixStrength={0.7}
          blur={[300, 90]}
          roughness={0.68}
          depthScale={1}
          minDepthThreshold={0.4}
          maxDepthThreshold={1.35}
          color="#ffffff"
          metalness={0.1}
        />
      </mesh>

      {/* Grey plaster walls */}
      <mesh position={[0, 2.4, -2.9]} material={WALL} receiveShadow>
        <boxGeometry args={[13, 4.8, 0.2]} />
      </mesh>
      <mesh position={[-5.4, 2.4, 0]} material={WALL} receiveShadow>
        <boxGeometry args={[0.2, 4.8, 6]} />
      </mesh>

      {/* Full-height matte black cabinetry across the back (bevelled edges) */}
      <RoundedBox args={[6.6, 4.0, 0.6]} radius={0.012} smoothness={3} position={[0.6, 2.0, -2.55]} castShadow receiveShadow material={BLACK} />
      {/* Tall cabinet seams + slim handles */}
      {[-1.6, 0.2, 2.0].map((x) => (
        <mesh key={x} position={[x, 2.0, -2.24]} material={BLACK2}>
          <boxGeometry args={[0.015, 3.4, 0.02]} />
        </mesh>
      ))}
      {[-1.2, 0.6, 2.4].map((x) => (
        <Handle key={x} position={[x, 1.9, -2.23]} length={0.8} vertical />
      ))}

      {/* Copper-patina hood panel */}
      <mesh position={[0.4, 3.15, -2.5]} castShadow material={copperMat}>
        <boxGeometry args={[2.3, 1.5, 0.5]} />
      </mesh>

      {/* Back-lit onyx splash (signature glow) */}
      <PulseEmissive base={2.0} amount={0.07} speed={0.5} position={[0.4, 1.35, -2.52]}>
        <planeGeometry args={[2.3, 0.7]} />
        <meshStandardMaterial map={onyx} emissive="#ffb257" emissiveMap={onyx} emissiveIntensity={2.0} toneMapped={false} />
      </PulseEmissive>
      <pointLight position={[0.4, 1.35, -2.0]} intensity={2.4} distance={4} decay={2} color="#ffb85f" />

      {/* Base run + slim black counter */}
      <RoundedBox args={[6.5, 0.9, 0.7]} radius={0.012} smoothness={3} position={[0.6, 0.45, -2.35]} castShadow receiveShadow material={BLACK} />
      <RoundedBox args={[6.6, 0.05, 0.78]} radius={0.008} smoothness={3} position={[0.6, 0.92, -2.35]} castShadow material={BLACK2} />

      {/* Window on the left wall */}
      <group position={[-5.28, 2.5, 0.6]} rotation={[0, Math.PI / 2, 0]}>
        <mesh>
          <planeGeometry args={[2.6, 1.6]} />
          <meshBasicMaterial map={windowView} toneMapped={false} />
        </mesh>
        {[0.82, -0.82].map((y) => (
          <mesh key={y} position={[0, y, 0.02]} material={BLACK2}>
            <boxGeometry args={[2.8, 0.09, 0.1]} />
          </mesh>
        ))}
        {[-1.35, 0, 1.35].map((x) => (
          <mesh key={x} position={[x, 0, 0.02]} material={BLACK2}>
            <boxGeometry args={[0.08, 1.7, 0.1]} />
          </mesh>
        ))}
      </group>
      <pointLight position={[-4.4, 2.6, 0.6]} intensity={night ? 1.0 : 5} distance={9} decay={2} color={night ? "#aab8ff" : "#eaf3ff"} />

      {/* Induction cooktop — click to toggle the stove */}
      <Hoverable name={controls.stove} hint={stove ? "off" : "on"} onActivate={onToggleStove} labelY={0.6}>
        <group position={[2.6, 0.96, -2.3]}>
          <mesh material={BLACK2}>
            <boxGeometry args={[0.95, 0.04, 0.62]} />
          </mesh>
          {[
            [-0.22, -0.13],
            [0.22, -0.13],
            [-0.22, 0.13],
            [0.22, 0.13],
          ].map(([x, z], i) => (
            <mesh key={i} position={[x, 0.025, z]} rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[0.06, 0.09, 24]} />
              <meshStandardMaterial color="#2a2a2e" emissive="#ff4a1c" emissiveIntensity={stove ? 1.6 : 0.06} side={THREE.DoubleSide} />
            </mesh>
          ))}
        </group>
      </Hoverable>
      <group position={[2.38, 1.02, -2.17]}>
        <mesh castShadow material={STEEL}>
          <cylinderGeometry args={[0.13, 0.11, 0.14, 24]} />
        </mesh>
        <mesh position={[0.16, 0.02, 0]} rotation={[0, 0, Math.PI / 2]} material={DARKMETAL}>
          <cylinderGeometry args={[0.015, 0.015, 0.16, 8]} />
        </mesh>
      </group>
      <Steam on={stove} />
      {stove && <pointLight position={[2.6, 1.05, -2.3]} intensity={0.8} distance={1.6} color="#ff6a2a" />}

      {/* Integrated stainless ovens (stacked) on the right */}
      <Hoverable name={labels.oven} hint="inspect" onActivate={() => onSelect("oven")} labelY={1.4}>
        <group position={[3.9, 1.35, -2.24]}>
          {[0, 0.68].map((dy, i) => (
            <group key={i} position={[0, dy, 0]}>
              <mesh material={STEEL}>
                <boxGeometry args={[0.86, 0.6, 0.08]} />
              </mesh>
              <mesh position={[0, 0, 0.05]} material={GLASS}>
                <boxGeometry args={[0.66, 0.42, 0.02]} />
              </mesh>
              <mesh position={[0, 0, 0.045]}>
                <planeGeometry args={[0.62, 0.38]} />
                <meshStandardMaterial color="#2a1608" emissive="#ff6a2a" emissiveIntensity={oven ? 1.5 : 0.3} />
              </mesh>
              <mesh position={[0, 0.24, 0.06]} material={DARKMETAL}>
                <boxGeometry args={[0.7, 0.04, 0.04]} />
              </mesh>
            </group>
          ))}
        </group>
      </Hoverable>

      {/* Pantry — twin doors swing open when selected */}
      <Pantry selected={selected === "pantry"} onSelect={onSelect} label={labels.pantry} />

      {/* Fridge (doors open) + freezer (drawer slides out) */}
      <Fridge selected={selected === "fridge"} onSelect={onSelect} label={labels.fridge} items={inventory.fridge} />
      <Freezer selected={selected === "freezer"} onSelect={onSelect} label={labels.freezer} />

      {/* Faceted angular island — front drawer opens when selected */}
      <Island selected={selected === "island"} onSelect={onSelect} label={labels.island} geo={islandGeo} mat={bronzeMat} />

      {/* Black gooseneck faucet + sink in the island — click to run water */}
      <Hoverable name={labels.sink} hint={water ? controls.water + " off" : controls.water} onActivate={onToggleWater} labelY={1.5}>
        <group position={[-0.2, 1.02, 1.0]}>
          <mesh position={[0, 0, 0]} rotation={[Math.PI / 2, 0, 0]} material={BLACK2}>
            <boxGeometry args={[0.5, 0.35, 0.03]} />
          </mesh>
          <mesh position={[0, 0.2, -0.12]} material={DARKMETAL}>
            <cylinderGeometry args={[0.022, 0.022, 0.4, 12]} />
          </mesh>
          <mesh position={[0, 0.4, -0.06]} rotation={[Math.PI / 3, 0, 0]} material={DARKMETAL}>
            <cylinderGeometry args={[0.022, 0.022, 0.22, 12]} />
          </mesh>
          <mesh position={[0, 0.42, 0.03]} material={DARKMETAL}>
            <cylinderGeometry args={[0.02, 0.02, 0.12, 12]} />
          </mesh>
        </group>
      </Hoverable>
      <WaterStream on={water} />

      <Stool x={-0.5} />
      <Stool x={0.4} />
      <Stool x={1.3} />

      {/* Sculptural teardrop pendants */}
      <Pendant x={-0.5} on={lightsOn} />
      <Pendant x={0.4} on={lightsOn} />
      <Pendant x={1.3} on={lightsOn} />

      {/* Recessed ceiling downlights */}
      {[
        [-2.5, -1],
        [0.6, -1.2],
        [3.2, -0.6],
        [0.4, 1.4],
        [2.6, 1.4],
      ].map(([x, z], i) => (
        <group key={i} position={[x, 4.55, z]}>
          <mesh>
            <cylinderGeometry args={[0.08, 0.08, 0.04, 20]} />
            <meshStandardMaterial color="#fff6e6" emissive="#ffedcf" emissiveIntensity={lightsOn ? 2.2 : 0.05} />
          </mesh>
          {lightsOn && <pointLight position={[0, -0.2, 0]} intensity={2.6} distance={6} decay={2} color="#ffe9c8" />}
        </group>
      ))}

      {/* Tall branch vase on the island end */}
      <group position={[-1.3, 1.0, 0.4]}>
        <mesh material={CERAMIC}>
          <cylinderGeometry args={[0.09, 0.07, 0.34, 16]} />
        </mesh>
        <Breathing amount={0.028} speed={0.45}>
        {[
          [0, 0.6, 0.1],
          [0.12, 0.7, -0.05],
          [-0.1, 0.55, 0.05],
        ].map(([x, y, z], i) => (
          <mesh key={i} position={[x as number, y as number, z as number]} rotation={[0, 0, (i - 1) * 0.4]}>
            <cylinderGeometry args={[0.006, 0.006, 0.5, 6]} />
            <meshStandardMaterial color="#6b5636" roughness={0.9} />
          </mesh>
        ))}
        {Array.from({ length: 8 }).map((_, i) => (
          <mesh key={i} position={[(Math.random() - 0.5) * 0.4, 0.55 + Math.random() * 0.35, (Math.random() - 0.5) * 0.3]}>
            <sphereGeometry args={[0.03, 8, 8]} />
            <meshStandardMaterial color="#e4c33a" emissive="#caa41f" emissiveIntensity={0.3} />
          </mesh>
        ))}
        </Breathing>
      </group>

      {/* Live wall clock — real time, hands actually move */}
      <Clock />

      {/* Dust suspended in the daylight */}
      <DustMotes on={!night} />

      <ContactShadows position={[0, 0.015, 0]} opacity={0.55} scale={20} blur={2.6} far={9} resolution={1024} color="#000000" />
    </>
  );
}

export default function Kitchen3D({
  selected,
  onSelect,
  labels,
  controls,
  inventory,
  modelUrl,
}: {
  selected: KitchenObject | null;
  onSelect: (k: KitchenObject) => void;
  labels: Record<KitchenObject, string>;
  controls: KitchenControlLabels;
  inventory: FridgeInventory;
  modelUrl?: string | null;
}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const controlsRef = useRef<any>(null);
  // Adaptive quality: if the machine can't hold a smooth framerate we drop the
  // heavy post-processing rather than letting the whole scene stutter. A smooth
  // 60fps scene reads as far more "real" than a pretty one running at 15fps.
  const [heavyFx, setHeavyFx] = useState(true);
  const [lightsOn, setLightsOn] = useState(true);
  const [night, setNight] = useState(false);
  const [water, setWater] = useState(false);
  const [stove, setStove] = useState(false);
  const [oven, setOven] = useState(false);

  const ctrlBtn = (active: boolean, onClick: () => void, Icon: typeof Sun, text: string) => (
    <button
      onClick={onClick}
      className={cn(
        "pointer-events-auto inline-flex w-full items-center gap-2 rounded-full border px-3 py-2 text-xs font-medium backdrop-blur transition-colors",
        active ? "border-amber-300/50 bg-amber-400/20 text-amber-100" : "border-white/15 bg-black/50 text-white/60 hover:text-white",
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
        camera={{ position: [5.8, 3.2, 5.8], fov: 40 }}
        gl={{ antialias: true, alpha: false, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.0 }}
        style={{ touchAction: "none" }}
      >
        <color attach="background" args={[night ? "#050609" : "#0a0a0c"]} />
        <fog attach="fog" args={[night ? "#050609" : "#0a0a0c", 16, 34]} />
        <ambientLight intensity={night ? 0.08 : 0.32} />
        <hemisphereLight args={["#fff2df", "#2a241f", night ? 0.1 : 0.4]} />
        <directionalLight
          position={[4, 7, 3]}
          intensity={night ? 0.12 : 1.5}
          color={night ? "#9fb4ff" : "#fff2df"}
          castShadow
          shadow-mapSize={[1024, 1024]}
          shadow-bias={-0.0004}
          shadow-camera-left={-8}
          shadow-camera-right={8}
          shadow-camera-top={8}
          shadow-camera-bottom={-8}
        />
        <directionalLight position={[-4, 4, -3]} intensity={night ? 0.08 : 0.35} color="#bcd4ff" />
        <Suspense fallback={null}>
          <Environment preset={night ? "night" : "apartment"} environmentIntensity={night ? 0.2 : 0.5} />
        </Suspense>

        {modelUrl ? (
          <ModelBoundary
            fallback={
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
            }
          >
            <Suspense fallback={null}>
              <KitchenModel url={modelUrl} />
            </Suspense>
            <ContactShadows position={[0, 0.01, 0]} opacity={0.5} scale={22} blur={2.6} far={10} resolution={1024} color="#000000" />
          </ModelBoundary>
        ) : (
          <>
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
            <CameraFocus controlsRef={controlsRef} focus={selected} />
          </>
        )}

        <OrbitControls
          ref={controlsRef}
          enablePan={false}
          minDistance={2.4}
          maxDistance={14}
          minPolarAngle={0.5}
          maxPolarAngle={Math.PI / 2.15}
          target={modelUrl ? [0, 1.2, 0] : [0.3, 1, -0.2]}
          enableDamping
          dampingFactor={0.08}
        />
        {/* Watches real framerate; drops the expensive AO pass if we can't
            hold ~50fps, and scales resolution down before it ever stutters. */}
        <PerformanceMonitor onDecline={() => setHeavyFx(false)} onIncline={() => setHeavyFx(true)} />
        <AdaptiveDpr pixelated={false} />

        {heavyFx ? (
          <EffectComposer multisampling={0} enableNormalPass>
            {/* Ambient occlusion — the single biggest realism cue for interiors:
                it darkens crevices, corners and where objects meet surfaces. */}
            <N8AO aoRadius={0.55} intensity={2.2} distanceFalloff={0.8} quality="low" halfRes />
            <Bloom luminanceThreshold={0.7} luminanceSmoothing={0.9} intensity={0.6} mipmapBlur radius={0.7} />
            <Vignette eskil={false} offset={0.22} darkness={0.7} />
          </EffectComposer>
        ) : (
          <EffectComposer multisampling={0} enableNormalPass={false}>
            <Bloom luminanceThreshold={0.75} luminanceSmoothing={0.9} intensity={0.45} mipmapBlur radius={0.6} />
            <Vignette eskil={false} offset={0.22} darkness={0.7} />
          </EffectComposer>
        )}
      </Canvas>

      {/* Appliance controls — vertical column on the LEFT */}
      <div className="pointer-events-none absolute left-4 top-1/2 z-20 flex w-36 -translate-y-1/2 flex-col gap-2">
        {ctrlBtn(lightsOn, () => setLightsOn((v) => !v), lightsOn ? Lightbulb : LightbulbOff, controls.lights)}
        {ctrlBtn(night, () => setNight((v) => !v), night ? Moon : Sun, night ? controls.night : controls.day)}
        {ctrlBtn(water, () => setWater((v) => !v), Droplets, controls.water)}
        {ctrlBtn(stove, () => setStove((v) => !v), Flame, controls.stove)}
        {ctrlBtn(oven, () => setOven((v) => !v), CookingPot, controls.oven)}
      </div>
    </>
  );
}
