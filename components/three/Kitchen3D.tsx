"use client";

import { useRef, useState, useMemo, Suspense } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, ContactShadows, Environment, Html, MeshReflectorMaterial } from "@react-three/drei";
import { EffectComposer, Bloom, Vignette } from "@react-three/postprocessing";
import * as THREE from "three";

/**
 * The Kitchen digital twin — Phase 1 (realism pass).
 *
 * A premium, explorable modern European kitchen built with React Three Fiber:
 * a polished reflective floor, layered daylight + warm pendant/downlight
 * lighting, a quartz island with bar stools, a full run of matte cabinets with
 * a stone counter, tile backsplash, an induction cooktop under a range hood,
 * styled counter props, a tall fridge whose doors open (revealing lit shelves)
 * when selected, an oven, a sink with a faucet, and a real window with a
 * daylight view. Every key object is hover-highlighted (with a floating label)
 * and clickable — selection is reported up so the module can show that object's
 * real inventory/data. Built from primitives so it needs no downloaded assets;
 * realistic GLB furniture can drop into each group later.
 */

export type KitchenObject = "fridge" | "freezer" | "pantry" | "island" | "oven" | "sink";

const WOOD = new THREE.MeshStandardMaterial({ color: "#6b4f38", roughness: 0.7, metalness: 0.05 });
const CAB = new THREE.MeshStandardMaterial({ color: "#1c2027", roughness: 0.5, metalness: 0.18 });
const CAB_LIGHT = new THREE.MeshStandardMaterial({ color: "#e9e5dc", roughness: 0.45, metalness: 0.08 });
const STONE = new THREE.MeshStandardMaterial({ color: "#f0eee8", roughness: 0.18, metalness: 0.25, envMapIntensity: 1.2 });
const WALL = new THREE.MeshStandardMaterial({ color: "#d3cdc3", roughness: 0.96 });
const STEEL = new THREE.MeshStandardMaterial({ color: "#cdd1d7", roughness: 0.22, metalness: 0.95, envMapIntensity: 1.4 });
const DARK = new THREE.MeshStandardMaterial({ color: "#0b0d11", roughness: 0.28, metalness: 0.45 });
const GLASS = new THREE.MeshStandardMaterial({ color: "#0a1a22", roughness: 0.06, metalness: 0.3, transparent: true, opacity: 0.5 });
const BRASS = new THREE.MeshStandardMaterial({ color: "#c19a5b", roughness: 0.32, metalness: 1, envMapIntensity: 1.5 });
const TILE = new THREE.MeshStandardMaterial({ color: "#e3e8e8", roughness: 0.15, metalness: 0.1, envMapIntensity: 1.1 });
const CERAMIC = new THREE.MeshStandardMaterial({ color: "#f4f1ea", roughness: 0.35, metalness: 0.05 });

function Hoverable({
  name,
  onSelect,
  objectKey,
  children,
  labelY = 1,
}: {
  name: string;
  onSelect: (k: KitchenObject) => void;
  objectKey: KitchenObject;
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
        onSelect(objectKey);
      }}
    >
      {children}
      {hovered && (
        <Html center position={[0, labelY, 0]} distanceFactor={9} zIndexRange={[10, 0]}>
          <div className="pointer-events-none whitespace-nowrap rounded-full border border-white/20 bg-black/75 px-2.5 py-1 text-[11px] font-medium text-white/90 backdrop-blur">
            {name} <span className="text-white/40">· inspect</span>
          </div>
        </Html>
      )}
    </group>
  );
}

/** A brass bar handle. */
function Handle({ position, length = 0.6, vertical = false }: { position: [number, number, number]; length?: number; vertical?: boolean }) {
  return (
    <mesh position={position} material={BRASS} rotation={vertical ? [0, 0, 0] : [0, 0, Math.PI / 2]}>
      <cylinderGeometry args={[0.018, 0.018, length, 12]} />
    </mesh>
  );
}

function Fridge({ selected, onSelect, label }: { selected: boolean; onSelect: (k: KitchenObject) => void; label: string }) {
  const left = useRef<THREE.Group>(null);
  const right = useRef<THREE.Group>(null);
  useFrame(() => {
    const target = selected ? 1 : 0;
    if (left.current) left.current.rotation.y = THREE.MathUtils.lerp(left.current.rotation.y, target * 2.0, 0.12);
    if (right.current) right.current.rotation.y = THREE.MathUtils.lerp(right.current.rotation.y, -target * 2.0, 0.12);
  });
  return (
    <Hoverable name={label} objectKey="fridge" onSelect={onSelect} labelY={2.5}>
      <group position={[-3.4, 0, -2.2]}>
        {/* Body */}
        <mesh position={[0, 1.1, 0]} castShadow material={STEEL}>
          <boxGeometry args={[1.3, 2.2, 1.0]} />
        </mesh>
        {/* Interior */}
        <mesh position={[0, 1.15, 0.05]} material={CAB_LIGHT}>
          <boxGeometry args={[1.15, 1.9, 0.9]} />
        </mesh>
        {/* Back interior glow */}
        <mesh position={[0, 1.15, -0.36]}>
          <planeGeometry args={[1.1, 1.85]} />
          <meshStandardMaterial color="#f4fbff" emissive="#dbeeff" emissiveIntensity={selected ? 0.8 : 0.15} />
        </mesh>
        {/* Lit shelves */}
        {[0.55, 1.15, 1.75].map((y) => (
          <mesh key={y} position={[0, y, 0.1]} material={GLASS}>
            <boxGeometry args={[1.1, 0.04, 0.8]} />
          </mesh>
        ))}
        {/* LED strip */}
        <mesh position={[0, 2.02, 0.1]}>
          <boxGeometry args={[1.05, 0.03, 0.05]} />
          <meshStandardMaterial color="#eaf6ff" emissive="#dcefff" emissiveIntensity={selected ? 3 : 0.4} />
        </mesh>
        {/* Doors */}
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
      </group>
    </Hoverable>
  );
}

/** A modern bar stool: seat, low backrest, central pole, foot ring. */
function Stool({ x }: { x: number }) {
  return (
    <group position={[x, 0, 1.7]}>
      <mesh position={[0, 0.62, 0]} castShadow material={WOOD}>
        <cylinderGeometry args={[0.22, 0.22, 0.07, 24]} />
      </mesh>
      <mesh position={[0, 0.82, -0.19]} rotation={[0.18, 0, 0]} castShadow material={WOOD}>
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

function Scene({ selected, onSelect, labels }: { selected: KitchenObject | null; onSelect: (k: KitchenObject) => void; labels: Record<KitchenObject, string> }) {
  // Bright daylight "view" for the window — a soft sky-to-meadow gradient with
  // a warm sun glow, generated on the client so no asset download is needed.
  const windowView = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 256;
    c.height = 256;
    const ctx = c.getContext("2d")!;
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
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, []);

  return (
    <>
      {/* Polished floor with real reflections */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[18, 16]} />
        <MeshReflectorMaterial
          resolution={1024}
          mixBlur={1.1}
          mixStrength={2.2}
          blur={[300, 90]}
          roughness={0.72}
          depthScale={1}
          minDepthThreshold={0.4}
          maxDepthThreshold={1.35}
          color="#5a4632"
          metalness={0.28}
        />
      </mesh>

      {/* Walls */}
      <mesh position={[0, 2.4, -2.9]} material={WALL} receiveShadow>
        <boxGeometry args={[13, 4.8, 0.2]} />
      </mesh>
      <mesh position={[-5.4, 2.4, 0]} material={WALL} receiveShadow>
        <boxGeometry args={[0.2, 4.8, 6]} />
      </mesh>

      {/* Window with a daylight view + frame */}
      <group position={[2.2, 2.5, -2.79]}>
        <mesh>
          <planeGeometry args={[3, 1.8]} />
          <meshBasicMaterial map={windowView} toneMapped={false} />
        </mesh>
        {/* Frame */}
        <mesh position={[0, 0, 0.02]} material={CAB_LIGHT}>
          <boxGeometry args={[3.2, 0.1, 0.1]} />
        </mesh>
        <mesh position={[0, 0.9, 0.02]} material={CAB_LIGHT}>
          <boxGeometry args={[3.2, 0.1, 0.1]} />
        </mesh>
        <mesh position={[0, -0.9, 0.02]} material={CAB_LIGHT}>
          <boxGeometry args={[3.2, 0.1, 0.1]} />
        </mesh>
        <mesh position={[-1.55, 0, 0.02]} material={CAB_LIGHT}>
          <boxGeometry args={[0.1, 1.9, 0.1]} />
        </mesh>
        <mesh position={[1.55, 0, 0.02]} material={CAB_LIGHT}>
          <boxGeometry args={[0.1, 1.9, 0.1]} />
        </mesh>
        <mesh position={[0, 0, 0.02]} material={CAB_LIGHT}>
          <boxGeometry args={[0.06, 1.9, 0.08]} />
        </mesh>
      </group>
      {/* Soft daylight spilling from the window */}
      <pointLight position={[2.2, 2.6, -1.8]} intensity={6} distance={9} decay={2} color="#eaf3ff" />

      {/* Tile backsplash behind the counter */}
      <mesh position={[0.6, 1.75, -2.73]} material={TILE} receiveShadow>
        <boxGeometry args={[6.6, 1.5, 0.04]} />
      </mesh>

      {/* Base cabinets + stone counter along back wall */}
      <mesh position={[0.6, 0.45, -2.35]} castShadow receiveShadow material={CAB}>
        <boxGeometry args={[6.5, 0.9, 0.7]} />
      </mesh>
      <mesh position={[0.6, 0.92, -2.35]} castShadow material={STONE}>
        <boxGeometry args={[6.6, 0.06, 0.78]} />
      </mesh>
      {/* Base cabinet handles */}
      {[-1.9, -0.4, 1.1, 2.6].map((x) => (
        <Handle key={x} position={[x, 0.72, -2.0]} length={0.28} vertical />
      ))}

      {/* Upper cabinets + doors + handles */}
      <mesh position={[1.4, 2.9, -2.7]} castShadow material={CAB}>
        <boxGeometry args={[4.4, 0.8, 0.35]} />
      </mesh>
      {[-0.7, 0.75, 2.2].map((x) => (
        <Handle key={x} position={[x, 2.62, -2.52]} length={0.22} vertical />
      ))}
      {/* Under-cabinet LED */}
      <mesh position={[1.4, 2.45, -2.5]}>
        <boxGeometry args={[4.2, 0.03, 0.05]} />
        <meshStandardMaterial color="#fff2d8" emissive="#ffe6b0" emissiveIntensity={1.8} />
      </mesh>

      {/* Sink + faucet */}
      <Hoverable name={labels.sink} objectKey="sink" onSelect={onSelect} labelY={1.4}>
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

      {/* Induction cooktop + range hood, above the oven run */}
      <group position={[2.6, 0.96, -2.3]}>
        <mesh material={DARK}>
          <boxGeometry args={[0.95, 0.04, 0.62]} />
        </mesh>
        {[[-0.22, -0.13], [0.22, -0.13], [-0.22, 0.13], [0.22, 0.13]].map(([x, z], i) => (
          <mesh key={i} position={[x, 0.025, z]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.06, 0.09, 24]} />
            <meshStandardMaterial color="#2a2a2e" emissive="#ff4a1c" emissiveIntensity={i === 0 ? 1.4 : 0.15} side={THREE.DoubleSide} />
          </mesh>
        ))}
      </group>
      <mesh position={[2.6, 2.55, -2.55]} castShadow material={STEEL}>
        <boxGeometry args={[1.1, 0.5, 0.5]} />
      </mesh>
      <mesh position={[2.6, 2.28, -2.42]} rotation={[0.5, 0, 0]} castShadow material={STEEL}>
        <boxGeometry args={[1.1, 0.06, 0.4]} />
      </mesh>

      {/* Oven built into the base run */}
      <Hoverable name={labels.oven} objectKey="oven" onSelect={onSelect} labelY={1.3}>
        <group position={[2.6, 0.5, -2.15]}>
          <mesh material={DARK}>
            <boxGeometry args={[0.9, 0.8, 0.1]} />
          </mesh>
          <mesh position={[0, 0.05, 0.06]} material={GLASS}>
            <boxGeometry args={[0.7, 0.5, 0.02]} />
          </mesh>
          <mesh position={[0, 0.05, 0.05]}>
            <planeGeometry args={[0.66, 0.46]} />
            <meshStandardMaterial color="#3a1a08" emissive="#ff6a2a" emissiveIntensity={0.5} />
          </mesh>
          <Handle position={[0, 0.34, 0.08]} length={0.7} />
        </group>
      </Hoverable>

      {/* Pantry (tall cabinet, right) */}
      <Hoverable name={labels.pantry} objectKey="pantry" onSelect={onSelect} labelY={2.4}>
        <group position={[4.4, 1.1, -2.4]}>
          <mesh castShadow material={CAB_LIGHT}>
            <boxGeometry args={[1.3, 2.2, 0.7]} />
          </mesh>
          <Handle position={[-0.1, 0, 0.37]} length={0.5} vertical />
          <Handle position={[0.1, 0, 0.37]} length={0.5} vertical />
        </group>
      </Hoverable>

      {/* Fridge + freezer */}
      <Fridge selected={selected === "fridge"} onSelect={onSelect} label={labels.fridge} />
      <Hoverable name={labels.freezer} objectKey="freezer" onSelect={onSelect} labelY={0.9}>
        <group position={[-3.4, 0.35, -1.4]}>
          <mesh castShadow material={STEEL}>
            <boxGeometry args={[1.3, 0.7, 1.0]} />
          </mesh>
          <Handle position={[0, 0.12, 0.52]} length={0.7} />
        </group>
      </Hoverable>

      {/* Island + quartz top */}
      <Hoverable name={labels.island} objectKey="island" onSelect={onSelect} labelY={1.6}>
        <group position={[0.4, 0, 0.6]}>
          <mesh position={[0, 0.45, 0]} castShadow receiveShadow material={CAB}>
            <boxGeometry args={[2.6, 0.9, 1.3]} />
          </mesh>
          <mesh position={[0, 0.93, 0]} castShadow material={STONE}>
            <boxGeometry args={[2.8, 0.08, 1.5]} />
          </mesh>
          {/* waterfall edge */}
          <mesh position={[-1.36, 0.47, 0]} material={STONE}>
            <boxGeometry args={[0.08, 0.9, 1.5]} />
          </mesh>
          <mesh position={[1.36, 0.47, 0]} material={STONE}>
            <boxGeometry args={[0.08, 0.9, 1.5]} />
          </mesh>
          {[-0.7, 0, 0.7].map((x) => (
            <Handle key={x} position={[x, 0.45, -0.66]} length={0.3} vertical />
          ))}
          {/* fruit bowl on the island */}
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
          {/* cutting board + utensil crock */}
          <mesh position={[-0.7, 0.99, 0.15]} rotation={[0, 0.3, 0]} castShadow material={WOOD}>
            <boxGeometry args={[0.5, 0.03, 0.32]} />
          </mesh>
          <mesh position={[-0.2, 1.06, -0.2]} material={CERAMIC}>
            <cylinderGeometry args={[0.07, 0.06, 0.18, 16]} />
          </mesh>
        </group>
      </Hoverable>
      {/* Bar stools */}
      <Stool x={-0.2} />
      <Stool x={1.0} />

      {/* Pendant lamps over the island */}
      {[-0.4, 1.2].map((x) => (
        <group key={x} position={[0.4 + x - 0.4, 0, 0.6]}>
          <mesh position={[0, 3.4, 0]} material={DARK}>
            <cylinderGeometry args={[0.01, 0.01, 1.2, 8]} />
          </mesh>
          <mesh position={[0, 2.75, 0]}>
            <coneGeometry args={[0.16, 0.22, 24, 1, true]} />
            <meshStandardMaterial color="#20242b" side={THREE.DoubleSide} roughness={0.4} metalness={0.3} />
          </mesh>
          <mesh position={[0, 2.68, 0]}>
            <sphereGeometry args={[0.06, 16, 16]} />
            <meshStandardMaterial color="#fff4d8" emissive="#ffdf9e" emissiveIntensity={4} />
          </mesh>
          <pointLight position={[0, 2.55, 0]} intensity={5} distance={4.5} decay={2} color="#ffe4b0" castShadow />
        </group>
      ))}

      {/* Coffee station */}
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

      {/* Wine bottles by the coffee station */}
      {[-2.9, -2.75].map((x, i) => (
        <mesh key={x} position={[x, 1.13, -2.3]} castShadow>
          <cylinderGeometry args={[0.05, 0.05, 0.34, 16]} />
          <meshStandardMaterial color={i === 0 ? "#243b1f" : "#3a1420"} roughness={0.25} metalness={0.1} />
        </mesh>
      ))}

      {/* Plant */}
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

      {/* Soft area rug under the island */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0.4, 0.012, 1.1]} receiveShadow>
        <planeGeometry args={[3.6, 2.4]} />
        <meshStandardMaterial color="#b5a488" roughness={0.98} />
      </mesh>

      {/* Recessed ceiling downlights (fixtures + light pools) */}
      {[
        [-2.5, -1],
        [0.6, -1.2],
        [3.2, -0.6],
        [0.4, 1.2],
      ].map(([x, z], i) => (
        <group key={i} position={[x, 4.55, z]}>
          <mesh>
            <cylinderGeometry args={[0.09, 0.09, 0.04, 20]} />
            <meshStandardMaterial color="#fff6e6" emissive="#ffedcf" emissiveIntensity={2.4} />
          </mesh>
          <pointLight position={[0, -0.2, 0]} intensity={3} distance={6} decay={2} color="#ffe9c8" />
        </group>
      ))}

      <ContactShadows position={[0, 0.015, 0]} opacity={0.5} scale={20} blur={2.6} far={9} resolution={1024} color="#000000" />
    </>
  );
}

export default function Kitchen3D({
  selected,
  onSelect,
  labels,
}: {
  selected: KitchenObject | null;
  onSelect: (k: KitchenObject) => void;
  labels: Record<KitchenObject, string>;
}) {
  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ position: [5.8, 3.3, 5.8], fov: 40 }}
      gl={{ antialias: true, alpha: false, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.02 }}
      style={{ touchAction: "none" }}
    >
      <color attach="background" args={["#0a0a0c"]} />
      <fog attach="fog" args={["#0a0a0c", 16, 34]} />
      <ambientLight intensity={0.4} />
      <hemisphereLight args={["#fff2df", "#3a2f28", 0.5]} />
      <directionalLight
        position={[4, 7, 3]}
        intensity={2.1}
        color="#fff2df"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-camera-left={-8}
        shadow-camera-right={8}
        shadow-camera-top={8}
        shadow-camera-bottom={-8}
      />
      <directionalLight position={[-4, 4, -3]} intensity={0.45} color="#bcd4ff" />
      <Suspense fallback={null}>
        <Environment preset="apartment" environmentIntensity={0.55} />
      </Suspense>

      <Scene selected={selected} onSelect={onSelect} labels={labels} />

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
  );
}
