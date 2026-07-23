"use client";

import { useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Line, Html } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import * as THREE from "three";
import type { LifeMapLocation } from "@/lib/types";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { StarField } from "./StarField";
import { HUNGARY_BORDER, projectLonLat } from "@/lib/hungary-geo";
import { layoutNavPins, type NavPinPosition } from "@/lib/module-nav-pins";

const CATEGORY_COLOR: Record<string, string> = {
  home: "#F5A15E",
  agriculture: "#10B981",
  work: "#3B82F6",
  travel: "#F472B6",
  other: "#67E8F9",
};

const WORLD_SIZE = 12;
/** Height of Hungary's raised landmass above the surrounding base plate —
 * pins and connection lines sit at this level, not at y=0. */
const GROUND_Y = 0.2;
/** With the nav-pin ring showing (home screen), the resting shot needs to
 * be wider so all 17 orbiting portals stay in frame, not just Hungary. */
const CAMERA_TARGET: [number, number, number] = [0, 7.5, 9.5];
const CAMERA_TARGET_WIDE: [number, number, number] = [0, 10.5, 13];
const CAMERA_START: [number, number, number] = [0, 16, 20];

/** A saved location's position_x/position_y are real longitude/latitude —
 * this projects them onto the local ground plane. */
function toWorld(loc: LifeMapLocation): [number, number] {
  return projectLonLat(loc.position_x, loc.position_y, WORLD_SIZE);
}

/** Hungary's actual national border, extruded into a raised, lit landmass —
 * the recognizable silhouette the map was missing, not a generic plate. */
function HungaryLandmass() {
  const geometry = useMemo(() => {
    const shape = new THREE.Shape();
    HUNGARY_BORDER.forEach(([lon, lat], i) => {
      const [x, z] = projectLonLat(lon, lat, WORLD_SIZE);
      // The mesh is rotated -90° about X below, which maps a shape's local
      // (x, y) to world (x, -y) — negate z here so the final world Z matches
      // every pin's own projectLonLat output.
      if (i === 0) shape.moveTo(x, -z);
      else shape.lineTo(x, -z);
    });
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: GROUND_Y,
      bevelEnabled: true,
      bevelThickness: 0.035,
      bevelSize: 0.05,
      bevelSegments: 3,
      curveSegments: 6,
    });
    geo.computeVertexNormals();
    return geo;
  }, []);

  return (
    <mesh geometry={geometry} rotation={[-Math.PI / 2, 0, 0]} receiveShadow castShadow>
      <meshStandardMaterial color="#123626" roughness={0.82} metalness={0.12} />
    </mesh>
  );
}

/** The surrounding region beyond Hungary's border — a dimmer, lower plate so
 * the country itself reads as the raised, lit centerpiece. Travel pins for
 * trips abroad land out here, past the silhouette's edge. */
function SurroundingTerrain() {
  const geometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(WORLD_SIZE + 5, WORLD_SIZE + 5, 60, 60);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const h = Math.sin(x * 0.4) * Math.cos(y * 0.35) * 0.1 + Math.sin(x * 0.9 + y * 0.5) * 0.04;
      pos.setZ(i, h);
    }
    geo.computeVertexNormals();
    return geo;
  }, []);

  return (
    <mesh geometry={geometry} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.08, 0]} receiveShadow>
      <meshStandardMaterial color="#060f0c" roughness={0.97} metalness={0.02} />
    </mesh>
  );
}

/** Smoothly dollies the camera in from a high aerial view down to its
 * resting orbit on mount — the same "arrival" beat as the landing globe.
 * OrbitControls only mounts once this finishes, so the two never fight
 * over camera position. */
function CameraIntro({ onDone, wide }: { onDone: () => void; wide: boolean }) {
  const { camera } = useThree();
  const elapsed = useRef(0);
  const done = useRef(false);
  const target = wide ? CAMERA_TARGET_WIDE : CAMERA_TARGET;

  useFrame((_, delta) => {
    if (done.current) return;
    elapsed.current += delta;
    const t = Math.min(elapsed.current / 1.8, 1);
    const eased = 1 - Math.pow(1 - t, 3);
    camera.position.lerpVectors(new THREE.Vector3(...CAMERA_START), new THREE.Vector3(...target), eased);
    camera.lookAt(0, GROUND_Y, 0);
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
      sphereRef.current.position.y = GROUND_Y + 0.95 + Math.sin(clock.elapsedTime * 1.6 + x) * 0.05;
    }
  });

  return (
    <group position={[x, GROUND_Y, z]}>
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
                [hx, GROUND_Y + 0.05, hz],
                [x, GROUND_Y + 0.05, z],
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

const NAV_RING_RADIUS = 6.5;

/** A module shortcut orbiting Hungary — the sidebar's "pages on the sides"
 * turned into a clickable place on the map. A floating glass chip (rendered
 * via drei's Html so it can reuse real DOM/Tailwind styling) sits above a
 * small glowing marker in the module's own accent color. */
function NavPin({ pin, onNavigate }: { pin: NavPinPosition; onNavigate: (href: string) => void }) {
  const { t } = useLocale();
  const Icon = pin.icon;
  const markerRef = useRef<THREE.Mesh>(null);
  const label = t(`nav.${pin.key}.label`);

  useFrame(({ clock }) => {
    if (markerRef.current) {
      markerRef.current.position.y = -0.08 + 0.3 + Math.sin(clock.elapsedTime * 1.4 + pin.x) * 0.04;
    }
  });

  return (
    <group position={[pin.x, 0, pin.z]}>
      <mesh
        ref={markerRef}
        onClick={(e) => {
          e.stopPropagation();
          onNavigate(pin.href);
        }}
        onPointerOver={() => {
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          document.body.style.cursor = "default";
        }}
      >
        <sphereGeometry args={[0.09, 16, 16]} />
        <meshStandardMaterial color={pin.color} emissive={pin.color} emissiveIntensity={1.6} />
      </mesh>
      <Html center distanceFactor={9} position={[0, 0.85, 0]} occlude={false}>
        <button
          onClick={() => onNavigate(pin.href)}
          className="flex select-none flex-col items-center gap-1 rounded-2xl border px-3 py-2 text-center backdrop-blur-md transition-transform hover:-translate-y-0.5"
          style={{
            background: "rgba(8,14,12,0.72)",
            borderColor: `${pin.color}55`,
            boxShadow: `0 0 24px -8px ${pin.color}99`,
          }}
        >
          <span
            className="flex h-7 w-7 items-center justify-center rounded-full"
            style={{ backgroundColor: `${pin.color}22`, color: pin.soft }}
          >
            <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
          </span>
          <span className="whitespace-nowrap text-[0.65rem] font-medium text-white/85">{label}</span>
        </button>
      </Html>
    </group>
  );
}

export function LifeMap({
  locations,
  selectedId,
  onSelect,
  progress,
  navPins = false,
  onNavigate,
}: {
  locations: LifeMapLocation[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  progress?: Record<string, { total: number; completed: number }>;
  /** Renders the sidebar's modules as a ring of clickable portals orbiting
   * Hungary — used on the home screen, off by default on the plain map page. */
  navPins?: boolean;
  onNavigate?: (href: string) => void;
}) {
  const [ready, setReady] = useState(false);
  const pins = useMemo(() => (navPins ? layoutNavPins(NAV_RING_RADIUS) : []), [navPins]);

  return (
    <Canvas camera={{ position: CAMERA_START, fov: 42 }} dpr={[1, 2]} onPointerMissed={() => onSelect("")}>
      <color attach="background" args={["#050a08"]} />
      <fog attach="fog" args={["#050a08", 9, 23]} />
      <ambientLight intensity={0.4} />
      <directionalLight position={[6, 9, 4]} intensity={1.15} color="#bfe3ff" />
      <directionalLight position={[-6, 4, -4]} intensity={0.25} color="#5EEAD4" />
      <StarField />
      {!ready && <CameraIntro onDone={() => setReady(true)} wide={navPins} />}
      <SurroundingTerrain />
      <HungaryLandmass />
      <gridHelper args={[WORLD_SIZE + 5, 40, "#1c4a3f", "#0e2622"]} position={[0, -0.075, 0]} />
      <ConnectionLines locations={locations} />
      {locations.map((loc) => (
        <Pin key={loc.id} loc={loc} active={loc.id === selectedId} onSelect={onSelect} progress={progress?.[loc.id]} />
      ))}
      {pins.map((pin) => (
        <NavPin key={pin.key} pin={pin} onNavigate={onNavigate ?? (() => {})} />
      ))}
      {ready && (
        <OrbitControls
          enablePan
          minDistance={4}
          maxDistance={17}
          maxPolarAngle={Math.PI / 2.15}
          target={[0, GROUND_Y, 0]}
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
