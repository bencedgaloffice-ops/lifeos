"use client";

import { useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Line } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import * as THREE from "three";
import type { LifeMapLocation } from "@/lib/types";
import { StarField } from "./StarField";

const CATEGORY_COLOR: Record<string, string> = {
  home: "#F5A15E",
  agriculture: "#10B981",
  work: "#3B82F6",
  travel: "#F472B6",
  other: "#67E8F9",
};

const WORLD_SIZE = 12;
const CAMERA_TARGET: [number, number, number] = [0, 7.5, 9.5];
const CAMERA_START: [number, number, number] = [0, 16, 20];

function toWorld(loc: LifeMapLocation): [number, number] {
  return [(loc.position_x / 1000) * WORLD_SIZE - WORLD_SIZE / 2, (loc.position_y / 1000) * WORLD_SIZE - WORLD_SIZE / 2];
}

/** A stylized, procedurally-displaced terrain plate — an artistic relief,
 * not real elevation data (per the "custom stylized 3D" design decision). */
function Terrain() {
  const geometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(WORLD_SIZE + 4, WORLD_SIZE + 4, 90, 90);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const h =
        Math.sin(x * 0.55) * Math.cos(y * 0.45) * 0.32 +
        Math.sin(x * 1.3 + y * 0.6) * 0.12 +
        Math.sin(x * 0.15 + y * 0.2) * 0.4;
      pos.setZ(i, h);
    }
    geo.computeVertexNormals();
    return geo;
  }, []);

  return (
    <mesh geometry={geometry} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <meshStandardMaterial color="#0b241f" roughness={0.95} metalness={0.05} />
    </mesh>
  );
}

/** Smoothly dollies the camera in from a high aerial view down to its
 * resting orbit on mount — the same "arrival" beat as the landing globe.
 * OrbitControls only mounts once this finishes, so the two never fight
 * over camera position. */
function CameraIntro({ onDone }: { onDone: () => void }) {
  const { camera } = useThree();
  const elapsed = useRef(0);
  const done = useRef(false);

  useFrame((_, delta) => {
    if (done.current) return;
    elapsed.current += delta;
    const t = Math.min(elapsed.current / 1.8, 1);
    const eased = 1 - Math.pow(1 - t, 3);
    camera.position.lerpVectors(new THREE.Vector3(...CAMERA_START), new THREE.Vector3(...CAMERA_TARGET), eased);
    camera.lookAt(0, 0, 0);
    if (t >= 1) {
      done.current = true;
      onDone();
    }
  });

  return null;
}

function Pin({
  loc,
  active,
  onSelect,
  progress,
}: {
  loc: LifeMapLocation;
  active: boolean;
  onSelect: (id: string) => void;
  progress?: { total: number; completed: number };
}) {
  const [x, z] = toWorld(loc);
  const color = CATEGORY_COLOR[loc.category] ?? CATEGORY_COLOR.other;
  const sphereRef = useRef<THREE.Mesh>(null);
  const complete = Boolean(progress && progress.total > 0 && progress.completed === progress.total);
  const inProgress = Boolean(progress && progress.total > 0 && progress.completed < progress.total);

  useFrame(({ clock }) => {
    if (sphereRef.current) {
      sphereRef.current.position.y = 0.95 + Math.sin(clock.elapsedTime * 1.6 + x) * 0.05;
    }
  });

  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.45, 0]}>
        <cylinderGeometry args={[0.015, 0.015, 0.9, 8]} />
        <meshBasicMaterial color={color} transparent opacity={0.45} />
      </mesh>
      <mesh
        ref={sphereRef}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(loc.id);
        }}
        onPointerOver={() => {
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          document.body.style.cursor = "default";
        }}
      >
        <sphereGeometry args={[active ? 0.17 : 0.12, 20, 20]} />
        <meshStandardMaterial
          color={color}
          emissive={complete ? "#FDE68A" : color}
          emissiveIntensity={active ? 2.4 : complete ? 2.1 : 1.3}
        />
      </mesh>
      {active && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
          <ringGeometry args={[0.24, 0.3, 32]} />
          <meshBasicMaterial color={color} transparent opacity={0.6} side={THREE.DoubleSide} />
        </mesh>
      )}
      {/* A thin achievement ring marks a location whose linked goals are all
          complete — the map doubles as a quiet progress readout. */}
      {complete && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 0]}>
          <ringGeometry args={[0.19, 0.22, 32]} />
          <meshBasicMaterial color="#FDE68A" transparent opacity={0.85} side={THREE.DoubleSide} />
        </mesh>
      )}
      {inProgress && !active && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 0]}>
          <ringGeometry args={[0.17, 0.19, 32]} />
          <meshBasicMaterial color={color} transparent opacity={0.35} side={THREE.DoubleSide} />
        </mesh>
      )}
    </group>
  );
}

/** Faint links from "home" out to every other pin — a simple life-network read. */
function ConnectionLines({ locations }: { locations: LifeMapLocation[] }) {
  const home = locations.find((l) => l.category === "home") ?? locations[0];
  if (!home) return null;
  const [hx, hz] = toWorld(home);

  return (
    <>
      {locations
        .filter((l) => l.id !== home.id)
        .map((l) => {
          const [x, z] = toWorld(l);
          return (
            <Line
              key={l.id}
              points={[
                [hx, 0.05, hz],
                [x, 0.05, z],
              ]}
              color="#5EEAD4"
              opacity={0.3}
              transparent
              lineWidth={1}
            />
          );
        })}
    </>
  );
}

export function LifeMap({
  locations,
  selectedId,
  onSelect,
  progress,
}: {
  locations: LifeMapLocation[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  progress?: Record<string, { total: number; completed: number }>;
}) {
  const [ready, setReady] = useState(false);

  return (
    <Canvas camera={{ position: CAMERA_START, fov: 42 }} dpr={[1, 2]} onPointerMissed={() => onSelect("")}>
      <color attach="background" args={["#050a08"]} />
      <fog attach="fog" args={["#050a08", 9, 23]} />
      <ambientLight intensity={0.4} />
      <directionalLight position={[6, 9, 4]} intensity={1.1} color="#bfe3ff" />
      <directionalLight position={[-6, 4, -4]} intensity={0.25} color="#5EEAD4" />
      <StarField />
      {!ready && <CameraIntro onDone={() => setReady(true)} />}
      <Terrain />
      <gridHelper args={[WORLD_SIZE + 4, 32, "#1c4a3f", "#0e2622"]} position={[0, 0.015, 0]} />
      <ConnectionLines locations={locations} />
      {locations.map((loc) => (
        <Pin key={loc.id} loc={loc} active={loc.id === selectedId} onSelect={onSelect} progress={progress?.[loc.id]} />
      ))}
      {ready && (
        <OrbitControls
          enablePan
          minDistance={4}
          maxDistance={17}
          maxPolarAngle={Math.PI / 2.15}
          target={[0, 0, 0]}
          autoRotate
          autoRotateSpeed={0.25}
        />
      )}
      <EffectComposer>
        <Bloom luminanceThreshold={0.25} luminanceSmoothing={0.9} intensity={0.55} mipmapBlur />
      </EffectComposer>
    </Canvas>
  );
}
