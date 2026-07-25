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

export type FoodItem = { name: string; quantity: string | null; expires_at: string | null };
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
const GLASSY = new THREE.MeshStandardMaterial({ color: "#cfe0e6", roughness: 0.07, metalness: 0.1, transparent: true, opacity: 0.13 });

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

/* -------------------------------------------------------------- food props */

function Bottle({
  position,
  colour,
  fill,
  r = 0.045,
  h = 0.3,
}: {
  position: [number, number, number];
  colour: string;
  fill: number;
  r?: number;
  h?: number;
}) {
  const lh = Math.max(0.02, h * 0.86 * fill);
  return (
    <group position={position}>
      <mesh material={GLASSY}>
        <cylinderGeometry args={[r, r, h, 14]} />
      </mesh>
      <mesh position={[0, -h / 2 + lh / 2 + 0.02, 0]}>
        <cylinderGeometry args={[r * 0.82, r * 0.82, lh, 14]} />
        <meshStandardMaterial color={colour} roughness={0.42} />
      </mesh>
      <mesh position={[0, h / 2 + 0.02, 0]} material={GOLD_MAT}>
        <cylinderGeometry args={[r * 0.55, r * 0.55, 0.045, 12]} />
      </mesh>
    </group>
  );
}

function EggTray({ position, count }: { position: [number, number, number]; count: number }) {
  return (
    <group position={position}>
      <mesh>
        <boxGeometry args={[0.34, 0.03, 0.16]} />
        <meshStandardMaterial color="#d9d3c6" roughness={0.9} />
      </mesh>
      {Array.from({ length: Math.min(10, Math.round(count)) }).map((_, i) => (
        <mesh key={i} position={[-0.14 + (i % 5) * 0.07, 0.04, -0.04 + Math.floor(i / 5) * 0.08]} scale={[1, 1.25, 1]}>
          <sphereGeometry args={[0.026, 10, 10]} />
          <meshStandardMaterial color="#f3e3c7" roughness={0.72} />
        </mesh>
      ))}
    </group>
  );
}

function Tray({ position, colour, fill }: { position: [number, number, number]; colour: string; fill: number }) {
  const w = 0.14 + 0.16 * fill;
  return (
    <group position={position}>
      <mesh>
        <boxGeometry args={[w + 0.03, 0.03, 0.2]} />
        <meshStandardMaterial color="#eceaea" roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.03, 0]}>
        <boxGeometry args={[w, 0.05, 0.16]} />
        <meshStandardMaterial color={colour} roughness={0.55} />
      </mesh>
    </group>
  );
}

function Produce({ position, colour, r = 0.05 }: { position: [number, number, number]; colour: string; r?: number }) {
  return (
    <mesh position={position} castShadow>
      <sphereGeometry args={[r, 12, 12]} />
      <meshStandardMaterial color={colour} roughness={0.6} />
    </mesh>
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

/** Low compressor hum (WebAudio, no asset). Starts only after a user gesture. */
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
        osc.frequency.value = 62;
        const lp = ctx.createBiquadFilter();
        lp.type = "lowpass";
        lp.frequency.value = 200;
        const gain = ctx.createGain();
        gain.gain.value = 0;
        osc.connect(lp).connect(gain).connect(ctx.destination);
        osc.start();
        ref.current = { ctx, gain };
      } catch {
        return;
      }
    }
    const { ctx, gain } = ref.current;
    if (ctx.state === "suspended") void ctx.resume();
    gain.gain.setTargetAtTime(0.04, ctx.currentTime, 0.5);
  }, [active]);
  useEffect(() => () => void ref.current?.ctx.close().catch(() => {}), []);
}

/* -------------------------------------------------------------- appliances */

/** Refrigeration column — black glass + gold, doors with real weight. */
function Fridge({
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
  const swing = useRef(0);
  const vel = useRef(0);
  const [lit, setLit] = useState(0);
  useApplianceHum(selected);

  useFrame((_, dt) => {
    const step = Math.min(dt, 0.05);
    vel.current += ((selected ? 1 : 0) - swing.current) * 34 * step - vel.current * 11 * step;
    swing.current += vel.current * step;
    if (l.current) l.current.rotation.y = swing.current * 2.0;
    if (r.current) r.current.rotation.y = -swing.current * 2.0;
    const want = THREE.MathUtils.clamp((swing.current - 0.08) / 0.5, 0, 1);
    if (Math.abs(want - lit) > 0.02) setLit(want);
  });

  const buckets = useMemo(() => {
    const b: Record<FoodKind, FoodItem[]> = {
      milk: [], egg: [], cheese: [], meat: [], fish: [], butter: [],
      yogurt: [], water: [], juice: [], fruit: [], veg: [], other: [],
    };
    items.forEach((i) => b[categorize(i.name)].push(i));
    // Soonest-expiring first — and first == front of the shelf.
    (Object.keys(b) as FoodKind[]).forEach((k) => b[k].sort((x, y) => daysLeft(x.expires_at) - daysLeft(y.expires_at)));
    return b;
  }, [items]);

  const drinks = useMemo(() => items.filter((i) => ["water", "juice", "milk"].includes(categorize(i.name))), [items]);
  const fruitC = ["#b8352f", "#d4761f", "#3f7d2f", "#7d3f6a"];
  const vegC = ["#a83232", "#3f8f45", "#2f7d5a", "#c9761f"];

  return (
    <Hoverable name={label} hint="open" onActivate={() => onSelect("fridge")} labelY={2.5}>
      <group position={[-3.1, 0, -3.05]}>
        <RoundedBox args={[1.75, 2.35, 0.78]} radius={0.012} smoothness={3} position={[0, 1.175, 0]} castShadow receiveShadow>
          <meshStandardMaterial color="#101216" roughness={0.28} metalness={0.35} envMapIntensity={1.3} />
        </RoundedBox>
        <mesh position={[0, 1.2, 0.04]}>
          <boxGeometry args={[1.55, 2.08, 0.68]} />
          <meshStandardMaterial color="#f3f5f6" roughness={0.32} metalness={0.2} />
        </mesh>
        <mesh position={[0, 1.2, -0.3]}>
          <planeGeometry args={[1.5, 2.02]} />
          <meshStandardMaterial color="#fbfdff" emissive="#eaf6ff" emissiveIntensity={0.1 + lit * 1.3} />
        </mesh>

        {[0.58, 1.18, 1.78].map((y) => (
          <group key={y} position={[0, y, 0.06]}>
            <mesh material={GLASSY}>
              <boxGeometry args={[1.5, 0.028, 0.62]} />
            </mesh>
            <mesh position={[0, 0, 0.31]} material={GOLD_MAT}>
              <boxGeometry args={[1.5, 0.014, 0.014]} />
            </mesh>
            <mesh position={[0, 0.16, -0.29]}>
              <boxGeometry args={[1.42, 0.012, 0.02]} />
              <meshStandardMaterial color="#eaf6ff" emissive="#dcefff" emissiveIntensity={0.2 + lit * 3} />
            </mesh>
          </group>
        ))}

        {/* TOP — dairy + eggs (soonest-expiring sits forward) */}
        {buckets.milk.slice(0, 2).map((it, i) => (
          <Bottle key={`m${i}`} position={[-0.5 + i * 0.19, 1.97, 0.16 - i * 0.2]} colour="#f8f7f3" fill={fillFrom(it.quantity)} />
        ))}
        {buckets.egg.slice(0, 1).map((it, i) => (
          <EggTray key={`e${i}`} position={[0.08, 1.84, 0.02]} count={countFrom(it.quantity, 10)} />
        ))}
        {buckets.butter.slice(0, 1).map((_, i) => (
          <mesh key={`b${i}`} position={[0.52, 1.86, 0.08]}>
            <boxGeometry args={[0.14, 0.05, 0.08]} />
            <meshStandardMaterial color="#f4e2a1" roughness={0.6} />
          </mesh>
        ))}
        {buckets.yogurt.slice(0, 3).map((_, i) => (
          <mesh key={`y${i}`} position={[0.4 + (i % 2) * 0.1, 1.86, -0.14]}>
            <cylinderGeometry args={[0.05, 0.045, 0.07, 12]} />
            <meshStandardMaterial color="#eef0f2" roughness={0.5} />
          </mesh>
        ))}

        {/* MIDDLE — proteins */}
        {buckets.meat.slice(0, 2).map((it, i) => (
          <Tray key={`me${i}`} position={[-0.36 + i * 0.42, 1.23, 0.14 - i * 0.2]} colour="#bc5555" fill={fillFrom(it.quantity)} />
        ))}
        {buckets.fish.slice(0, 1).map((it, i) => (
          <Tray key={`f${i}`} position={[0.44, 1.23, -0.1]} colour="#d3a09c" fill={fillFrom(it.quantity)} />
        ))}
        {buckets.cheese.slice(0, 2).map((it, i) => (
          <mesh key={`c${i}`} position={[-0.5 + i * 0.18, 1.27, 0.2]}>
            <boxGeometry args={[0.08 + 0.13 * fillFrom(it.quantity), 0.09, 0.13]} />
            <meshStandardMaterial color="#f2c14e" roughness={0.55} />
          </mesh>
        ))}

        {/* BOTTOM — fruit */}
        {buckets.fruit.slice(0, 8).map((_, i) => (
          <Produce key={`fr${i}`} position={[-0.55 + (i % 4) * 0.32, 0.66, -0.1 + Math.floor(i / 4) * 0.2]} colour={fruitC[i % fruitC.length]} />
        ))}

        {/* crisper drawer */}
        <mesh position={[0, 0.24, 0.04]} material={GLASSY}>
          <boxGeometry args={[1.44, 0.36, 0.6]} />
        </mesh>
        {buckets.veg.slice(0, 8).map((_, i) => (
          <Produce key={`v${i}`} position={[-0.55 + (i % 4) * 0.34, 0.24, -0.1 + Math.floor(i / 4) * 0.2]} colour={vegC[i % vegC.length]} r={0.055} />
        ))}

        <ColdAir position={[0, 0.2, 0.45]} on={selected} />
        {lit > 0.05 && <pointLight position={[0, 1.4, 0.3]} intensity={lit * 2.6} distance={2.4} decay={2} color="#eef8ff" />}

        {/* doors: black glass, gold handle, rubber seal */}
        <group ref={l} position={[-0.875, 1.175, 0.4]}>
          <RoundedBox args={[0.875, 2.35, 0.07]} radius={0.008} smoothness={3} position={[0.4375, 0, 0]} castShadow material={BLACKGLASS} />
          <mesh position={[0.4375, 0, -0.04]}>
            <boxGeometry args={[0.79, 2.2, 0.015]} />
            <meshStandardMaterial color="#08090b" roughness={0.92} />
          </mesh>
          <GoldHandle position={[0.8, 0, 0.07]} length={1.5} />
          {drinks.slice(0, 3).map((it, i) => (
            <Bottle
              key={i}
              position={[0.45, 0.55 - i * 0.55, 0.12]}
              colour={categorize(it.name) === "water" ? "#bfe0ff" : "#c8873a"}
              fill={fillFrom(it.quantity)}
              h={0.32}
            />
          ))}
        </group>
        <group ref={r} position={[0.875, 1.175, 0.4]}>
          <RoundedBox args={[0.875, 2.35, 0.07]} radius={0.008} smoothness={3} position={[-0.4375, 0, 0]} castShadow material={BLACKGLASS} />
          <mesh position={[-0.4375, 0, -0.04]}>
            <boxGeometry args={[0.79, 2.2, 0.015]} />
            <meshStandardMaterial color="#08090b" roughness={0.92} />
          </mesh>
          <GoldHandle position={[-0.8, 0, 0.07]} length={1.5} />
        </group>
      </group>
    </Hoverable>
  );
}

/** Freezer drawer with frosted packs — spring-damped travel. */
function Freezer({
  selected,
  onSelect,
  label,
  frost,
}: {
  selected: boolean;
  onSelect: (k: KitchenObject) => void;
  label: string;
  frost: THREE.Texture;
}) {
  const d = useRef<THREE.Group>(null);
  const vel = useRef(0);
  useFrame((_, dt) => {
    if (!d.current) return;
    const step = Math.min(dt, 0.05);
    vel.current += ((selected ? 0.5 : 0) - d.current.position.z) * 58 * step - vel.current * 13 * step;
    d.current.position.z += vel.current * step;
  });
  return (
    <Hoverable name={label} hint="open" onActivate={() => onSelect("freezer")} labelY={0.85}>
      <group position={[-1.7, 0.3, -3.02]}>
        <RoundedBox args={[0.9, 0.6, 0.78]} radius={0.01} smoothness={3} castShadow>
          <meshStandardMaterial color="#101216" roughness={0.3} metalness={0.35} />
        </RoundedBox>
        <mesh position={[0, 0, -0.28]}>
          <planeGeometry args={[0.82, 0.5]} />
          <meshStandardMaterial color="#eaf6ff" emissive="#bfe4ff" emissiveIntensity={selected ? 0.9 : 0.1} />
        </mesh>
        <group ref={d}>
          <RoundedBox args={[0.9, 0.6, 0.06]} radius={0.008} smoothness={3} position={[0, 0, 0.4]} castShadow material={BLACKGLASS} />
          <GoldHandle position={[0, 0.13, 0.45]} length={0.6} vertical={false} />
          <mesh position={[0, -0.1, 0.16]} material={STEEL}>
            <boxGeometry args={[0.82, 0.28, 0.5]} />
          </mesh>
          {["#cfe4ff", "#e8d8c0", "#d9c0c0"].map((c, i) => (
            <group key={i} position={[-0.26 + i * 0.26, -0.03, 0.18]}>
              <mesh>
                <boxGeometry args={[0.2, 0.16, 0.28]} />
                <meshStandardMaterial color={c} roughness={0.88} />
              </mesh>
              <mesh scale={1.04}>
                <boxGeometry args={[0.2, 0.16, 0.28]} />
                <meshStandardMaterial map={frost} transparent opacity={0.6} roughness={1} depthWrite={false} />
              </mesh>
            </group>
          ))}
        </group>
        <ColdAir position={[0, 0, 0.5]} on={selected} />
      </group>
    </Hoverable>
  );
}

/** Full-height pantry: gold-framed glass doors, lit shelves, labelled jars. */
function Pantry({ selected, onSelect, label }: { selected: boolean; onSelect: (k: KitchenObject) => void; label: string }) {
  const l = useRef<THREE.Group>(null);
  const r = useRef<THREE.Group>(null);
  const swing = useRef(0);
  const vel = useRef(0);
  const [lit, setLit] = useState(0);
  useFrame((_, dt) => {
    const step = Math.min(dt, 0.05);
    vel.current += ((selected ? 1 : 0) - swing.current) * 32 * step - vel.current * 11 * step;
    swing.current += vel.current * step;
    if (l.current) l.current.rotation.y = swing.current * 2.0;
    if (r.current) r.current.rotation.y = -swing.current * 2.0;
    const want = THREE.MathUtils.clamp((swing.current - 0.06) / 0.5, 0, 1);
    if (Math.abs(want - lit) > 0.02) setLit(want);
  });
  const jar = ["#e2d3ad", "#c9b48a", "#e8dcc4", "#b99b6a", "#d8c9a6", "#c2a97e"];
  return (
    <Hoverable name={label} hint="open" onActivate={() => onSelect("pantry")} labelY={2.5}>
      <group position={[3.1, 0, -3.05]}>
        <RoundedBox args={[1.75, 2.35, 0.78]} radius={0.012} smoothness={3} position={[0, 1.175, 0]} castShadow receiveShadow>
          <meshStandardMaterial color="#101216" roughness={0.3} metalness={0.3} />
        </RoundedBox>
        <mesh position={[0, 1.2, 0.02]}>
          <boxGeometry args={[1.58, 2.1, 0.7]} />
          <meshStandardMaterial color="#b08d5f" roughness={0.72} />
        </mesh>
        <mesh position={[0, 1.2, -0.31]}>
          <planeGeometry args={[1.52, 2.04]} />
          <meshStandardMaterial color="#d9bb8c" emissive="#ffcf85" emissiveIntensity={0.08 + lit * 0.7} />
        </mesh>
        {[0.45, 0.86, 1.27, 1.68, 2.05].map((y, si) => (
          <group key={y} position={[0, y, 0.04]}>
            <mesh castShadow>
              <boxGeometry args={[1.55, 0.032, 0.62]} />
              <meshStandardMaterial color="#8a6b45" roughness={0.65} />
            </mesh>
            <mesh position={[0, 0.02, 0.31]} material={GOLD_MAT}>
              <boxGeometry args={[1.55, 0.012, 0.012]} />
            </mesh>
            <mesh position={[0, 0.15, -0.28]}>
              <boxGeometry args={[1.46, 0.01, 0.018]} />
              <meshStandardMaterial color="#fff1d6" emissive="#ffcf85" emissiveIntensity={0.15 + lit * 2.6} />
            </mesh>
            {Array.from({ length: 5 }).map((_, i) => (
              <group key={i} position={[-0.6 + i * 0.3, 0.13, 0]}>
                <mesh material={GLASSY}>
                  <cylinderGeometry args={[0.062, 0.062, 0.22, 14]} />
                </mesh>
                <mesh position={[0, -0.03, 0]}>
                  <cylinderGeometry args={[0.052, 0.052, 0.14, 14]} />
                  <meshStandardMaterial color={jar[(si + i) % jar.length]} roughness={0.85} />
                </mesh>
                <mesh position={[0, 0.12, 0]} material={GOLD_MAT}>
                  <cylinderGeometry args={[0.064, 0.064, 0.022, 14]} />
                </mesh>
                <mesh position={[0, 0.02, 0.063]}>
                  <planeGeometry args={[0.075, 0.032]} />
                  <meshStandardMaterial color="#f6f1e6" roughness={0.9} />
                </mesh>
              </group>
            ))}
          </group>
        ))}
        {lit > 0.05 && <pointLight position={[0, 1.3, 0.25]} intensity={lit * 2.2} distance={2.4} decay={2} color="#ffd9a0" />}
        {[
          { ref: l, x: -0.875, s: 1 },
          { ref: r, x: 0.875, s: -1 },
        ].map((d, i) => (
          <group key={i} ref={d.ref} position={[d.x, 1.175, 0.4]}>
            <mesh position={[d.s * 0.4375, 0, 0]} material={GLASSY}>
              <boxGeometry args={[0.875, 2.35, 0.03]} />
            </mesh>
            {[-1.15, 1.15].map((y) => (
              <mesh key={y} position={[d.s * 0.4375, y, 0.01]} material={GOLD_MAT}>
                <boxGeometry args={[0.875, 0.03, 0.035]} />
              </mesh>
            ))}
            {[0, d.s * 0.85].map((x, k) => (
              <mesh key={k} position={[x, 0, 0.01]} material={GOLD_MAT}>
                <boxGeometry args={[0.03, 2.35, 0.035]} />
              </mesh>
            ))}
            <GoldHandle position={[d.s * 0.79, 0, 0.06]} length={1.4} />
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
      <mesh position={[0, 1.72, -3.34]}>
        <planeGeometry args={[3.0, 1.0]} />
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
          <boxGeometry args={[3.1, 0.04, 0.05]} />
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
        <boxGeometry args={[2.3, 0.06, 0.78]} />
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

      {/* STORE: refrigeration left, pantry right */}
      <Fridge selected={selected === "fridge"} onSelect={onSelect} label={labels.fridge} items={inventory.fridge} />
      <Freezer selected={selected === "freezer"} onSelect={onSelect} label={labels.freezer} frost={frost} />
      <Pantry selected={selected === "pantry"} onSelect={onSelect} label={labels.pantry} />

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
  home: { cam: [0.4, 1.62, 5.9], tgt: [0, 1.18, -1.9] },
  fridge: { cam: [-3.1, 1.6, -0.7], tgt: [-3.1, 1.25, -2.7] },
  freezer: { cam: [-1.7, 1.1, -1.05], tgt: [-1.7, 0.45, -2.7] },
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
        camera={{ position: [0.4, 1.62, 5.9], fov: 36 }}
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
