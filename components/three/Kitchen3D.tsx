"use client";

import { useRef, useState, Suspense } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, ContactShadows, Environment, Html } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import * as THREE from "three";

/**
 * The Kitchen digital twin — Phase 1.
 *
 * A premium, explorable modern European kitchen built with React Three Fiber:
 * warm image-based lighting + reflections, a quartz island and bar stools,
 * run of matte cabinets with a stone counter, a tall fridge whose doors open
 * (revealing lit shelves) when selected, an oven, a sink with a faucet, a
 * daylight window, and a plant. Every key object is hover-highlighted (with a
 * floating label) and clickable — selection is reported up so the module can
 * show that object's real inventory/data. Built from primitives so it needs no
 * downloaded assets; realistic GLB furniture can drop into each group later.
 */

export type KitchenObject = "fridge" | "freezer" | "pantry" | "island" | "oven" | "sink";

const WOOD = new THREE.MeshStandardMaterial({ color: "#6b4f38", roughness: 0.72, metalness: 0.05 });
const FLOOR = new THREE.MeshStandardMaterial({ color: "#8a6a49", roughness: 0.55, metalness: 0.08 });
const CAB = new THREE.MeshStandardMaterial({ color: "#20242b", roughness: 0.55, metalness: 0.15 });
const CAB_LIGHT = new THREE.MeshStandardMaterial({ color: "#e7e3da", roughness: 0.5, metalness: 0.1 });
const STONE = new THREE.MeshStandardMaterial({ color: "#eceae4", roughness: 0.25, metalness: 0.2 });
const WALL = new THREE.MeshStandardMaterial({ color: "#cfc9bf", roughness: 0.95 });
const STEEL = new THREE.MeshStandardMaterial({ color: "#c8ccd2", roughness: 0.28, metalness: 0.9 });
const DARK = new THREE.MeshStandardMaterial({ color: "#0c0e12", roughness: 0.3, metalness: 0.4 });
const GLASS = new THREE.MeshStandardMaterial({ color: "#0a1a22", roughness: 0.08, metalness: 0.3, transparent: true, opacity: 0.5 });

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

function Fridge({ selected, onSelect, label }: { selected: boolean; onSelect: (k: KitchenObject) => void; label: string }) {
  const left = useRef<THREE.Group>(null);
  const right = useRef<THREE.Group>(null);
  useFrame(() => {
    const target = selected ? 1 : 0;
    if (left.current) left.current.rotation.y = THREE.MathUtils.lerp(left.current.rotation.y, target * 2.0, 0.12);
    if (right.current) right.current.rotation.y = THREE.MathUtils.lerp(right.current.rotation.y, -target * 2.0, 0.12);
  });
  return (
    <Hoverable name={label} objectKey="fridge" onSelect={onSelect} labelY={2.4}>
      <group position={[-3.4, 0, -2.2]}>
        {/* Body */}
        <mesh position={[0, 1.1, 0]} castShadow material={STEEL}>
          <boxGeometry args={[1.3, 2.2, 1.0]} />
        </mesh>
        {/* Interior */}
        <mesh position={[0, 1.15, 0.05]} material={CAB_LIGHT}>
          <boxGeometry args={[1.15, 1.9, 0.9]} />
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
          <mesh position={[0.58, 0, 0.06]} material={DARK}>
            <boxGeometry args={[0.05, 1.0, 0.05]} />
          </mesh>
        </group>
        <group ref={right} position={[0.65, 1.1, 0.5]}>
          <mesh position={[-0.325, 0, 0]} castShadow material={STEEL}>
            <boxGeometry args={[0.65, 2.2, 0.08]} />
          </mesh>
          <mesh position={[-0.58, 0, 0.06]} material={DARK}>
            <boxGeometry args={[0.05, 1.0, 0.05]} />
          </mesh>
        </group>
      </group>
    </Hoverable>
  );
}

function Scene({ selected, onSelect, labels }: { selected: KitchenObject | null; onSelect: (k: KitchenObject) => void; labels: Record<KitchenObject, string> }) {
  return (
    <>
      {/* Floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow material={FLOOR}>
        <planeGeometry args={[16, 14]} />
      </mesh>
      {/* Walls */}
      <mesh position={[0, 2.4, -2.9]} material={WALL}>
        <boxGeometry args={[13, 4.8, 0.2]} />
      </mesh>
      <mesh position={[-5.4, 2.4, 0]} material={WALL}>
        <boxGeometry args={[0.2, 4.8, 6]} />
      </mesh>
      {/* Daylight window */}
      <mesh position={[2.2, 2.5, -2.78]}>
        <boxGeometry args={[3, 1.8, 0.06]} />
        <meshStandardMaterial color="#eaf4ff" emissive="#cfe6ff" emissiveIntensity={1.4} />
      </mesh>

      {/* Base cabinets + stone counter along back wall */}
      <mesh position={[0.6, 0.45, -2.35]} castShadow material={CAB}>
        <boxGeometry args={[6.5, 0.9, 0.7]} />
      </mesh>
      <mesh position={[0.6, 0.92, -2.35]} castShadow material={STONE}>
        <boxGeometry args={[6.6, 0.06, 0.78]} />
      </mesh>
      {/* Upper cabinets */}
      <mesh position={[1.4, 2.9, -2.7]} material={CAB}>
        <boxGeometry args={[4.4, 0.8, 0.35]} />
      </mesh>
      {/* Under-cabinet LED */}
      <mesh position={[1.4, 2.45, -2.5]}>
        <boxGeometry args={[4.2, 0.03, 0.05]} />
        <meshStandardMaterial color="#fff2d8" emissive="#ffe6b0" emissiveIntensity={1.6} />
      </mesh>

      {/* Sink + faucet */}
      <Hoverable name={labels.sink} objectKey="sink" onSelect={onSelect} labelY={1.4}>
        <group position={[-0.8, 0.93, -2.3]}>
          <mesh position={[0, -0.02, 0]} material={DARK}>
            <boxGeometry args={[0.9, 0.12, 0.5]} />
          </mesh>
          <mesh position={[0, 0.28, -0.15]} material={STEEL}>
            <cylinderGeometry args={[0.03, 0.03, 0.55, 12]} />
          </mesh>
          <mesh position={[0, 0.52, -0.02]} rotation={[Math.PI / 2, 0, 0]} material={STEEL}>
            <cylinderGeometry args={[0.03, 0.03, 0.3, 12]} />
          </mesh>
        </group>
      </Hoverable>

      {/* Oven built into the base run */}
      <Hoverable name={labels.oven} objectKey="oven" onSelect={onSelect} labelY={1.3}>
        <group position={[2.6, 0.5, -2.15]}>
          <mesh material={DARK}>
            <boxGeometry args={[0.9, 0.8, 0.1]} />
          </mesh>
          <mesh position={[0, 0.05, 0.06]} material={GLASS}>
            <boxGeometry args={[0.7, 0.5, 0.02]} />
          </mesh>
          {[-0.3, -0.1, 0.1, 0.3].map((x) => (
            <mesh key={x} position={[x, 0.32, 0.07]}>
              <cylinderGeometry args={[0.03, 0.03, 0.04, 12]} />
              <meshStandardMaterial color="#ff7847" emissive="#ff5a24" emissiveIntensity={1.2} />
            </mesh>
          ))}
        </group>
      </Hoverable>

      {/* Pantry (tall cabinet, right) */}
      <Hoverable name={labels.pantry} objectKey="pantry" onSelect={onSelect} labelY={2.4}>
        <mesh position={[4.4, 1.1, -2.4]} castShadow material={CAB_LIGHT}>
          <boxGeometry args={[1.3, 2.2, 0.7]} />
        </mesh>
      </Hoverable>

      {/* Fridge + freezer */}
      <Fridge selected={selected === "fridge"} onSelect={onSelect} label={labels.fridge} />
      <Hoverable name={labels.freezer} objectKey="freezer" onSelect={onSelect} labelY={0.9}>
        <mesh position={[-3.4, 0.35, -1.4]} castShadow material={STEEL}>
          <boxGeometry args={[1.3, 0.7, 1.0]} />
        </mesh>
      </Hoverable>

      {/* Island + quartz top */}
      <Hoverable name={labels.island} objectKey="island" onSelect={onSelect} labelY={1.5}>
        <group position={[0.4, 0, 0.6]}>
          <mesh position={[0, 0.45, 0]} castShadow material={CAB}>
            <boxGeometry args={[2.6, 0.9, 1.3]} />
          </mesh>
          <mesh position={[0, 0.93, 0]} castShadow material={STONE}>
            <boxGeometry args={[2.8, 0.08, 1.5]} />
          </mesh>
        </group>
      </Hoverable>
      {/* Bar stools */}
      {[-0.6, 0.6].map((x) => (
        <group key={x} position={[0.4 + x, 0, 1.7]}>
          <mesh position={[0, 0.6, 0]} castShadow material={WOOD}>
            <cylinderGeometry args={[0.22, 0.22, 0.08, 20]} />
          </mesh>
          <mesh position={[0, 0.3, 0]} material={STEEL}>
            <cylinderGeometry args={[0.04, 0.04, 0.6, 12]} />
          </mesh>
        </group>
      ))}

      {/* Coffee station */}
      <group position={[-2.4, 0.98, -2.3]}>
        <mesh material={DARK}>
          <boxGeometry args={[0.35, 0.4, 0.3]} />
        </mesh>
        <mesh position={[0, -0.15, 0.2]} material={CAB_LIGHT}>
          <cylinderGeometry args={[0.06, 0.05, 0.1, 16]} />
        </mesh>
      </group>

      {/* Plant */}
      <group position={[3.9, 1.0, 0.2]}>
        <mesh material={WOOD}>
          <cylinderGeometry args={[0.16, 0.12, 0.3, 16]} />
        </mesh>
        <mesh position={[0, 0.3, 0]}>
          <sphereGeometry args={[0.28, 16, 16]} />
          <meshStandardMaterial color="#3f7d43" roughness={0.9} />
        </mesh>
      </group>

      <ContactShadows position={[0, 0.01, 0]} opacity={0.4} scale={18} blur={2.4} far={8} resolution={512} color="#000000" />
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
      camera={{ position: [5.5, 3.4, 5.5], fov: 42 }}
      gl={{ antialias: true, alpha: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05 }}
      style={{ touchAction: "none" }}
    >
      <color attach="background" args={["#0b0b0d"]} />
      <ambientLight intensity={0.5} />
      <directionalLight position={[4, 7, 3]} intensity={2.2} color="#fff2df" castShadow shadow-mapSize={[2048, 2048]} shadow-bias={-0.0004} />
      <directionalLight position={[-4, 4, -3]} intensity={0.5} color="#bcd4ff" />
      <Suspense fallback={null}>
        <Environment preset="apartment" environmentIntensity={0.5} />
      </Suspense>

      <Scene selected={selected} onSelect={onSelect} labels={labels} />

      <OrbitControls
        enablePan={false}
        minDistance={4}
        maxDistance={12}
        minPolarAngle={0.3}
        maxPolarAngle={Math.PI / 2.15}
        target={[0.3, 1, -0.5]}
        enableDamping
        dampingFactor={0.08}
      />
      <EffectComposer multisampling={0} enableNormalPass={false}>
        <Bloom luminanceThreshold={0.7} luminanceSmoothing={0.9} intensity={0.5} mipmapBlur radius={0.6} />
      </EffectComposer>
    </Canvas>
  );
}
