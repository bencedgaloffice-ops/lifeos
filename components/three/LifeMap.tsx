"use client";

import { useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Line, Html, Trail } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import * as THREE from "three";
import { ChevronRight } from "lucide-react";
import type { LifeMapLocation } from "@/lib/types";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { StarField } from "./StarField";
import { HUNGARY_BORDER, projectLonLat } from "@/lib/hungary-geo";
import { LOCATION_CLUSTERS, type LocationCluster } from "@/lib/hungary-locations";
import { ROADS } from "@/lib/hungary-roads";
import { computeVehicleState, type VehicleState } from "@/lib/vehicle-sim";

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
const CAMERA_TARGET: [number, number, number] = [0, 7.5, 9.5];
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

/** A soft glowing outline traced along Hungary's real border, sitting right
 * on the landmass's top edge — two stacked lines (a bright core, a wider
 * translucent halo) so Bloom picks it up as a genuine glow, not a flat
 * outline. */
function BorderGlow() {
  const points = useMemo<[number, number, number][]>(
    () => HUNGARY_BORDER.map(([lon, lat]) => {
      const [x, z] = projectLonLat(lon, lat, WORLD_SIZE);
      return [x, GROUND_Y + 0.01, z];
    }),
    [],
  );

  return (
    <>
      <Line points={points} color="#8FE3FF" lineWidth={2.5} transparent opacity={0.9} />
      <Line points={points} color="#8FE3FF" lineWidth={7} transparent opacity={0.25} />
    </>
  );
}

/** Hungary's real motorway network (M0 ring + M1/M3/M5/M7 spokes) traced
 * onto the terrain — a warm asphalt glow distinct from the border's cool
 * cyan, with a small floating label at each road's midpoint so it reads as
 * "M1", "M3", etc., not an unlabeled line. The vehicle's own routes ride
 * these exact same points (see lib/vehicle-routes.ts). */
function RoadNetwork() {
  return (
    <>
      {ROADS.map((road) => {
        const points: [number, number, number][] = road.path.map(([lon, lat]) => {
          const [x, z] = projectLonLat(lon, lat, WORLD_SIZE);
          return [x, GROUND_Y + 0.008, z];
        });
        const mid = points[Math.floor(points.length / 2)];
        return (
          <group key={road.key}>
            <Line points={points} color="#F3C969" lineWidth={1.6} transparent opacity={0.75} />
            <Line points={points} color="#F3C969" lineWidth={4.5} transparent opacity={0.18} />
            <Html center distanceFactor={10} position={mid} occlude={false}>
              <span className="whitespace-nowrap rounded-full border border-amber-200/25 bg-black/50 px-1.5 py-0.5 text-[0.55rem] font-semibold tracking-wide text-amber-100/80 backdrop-blur-sm">
                {road.label}
              </span>
            </Html>
          </group>
        );
      })}
    </>
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

/** One of the five real places LifeOS's sections live geographically
 * (Budapest, Diósd, Somogy, Balaton, the Germany route) — an animated
 * glowing marker that expands into its section shortcuts on hover/click. */
function LocationClusterPin({ cluster, onNavigate }: { cluster: LocationCluster; onNavigate: (href: string) => void }) {
  const { t } = useLocale();
  const [x, z] = projectLonLat(cluster.lon, cluster.lat, WORLD_SIZE);
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState(false);
  const markerRef = useRef<THREE.Mesh>(null);
  const Icon = cluster.icon;
  const scale = hovered || open ? 1.35 : 1;

  useFrame(({ clock }) => {
    if (markerRef.current) {
      markerRef.current.position.y = GROUND_Y + 0.4 + Math.sin(clock.elapsedTime * 1.3 + x) * 0.05;
    }
  });

  return (
    <group position={[x, 0, z]}>
      {/* Ground halo ring — a soft footprint under the marker. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, GROUND_Y + 0.012, 0]}>
        <ringGeometry args={[0.2, 0.32, 32]} />
        <meshBasicMaterial color={cluster.color} transparent opacity={hovered || open ? 0.55 : 0.3} side={THREE.DoubleSide} />
      </mesh>

      <mesh
        ref={markerRef}
        scale={scale}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        onPointerOver={() => {
          setHovered(true);
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          setHovered(false);
          document.body.style.cursor = "default";
        }}
      >
        <sphereGeometry args={[0.13, 20, 20]} />
        <meshStandardMaterial color={cluster.color} emissive={cluster.color} emissiveIntensity={hovered || open ? 2.6 : 1.7} />
      </mesh>

      <Html center distanceFactor={9} position={[0, cluster.labelOffsetY ?? 1.05, 0]} occlude={false}>
        {open ? (
          <div
            className="w-56 select-none rounded-2xl border p-3 text-left backdrop-blur-md"
            style={{ background: "rgba(6,11,10,0.88)", borderColor: `${cluster.color}55`, boxShadow: `0 0 32px -6px ${cluster.color}aa` }}
          >
            <button
              onClick={(e) => {
                e.stopPropagation();
                setOpen(false);
              }}
              className="mb-1.5 flex w-full items-center gap-2 text-left"
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: `${cluster.color}22`, color: cluster.color }}>
                <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
              </span>
              <span className="text-sm font-semibold text-white">{t(`homeMap.${cluster.nameKey}`)}</span>
            </button>
            <p className="mb-2 text-[0.7rem] leading-relaxed text-white/50">{t(`homeMap.${cluster.previewKey}`)}</p>
            <div className="space-y-1">
              {cluster.items.map((item) => {
                const ItemIcon = item.icon;
                return (
                  <button
                    key={item.key}
                    onClick={(e) => {
                      e.stopPropagation();
                      onNavigate(item.href);
                    }}
                    className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-xs text-white/75 transition-colors hover:bg-white/[0.06] hover:text-white"
                  >
                    <span className="flex items-center gap-1.5">
                      <ItemIcon className="h-3.5 w-3.5" strokeWidth={1.75} />
                      {t(`homeMap.${item.labelKey}`)}
                    </span>
                    <ChevronRight className="h-3 w-3 opacity-50" />
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <button
            onClick={() => setOpen(true)}
            className="whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium text-white/85 backdrop-blur-md transition-transform hover:-translate-y-0.5"
            style={{ background: "rgba(6,11,10,0.72)", borderColor: `${cluster.color}55`, boxShadow: hovered ? `0 0 24px -6px ${cluster.color}aa` : undefined }}
          >
            {t(`homeMap.${cluster.nameKey}`)}
          </button>
        )}
      </Html>
    </group>
  );
}

const STATUS_COLOR: Record<VehicleState["status"], string> = {
  driving: "#67E8F9",
  returning: "#67E8F9",
  working: "#FBBF24",
  arrived: "#34D399",
  waiting: "#9CA3AF",
};

/** The living vehicle — follows the hand-modeled road corridors between
 * Diósd, ICSB, Budapest, Somogy, and the Germany route on a continuously
 * repeating simulated schedule (lib/vehicle-sim.ts). Headlights and a
 * brighter trail switch on during the loop's simulated night. Clicking it
 * opens the operational status panel (handled by the parent module). */
function VehicleMarker({ onOpen }: { onOpen: (state: VehicleState) => void }) {
  const groupRef = useRef<THREE.Group>(null);
  const bodyRef = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);
  const lastHeading = useRef(0);

  useFrame(() => {
    const state = computeVehicleState();
    const [x, z] = projectLonLat(state.position[0], state.position[1], WORLD_SIZE);
    if (groupRef.current) {
      const dx = x - groupRef.current.position.x;
      const dz = z - groupRef.current.position.z;
      groupRef.current.position.set(x, GROUND_Y + 0.06, z);
      if (dx * dx + dz * dz > 0.00001) {
        lastHeading.current = Math.atan2(dx, dz);
      }
      groupRef.current.rotation.y = lastHeading.current;
    }
    if (bodyRef.current) {
      const s = hovered ? 1.5 : 1;
      bodyRef.current.scale.setScalar(s);
    }
  });

  const state = computeVehicleState();
  const color = STATUS_COLOR[state.status];

  return (
    <Trail width={state.speedFactor > 0 ? 2.2 : 0} length={5} color={color} attenuation={(t) => t * t} local>
      <group
        ref={groupRef}
        onClick={(e) => {
          e.stopPropagation();
          onOpen(computeVehicleState());
        }}
        onPointerOver={() => {
          setHovered(true);
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          setHovered(false);
          document.body.style.cursor = "default";
        }}
      >
        {/* A small stylized car, not a directionless cone — nose faces local
            +Z, matching the heading rotation applied to the parent group, so
            it visibly turns to face the way it's actually driving. */}
        <group ref={bodyRef}>
          <mesh position={[0, 0.045, 0]} castShadow>
            <boxGeometry args={[0.095, 0.05, 0.19]} />
            <meshStandardMaterial color="#D8DEE4" roughness={0.35} metalness={0.55} />
          </mesh>
          <mesh position={[0, 0.085, -0.015]} castShadow>
            <boxGeometry args={[0.075, 0.04, 0.1]} />
            <meshStandardMaterial color="#141a1f" roughness={0.2} metalness={0.4} />
          </mesh>
          {/* Roof light bar — carries the status color, the one part of the
              car that isn't just neutral bodywork. */}
          <mesh position={[0, 0.108, -0.015]}>
            <boxGeometry args={[0.05, 0.012, 0.05]} />
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={2.2} />
          </mesh>
          {/* Headlights (front, +Z) / taillights (back, -Z). */}
          <mesh position={[0.03, 0.045, 0.096]}>
            <sphereGeometry args={[0.014, 8, 8]} />
            <meshStandardMaterial color="#fff6d8" emissive="#fff6d8" emissiveIntensity={state.isNight ? 3 : 1.2} />
          </mesh>
          <mesh position={[-0.03, 0.045, 0.096]}>
            <sphereGeometry args={[0.014, 8, 8]} />
            <meshStandardMaterial color="#fff6d8" emissive="#fff6d8" emissiveIntensity={state.isNight ? 3 : 1.2} />
          </mesh>
          <mesh position={[0.032, 0.045, -0.096]}>
            <sphereGeometry args={[0.011, 8, 8]} />
            <meshStandardMaterial color="#dc2626" emissive="#dc2626" emissiveIntensity={1.4} />
          </mesh>
          <mesh position={[-0.032, 0.045, -0.096]}>
            <sphereGeometry args={[0.011, 8, 8]} />
            <meshStandardMaterial color="#dc2626" emissive="#dc2626" emissiveIntensity={1.4} />
          </mesh>
          {/* Wheels. */}
          {[
            [0.05, 0.07],
            [0.05, -0.07],
            [-0.05, 0.07],
            [-0.05, -0.07],
          ].map(([wx, wz], i) => (
            <mesh key={i} position={[wx, 0.02, wz]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.02, 0.02, 0.018, 12]} />
              <meshStandardMaterial color="#0e0e10" roughness={0.8} />
            </mesh>
          ))}
        </group>
        {/* Headlight glow — only bright during the loop's simulated night. */}
        <pointLight position={[0, 0.06, 0.12]} intensity={state.isNight ? 0.9 : 0.15} distance={1.2} color="#fff6d8" />
      </group>
    </Trail>
  );
}

export function LifeMap({
  locations,
  selectedId,
  onSelect,
  progress,
  navPins = false,
  onNavigate,
  onOpenVehicle,
}: {
  locations: LifeMapLocation[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  progress?: Record<string, { total: number; completed: number }>;
  /** Renders the Budapest/Diósd/Somogy/Balaton/Germany location clusters and
   * the living vehicle — used on the home screen, off on the plain map view. */
  navPins?: boolean;
  onNavigate?: (href: string) => void;
  onOpenVehicle?: (state: VehicleState) => void;
}) {
  const [ready, setReady] = useState(false);

  return (
    <Canvas camera={{ position: CAMERA_START, fov: 42 }} dpr={[1, 2]} onPointerMissed={() => onSelect("")}>
      <color attach="background" args={["#050a08"]} />
      <fog attach="fog" args={["#050a08", 9, 23]} />
      <ambientLight intensity={0.4} />
      <directionalLight position={[6, 9, 4]} intensity={1.15} color="#bfe3ff" />
      <directionalLight position={[-6, 4, -4]} intensity={0.25} color="#5EEAD4" />
      <StarField />
      {!ready && <CameraIntro onDone={() => setReady(true)} />}
      <SurroundingTerrain />
      <HungaryLandmass />
      <BorderGlow />
      <gridHelper args={[WORLD_SIZE + 5, 40, "#1c4a3f", "#0e2622"]} position={[0, -0.075, 0]} />
      <ConnectionLines locations={locations} />
      {locations.map((loc) => (
        <Pin key={loc.id} loc={loc} active={loc.id === selectedId} onSelect={onSelect} progress={progress?.[loc.id]} />
      ))}
      {navPins && (
        <>
          <RoadNetwork />
          {LOCATION_CLUSTERS.map((cluster) => (
            <LocationClusterPin key={cluster.key} cluster={cluster} onNavigate={onNavigate ?? (() => {})} />
          ))}
          <VehicleMarker onOpen={onOpenVehicle ?? (() => {})} />
        </>
      )}
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
