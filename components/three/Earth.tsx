"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import * as THREE from "three";
import { StarField } from "./StarField";
import { SpaceDust } from "./SpaceDust";
import { HoloRings } from "./HoloRings";
import { enterSignal } from "@/lib/landing/enterSignal";

/* ------------------------------------------------------------------
   Realistic NASA-style Earth — real Blue Marble day imagery, city
   lights on the night side, an ocean specular mask and a true cloud
   layer (all sourced as web-optimized stills, no procedural land
   generation). Shading is still hand-written GLSL: day/night
   terminator blend, ocean sun-glint, atmospheric Fresnel rim and an
   outer halo, so the lighting quality stays cinematic while the
   surface itself reads as an actual satellite photograph of Earth.
------------------------------------------------------------------ */

const globeVertex = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vWorldPos;
  varying vec2 vUv;
  void main(){
    vNormal = normalize(normalMatrix * normal);
    vUv = uv;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldPos = wp.xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const globeFragment = /* glsl */ `
  uniform sampler2D uDayMap;
  uniform sampler2D uNightMap;
  uniform sampler2D uSpecularMap;
  uniform sampler2D uBumpMap;
  uniform vec3 uLightDir;
  uniform vec3 uRimColor;
  uniform float uRimBoost;
  varying vec3 vNormal;
  varying vec3 vWorldPos;
  varying vec2 vUv;

  void main(){
    vec3 dayTex = texture2D(uDayMap, vUv).rgb;
    vec3 nightTex = texture2D(uNightMap, vUv).rgb;
    float ocean = texture2D(uSpecularMap, vUv).r; // 1 = water, 0 = land
    float relief = texture2D(uBumpMap, vUv).r;

    // Subtle terrain relief shading so land doesn't read as flat-printed.
    vec3 surface = dayTex * (0.88 + 0.28 * relief);

    vec3 N = normalize(vNormal);
    vec3 L = normalize(uLightDir);
    float diff = dot(N, L);
    // Soft, wide terminator so day/night blends like real atmospheric scatter.
    float dayAmount = smoothstep(-0.26, 0.3, diff);

    float nightSide = 1.0 - smoothstep(-0.04, 0.26, diff);
    vec3 nightGlow = nightTex * 1.6 * nightSide;

    vec3 dayColor = surface * (0.34 + 0.92 * max(diff, 0.0));

    // Ocean sun-glint, masked to water only via the specular map.
    vec3 V = normalize(cameraPosition - vWorldPos);
    vec3 H = normalize(L + V);
    float spec = pow(max(dot(N, H), 0.0), 70.0) * ocean * dayAmount;
    dayColor += vec3(0.55, 0.75, 1.0) * spec * 0.85;
    float softSpec = pow(max(dot(N, H), 0.0), 14.0) * ocean * dayAmount;
    dayColor += vec3(0.3, 0.45, 0.7) * softSpec * 0.14;

    vec3 color = mix(nightGlow + surface * 0.03, dayColor, dayAmount);

    // Faint blue atmospheric haze right at the terminator line.
    float terminatorBand = pow(clamp(1.0 - abs(diff), 0.0, 1.0), 4.0);
    color += vec3(0.25, 0.45, 0.9) * terminatorBand * 0.1;

    // Fresnel rim — thin atmosphere glowing at the limb.
    float fres = pow(1.0 - max(dot(N, V), 0.0), 3.0);
    color += uRimColor * fres * (0.35 + 0.65 * dayAmount) * uRimBoost;

    color = color / (color + vec3(0.9));
    color = pow(color, vec3(0.92));

    gl_FragColor = vec4(color, 1.0);
  }
`;

const cloudFragment = /* glsl */ `
  uniform sampler2D uCloudsMap;
  uniform vec3 uLightDir;
  varying vec3 vNormal;
  varying vec3 vWorldPos;
  varying vec2 vUv;

  void main(){
    vec4 cloudTex = texture2D(uCloudsMap, vUv);
    float density = cloudTex.a;

    vec3 N = normalize(vNormal);
    vec3 L = normalize(uLightDir);
    float diff = smoothstep(-0.2, 0.4, dot(N, L));

    vec3 V = normalize(cameraPosition - vWorldPos);
    float fres = pow(1.0 - max(dot(N, V), 0.0), 2.2);

    float alpha = density * (0.3 + 0.65 * diff) * (1.0 - fres * 0.55);
    vec3 col = cloudTex.rgb * (0.5 + 0.55 * diff);
    gl_FragColor = vec4(col, alpha);
  }
`;

const atmosphereVertex = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vWorldPos;
  void main(){
    vNormal = normalize(normalMatrix * normal);
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldPos = wp.xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const atmosphereFragment = /* glsl */ `
  uniform vec3 uLightDir;
  uniform float uIntensity;
  varying vec3 vNormal;
  varying vec3 vWorldPos;
  void main(){
    vec3 N = normalize(vNormal);
    vec3 V = normalize(cameraPosition - vWorldPos);
    float fres = pow(1.0 - max(dot(N, V), 0.0), 4.5);
    float lightAmount = smoothstep(-0.35, 0.5, dot(N, normalize(uLightDir)));
    vec3 glowDim = vec3(0.1, 0.22, 0.5);
    vec3 glowBright = vec3(0.3, 0.55, 1.0);
    vec3 glow = mix(glowDim, glowBright, lightAmount);
    float intensity = fres * (0.28 + 0.5 * lightAmount) * uIntensity * 0.55;
    gl_FragColor = vec4(glow, intensity);
  }
`;

// Outer, wider halo shell — a faint haze bleeding into space, not a ring.
const haloFragment = /* glsl */ `
  uniform vec3 uLightDir;
  uniform float uIntensity;
  varying vec3 vNormal;
  varying vec3 vWorldPos;
  void main(){
    vec3 N = normalize(vNormal);
    vec3 V = normalize(cameraPosition - vWorldPos);
    float fres = pow(1.0 - max(dot(N, V), 0.0), 7.0);
    float lightAmount = smoothstep(-0.4, 0.6, dot(N, normalize(uLightDir)));
    vec3 glow = vec3(0.18, 0.4, 0.95);
    gl_FragColor = vec4(glow, fres * 0.16 * (0.5 + 0.6 * lightAmount) * uIntensity);
  }
`;

/** Frame-rate independent exponential smoothing (critically damped feel). */
function damp(current: number, target: number, lambda: number, delta: number) {
  return THREE.MathUtils.lerp(current, target, 1 - Math.exp(-lambda * delta));
}

type PointerState = {
  x: number;
  y: number;
  down: boolean;
  dragDX: number;
  dragDY: number;
  velX: number;
};

// Radius (in local sphere units, where the planet itself is radius 1) of the
// outermost visible shell — used to size the globe so the whole thing,
// halo included, always fits inside the viewport.
const HALO_RADIUS = 1.16;

// The day texture is a standard equirectangular map (u=0.5 → 0° longitude,
// Greenwich). Three.js's own sphere UV mapping puts u=0.25 facing the
// default camera, so we rotate the globe by -90° to bring u=0.5 to face
// front, then bias a further ~12° east to center the view on Central
// Europe (Germany/Italy/Hungary) rather than the Atlantic edge of the UK.
const EUROPE_FACING_ROTATION_Y = -Math.PI / 2 - THREE.MathUtils.degToRad(12);

// A gentle axial tilt (applied once, before the perpetual Y-spin) lifts
// Central Europe out of the top rim of the frame and into the vertical
// center — without it, Germany/Hungary sit right at the edge of view.
const EUROPE_FACING_TILT_X = THREE.MathUtils.degToRad(22);

// Cinematic intro: hold on Europe fully still, then ease up into the
// perpetual slow spin — so the first thing anyone sees unambiguously reads
// as "Europe", not a blur of continents.
const INTRO_HOLD_SECONDS = 2.4;
const INTRO_EASE_SECONDS = 3.6;

function smoothstep01(k: number) {
  const x = THREE.MathUtils.clamp(k, 0, 1);
  return x * x * (3 - 2 * x);
}

function Globe({ pointer, hovered }: { pointer: React.MutableRefObject<PointerState>; hovered: React.MutableRefObject<boolean> }) {
  const spinGroup = useRef<THREE.Group>(null); // owns perpetual spin + drag
  const floatGroup = useRef<THREE.Group>(null); // owns float/breathing offset
  const earthMat = useRef<THREE.ShaderMaterial>(null);
  const cloudMat = useRef<THREE.ShaderMaterial>(null);
  const atmoMat = useRef<THREE.ShaderMaterial>(null);
  const haloMat = useRef<THREE.ShaderMaterial>(null);
  const cloudMesh = useRef<THREE.Mesh>(null);
  const { viewport, camera } = useThree();

  const [dayMap, nightMap, specularMap, bumpMap, cloudsMap] = useTexture([
    "/textures/earth-day.jpg",
    "/textures/earth-night.jpg",
    "/textures/earth-specular.jpg",
    "/textures/earth-bump.jpg",
    "/textures/earth-clouds.png",
  ]);

  useMemo(() => {
    dayMap.colorSpace = THREE.SRGBColorSpace;
    nightMap.colorSpace = THREE.SRGBColorSpace;
    cloudsMap.colorSpace = THREE.SRGBColorSpace;
    specularMap.colorSpace = THREE.NoColorSpace;
    bumpMap.colorSpace = THREE.NoColorSpace;
    for (const tex of [dayMap, nightMap, specularMap, bumpMap, cloudsMap]) {
      tex.anisotropy = 8;
      tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
      tex.needsUpdate = true;
    }
  }, [dayMap, nightMap, specularMap, bumpMap, cloudsMap]);

  const lightDir = useMemo(() => new THREE.Vector3(1.0, 0.35, 0.75).normalize(), []);
  const rimColor = useMemo(() => new THREE.Color(0.16, 0.42, 0.98), []);

  const uniforms = useMemo(
    () => ({
      earth: {
        uDayMap: { value: dayMap },
        uNightMap: { value: nightMap },
        uSpecularMap: { value: specularMap },
        uBumpMap: { value: bumpMap },
        uLightDir: { value: lightDir },
        uRimColor: { value: rimColor },
        uRimBoost: { value: 1 },
      },
      cloud: { uCloudsMap: { value: cloudsMap }, uLightDir: { value: lightDir } },
      atmo: { uLightDir: { value: lightDir }, uIntensity: { value: 1 } },
      halo: { uLightDir: { value: lightDir }, uIntensity: { value: 1 } },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lightDir, rimColor],
  );

  // Inertial drag-rotation velocity, persists across frames.
  const spinVelocity = useRef(0);
  const baseSpinSpeed = 0.021; // slow, elegant, premium — not mechanical
  const glowBoost = useRef(0); // eased 0..1 hover/interaction glow boost

  useFrame((state, delta) => {
    const dt = Math.min(delta, 1 / 30);
    const t = state.clock.elapsedTime;
    const p = pointer.current;

    // --- Cinematic intro: hold still on Europe, then ease into the loop ---
    let idleSpeed = baseSpinSpeed;
    if (t < INTRO_HOLD_SECONDS) {
      idleSpeed = 0;
    } else if (t < INTRO_HOLD_SECONDS + INTRO_EASE_SECONDS) {
      idleSpeed = baseSpinSpeed * smoothstep01((t - INTRO_HOLD_SECONDS) / INTRO_EASE_SECONDS);
    }
    // Hovering reads as the globe "paying attention" — rotation eases down slightly.
    idleSpeed *= 1 - glowBoost.current * 0.35;

    // --- Spin: perpetual + drag inertia, independent of camera parallax ---
    if (p.down) {
      spinVelocity.current = damp(spinVelocity.current, p.dragDX * 2.4, 10, dt);
    } else {
      spinVelocity.current = damp(spinVelocity.current, idleSpeed, 1.6, dt);
    }
    if (spinGroup.current) {
      spinGroup.current.rotation.y += spinVelocity.current * dt;
    }
    p.dragDX = damp(p.dragDX, 0, 14, dt);

    // --- Gentle floating + breathing scale, decoupled from spin ---
    if (floatGroup.current) {
      floatGroup.current.position.y = Math.sin(t * 0.42) * 0.055;
      floatGroup.current.position.x = Math.sin(t * 0.27) * 0.02;
      const breathe = 1 + Math.sin(t * 0.33) * 0.006;
      floatGroup.current.scale.setScalar(breathe);
    }

    // --- Cinematic camera: mouse parallax + slow orbital drift + zoom breathing ---
    // On "Enter LifeOS" the camera dives straight into the globe (a warp into
    // the personal world) — recentre and rush the dolly toward the surface.
    const entering = enterSignal.entering;
    const orbitalAngle = t * 0.05;
    const orbitalX = Math.sin(orbitalAngle) * 0.12;
    const orbitalY = Math.cos(orbitalAngle * 0.7) * 0.05;
    const zoomBreathe = Math.sin(t * 0.12) * 0.15;
    const targetCamX = entering ? 0 : p.x * 0.45 + orbitalX;
    const targetCamY = entering ? 0 : 0.15 + p.y * -0.28 + orbitalY;
    // A slower, deliberate dolly so the continents visibly rush up to meet you
    // before the light burst takes over — not an instant cut to the dark side.
    const targetCamZ = entering ? 2.35 : 6 + zoomBreathe;
    const camLambda = entering ? 2.4 : 2.2;
    camera.position.x = damp(camera.position.x, targetCamX, camLambda, dt);
    camera.position.y = damp(camera.position.y, targetCamY, camLambda, dt);
    camera.position.z = damp(camera.position.z, targetCamZ, camLambda, dt);
    camera.lookAt(0, 0, 0);
    if (entering) spinVelocity.current = damp(spinVelocity.current, 0.6, 2, dt); // subtle acceleration

    // --- Hover / interaction glow boost, eased ---
    const targetGlow = hovered.current || p.down ? 1 : 0;
    glowBoost.current = damp(glowBoost.current, targetGlow, 4, dt);
    const rim = 1 + glowBoost.current * 0.35;
    if (earthMat.current) earthMat.current.uniforms.uRimBoost.value = rim;
    if (atmoMat.current) atmoMat.current.uniforms.uIntensity.value = 1 + glowBoost.current * 0.5;
    if (haloMat.current) haloMat.current.uniforms.uIntensity.value = 1 + glowBoost.current * 0.65;

    // Real cloud layer drifts independently of the planet's own rotation.
    if (cloudMesh.current) cloudMesh.current.rotation.y += dt * 0.006;
  });

  // Size the globe (halo included) so it always fits fully inside the
  // viewport with breathing room — never crops the poles or the limb,
  // regardless of aspect ratio or screen size. Kept smaller than a full
  // hero fill so the black void above/below has room for the brand mark
  // and the entry button.
  const maxDiameter = Math.min(viewport.width, viewport.height) * 0.64;
  const scale = THREE.MathUtils.clamp(maxDiameter / (2 * HALO_RADIUS), 0.7, 2);

  return (
    <group ref={floatGroup}>
      <group ref={spinGroup} scale={scale} rotation={[EUROPE_FACING_TILT_X, EUROPE_FACING_ROTATION_Y, 0]}>
        {/* Holographic tracking layer — rings, scan band, satellite dots */}
        <HoloRings glowBoost={glowBoost} />

        {/* Earth surface */}
        <mesh
          onPointerOver={() => (hovered.current = true)}
          onPointerOut={() => (hovered.current = false)}
        >
          <sphereGeometry args={[1, 160, 160]} />
          <shaderMaterial
            ref={earthMat}
            vertexShader={globeVertex}
            fragmentShader={globeFragment}
            uniforms={uniforms.earth}
          />
        </mesh>

        {/* Real cloud layer */}
        <mesh ref={cloudMesh} scale={1.015}>
          <sphereGeometry args={[1, 110, 110]} />
          <shaderMaterial
            vertexShader={globeVertex}
            fragmentShader={cloudFragment}
            uniforms={uniforms.cloud}
            transparent
            depthWrite={false}
          />
        </mesh>

        {/* Tight atmospheric rim shell */}
        <mesh scale={1.045}>
          <sphereGeometry args={[1, 64, 64]} />
          <shaderMaterial
            ref={atmoMat}
            vertexShader={atmosphereVertex}
            fragmentShader={atmosphereFragment}
            uniforms={uniforms.atmo}
            transparent
            side={THREE.BackSide}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>

        {/* Wide soft halo shell — glow bleeding into space */}
        <mesh scale={HALO_RADIUS}>
          <sphereGeometry args={[1, 48, 48]} />
          <shaderMaterial
            ref={haloMat}
            vertexShader={atmosphereVertex}
            fragmentShader={haloFragment}
            uniforms={uniforms.halo}
            transparent
            side={THREE.BackSide}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      </group>
    </group>
  );
}

/** Pauses the render loop while the tab is hidden — no wasted GPU/battery. */
function useVisibleFrameloop() {
  const [frameloop, setFrameloop] = useState<"always" | "never">("always");
  useEffect(() => {
    const onVisibility = () => setFrameloop(document.hidden ? "never" : "always");
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);
  return frameloop;
}

export default function Earth() {
  const pointer = useRef<PointerState>({ x: 0, y: 0, down: false, dragDX: 0, dragDY: 0, velX: 0 });
  const hovered = useRef(false);
  const lastX = useRef(0);
  const frameloop = useVisibleFrameloop();

  return (
    <Canvas
      camera={{ position: [0, 0.15, 6], fov: 40 }}
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      style={{ touchAction: "none" }}
      frameloop={frameloop}
      onPointerMove={(e) => {
        const x = (e.clientX / window.innerWidth) * 2 - 1;
        const y = (e.clientY / window.innerHeight) * 2 - 1;
        pointer.current.x = x;
        pointer.current.y = y;
        if (pointer.current.down) {
          pointer.current.dragDX = e.clientX - lastX.current;
        }
        lastX.current = e.clientX;
      }}
      onPointerDown={(e) => {
        pointer.current.down = true;
        lastX.current = e.clientX;
        (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
      }}
      onPointerUp={() => {
        pointer.current.down = false;
      }}
      onPointerLeave={() => {
        pointer.current.down = false;
      }}
    >
      <ambientLight intensity={0.42} />
      <directionalLight position={[5, 2, 4]} intensity={1.25} />
      {/* Subtle cool fill from the opposite side so the night limb never goes fully flat black */}
      <directionalLight position={[-4, -1, -3]} intensity={0.12} color="#3b5bdb" />
      <StarField />
      <SpaceDust />
      <Suspense fallback={null}>
        <Globe pointer={pointer} hovered={hovered} />
      </Suspense>
      <EffectComposer multisampling={0} enableNormalPass={false}>
        <Bloom luminanceThreshold={0.42} luminanceSmoothing={0.9} intensity={0.4} mipmapBlur radius={0.6} />
      </EffectComposer>
    </Canvas>
  );
}
