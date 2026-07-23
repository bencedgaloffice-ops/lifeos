"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

/* ------------------------------------------------------------------
   Custom cinematic star field — replaces drei's generic <Stars/>.
   Every star gets its own size, brightness and twinkle phase/speed so
   nothing reads as a repeating loop; the whole field drifts at a
   near-imperceptible rate to sell depth without feeling animated.
------------------------------------------------------------------ */

const STAR_COUNT = 2600;

const starVertex = /* glsl */ `
  attribute float aSize;
  attribute float aBrightness;
  attribute float aPhase;
  attribute float aSpeed;
  uniform float uTime;
  varying float vBrightness;
  varying float vTwinkle;

  void main() {
    vBrightness = aBrightness;
    // Slow, per-star twinkle — irregular phase/speed keeps it from reading as a loop.
    vTwinkle = 0.55 + 0.45 * sin(uTime * aSpeed + aPhase);
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * (300.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const starFragment = /* glsl */ `
  varying float vBrightness;
  varying float vTwinkle;

  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float d = length(uv);
    float core = smoothstep(0.5, 0.0, d);
    float glow = smoothstep(0.5, 0.15, d) * 0.4;
    float alpha = (core + glow) * vBrightness * vTwinkle;
    if (alpha < 0.01) discard;
    vec3 color = mix(vec3(0.75, 0.82, 1.0), vec3(1.0), core);
    gl_FragColor = vec4(color, alpha);
  }
`;

export function StarField() {
  const points = useRef<THREE.Points>(null);
  const material = useRef<THREE.ShaderMaterial>(null);

  const { positions, sizes, brightness, phases, speeds } = useMemo(() => {
    const positions = new Float32Array(STAR_COUNT * 3);
    const sizes = new Float32Array(STAR_COUNT);
    const brightness = new Float32Array(STAR_COUNT);
    const phases = new Float32Array(STAR_COUNT);
    const speeds = new Float32Array(STAR_COUNT);

    for (let i = 0; i < STAR_COUNT; i++) {
      // Distribute on a thick shell so depth varies noticeably (30–110 units out).
      const radius = 30 + Math.pow(Math.random(), 0.6) * 80;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(THREE.MathUtils.lerp(-1, 1, Math.random()));
      positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = radius * Math.cos(phi);
      positions[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);

      sizes[i] = Math.random() < 0.08 ? THREE.MathUtils.randFloat(2.2, 3.4) : THREE.MathUtils.randFloat(0.6, 1.6);
      brightness[i] = Math.random() < 0.08 ? THREE.MathUtils.randFloat(0.75, 1) : THREE.MathUtils.randFloat(0.15, 0.55);
      phases[i] = Math.random() * Math.PI * 2;
      speeds[i] = THREE.MathUtils.randFloat(0.08, 0.35);
    }

    return { positions, sizes, brightness, phases, speeds };
  }, []);

  useFrame((state, delta) => {
    if (material.current) material.current.uniforms.uTime.value = state.clock.elapsedTime;
    // Imperceptibly slow field rotation — sells a living, deep sky without looking animated.
    if (points.current) {
      points.current.rotation.y += delta * 0.0018;
      points.current.rotation.x += delta * 0.0005;
    }
  });

  const uniforms = useMemo(() => ({ uTime: { value: 0 } }), []);

  return (
    <points ref={points}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-aSize" args={[sizes, 1]} />
        <bufferAttribute attach="attributes-aBrightness" args={[brightness, 1]} />
        <bufferAttribute attach="attributes-aPhase" args={[phases, 1]} />
        <bufferAttribute attach="attributes-aSpeed" args={[speeds, 1]} />
      </bufferGeometry>
      <shaderMaterial
        ref={material}
        vertexShader={starVertex}
        fragmentShader={starFragment}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}
