"use client";

import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { JarvisStatus } from "@/lib/jarvis/types";
import { orbSignal } from "@/lib/jarvis/orbSignal";

/* ------------------------------------------------------------------
   The Jarvis orb — a red holographic intelligence core.

   A noise-displaced icosahedron energy core sits inside an additive
   fresnel glow shell, wrapped by counter-rotating holographic rings, a
   cloud of orbiting particles, and — while speaking — expanding
   "sound-wave" rings that fire on every word boundary. The whole thing
   is state-reactive:

     idle       slow breathing displacement
     waking     quick swell
     listening  rings spin up, tighter shimmer
     thinking   brighter, faster pulse
     speaking   travelling plasma ripples + per-word energy pulses that
                ride the real speech-synthesis word boundaries
     denied     colour snaps toward a hard warning red

   Speech energy comes from `orbSignal`, written by the speech engine
   outside React, so the mouth-movement never triggers re-renders. All
   hand-written GLSL — cheap enough to run several instances at once.
------------------------------------------------------------------ */

const STATE_INDEX: Record<JarvisStatus, number> = {
  idle: 0, waking: 1, listening: 2, thinking: 3, speaking: 4, denied: 5,
};

const coreVertex = /* glsl */ `
  uniform float uTime;
  uniform float uAmp;
  uniform float uState;
  uniform float uSpeak;
  uniform float uPulse;
  varying vec3 vNormal;
  varying vec3 vWorldPos;
  varying float vDisp;
  varying float vRipple;

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
    float speed = 0.28 + uState * 0.10 + uSpeak * 0.6;
    float n = snoise(normal * 1.7 + uTime * speed);
    n += 0.5 * snoise(normal * 3.6 + uTime * speed * 0.6);
    n += 0.25 * snoise(normal * 7.0 - uTime * speed * 0.9);

    // Speaking: concentric plasma waves travelling pole-to-pole, their
    // amplitude riding the live per-word energy (uSpeak) and pulse (uPulse).
    float wavePhase = normal.y * 7.0 - uTime * 7.0;
    float ripple = sin(wavePhase) * (uSpeak * 0.6 + uPulse * 0.7);
    ripple += sin(normal.x * 9.0 + uTime * 5.0) * uSpeak * 0.25;
    vRipple = ripple;

    vDisp = n + ripple;
    float disp = (n * 0.13 + ripple * 0.12) * (0.55 + uAmp) + uPulse * 0.05;
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
  uniform float uSpeak;
  uniform float uPulse;
  uniform vec3 uAccent;
  varying vec3 vNormal;
  varying vec3 vWorldPos;
  varying float vDisp;
  varying float vRipple;

  void main(){
    vec3 N = normalize(vNormal);
    vec3 V = normalize(cameraPosition - vWorldPos);
    float fres = pow(1.0 - max(dot(N, V), 0.0), 2.2);

    vec3 deep = uAccent * 0.14;
    vec3 mid  = uAccent * 0.8;
    vec3 hot  = mix(uAccent, vec3(1.0, 0.9, 0.82), 0.6);

    vec3 col = mix(deep, mid, smoothstep(-0.7, 0.7, vDisp));
    col = mix(col, hot, fres);
    // Molten energy veins + speaking-ripple highlights.
    col += hot * fres * (0.5 + uAmp * 0.7 + uSpeak * 0.9);
    col += hot * max(vRipple, 0.0) * (0.4 + uPulse) * 0.8;
    col += uAccent * uPulse * 0.6;

    // Denied: hard warning strobe.
    col = mix(col, vec3(1.0, 0.1, 0.12), step(4.5, uState) * (0.5 + 0.5 * sin(uTime * 20.0)));

    // Gentle filmic-ish rolloff so the hot core doesn't clip harshly.
    col = col / (col + vec3(0.85));
    col = pow(col, vec3(0.85));
    gl_FragColor = vec4(col, 1.0);
  }
`;

const shellVertex = /* glsl */ `
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
  uniform float uEnergy;
  varying vec3 vNormal;
  varying vec3 vWorldPos;
  void main(){
    vec3 N = normalize(vNormal);
    vec3 V = normalize(cameraPosition - vWorldPos);
    float fres = pow(1.0 - max(dot(N, V), 0.0), 3.0);
    gl_FragColor = vec4(uAccent, fres * (0.7 + uEnergy * 0.9));
  }
`;

function damp(current: number, target: number, lambda: number, dt: number) {
  return THREE.MathUtils.lerp(current, target, 1 - Math.exp(-lambda * dt));
}

/** Expanding "sound-wave" rings — one fires on each spoken word. */
function SoundWaves({ accent, energyRef }: { accent: THREE.Color; energyRef: React.MutableRefObject<number> }) {
  const POOL = 5;
  const meshes = useRef<(THREE.Mesh | null)[]>([]);
  const ages = useRef<number[]>(Array(POOL).fill(Infinity)); // seconds since spawn
  const cursor = useRef(0);
  const lastSeen = useRef(-Infinity);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 1 / 30);
    // Spawn a ring when a new word boundary arrives while speaking.
    if (orbSignal.speaking && orbSignal.lastPulseAt !== lastSeen.current) {
      lastSeen.current = orbSignal.lastPulseAt;
      ages.current[cursor.current] = 0;
      cursor.current = (cursor.current + 1) % POOL;
    }
    for (let i = 0; i < POOL; i++) {
      const mesh = meshes.current[i];
      if (!mesh) continue;
      const age = (ages.current[i] += dt);
      const life = 0.9;
      if (age > life) {
        mesh.visible = false;
        continue;
      }
      const k = age / life; // 0..1
      mesh.visible = true;
      const scale = 1.45 + k * 1.7;
      mesh.scale.setScalar(scale);
      const mat = mesh.material as THREE.MeshBasicMaterial;
      mat.opacity = (1 - k) * 0.5 * (0.4 + energyRef.current);
    }
  });

  return (
    <group rotation={[Math.PI / 2, 0, 0]}>
      {Array.from({ length: POOL }).map((_, i) => (
        <mesh key={i} ref={(m) => { meshes.current[i] = m; }} visible={false}>
          <torusGeometry args={[1, 0.012, 8, 90]} />
          <meshBasicMaterial color={accent} transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}

function Particles({ accent, energyRef }: { accent: THREE.Color; energyRef: React.MutableRefObject<number> }) {
  const ref = useRef<THREE.Points>(null);
  const positions = useMemo(() => {
    const N = 110;
    const p = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const r = 1.85 + Math.random() * 0.8;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      p[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      p[i * 3 + 1] = r * Math.cos(phi) * 0.55;
      p[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    return p;
  }, []);

  useFrame((_, delta) => {
    if (!ref.current) return;
    ref.current.rotation.y += delta * (0.22 + energyRef.current * 0.5);
    const mat = ref.current.material as THREE.PointsMaterial;
    mat.opacity = 0.55 + energyRef.current * 0.4;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.05} color={accent} transparent opacity={0.6} blending={THREE.AdditiveBlending} depthWrite={false} />
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
      <meshBasicMaterial color={accent} transparent opacity={0.5} blending={THREE.AdditiveBlending} depthWrite={false} />
    </mesh>
  );
}

function Orb({ statusRef, accent, reducedMotion }: { statusRef: React.MutableRefObject<number>; accent: THREE.Color; reducedMotion: boolean }) {
  const group = useRef<THREE.Group>(null);
  const ringSpeed = useRef(0.2);
  const energyRef = useRef(0); // shared speaking energy for satellite effects
  const uniforms = useMemo(
    () => ({
      core: {
        uTime: { value: 0 }, uAmp: { value: 0 }, uState: { value: 0 },
        uSpeak: { value: 0 }, uPulse: { value: 0 }, uAccent: { value: accent.clone() },
      },
      innerGlow: { uAccent: { value: accent.clone().lerp(new THREE.Color(1, 1, 1), 0.35) }, uEnergy: { value: 0 } },
      glow: { uAccent: { value: accent.clone() }, uEnergy: { value: 0 } },
    }),
    [accent],
  );
  const state = useRef(0);
  const amp = useRef(0);
  const speak = useRef(0);
  const pulse = useRef(0);

  useFrame((clock, delta) => {
    const dt = Math.min(delta, 1 / 30);
    const t = clock.clock.elapsedTime;
    state.current = damp(state.current, statusRef.current, 6, dt);

    // --- Speaking energy from the live signal (word boundaries) ---
    const nowMs = typeof performance !== "undefined" ? performance.now() : Date.now();
    const sincePulse = nowMs - orbSignal.lastPulseAt;
    // A word pulse decays over ~260ms; between words a synthetic shimmer keeps
    // the mouth "alive" even on browsers that don't emit boundary events.
    const wordPulse = THREE.MathUtils.clamp(1 - sincePulse / 260, 0, 1);
    const speakingTarget = orbSignal.speaking || statusRef.current === 4 ? 1 : 0;
    speak.current = damp(speak.current, speakingTarget, 8, dt);
    const synthetic = speak.current * (0.35 + 0.35 * (0.5 + 0.5 * Math.sin(t * 9.0) * Math.sin(t * 17.0)));
    pulse.current = damp(pulse.current, Math.max(wordPulse, synthetic), 14, dt);
    energyRef.current = speak.current * (0.4 + 0.6 * pulse.current);

    const targetAmp =
      statusRef.current >= 4 ? 0.55 + energyRef.current * 0.6 :
      statusRef.current === 3 ? 0.7 :
      statusRef.current === 2 ? 0.5 :
      statusRef.current === 1 ? 0.6 :
      0.15 + Math.sin(t * 1.2) * 0.06;
    amp.current = damp(amp.current, reducedMotion ? 0.15 : targetAmp, 4, dt);

    const c = uniforms.core;
    c.uTime.value = t;
    c.uState.value = state.current;
    c.uAmp.value = amp.current;
    c.uSpeak.value = reducedMotion ? 0 : speak.current;
    c.uPulse.value = reducedMotion ? 0 : pulse.current;
    uniforms.glow.uEnergy.value = energyRef.current;
    uniforms.innerGlow.uEnergy.value = energyRef.current;

    const targetRing = reducedMotion ? 0.1 : 0.18 + (statusRef.current >= 2 ? statusRef.current * 0.22 : 0) + energyRef.current * 0.6;
    ringSpeed.current = damp(ringSpeed.current, targetRing, 3, dt);

    if (group.current && !reducedMotion) {
      group.current.rotation.y += dt * 0.2;
      const s = 1 + Math.sin(t * 0.9) * 0.02 + amp.current * 0.04 + pulse.current * 0.03;
      group.current.scale.setScalar(s);
    }
  });

  return (
    <group ref={group}>
      {/* Bright inner heart */}
      <mesh scale={0.55}>
        <sphereGeometry args={[1, 24, 24]} />
        <shaderMaterial vertexShader={shellVertex} fragmentShader={glowFragment} uniforms={uniforms.innerGlow} transparent blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      {/* Plasma energy core */}
      <mesh>
        <icosahedronGeometry args={[1.25, 32]} />
        <shaderMaterial vertexShader={coreVertex} fragmentShader={coreFragment} uniforms={uniforms.core} />
      </mesh>
      {/* Fresnel glow shell */}
      <mesh scale={1.42}>
        <sphereGeometry args={[1.25, 40, 40]} />
        <shaderMaterial vertexShader={shellVertex} fragmentShader={glowFragment} uniforms={uniforms.glow} transparent side={THREE.BackSide} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      <Ring radius={1.7} tilt={[1.3, 0.2, 0]} accent={accent} speedRef={ringSpeed} />
      <Ring radius={1.95} tilt={[1.0, -0.5, 0.4]} accent={accent} speedRef={ringSpeed} />
      {!reducedMotion && <Particles accent={accent} energyRef={energyRef} />}
      {!reducedMotion && <SoundWaves accent={accent} energyRef={energyRef} />}
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
