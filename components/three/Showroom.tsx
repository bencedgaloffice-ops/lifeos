"use client";

import { Component, Suspense, useRef, type ReactNode } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, ContactShadows, Environment, MeshReflectorMaterial } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import * as THREE from "three";
import { VehicleModel } from "./VehicleModel";

/**
 * The luxury showroom stage — a shared, data-driven environment.
 *
 * The environment, lighting, reflections, turntable, fog and post-processing
 * are constant; only the vehicle changes. If a `modelUrl` (standardized GLB)
 * is supplied it is loaded dynamically and normalized onto the platform;
 * otherwise a stylized primitive SUV stands in. A load error falls back to the
 * same stylized SUV, so a bad/missing model never breaks the scene. This is
 * what lets the engine display any real European vehicle without code changes.
 */

/* ---- stylized fallback vehicle (no downloaded assets required) ---- */
function StylizedSUV({ accent }: { accent: string }) {
  const body = new THREE.MeshStandardMaterial({ color: "#0c0f14", metalness: 0.9, roughness: 0.28 });
  const trim = new THREE.MeshStandardMaterial({ color: "#c7d2dd", metalness: 1, roughness: 0.2 });
  const glass = new THREE.MeshStandardMaterial({ color: "#0a1420", metalness: 0.6, roughness: 0.1, transparent: true, opacity: 0.85 });
  const tire = new THREE.MeshStandardMaterial({ color: "#0a0a0c", metalness: 0.2, roughness: 0.8 });
  const rim = new THREE.MeshStandardMaterial({ color: "#dfe7ef", metalness: 1, roughness: 0.15 });
  const head = new THREE.MeshStandardMaterial({ color: "#fdf6d8", emissive: "#fff3c4", emissiveIntensity: 2.2 });
  const tail = new THREE.MeshStandardMaterial({ color: "#ff2d3f", emissive: "#ff2d3f", emissiveIntensity: 2 });
  const glow = new THREE.MeshStandardMaterial({ color: accent, emissive: accent, emissiveIntensity: 1.4 });

  const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.32, 24);
  const rimGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.34, 20);
  const wheelPositions: [number, number, number][] = [
    [1.35, 0.42, 0.95],
    [1.35, 0.42, -0.95],
    [-1.35, 0.42, 0.95],
    [-1.35, 0.42, -0.95],
  ];

  return (
    <group>
      <mesh position={[0, 0.7, 0]} castShadow material={body}>
        <boxGeometry args={[4.3, 0.85, 2.0]} />
      </mesh>
      <mesh position={[0, 0.42, 0]} material={body}>
        <boxGeometry args={[4.0, 0.4, 1.85]} />
      </mesh>
      <mesh position={[-0.15, 1.28, 0]} castShadow material={body}>
        <boxGeometry args={[2.5, 0.72, 1.82]} />
      </mesh>
      <mesh position={[-0.15, 1.3, 0.92]} material={glass}>
        <boxGeometry args={[2.35, 0.62, 0.02]} />
      </mesh>
      <mesh position={[-0.15, 1.3, -0.92]} material={glass}>
        <boxGeometry args={[2.35, 0.62, 0.02]} />
      </mesh>
      <mesh position={[1.15, 1.3, 0]} rotation={[0, 0, -0.5]} material={glass}>
        <boxGeometry args={[0.5, 0.7, 1.78]} />
      </mesh>
      <mesh position={[0, 1.05, 0.98]} material={trim}>
        <boxGeometry args={[3.6, 0.05, 0.04]} />
      </mesh>
      <mesh position={[0, 1.05, -0.98]} material={trim}>
        <boxGeometry args={[3.6, 0.05, 0.04]} />
      </mesh>
      <mesh position={[2.16, 0.75, 0]} material={trim}>
        <boxGeometry args={[0.06, 0.5, 1.5]} />
      </mesh>
      <mesh position={[2.17, 0.62, 0]} material={glow}>
        <boxGeometry args={[0.04, 0.06, 1.4]} />
      </mesh>
      <mesh position={[2.17, 0.9, 0.7]} material={head}>
        <boxGeometry args={[0.05, 0.14, 0.34]} />
      </mesh>
      <mesh position={[2.17, 0.9, -0.7]} material={head}>
        <boxGeometry args={[0.05, 0.14, 0.34]} />
      </mesh>
      <mesh position={[-2.16, 0.95, 0.75]} material={tail}>
        <boxGeometry args={[0.05, 0.28, 0.22]} />
      </mesh>
      <mesh position={[-2.16, 0.95, -0.75]} material={tail}>
        <boxGeometry args={[0.05, 0.28, 0.22]} />
      </mesh>
      {wheelPositions.map((p, i) => (
        <group key={i} position={p} rotation={[Math.PI / 2, 0, 0]}>
          <mesh geometry={wheelGeo} material={tire} castShadow />
          <mesh geometry={rimGeo} material={rim} />
        </group>
      ))}
    </group>
  );
}

/* ---- error boundary so a bad GLB URL never crashes the scene ---- */
class ModelBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidUpdate(prev: { children: ReactNode }) {
    // Reset when the child (vehicle) changes so a new URL gets a fresh try.
    if (prev.children !== this.props.children && this.state.failed) this.setState({ failed: false });
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function Stage({ accent, modelUrl }: { accent: string; modelUrl?: string }) {
  const group = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (group.current) group.current.rotation.y += dt * 0.18;
  });
  const stylized = <StylizedSUV accent={accent} />;
  return (
    <>
      <group ref={group}>
        {modelUrl ? (
          <ModelBoundary fallback={stylized}>
            <Suspense fallback={stylized}>
              <VehicleModel url={modelUrl} />
            </Suspense>
          </ModelBoundary>
        ) : (
          stylized
        )}
        <mesh position={[0, 0.02, 0]} receiveShadow>
          <cylinderGeometry args={[3.1, 3.1, 0.08, 64]} />
          <meshStandardMaterial color="#0a0d12" metalness={0.8} roughness={0.35} />
        </mesh>
        <mesh position={[0, 0.06, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[3.1, 0.03, 16, 90]} />
          <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={2.4} />
        </mesh>
      </group>

      <ContactShadows position={[0, 0.01, 0]} opacity={0.55} scale={14} blur={2.6} far={6} resolution={512} color="#000000" />
    </>
  );
}

export default function Showroom({ accent = "#9BB0C4", modelUrl }: { accent?: string; modelUrl?: string }) {
  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ position: [6, 3.2, 6], fov: 38 }}
      gl={{ antialias: true, alpha: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05 }}
      style={{ touchAction: "none" }}
    >
      <color attach="background" args={["#05070a"]} />
      <fog attach="fog" args={["#05070a", 12, 30]} />

      {/* Image-based lighting for realistic metallic paint reflections. Its
          own Suspense means a slow/blocked HDRI never delays the vehicle. */}
      <Suspense fallback={null}>
        <Environment preset="warehouse" environmentIntensity={0.65} />
      </Suspense>

      <ambientLight intensity={0.18} />
      <spotLight position={[6, 9, 4]} angle={0.5} penumbra={1} intensity={150} color="#eaf2ff" castShadow shadow-bias={-0.0004} shadow-mapSize={[2048, 2048]} />
      <spotLight position={[-6, 8, -3]} angle={0.6} penumbra={1} intensity={95} color={accent} />
      <spotLight position={[0, 7, -7]} angle={0.7} penumbra={1} intensity={60} color="#ffffff" />
      <pointLight position={[0, 4, 0]} intensity={14} color="#dfe9ff" />

      <Stage accent={accent} modelUrl={modelUrl} />

      {/* Mirror-polished showroom floor with real reflections of the car. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[80, 80]} />
        <MeshReflectorMaterial
          resolution={1024}
          mixBlur={1}
          mixStrength={45}
          blur={[300, 90]}
          roughness={0.65}
          depthScale={1.1}
          minDepthThreshold={0.4}
          maxDepthThreshold={1.3}
          color="#080b11"
          metalness={0.7}
          mirror={0.55}
        />
      </mesh>

      <OrbitControls
        enablePan={false}
        minDistance={5}
        maxDistance={13}
        minPolarAngle={0.35}
        maxPolarAngle={Math.PI / 2.15}
        target={[0, 0.9, 0]}
        enableDamping
        dampingFactor={0.08}
      />

      <EffectComposer multisampling={0} enableNormalPass={false}>
        <Bloom luminanceThreshold={0.55} luminanceSmoothing={0.9} intensity={0.7} mipmapBlur radius={0.7} />
      </EffectComposer>
    </Canvas>
  );
}
