"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

/* ------------------------------------------------------------------
   The "intelligent object" layer — Apple-style holographic reads, not
   a sci-fi HUD. Two faint tracking rings with a slow traveling pulse,
   a handful of tiny orbiting satellite indicators, and an occasional
   soft latitude scan band across the planet itself.
------------------------------------------------------------------ */

const ringVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const ringFragment = /* glsl */ `
  uniform float uTime;
  uniform float uSpeed;
  uniform float uGlow;
  varying vec2 vUv;

  void main() {
    // Faint constant ring + a bright pulse that travels once around per cycle.
    float base = 0.05;
    float pulsePos = fract(uTime * uSpeed);
    float dist = abs(fract(vUv.x - pulsePos + 0.5) - 0.5);
    float pulse = smoothstep(0.05, 0.0, dist) * 0.85;
    float edgeFade = smoothstep(0.0, 0.15, vUv.y) * smoothstep(1.0, 0.85, vUv.y);
    float alpha = (base + pulse) * edgeFade * uGlow;
    vec3 color = vec3(0.35, 0.62, 1.0);
    gl_FragColor = vec4(color, alpha);
  }
`;

const bandFragment = /* glsl */ `
  uniform float uTime;
  uniform float uGlow;
  varying vec3 vNormal;

  void main() {
    // A soft horizontal scan band that sweeps pole-to-pole every ~22s, then
    // rests — "occasional", not continuous, per the brief.
    float cycle = mod(uTime, 22.0);
    float sweep = smoothstep(0.0, 7.0, cycle) * smoothstep(14.0, 7.0, cycle);
    float bandY = sin(uTime * 0.09) * 0.9;
    float band = smoothstep(0.05, 0.0, abs(vNormal.y - bandY));
    float alpha = band * sweep * 0.1 * uGlow;
    gl_FragColor = vec4(0.4, 0.68, 1.0, alpha);
  }
`;

const bandVertex = /* glsl */ `
  varying vec3 vNormal;
  void main() {
    vNormal = normalize(normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

type Sat = { radius: number; speed: number; phase: number; tiltX: number; tiltZ: number };

const SATELLITES: Sat[] = [
  { radius: 1.32, speed: 0.09, phase: 0, tiltX: 0.5, tiltZ: 0.15 },
  { radius: 1.48, speed: -0.065, phase: 2.1, tiltX: -0.3, tiltZ: 0.9 },
  { radius: 1.22, speed: 0.12, phase: 4.4, tiltX: 1.1, tiltZ: -0.4 },
];

function Satellite({ config }: { config: Sat }) {
  const dot = useRef<THREE.Mesh>(null);
  const glow = useRef<THREE.Sprite>(null);

  useFrame((state) => {
    const angle = state.clock.elapsedTime * config.speed + config.phase;
    const x = config.radius * Math.cos(angle);
    const z = config.radius * Math.sin(angle);
    dot.current?.position.set(x, 0, z);
    glow.current?.position.set(x, 0, z);
  });

  const spriteMap = useSoftDotTexture();

  return (
    <group rotation={[config.tiltX, 0, config.tiltZ]}>
      <mesh ref={dot}>
        <sphereGeometry args={[0.012, 12, 12]} />
        <meshBasicMaterial color="#8fc0ff" transparent opacity={0.85} />
      </mesh>
      <sprite ref={glow} scale={[0.09, 0.09, 0.09]}>
        <spriteMaterial map={spriteMap} transparent opacity={0.5} blending={THREE.AdditiveBlending} depthWrite={false} />
      </sprite>
    </group>
  );
}

/** A tiny radial-gradient dot texture, generated once, reused for every glow sprite. */
function useSoftDotTexture() {
  return useMemo(() => {
    const size = 64;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    gradient.addColorStop(0, "rgba(160,200,255,0.9)");
    gradient.addColorStop(1, "rgba(160,200,255,0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
    const texture = new THREE.CanvasTexture(canvas);
    return texture;
  }, []);
}

export function HoloRings({ glowBoost }: { glowBoost: React.MutableRefObject<number> }) {
  const ring1Mat = useRef<THREE.ShaderMaterial>(null);
  const ring2Mat = useRef<THREE.ShaderMaterial>(null);
  const bandMat = useRef<THREE.ShaderMaterial>(null);

  const ring1Uniforms = useMemo(() => ({ uTime: { value: 0 }, uSpeed: { value: 0.045 }, uGlow: { value: 1 } }), []);
  const ring2Uniforms = useMemo(() => ({ uTime: { value: 0 }, uSpeed: { value: -0.03 }, uGlow: { value: 1 } }), []);
  const bandUniforms = useMemo(() => ({ uTime: { value: 0 }, uGlow: { value: 1 } }), []);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const glow = 0.55 + glowBoost.current * 0.8;
    if (ring1Mat.current) {
      ring1Mat.current.uniforms.uTime.value = t;
      ring1Mat.current.uniforms.uGlow.value = glow;
    }
    if (ring2Mat.current) {
      ring2Mat.current.uniforms.uTime.value = t;
      ring2Mat.current.uniforms.uGlow.value = glow;
    }
    if (bandMat.current) {
      bandMat.current.uniforms.uTime.value = t;
      bandMat.current.uniforms.uGlow.value = glow;
    }
  });

  return (
    <group>
      {/* Two tilted tracking rings, each carrying a slow traveling pulse */}
      <mesh rotation={[Math.PI / 2.35, 0.3, 0]}>
        <torusGeometry args={[1.28, 0.0032, 8, 128]} />
        <shaderMaterial
          ref={ring1Mat}
          vertexShader={ringVertex}
          fragmentShader={ringFragment}
          uniforms={ring1Uniforms}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      <mesh rotation={[Math.PI / 1.7, -0.4, 0.2]}>
        <torusGeometry args={[1.4, 0.0026, 8, 128]} />
        <shaderMaterial
          ref={ring2Mat}
          vertexShader={ringVertex}
          fragmentShader={ringFragment}
          uniforms={ring2Uniforms}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Soft occasional latitude scan band, hugging the planet surface */}
      <mesh scale={1.006}>
        <sphereGeometry args={[1, 64, 64]} />
        <shaderMaterial
          ref={bandMat}
          vertexShader={bandVertex}
          fragmentShader={bandFragment}
          uniforms={bandUniforms}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {SATELLITES.map((config, i) => (
        <Satellite key={i} config={config} />
      ))}
    </group>
  );
}
