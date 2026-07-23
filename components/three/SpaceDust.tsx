"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

/* ------------------------------------------------------------------
   Tiny glowing dust drifting between camera and globe — almost
   invisible, depth-sorted, reinforces that the Earth floats in a real
   volume of space rather than in front of a flat backdrop.
------------------------------------------------------------------ */

const DUST_COUNT = 220;
const FIELD_RADIUS = 5.2;

const dustVertex = /* glsl */ `
  attribute float aSize;
  attribute float aOpacity;
  varying float vOpacity;
  void main() {
    vOpacity = aOpacity;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * (180.0 / -mvPosition.z);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const dustFragment = /* glsl */ `
  varying float vOpacity;
  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float d = length(uv);
    float alpha = smoothstep(0.5, 0.0, d) * vOpacity;
    if (alpha < 0.008) discard;
    gl_FragColor = vec4(0.72, 0.82, 1.0, alpha);
  }
`;

export function SpaceDust() {
  const points = useRef<THREE.Points>(null);

  const { positions, sizes, opacities, drift } = useMemo(() => {
    const positions = new Float32Array(DUST_COUNT * 3);
    const sizes = new Float32Array(DUST_COUNT);
    const opacities = new Float32Array(DUST_COUNT);
    const drift = new Float32Array(DUST_COUNT * 3);

    for (let i = 0; i < DUST_COUNT; i++) {
      positions[i * 3] = THREE.MathUtils.randFloatSpread(FIELD_RADIUS * 2);
      positions[i * 3 + 1] = THREE.MathUtils.randFloatSpread(FIELD_RADIUS * 1.4);
      positions[i * 3 + 2] = THREE.MathUtils.randFloatSpread(FIELD_RADIUS * 2) - 1;

      sizes[i] = THREE.MathUtils.randFloat(0.4, 1.1);
      opacities[i] = THREE.MathUtils.randFloat(0.03, 0.12); // near-invisible, per spec

      drift[i * 3] = THREE.MathUtils.randFloatSpread(0.02);
      drift[i * 3 + 1] = THREE.MathUtils.randFloat(0.006, 0.018);
      drift[i * 3 + 2] = THREE.MathUtils.randFloatSpread(0.02);
    }

    return { positions, sizes, opacities, drift };
  }, []);

  useFrame((_, delta) => {
    const geo = points.current?.geometry;
    if (!geo) return;
    const posAttr = geo.getAttribute("position") as THREE.BufferAttribute;
    for (let i = 0; i < DUST_COUNT; i++) {
      let x = posAttr.getX(i) + drift[i * 3] * delta;
      let y = posAttr.getY(i) + drift[i * 3 + 1] * delta;
      let z = posAttr.getZ(i) + drift[i * 3 + 2] * delta;
      // Wrap gently so particles never run out — keeps the field looking endless.
      if (y > FIELD_RADIUS * 0.7) y = -FIELD_RADIUS * 0.7;
      if (x > FIELD_RADIUS) x = -FIELD_RADIUS;
      if (x < -FIELD_RADIUS) x = FIELD_RADIUS;
      if (z > FIELD_RADIUS) z = -FIELD_RADIUS;
      if (z < -FIELD_RADIUS) z = FIELD_RADIUS;
      posAttr.setXYZ(i, x, y, z);
    }
    posAttr.needsUpdate = true;
  });

  return (
    <points ref={points}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-aSize" args={[sizes, 1]} />
        <bufferAttribute attach="attributes-aOpacity" args={[opacities, 1]} />
      </bufferGeometry>
      <shaderMaterial
        vertexShader={dustVertex}
        fragmentShader={dustFragment}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}
