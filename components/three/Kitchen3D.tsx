"use client";

import { useRef, useState, useMemo, Suspense } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, ContactShadows, Environment, Html, MeshReflectorMaterial } from "@react-three/drei";
import { EffectComposer, Bloom, Vignette } from "@react-three/postprocessing";
import { Lightbulb, LightbulbOff, Sun, Moon, Droplets, Flame, CookingPot } from "lucide-react";
import * as THREE from "three";
import { cn } from "@/lib/utils";

/**
 * The Kitchen digital twin — Phase 1 (realism + working appliances).
 *
 * A premium, explorable modern European kitchen built with React Three Fiber
 * with procedurally-generated wood / marble / tile surfaces, layered lighting,
 * and real, toggleable appliances: kitchen lights, day/night, a running faucet,
 * an induction stove (with a steaming pot), and the oven. Inventory objects
 * (fridge, freezer, pantry, island) stay clickable for their real data; the
 * fridge opens its lit doors when selected. Built from primitives so it needs
 * no downloaded assets; realistic GLB furniture can drop into each group later.
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

const CAB = new THREE.MeshStandardMaterial({ color: "#1c2027", roughness: 0.5, metalness: 0.18 });
const CAB_LIGHT = new THREE.MeshStandardMaterial({ color: "#e9e5dc", roughness: 0.45, metalness: 0.08 });
const WALL = new THREE.MeshStandardMaterial({ color: "#d5cfc5", roughness: 0.96 });
const STEEL = new THREE.MeshStandardMaterial({ color: "#cdd1d7", roughness: 0.22, metalness: 0.95, envMapIntensity: 1.4 });
const DARK = new THREE.MeshStandardMaterial({ color: "#0b0d11", roughness: 0.28, metalness: 0.45 });
const GLASS = new THREE.MeshStandardMaterial({ color: "#0a1a22", roughness: 0.06, metalness: 0.3, transparent: true, opacity: 0.5 });
const BRASS = new THREE.MeshStandardMaterial({ color: "#c19a5b", roughness: 0.32, metalness: 1, envMapIntensity: 1.5 });
const CERAMIC = new THREE.MeshStandardMaterial({ color: "#f4f1ea", roughness: 0.35, metalness: 0.05 });
const WOODMAT = new THREE.MeshStandardMaterial({ color: "#6b4f38", roughness: 0.7, metalness: 0.05 });

/** Build a repeating CanvasTexture from a draw routine (client-side only). */
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
      {children}
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
  return (
    <mesh position={position} material={BRASS} rotation={vertical ? [0, 0, 0] : [0, 0, Math.PI / 2]}>
      <cylinderGeometry args={[0.018, 0.018, length, 12]} />
    </mesh>
  );
}

function Fridge({ selected, onSelect, label, hint, lightsOn }: { selected: boolean; onSelect: (k: KitchenObject) => void; label: string; hint: string; lightsOn: boolean }) {
  const left = useRef<THREE.Group>(null);
  const right = useRef<THREE.Group>(null);
  useFrame(() => {
    const target = selected ? 1 : 0;
    if (left.current) left.current.rotation.y = THREE.MathUtils.lerp(left.current.rotation.y, target * 2.0, 0.12);
    if (right.current) right.current.rotation.y = THREE.MathUtils.lerp(right.current.rotation.y, -target * 2.0, 0.12);
  });
  const glow = selected ? 3 : 0.35;
  return (
    <Hoverable name={label} hint={hint} onActivate={() => onSelect("fridge")} labelY={2.5}>
      <group position={[-3.4, 0, -2.2]}>
        <mesh position={[0, 1.1, 0]} castShadow material={STEEL}>
          <boxGeometry args={[1.3, 2.2, 1.0]} />
        </mesh>
        <mesh position={[0, 1.15, 0.05]} material={CAB_LIGHT}>
          <boxGeometry args={[1.15, 1.9, 0.9]} />
        </mesh>
        <mesh position={[0, 1.15, -0.36]}>
          <planeGeometry args={[1.1, 1.85]} />
          <meshStandardMaterial color="#f4fbff" emissive="#dbeeff" emissiveIntensity={selected ? 0.8 : 0.15} />
        </mesh>
        {[0.55, 1.15, 1.75].map((y) => (
          <mesh key={y} position={[0, y, 0.1]} material={GLASS}>
            <boxGeometry args={[1.1, 0.04, 0.8]} />
          </mesh>
        ))}
        <mesh position={[0, 2.02, 0.1]}>
          <boxGeometry args={[1.05, 0.03, 0.05]} />
          <meshStandardMaterial color="#eaf6ff" emissive="#dcefff" emissiveIntensity={glow} />
        </mesh>
        <group ref={left} position={[-0.65, 1.1, 0.5]}>
          <mesh position={[0.325, 0, 0]} castShadow material={STEEL}>
            <boxGeometry args={[0.65, 2.2, 0.08]} />
          </mesh>
          <mesh position={[0.58, 0, 0.06]} material={BRASS}>
            <boxGeometry args={[0.04, 1.0, 0.04]} />
          </mesh>
        </group>
        <group ref={right} position={[0.65, 1.1, 0.5]}>
          <mesh position={[-0.325, 0, 0]} castShadow material={STEEL}>
            <boxGeometry args={[0.65, 2.2, 0.08]} />
          </mesh>
          <mesh position={[-0.58, 0, 0.06]} material={BRASS}>
            <boxGeometry args={[0.04, 1.0, 0.04]} />
          </mesh>
        </group>
        {/* only glows when open + lights on */}
        {selected && lightsOn && <pointLight position={[0, 1.2, 0.3]} intensity={2} distance={2} color="#eaf6ff" />}
      </group>
    </Hoverable>
  );
}

function Stool({ x }: { x: number }) {
  return (
    <group position={[x, 0, 1.7]}>
      <mesh position={[0, 0.62, 0]} castShadow material={WOODMAT}>
        <cylinderGeometry args={[0.22, 0.22, 0.07, 24]} />
      </mesh>
      <mesh position={[0, 0.82, -0.19]} rotation={[0.18, 0, 0]} castShadow material={WOODMAT}>
        <boxGeometry args={[0.36, 0.28, 0.05]} />
      </mesh>
      <mesh position={[0, 0.31, 0]} material={STEEL}>
        <cylinderGeometry args={[0.035, 0.045, 0.6, 16]} />
      </mesh>
      <mesh position={[0, 0.18, 0]} material={STEEL}>
        <torusGeometry args={[0.16, 0.015, 8, 24]} />
      </mesh>
      <mesh position={[0, 0.02, 0]} material={STEEL}>
        <cylinderGeometry args={[0.22, 0.22, 0.03, 24]} />
      </mesh>
    </group>
  );
}

/** Animated water column falling from the faucet into the sink. */
function WaterStream({ on }: { on: boolean }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((s) => {
    if (!ref.current) return;
    ref.current.visible = on;
    const m = ref.current.material as THREE.MeshStandardMaterial;
    m.opacity = on ? 0.45 + Math.sin(s.clock.elapsedTime * 22) * 0.12 : 0;
  });
  return (
    <mesh ref={ref} position={[-0.8, 1.2, -2.17]} visible={false}>
      <cylinderGeometry args={[0.012, 0.022, 0.52, 10]} />
      <meshStandardMaterial color="#cdeaff" transparent opacity={0} roughness={0.1} metalness={0} />
    </mesh>
  );
}

/** Rising steam puffs above the pot when the stove is on. */
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
      m.opacity = on ? (1 - t) * 0.35 : 0;
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
  lightsOn,
  night,
  water,
  stove,
  oven,
  onToggleLights,
  onToggleWater,
  onToggleStove,
}: {
  selected: KitchenObject | null;
  onSelect: (k: KitchenObject) => void;
  labels: Record<KitchenObject, string>;
  controls: KitchenControlLabels;
  lightsOn: boolean;
  night: boolean;
  water: boolean;
  stove: boolean;
  oven: boolean;
  onToggleLights: () => void;
  onToggleWater: () => void;
  onToggleStove: () => void;
}) {
  const wood = useMemo(
    () =>
      makeTexture((ctx, w, h) => {
        ctx.fillStyle = "#6b4f34";
        ctx.fillRect(0, 0, w, h);
        const planks = 6;
        const pw = w / planks;
        const shades = ["#6e5236", "#63492f", "#725539", "#5c4429", "#6a5034", "#5f4a30"];
        for (let i = 0; i < planks; i++) {
          ctx.fillStyle = shades[i % shades.length];
          ctx.fillRect(i * pw, 0, pw - 2, h);
          ctx.strokeStyle = "rgba(40,28,16,0.22)";
          ctx.lineWidth = 1;
          for (let gth = 0; gth < 16; gth++) {
            const x = i * pw + Math.random() * pw;
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.bezierCurveTo(x + 4, h * 0.33, x - 4, h * 0.66, x, h);
            ctx.stroke();
          }
          ctx.fillStyle = "rgba(18,11,5,0.6)";
          ctx.fillRect(i * pw + pw - 2, 0, 2, h);
        }
        ctx.fillStyle = "rgba(18,11,5,0.5)";
        for (let y = 0; y < h; y += h / 4) ctx.fillRect(0, y, w, 2);
      }, [5, 5]),
    [],
  );

  const marble = useMemo(
    () =>
      makeTexture((ctx, w, h) => {
        ctx.fillStyle = "#f2f0ea";
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = "rgba(150,152,162,0.22)";
        for (let i = 0; i < 11; i++) {
          ctx.lineWidth = Math.random() * 2 + 0.4;
          ctx.beginPath();
          let x = Math.random() * w;
          let y = 0;
          ctx.moveTo(x, y);
          while (y < h) {
            x += (Math.random() - 0.5) * 60;
            y += h / 9;
            ctx.lineTo(x, y);
          }
          ctx.stroke();
        }
      }),
    [],
  );

  const tile = useMemo(
    () =>
      makeTexture((ctx, w, h) => {
        ctx.fillStyle = "#c9d2d2";
        ctx.fillRect(0, 0, w, h);
        const n = 4;
        const s = w / n;
        const gap = 8;
        ctx.fillStyle = "#eef3f3";
        for (let i = 0; i < n; i++)
          for (let j = 0; j < n; j++) ctx.fillRect(i * s + gap / 2, j * s + gap / 2, s - gap, s - gap);
      }, [3, 1.5]),
    [],
  );

  const marbleMat = useMemo(() => new THREE.MeshStandardMaterial({ map: marble, roughness: 0.2, metalness: 0.2, envMapIntensity: 1.2 }), [marble]);
  const tileMat = useMemo(() => new THREE.MeshStandardMaterial({ map: tile, roughness: 0.15, metalness: 0.1, envMapIntensity: 1.1 }), [tile]);

  // Window "view" — daylight meadow or an evening sky depending on time of day.
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

  const ledOn = lightsOn ? 1.8 : 0.04;

  return (
    <>
      {/* Polished wood floor with real reflections */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[18, 16]} />
        <MeshReflectorMaterial
          map={wood}
          resolution={1024}
          mixBlur={1.2}
          mixStrength={0.9}
          blur={[300, 90]}
          roughness={0.62}
          depthScale={1}
          minDepthThreshold={0.4}
          maxDepthThreshold={1.35}
          color="#ffffff"
          metalness={0.15}
        />
      </mesh>

      {/* Walls */}
      <mesh position={[0, 2.4, -2.9]} material={WALL} receiveShadow>
        <boxGeometry args={[13, 4.8, 0.2]} />
      </mesh>
      <mesh position={[-5.4, 2.4, 0]} material={WALL} receiveShadow>
        <boxGeometry args={[0.2, 4.8, 6]} />
      </mesh>

      {/* Window with a live view + frame */}
      <group position={[2.2, 2.5, -2.79]}>
        <mesh>
          <planeGeometry args={[3, 1.8]} />
          <meshBasicMaterial map={windowView} toneMapped={false} />
        </mesh>
        {[
          [0, 0.95, 3.2, 0.1],
          [0, -0.95, 3.2, 0.1],
        ].map(([x, y, sw, sh], i) => (
          <mesh key={`h${i}`} position={[x, y, 0.02]} material={CAB_LIGHT}>
            <boxGeometry args={[sw, sh, 0.1]} />
          </mesh>
        ))}
        {[-1.55, 0, 1.55].map((x) => (
          <mesh key={`v${x}`} position={[x, 0, 0.02]} material={CAB_LIGHT}>
            <boxGeometry args={[0.08, 1.9, 0.1]} />
          </mesh>
        ))}
      </group>
      {/* Daylight/moonlight spilling from the window */}
      <pointLight position={[2.2, 2.6, -1.8]} intensity={night ? 1.2 : 6} distance={9} decay={2} color={night ? "#aab8ff" : "#eaf3ff"} />

      {/* Tile backsplash */}
      <mesh position={[0.6, 1.75, -2.73]} material={tileMat} receiveShadow>
        <boxGeometry args={[6.6, 1.5, 0.04]} />
      </mesh>

      {/* Base cabinets + marble counter */}
      <mesh position={[0.6, 0.45, -2.35]} castShadow receiveShadow material={CAB}>
        <boxGeometry args={[6.5, 0.9, 0.7]} />
      </mesh>
      <mesh position={[0.6, 0.92, -2.35]} castShadow material={marbleMat}>
        <boxGeometry args={[6.6, 0.06, 0.78]} />
      </mesh>
      {[-1.9, -0.4, 1.1, 2.6].map((x) => (
        <Handle key={x} position={[x, 0.72, -2.0]} length={0.28} vertical />
      ))}

      {/* Upper cabinets + under-cabinet LED */}
      <mesh position={[1.4, 2.9, -2.7]} castShadow material={CAB}>
        <boxGeometry args={[4.4, 0.8, 0.35]} />
      </mesh>
      {[-0.7, 0.75, 2.2].map((x) => (
        <Handle key={x} position={[x, 2.62, -2.52]} length={0.22} vertical />
      ))}
      <mesh position={[1.4, 2.45, -2.5]}>
        <boxGeometry args={[4.2, 0.03, 0.05]} />
        <meshStandardMaterial color="#fff2d8" emissive="#ffe6b0" emissiveIntensity={ledOn} />
      </mesh>

      {/* Wall light switch — click to toggle the kitchen lights */}
      <Hoverable name={controls.lights} hint={lightsOn ? "off" : "on"} onActivate={onToggleLights} labelY={0.35}>
        <group position={[-5.28, 1.4, 1.6]} rotation={[0, Math.PI / 2, 0]}>
          <mesh material={CAB_LIGHT}>
            <boxGeometry args={[0.22, 0.32, 0.04]} />
          </mesh>
          <mesh position={[0, lightsOn ? 0.05 : -0.05, 0.03]}>
            <boxGeometry args={[0.09, 0.13, 0.03]} />
            <meshStandardMaterial color={lightsOn ? "#ffe6b0" : "#3a3f47"} emissive={lightsOn ? "#ffcf7a" : "#000000"} emissiveIntensity={lightsOn ? 0.8 : 0} />
          </mesh>
        </group>
      </Hoverable>

      {/* Sink + faucet — click to run the water */}
      <Hoverable name={labels.sink} hint={water ? controls.water + " off" : controls.water} onActivate={onToggleWater} labelY={1.4}>
        <group position={[-0.8, 0.93, -2.3]}>
          <mesh position={[0, -0.02, 0]} material={DARK}>
            <boxGeometry args={[0.9, 0.12, 0.5]} />
          </mesh>
          <mesh position={[0, -0.04, 0]} material={STEEL}>
            <boxGeometry args={[0.78, 0.06, 0.38]} />
          </mesh>
          <mesh position={[0, 0.28, -0.15]} material={STEEL}>
            <cylinderGeometry args={[0.03, 0.03, 0.55, 12]} />
          </mesh>
          <mesh position={[0, 0.52, -0.02]} rotation={[Math.PI / 2, 0, 0]} material={STEEL}>
            <cylinderGeometry args={[0.03, 0.03, 0.3, 12]} />
          </mesh>
        </group>
      </Hoverable>
      <WaterStream on={water} />

      {/* Induction cooktop — click to turn the stove on/off */}
      <Hoverable name={controls.stove} hint={stove ? "off" : "on"} onActivate={onToggleStove} labelY={0.6}>
        <group position={[2.6, 0.96, -2.3]}>
          <mesh material={DARK}>
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
              <meshStandardMaterial color="#2a2a2e" emissive="#ff4a1c" emissiveIntensity={stove ? 1.6 : 0.08} side={THREE.DoubleSide} />
            </mesh>
          ))}
        </group>
      </Hoverable>
      {/* Pot on the front-left burner + steam */}
      <group position={[2.38, 1.02, -2.17]}>
        <mesh castShadow material={STEEL}>
          <cylinderGeometry args={[0.13, 0.11, 0.14, 24]} />
        </mesh>
        <mesh position={[0.16, 0.02, 0]} rotation={[0, 0, Math.PI / 2]} material={DARK}>
          <cylinderGeometry args={[0.015, 0.015, 0.16, 8]} />
        </mesh>
      </group>
      <Steam on={stove} />
      {stove && <pointLight position={[2.6, 1.05, -2.3]} intensity={0.8} distance={1.6} color="#ff6a2a" />}

      {/* Range hood */}
      <mesh position={[2.6, 2.55, -2.55]} castShadow material={STEEL}>
        <boxGeometry args={[1.1, 0.5, 0.5]} />
      </mesh>
      <mesh position={[2.6, 2.28, -2.42]} rotation={[0.5, 0, 0]} castShadow material={STEEL}>
        <boxGeometry args={[1.1, 0.06, 0.4]} />
      </mesh>

      {/* Oven — click to inspect / meal picks (glows when on) */}
      <Hoverable name={labels.oven} hint="inspect" onActivate={() => onSelect("oven")} labelY={1.3}>
        <group position={[2.6, 0.5, -2.15]}>
          <mesh material={DARK}>
            <boxGeometry args={[0.9, 0.8, 0.1]} />
          </mesh>
          <mesh position={[0, 0.05, 0.06]} material={GLASS}>
            <boxGeometry args={[0.7, 0.5, 0.02]} />
          </mesh>
          <mesh position={[0, 0.05, 0.05]}>
            <planeGeometry args={[0.66, 0.46]} />
            <meshStandardMaterial color="#3a1a08" emissive="#ff6a2a" emissiveIntensity={oven ? 1.6 : 0.35} />
          </mesh>
          <Handle position={[0, 0.34, 0.08]} length={0.7} />
        </group>
      </Hoverable>

      {/* Pantry */}
      <Hoverable name={labels.pantry} hint="inspect" onActivate={() => onSelect("pantry")} labelY={2.4}>
        <group position={[4.4, 1.1, -2.4]}>
          <mesh castShadow material={CAB_LIGHT}>
            <boxGeometry args={[1.3, 2.2, 0.7]} />
          </mesh>
          <Handle position={[-0.1, 0, 0.37]} length={0.5} vertical />
          <Handle position={[0.1, 0, 0.37]} length={0.5} vertical />
        </group>
      </Hoverable>

      {/* Fridge + freezer */}
      <Fridge selected={selected === "fridge"} onSelect={onSelect} label={labels.fridge} hint="inspect" lightsOn={lightsOn} />
      <Hoverable name={labels.freezer} hint="inspect" onActivate={() => onSelect("freezer")} labelY={0.9}>
        <group position={[-3.4, 0.35, -1.4]}>
          <mesh castShadow material={STEEL}>
            <boxGeometry args={[1.3, 0.7, 1.0]} />
          </mesh>
          <Handle position={[0, 0.12, 0.52]} length={0.7} />
        </group>
      </Hoverable>

      {/* Island with marble waterfall top */}
      <Hoverable name={labels.island} hint="inspect" onActivate={() => onSelect("island")} labelY={1.6}>
        <group position={[0.4, 0, 0.6]}>
          <mesh position={[0, 0.45, 0]} castShadow receiveShadow material={CAB}>
            <boxGeometry args={[2.6, 0.9, 1.3]} />
          </mesh>
          <mesh position={[0, 0.93, 0]} castShadow material={marbleMat}>
            <boxGeometry args={[2.8, 0.08, 1.5]} />
          </mesh>
          <mesh position={[-1.36, 0.47, 0]} material={marbleMat}>
            <boxGeometry args={[0.08, 0.9, 1.5]} />
          </mesh>
          <mesh position={[1.36, 0.47, 0]} material={marbleMat}>
            <boxGeometry args={[0.08, 0.9, 1.5]} />
          </mesh>
          {[-0.7, 0, 0.7].map((x) => (
            <Handle key={x} position={[x, 0.45, -0.66]} length={0.3} vertical />
          ))}
          <group position={[0.7, 1.0, 0.1]}>
            <mesh material={CERAMIC}>
              <cylinderGeometry args={[0.22, 0.12, 0.1, 20]} />
            </mesh>
            {[
              ["#c0392b", -0.07, 0.05],
              ["#e67e22", 0.07, 0.02],
              ["#27ae60", 0, -0.07],
              ["#c0392b", 0.05, -0.02],
            ].map(([c, x, z], i) => (
              <mesh key={i} position={[x as number, 0.12, z as number]}>
                <sphereGeometry args={[0.07, 16, 16]} />
                <meshStandardMaterial color={c as string} roughness={0.55} />
              </mesh>
            ))}
          </group>
          <mesh position={[-0.7, 0.99, 0.15]} rotation={[0, 0.3, 0]} castShadow material={WOODMAT}>
            <boxGeometry args={[0.5, 0.03, 0.32]} />
          </mesh>
          <mesh position={[-0.2, 1.06, -0.2]} material={CERAMIC}>
            <cylinderGeometry args={[0.07, 0.06, 0.18, 16]} />
          </mesh>
        </group>
      </Hoverable>

      <Stool x={-0.2} />
      <Stool x={1.0} />

      {/* Pendant lamps over the island */}
      {[-0.4, 1.2].map((x) => (
        <group key={x} position={[x, 0, 0.6]}>
          <mesh position={[0, 3.4, 0]} material={DARK}>
            <cylinderGeometry args={[0.01, 0.01, 1.2, 8]} />
          </mesh>
          <mesh position={[0, 2.75, 0]}>
            <coneGeometry args={[0.16, 0.22, 24, 1, true]} />
            <meshStandardMaterial color="#20242b" side={THREE.DoubleSide} roughness={0.4} metalness={0.3} />
          </mesh>
          <mesh position={[0, 2.68, 0]}>
            <sphereGeometry args={[0.06, 16, 16]} />
            <meshStandardMaterial color="#fff4d8" emissive="#ffdf9e" emissiveIntensity={lightsOn ? 4 : 0.1} />
          </mesh>
          {lightsOn && <pointLight position={[0, 2.55, 0]} intensity={5} distance={4.5} decay={2} color="#ffe4b0" />}
        </group>
      ))}

      {/* Recessed ceiling downlights */}
      {[
        [-2.5, -1],
        [0.6, -1.2],
        [3.2, -0.6],
        [0.4, 1.2],
      ].map(([x, z], i) => (
        <group key={i} position={[x, 4.55, z]}>
          <mesh>
            <cylinderGeometry args={[0.09, 0.09, 0.04, 20]} />
            <meshStandardMaterial color="#fff6e6" emissive="#ffedcf" emissiveIntensity={lightsOn ? 2.4 : 0.06} />
          </mesh>
          {lightsOn && <pointLight position={[0, -0.2, 0]} intensity={3} distance={6} decay={2} color="#ffe9c8" />}
        </group>
      ))}

      {/* Coffee station + kettle + wine */}
      <group position={[-2.4, 0.98, -2.3]}>
        <mesh castShadow material={DARK}>
          <boxGeometry args={[0.35, 0.4, 0.3]} />
        </mesh>
        <mesh position={[0, 0.22, 0.05]}>
          <boxGeometry args={[0.2, 0.05, 0.02]} />
          <meshStandardMaterial color="#0a2a2a" emissive="#12e0c0" emissiveIntensity={1.5} />
        </mesh>
        <mesh position={[-0.02, -0.15, 0.2]} material={CERAMIC}>
          <cylinderGeometry args={[0.06, 0.05, 0.1, 16]} />
        </mesh>
      </group>
      <mesh position={[-1.7, 1.12, -2.3]} castShadow material={STEEL}>
        <cylinderGeometry args={[0.12, 0.14, 0.3, 20]} />
      </mesh>
      {[-2.95, -2.8].map((x, i) => (
        <mesh key={x} position={[x, 1.13, -2.3]} castShadow>
          <cylinderGeometry args={[0.05, 0.05, 0.34, 16]} />
          <meshStandardMaterial color={i === 0 ? "#243b1f" : "#3a1420"} roughness={0.25} metalness={0.1} />
        </mesh>
      ))}

      {/* Wall clock */}
      <group position={[-2.4, 3.35, -2.78]}>
        <mesh material={CAB_LIGHT} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.28, 0.28, 0.05, 32]} />
        </mesh>
        <mesh position={[0, 0, 0.03]}>
          <circleGeometry args={[0.24, 32]} />
          <meshStandardMaterial color="#f6f4ee" />
        </mesh>
        <mesh position={[0, 0.07, 0.04]} rotation={[0, 0, 0]}>
          <boxGeometry args={[0.02, 0.16, 0.01]} />
          <meshStandardMaterial color="#1c2027" />
        </mesh>
        <mesh position={[0.06, 0, 0.04]} rotation={[0, 0, Math.PI / 2]}>
          <boxGeometry args={[0.02, 0.12, 0.01]} />
          <meshStandardMaterial color="#1c2027" />
        </mesh>
      </group>

      {/* Herbs on the windowsill */}
      {[1.4, 2.2, 3.0].map((x) => (
        <group key={x} position={[x, 1.65, -2.6]}>
          <mesh material={CERAMIC}>
            <cylinderGeometry args={[0.08, 0.06, 0.12, 12]} />
          </mesh>
          <mesh position={[0, 0.14, 0]}>
            <sphereGeometry args={[0.11, 12, 12]} />
            <meshStandardMaterial color="#4c9350" roughness={0.9} />
          </mesh>
        </group>
      ))}

      {/* Floor plant */}
      <group position={[3.9, 1.0, 0.2]}>
        <mesh castShadow material={CERAMIC}>
          <cylinderGeometry args={[0.17, 0.13, 0.32, 20]} />
        </mesh>
        {[
          [0, 0.34, 0, 0.26],
          [0.14, 0.42, 0.05, 0.18],
          [-0.12, 0.4, -0.05, 0.16],
          [0.04, 0.5, -0.08, 0.14],
        ].map(([x, y, z, r], i) => (
          <mesh key={i} position={[x as number, y as number, z as number]}>
            <sphereGeometry args={[r as number, 16, 16]} />
            <meshStandardMaterial color={i % 2 ? "#3f7d43" : "#4c9350"} roughness={0.9} />
          </mesh>
        ))}
      </group>

      {/* Area rug */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0.4, 0.012, 1.1]} receiveShadow>
        <planeGeometry args={[3.6, 2.4]} />
        <meshStandardMaterial color="#b5a488" roughness={0.98} />
      </mesh>

      <ContactShadows position={[0, 0.015, 0]} opacity={0.5} scale={20} blur={2.6} far={9} resolution={1024} color="#000000" />
    </>
  );
}

export default function Kitchen3D({
  selected,
  onSelect,
  labels,
  controls,
}: {
  selected: KitchenObject | null;
  onSelect: (k: KitchenObject) => void;
  labels: Record<KitchenObject, string>;
  controls: KitchenControlLabels;
}) {
  const [lightsOn, setLightsOn] = useState(true);
  const [night, setNight] = useState(false);
  const [water, setWater] = useState(false);
  const [stove, setStove] = useState(false);
  const [oven, setOven] = useState(false);

  const ctrlBtn = (active: boolean, onClick: () => void, Icon: typeof Sun, text: string) => (
    <button
      onClick={onClick}
      className={cn(
        "pointer-events-auto inline-flex items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-medium backdrop-blur transition-colors",
        active ? "border-orange-300/50 bg-orange-400/20 text-orange-100" : "border-white/15 bg-black/50 text-white/60 hover:text-white",
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      <span>{text}</span>
    </button>
  );

  return (
    <>
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ position: [5.8, 3.3, 5.8], fov: 40 }}
        gl={{ antialias: true, alpha: false, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.02 }}
        style={{ touchAction: "none" }}
      >
        <color attach="background" args={[night ? "#05060a" : "#0a0a0c"]} />
        <fog attach="fog" args={[night ? "#05060a" : "#0a0a0c", 16, 34]} />
        <ambientLight intensity={night ? 0.08 : 0.4} />
        <hemisphereLight args={["#fff2df", "#3a2f28", night ? 0.12 : 0.5]} />
        <directionalLight
          position={[4, 7, 3]}
          intensity={night ? 0.15 : 2.1}
          color={night ? "#9fb4ff" : "#fff2df"}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-bias={-0.0004}
          shadow-camera-left={-8}
          shadow-camera-right={8}
          shadow-camera-top={8}
          shadow-camera-bottom={-8}
        />
        <directionalLight position={[-4, 4, -3]} intensity={night ? 0.1 : 0.45} color="#bcd4ff" />
        <Suspense fallback={null}>
          <Environment preset={night ? "night" : "apartment"} environmentIntensity={night ? 0.2 : 0.55} />
        </Suspense>

        <Scene
          selected={selected}
          onSelect={onSelect}
          labels={labels}
          controls={controls}
          lightsOn={lightsOn}
          night={night}
          water={water}
          stove={stove}
          oven={oven}
          onToggleLights={() => setLightsOn((v) => !v)}
          onToggleWater={() => setWater((v) => !v)}
          onToggleStove={() => setStove((v) => !v)}
        />

        <OrbitControls
          enablePan={false}
          minDistance={4}
          maxDistance={13}
          minPolarAngle={0.5}
          maxPolarAngle={Math.PI / 2.15}
          target={[0.3, 1, -0.4]}
          enableDamping
          dampingFactor={0.08}
        />
        <EffectComposer multisampling={0} enableNormalPass={false}>
          <Bloom luminanceThreshold={0.72} luminanceSmoothing={0.9} intensity={0.55} mipmapBlur radius={0.65} />
          <Vignette eskil={false} offset={0.25} darkness={0.6} />
        </EffectComposer>
      </Canvas>

      {/* Appliance control bar */}
      <div className="pointer-events-none absolute inset-x-0 bottom-4 z-20 flex flex-wrap items-center justify-center gap-2 px-4">
        {ctrlBtn(lightsOn, () => setLightsOn((v) => !v), lightsOn ? Lightbulb : LightbulbOff, controls.lights)}
        {ctrlBtn(night, () => setNight((v) => !v), night ? Moon : Sun, night ? controls.night : controls.day)}
        {ctrlBtn(water, () => setWater((v) => !v), Droplets, controls.water)}
        {ctrlBtn(stove, () => setStove((v) => !v), Flame, controls.stove)}
        {ctrlBtn(oven, () => setOven((v) => !v), CookingPot, controls.oven)}
      </div>
    </>
  );
}
