"use client";

import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { JarvisStatus } from "@/lib/jarvis/types";

/* ------------------------------------------------------------------
   The Jarvis orb — a red holographic intelligence core.

   A noise-displaced icosahedron (the "energy core") sits inside an
   additive fresnel glow shell, wrapped by two counter-rotating
   holographic rings and a ring of orbiting particles. Everything is
   state-reactive via a single damped `uState`/`uAmp` pair:

     idle       slow breathing displacement
     waking     quick swell
     listening  rings spin up, tighter shimmer
     thinking   brighter, faster pulse
     speaking   travelling waves ripple across the surface
     denied     colour shifts toward a hard warning red

   All hand-written GLSL; no textures, so it's cheap enough to run
   several instances at once (landing + dashboard).
------------------------------------------------------------------ */

const STATE_INDEX: Record<JarvisStatus, number> = {
  idle: 0,
  waking: 1,
  listening: 2,
  thinking: 3,
  speaking: 4,
  denied: 5,
};

const coreVertex = /* glsl */ `
  uniform float uTime;
  uniform float uAmp;
  uniform float uState;
  varying vec3 vNormal;
  varying vec3 vWorldPos;
  varying float vDisp;

  vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
  vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
  vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
  vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
  float snoise(vec3 v){
    const vec2 C=vec2(1.0/6.0,1.0/3.0);const vec4 D=vec4(0.0,0.5,1.0,2.0);
    vec3 i=floor(v+dot(v,C.yyy));vec3 x0=v-i+dot(i,C.xxx);
    vec3 g=step(x0.yzx,x0.xyz);vec3 l=1.0-g;vec3 i1=min(g.xyz,l.zxy);vec3 i2=max(g.xyz,l.zxy);
    vec3 x1=x0-i1+C.xxx;vec3 x2=x0-i2+C.yyy;vec3 x3=x0-D.yyy;
    i=mod289(i);
    vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
    float n_=0.142857142857;vec3 ns=n_*D.wyz-D.xzx;
    vec4 j=p-49.0*floor(p*ns.z*ns.z);
    vec4 x_=floor(j*ns.z);vec4 y_=floor(j-7.0*x_);
    vec4 x=x_*ns.x+ns.yyyy;vec4 y=y_*ns.x+ns.yyyy;
    vec4 h=1.0-abs(x)-abs(y);
    vec4 b0=vec4(x.xy,y.xy);vec4 b1=vec4(x.zw,y.zw);
    vec4 s0=floor(b0)*2.0+1.0;vec4 s1=floor(b1)*2.0+1.0;vec4 sh=-step(h,vec4(0.0));
    vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
    vec3 p0=vec3(a0.xy,h.x);vec3 p1=vec3(a0.zw,h.y);vec3 p2=vec3(a1.xy,h.z);vec3 p3=vec3(a1.zw,h.w);
    vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
    p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
    vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);m=m*m;
    return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
  }

  void main(){
    vNormal = normalize(normalMatrix * normal);
    float speed = 0.25 + uState * 0.12;
    float n = snoise(normal * 1.7 + uTime * speed);
    n += 0.5 * snoise(normal * 3.4 + uTime * speed * 0.6);
    // Speaking (state 4): travelling waves rippling top-to-bottom.
    float wave = sin(normal.y * 9.0 - uTime * 6.0) * step(3.5, uState) * 0.5;
    vDisp = n + wave;
    float disp = (n * 0.14 + wave * 0.08) * (0.6 + uAmp);
    vec3 displaced = position + normal * disp;
    vec4 wp = modelMatrix * vec4(displaced, 1.0);
    vWorldPos = wp.xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
  }
`;

const coreFragment = /* glsl */ `
  uniform float uTime;
  uniform float uState;
  uniform float uAmp;
  uniform vec3 uAccent;
  varying vec3 vNormal;
  varying vec3 vWorldPos;
  varying float vDisp;

  void main(){
    vec3 N = normalize(vNormal);
    vec3 V = normalize(cameraPosition - vWorldPos);
    float fres = pow(1.0 - max(dot(N, V), 0.0), 2.3);

    vec3 deep = uAccent * 0.18;
    vec3 mid  = uAccent * 0.75;
    vec3 hot  = mix(uAccent, vec3(1.0, 0.85, 0.8), 0.5);

    vec3 col = mix(deep, mid, smoothstep(-0.6, 0.6, vDisp));
    col = mix(col, hot, fres);
    col += hot * fres * (0.5 + uAmp * 0.8);
    // Denied state (5) pushes toward a hard warning red flash.
    col = mix(col, vec3(1.0, 0.1, 0.12), step(4.5, uState) * (0.5 + 0.5 * sin(uTime * 20.0)));
    gl_FragColor = vec4(col, 1.0);
  }
`;

const glowVertex = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vWorldPos;
  void main(){
    vNormal = normalize(normalMatrix * normal);
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldPos = wp.xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const glowFragment = /* glsl */ `
  uniform vec3 uAccent;
  uniform float uAmp;
  varying vec3 vNormal;
  varying vec3 vWorldPos;
  void main(){
    vec3 N = normalize(vNormal);
    vec3 V = normalize(cameraPosition - vWorldPos);
    float fres = pow(1.0 - max(dot(N, V), 0.0), 3.0);
    gl_FragColor = vec4(uAccent, fres * (0.75 + uAmp * 0.5));
  }
`;

function damp(current: number, target: number, lambda: number, dt: number) {
  return THREE.MathUtils.lerp(current, target, 1 - Math.exp(-lambda * dt));
}

function Particles({ accent }: { accent: THREE.Color }) {
  const ref = useRef<THREE.Points>(null);
  const { positions } = useMemo(() => {
    const N = 90;
    const positions = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const r = 1.9 + Math.random() * 0.7;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.cos(phi) * 0.5;
      positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    return { positions };
  }, []);

  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.y += delta * 0.25;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.05}
        color={accent}
        transparent
        opacity={0.7}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
}

function Ring({ radius, tilt, accent, speedRef }: { radius: number; tilt: [number, number, number]; accent: THREE.Color; speedRef: React.MutableRefObject<number> }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.z += delta * speedRef.current;
  });
  return (
    <mesh ref={ref} rotation={tilt}>
      <torusGeometry args={[radius, 0.008, 8, 120]} />
      <meshBasicMaterial color={accent} transparent opacity={0.55} blending={THREE.AdditiveBlending} depthWrite={false} />
    </mesh>
  );
}

function Orb({ statusRef, accent, reducedMotion }: { statusRef: React.MutableRefObject<number>; accent: THREE.Color; reducedMotion: boolean }) {
  const group = useRef<THREE.Group>(null);
  const ringSpeed = useRef(0.2);
  const uniforms = useMemo(
    () => ({
      core: {
        uTime: { value: 0 },
        uAmp: { value: 0 },
        uState: { value: 0 },
        uAccent: { value: accent.clone() },
      },
      glow: { uAccent: { value: accent.clone() }, uAmp: { value: 0 } },
    }),
    [accent],
  );
  const state = useRef(0);
  const amp = useRef(0);

  useFrame((clock, delta) => {
    const dt = Math.min(delta, 1 / 30);
    const t = clock.clock.elapsedTime;
    state.current = damp(state.current, statusRef.current, 6, dt);

    // Target "energy" amplitude per state.
    const targetAmp =
      statusRef.current >= 4 ? 0.9 : // speaking
      statusRef.current === 3 ? 0.7 : // thinking
      statusRef.current === 2 ? 0.5 : // listening
      statusRef.current === 1 ? 0.6 : // waking
      0.15 + Math.sin(t * 1.2) * 0.06; // idle breathing
    amp.current = damp(amp.current, reducedMotion ? 0.15 : targetAmp, 4, dt);

    uniforms.core.uTime.value = t;
    uniforms.core.uState.value = state.current;
    uniforms.core.uAmp.value = amp.current;
    uniforms.glow.uAmp.value = amp.current;

    // Rings spin up while listening/thinking.
    const targetRing = reducedMotion ? 0.1 : 0.18 + (statusRef.current >= 2 ? statusRef.current * 0.22 : 0);
    ringSpeed.current = damp(ringSpeed.current, targetRing, 3, dt);

    if (group.current && !reducedMotion) {
      group.current.rotation.y += dt * 0.2;
      const s = 1 + Math.sin(t * 0.9) * 0.02 + amp.current * 0.05;
      group.current.scale.setScalar(s);
    }
  });

  return (
    <group ref={group}>
      <mesh>
        <icosahedronGeometry args={[1.25, 32]} />
        <shaderMaterial vertexShader={coreVertex} fragmentShader={coreFragment} uniforms={uniforms.core} />
      </mesh>
      <mesh scale={1.4}>
        <sphereGeometry args={[1.25, 40, 40]} />
        <shaderMaterial
          vertexShader={glowVertex}
          fragmentShader={glowFragment}
          uniforms={uniforms.glow}
          transparent
          side={THREE.BackSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      <Ring radius={1.7} tilt={[1.3, 0.2, 0]} accent={accent} speedRef={ringSpeed} />
      <Ring radius={1.95} tilt={[1.0, -0.5, 0.4]} accent={accent} speedRef={ringSpeed} />
      {!reducedMotion && <Particles accent={accent} />}
    </group>
  );
}

export default function JarvisOrb({
  status,
  accent = "#ff2d3f",
  reducedMotion = false,
}: {
  status: JarvisStatus;
  accent?: string;
  reducedMotion?: boolean;
}) {
  const statusRef = useRef(STATE_INDEX[status]);
  statusRef.current = STATE_INDEX[status];
  const accentColor = useMemo(() => new THREE.Color(accent), [accent]);

  return (
    <Canvas
      camera={{ position: [0, 0, 5.4], fov: 42 }}
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      style={{ background: "transparent" }}
    >
      <ambientLight intensity={0.7} />
      <pointLight position={[3, 2, 5]} intensity={2} color={accent} />
      <Orb statusRef={statusRef} accent={accentColor} reducedMotion={reducedMotion} />
    </Canvas>
  );
}
