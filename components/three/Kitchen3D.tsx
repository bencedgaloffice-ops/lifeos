"use client";

import { useRef, useState, useMemo, Suspense, Component, type ReactNode } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, ContactShadows, Environment, Html, MeshReflectorMaterial } from "@react-three/drei";
import { EffectComposer, Bloom, Vignette } from "@react-three/postprocessing";
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
    <mesh position={position} material={DARKMETAL} rotation={vertical ? [0, 0, 0] : [0, 0, Math.PI / 2]}>
      <cylinderGeometry args={[0.014, 0.014, length, 10]} />
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
  useFrame(() => {
    if (drawer.current) drawer.current.position.z = THREE.MathUtils.lerp(drawer.current.position.z, selected ? 0.55 : 0, 0.15);
  });
  return (
    <Hoverable name={label} hint="inspect" onActivate={() => onSelect("freezer")} labelY={0.95}>
      <group position={[-3.4, 0.35, -1.4]}>
        <mesh castShadow material={BLACK}>
          <boxGeometry args={[1.3, 0.7, 1.0]} />
        </mesh>
        <mesh position={[0, 0, 0.02]} material={CERAMIC}>
          <boxGeometry args={[1.15, 0.56, 0.9]} />
        </mesh>
        <mesh position={[0, 0, -0.35]}>
          <planeGeometry args={[1.1, 0.5]} />
          <meshStandardMaterial color="#eaf6ff" emissive="#bfe4ff" emissiveIntensity={selected ? 0.85 : 0.14} />
        </mesh>
        <group ref={drawer}>
          <mesh position={[0, 0, 0.5]} castShadow material={BLACK}>
            <boxGeometry args={[1.3, 0.7, 0.06]} />
          </mesh>
          <Handle position={[0, 0.14, 0.54]} length={0.7} />
          <mesh position={[0, -0.12, 0.22]} material={STEEL}>
            <boxGeometry args={[1.0, 0.32, 0.55]} />
          </mesh>
          {[
            ["#cfe4ff", -0.3],
            ["#e8d8c0", 0],
            ["#d9c0c0", 0.3],
          ].map(([c, x], i) => (
            <mesh key={i} position={[x as number, -0.04, 0.24]}>
              <boxGeometry args={[0.22, 0.18, 0.32]} />
              <meshStandardMaterial color={c as string} roughness={0.6} />
            </mesh>
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
        <mesh material={BLACK}>
          <boxGeometry args={[1.0, 2.2, 0.7]} />
        </mesh>
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

function Fridge({ selected, onSelect, label, lightsOn }: { selected: boolean; onSelect: (k: KitchenObject) => void; label: string; lightsOn: boolean }) {
  const left = useRef<THREE.Group>(null);
  const right = useRef<THREE.Group>(null);
  useFrame(() => {
    const target = selected ? 1 : 0;
    if (left.current) left.current.rotation.y = THREE.MathUtils.lerp(left.current.rotation.y, target * 2.0, 0.12);
    if (right.current) right.current.rotation.y = THREE.MathUtils.lerp(right.current.rotation.y, -target * 2.0, 0.12);
  });
  return (
    <Hoverable name={label} hint="inspect" onActivate={() => onSelect("fridge")} labelY={2.5}>
      <group position={[-3.4, 0, -2.2]}>
        <mesh position={[0, 1.1, 0]} castShadow material={BLACK}>
          <boxGeometry args={[1.3, 2.2, 1.0]} />
        </mesh>
        <mesh position={[0, 1.15, 0.05]} material={CERAMIC}>
          <boxGeometry args={[1.15, 1.9, 0.9]} />
        </mesh>
        <mesh position={[0, 1.15, -0.36]}>
          <planeGeometry args={[1.1, 1.85]} />
          <meshStandardMaterial color="#f4fbff" emissive="#dbeeff" emissiveIntensity={selected ? 0.8 : 0.12} />
        </mesh>
        {[0.55, 1.15, 1.75].map((y) => (
          <mesh key={y} position={[0, y, 0.1]} material={GLASS}>
            <boxGeometry args={[1.1, 0.04, 0.8]} />
          </mesh>
        ))}
        <mesh position={[0, 2.02, 0.1]}>
          <boxGeometry args={[1.05, 0.03, 0.05]} />
          <meshStandardMaterial color="#eaf6ff" emissive="#dcefff" emissiveIntensity={selected ? 3 : 0.3} />
        </mesh>
        <group ref={left} position={[-0.65, 1.1, 0.5]}>
          <mesh position={[0.325, 0, 0]} castShadow material={BLACK}>
            <boxGeometry args={[0.65, 2.2, 0.08]} />
          </mesh>
          <Handle position={[0.58, 0, 0.08]} length={1.0} vertical />
        </group>
        <group ref={right} position={[0.65, 1.1, 0.5]}>
          <mesh position={[-0.325, 0, 0]} castShadow material={BLACK}>
            <boxGeometry args={[0.65, 2.2, 0.08]} />
          </mesh>
          <Handle position={[-0.58, 0, 0.08]} length={1.0} vertical />
        </group>
        {selected && lightsOn && <pointLight position={[0, 1.2, 0.3]} intensity={2} distance={2} color="#eaf6ff" />}
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
  lightsOn: boolean;
  night: boolean;
  water: boolean;
  stove: boolean;
  oven: boolean;
  onToggleWater: () => void;
  onToggleStove: () => void;
}) {
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

  const bronzeMat = useMemo(() => new THREE.MeshStandardMaterial({ map: bronze, roughness: 0.35, metalness: 0.45, envMapIntensity: 1.3 }), [bronze]);
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
          resolution={1024}
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

      {/* Full-height matte black cabinetry across the back */}
      <mesh position={[0.6, 2.0, -2.55]} castShadow receiveShadow material={BLACK}>
        <boxGeometry args={[6.6, 4.0, 0.6]} />
      </mesh>
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
      <mesh position={[0.4, 1.35, -2.52]}>
        <planeGeometry args={[2.3, 0.7]} />
        <meshStandardMaterial map={onyx} emissive="#ffb257" emissiveMap={onyx} emissiveIntensity={2.0} toneMapped={false} />
      </mesh>
      <pointLight position={[0.4, 1.35, -2.0]} intensity={2.4} distance={4} decay={2} color="#ffb85f" />

      {/* Base run + slim black counter */}
      <mesh position={[0.6, 0.45, -2.35]} castShadow receiveShadow material={BLACK}>
        <boxGeometry args={[6.5, 0.9, 0.7]} />
      </mesh>
      <mesh position={[0.6, 0.92, -2.35]} castShadow material={BLACK2}>
        <boxGeometry args={[6.6, 0.05, 0.78]} />
      </mesh>

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
      <Fridge selected={selected === "fridge"} onSelect={onSelect} label={labels.fridge} lightsOn={lightsOn} />
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
      </group>

      <ContactShadows position={[0, 0.015, 0]} opacity={0.55} scale={20} blur={2.6} far={9} resolution={1024} color="#000000" />
    </>
  );
}

export default function Kitchen3D({
  selected,
  onSelect,
  labels,
  controls,
  modelUrl,
}: {
  selected: KitchenObject | null;
  onSelect: (k: KitchenObject) => void;
  labels: Record<KitchenObject, string>;
  controls: KitchenControlLabels;
  modelUrl?: string | null;
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
        dpr={[1, 2]}
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
          shadow-mapSize={[2048, 2048]}
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
            onToggleWater={() => setWater((v) => !v)}
            onToggleStove={() => setStove((v) => !v)}
          />
        )}

        <OrbitControls
          enablePan={false}
          minDistance={4}
          maxDistance={14}
          minPolarAngle={0.5}
          maxPolarAngle={Math.PI / 2.15}
          target={modelUrl ? [0, 1.2, 0] : [0.3, 1, -0.2]}
          enableDamping
          dampingFactor={0.08}
        />
        <EffectComposer multisampling={0} enableNormalPass={false}>
          <Bloom luminanceThreshold={0.7} luminanceSmoothing={0.9} intensity={0.6} mipmapBlur radius={0.7} />
          <Vignette eskil={false} offset={0.22} darkness={0.7} />
        </EffectComposer>
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
