"use client";

import { useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Stars } from "@react-three/drei";
import * as THREE from "three";

/* ------------------------------------------------------------------
   Procedural shader Earth — no external texture assets required.
   Continents, oceans, clouds, city lights, atmospheric rim glow and
   Fresnel lighting are all generated in GLSL for a cinematic, fully
   self-contained globe.

   This is the same rendering approach LifeOS has always used (R3F +
   hand-written GLSL, no texture pipeline) — this file upgrades the
   shading, lighting, atmosphere, cloud layers, camera behaviour and
   interaction model in place, without swapping the underlying tech.
------------------------------------------------------------------ */

const noiseGLSL = /* glsl */ `
  // Classic 3D simplex-ish value noise (Ashima-style hash) for continents.
  vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
  vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
  vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
  vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
  float snoise(vec3 v){
    const vec2 C=vec2(1.0/6.0,1.0/3.0);
    const vec4 D=vec4(0.0,0.5,1.0,2.0);
    vec3 i=floor(v+dot(v,C.yyy));
    vec3 x0=v-i+dot(i,C.xxx);
    vec3 g=step(x0.yzx,x0.xyz);
    vec3 l=1.0-g;
    vec3 i1=min(g.xyz,l.zxy);
    vec3 i2=max(g.xyz,l.zxy);
    vec3 x1=x0-i1+C.xxx;
    vec3 x2=x0-i2+C.yyy;
    vec3 x3=x0-D.yyy;
    i=mod289(i);
    vec4 p=permute(permute(permute(
      i.z+vec4(0.0,i1.z,i2.z,1.0))
      +i.y+vec4(0.0,i1.y,i2.y,1.0))
      +i.x+vec4(0.0,i1.x,i2.x,1.0));
    float n_=0.142857142857;
    vec3 ns=n_*D.wyz-D.xzx;
    vec4 j=p-49.0*floor(p*ns.z*ns.z);
    vec4 x_=floor(j*ns.z);
    vec4 y_=floor(j-7.0*x_);
    vec4 x=x_*ns.x+ns.yyyy;
    vec4 y=y_*ns.x+ns.yyyy;
    vec4 h=1.0-abs(x)-abs(y);
    vec4 b0=vec4(x.xy,y.xy);
    vec4 b1=vec4(x.zw,y.zw);
    vec4 s0=floor(b0)*2.0+1.0;
    vec4 s1=floor(b1)*2.0+1.0;
    vec4 sh=-step(h,vec4(0.0));
    vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;
    vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
    vec3 p0=vec3(a0.xy,h.x);
    vec3 p1=vec3(a0.zw,h.y);
    vec3 p2=vec3(a1.xy,h.z);
    vec3 p3=vec3(a1.zw,h.w);
    vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
    p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
    vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);
    m=m*m;
    return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
  }
  float fbm(vec3 p){
    float f=0.0; float a=0.5;
    for(int i=0;i<6;i++){ f+=a*snoise(p); p*=2.03; a*=0.5; }
    return f;
  }
  // Cheaper 4-octave variant for expensive double-sampled effects (shadows).
  float fbm4(vec3 p){
    float f=0.0; float a=0.5;
    for(int i=0;i<4;i++){ f+=a*snoise(p); p*=2.05; a*=0.5; }
    return f;
  }
`;

const globeVertex = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vPosition;
  varying vec3 vWorldPos;
  void main(){
    vNormal = normalize(normalMatrix * normal);
    vPosition = position;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldPos = wp.xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const globeFragment = /* glsl */ `
  uniform float uTime;
  uniform vec3 uLightDir;
  uniform vec3 uRimColor;
  uniform float uRimBoost;
  varying vec3 vNormal;
  varying vec3 vPosition;
  varying vec3 vWorldPos;

  ${noiseGLSL}

  void main(){
    vec3 sp = normalize(vPosition);

    // --- Continents ---
    float continent = fbm(sp * 1.8);
    continent += 0.5 * fbm(sp * 4.0);
    float land = smoothstep(0.02, 0.14, continent);

    // Coastline & terrain detail (two frequencies for a less uniform, more
    // "satellite photo" feel — coarse relief + fine grain).
    float detail = fbm(sp * 9.0);
    float microDetail = fbm(sp * 26.0);

    // --- Colors ---
    vec3 deepOcean = vec3(0.012, 0.05, 0.15);
    vec3 shallow   = vec3(0.03, 0.17, 0.36);
    vec3 ocean = mix(deepOcean, shallow, smoothstep(-0.2, 0.05, continent));
    // Subtle ocean current banding so water doesn't read as a flat fill.
    ocean = mix(ocean, ocean * 1.12, smoothstep(0.3, 0.8, microDetail));

    vec3 lowland = vec3(0.055, 0.2, 0.11);
    vec3 forest  = vec3(0.085, 0.27, 0.135);
    vec3 desert  = vec3(0.34, 0.28, 0.15);
    vec3 landCol = mix(lowland, forest, smoothstep(0.0, 0.5, detail));
    landCol = mix(landCol, desert, smoothstep(0.55, 0.85, detail) * 0.6);
    // Fine terrain grain (mountain ranges / texture) so land isn't flat-shaded.
    landCol *= 0.92 + 0.16 * microDetail;

    // Polar ice caps
    float lat = abs(sp.y);
    float ice = smoothstep(0.76, 0.9, lat);
    landCol = mix(landCol, vec3(0.86, 0.91, 0.96), ice);
    ocean = mix(ocean, vec3(0.72, 0.82, 0.92), ice * 0.5);

    vec3 surface = mix(ocean, landCol, land);

    // --- Lighting (day/night terminator) ---
    vec3 N = normalize(vNormal);
    vec3 L = normalize(uLightDir);
    float diff = dot(N, L);
    // Softer, wider terminator so the day/night blend feels atmospheric
    // rather than a hard line.
    float dayAmount = smoothstep(-0.28, 0.32, diff);

    // Night side: city lights on land, denser near coasts/detail edges.
    float cityMask = land * smoothstep(0.3, 0.7, detail);
    float cities = cityMask * fbm(sp * 42.0);
    cities = smoothstep(0.22, 0.55, cities);
    float nightSide = 1.0 - smoothstep(-0.05, 0.28, diff);
    vec3 nightGlow = vec3(1.0, 0.78, 0.42) * cities * 0.95 * nightSide;

    vec3 dayColor = surface * (0.32 + 0.9 * max(diff, 0.0));

    // Ocean specular sheen (sun glint)
    vec3 V = normalize(cameraPosition - vWorldPos);
    vec3 H = normalize(L + V);
    float spec = pow(max(dot(N, H), 0.0), 60.0) * (1.0 - land) * dayAmount;
    dayColor += vec3(0.55, 0.75, 1.0) * spec * 0.7;
    // Softer, broader sheen for a less pinpoint highlight.
    float softSpec = pow(max(dot(N, H), 0.0), 12.0) * (1.0 - land) * dayAmount;
    dayColor += vec3(0.3, 0.45, 0.7) * softSpec * 0.12;

    vec3 color = mix(nightGlow + surface * 0.025, dayColor, dayAmount);

    // Subtle blue atmospheric haze near the terminator (Rayleigh-ish tint),
    // strongest exactly where day meets night.
    float terminatorBand = 1.0 - abs(diff);
    terminatorBand = pow(clamp(terminatorBand, 0.0, 1.0), 4.0);
    color += vec3(0.25, 0.45, 0.9) * terminatorBand * 0.12;

    // --- Fresnel rim (blue atmosphere at the edge) ---
    float fres = pow(1.0 - max(dot(N, V), 0.0), 3.0);
    color += uRimColor * fres * (0.35 + 0.65 * dayAmount) * uRimBoost;

    // Gentle filmic-ish tonemap so highlights roll off instead of clipping.
    color = color / (color + vec3(0.9));
    color = pow(color, vec3(0.92));

    gl_FragColor = vec4(color, 1.0);
  }
`;

const cloudVertex = globeVertex;

const cloudFragment = /* glsl */ `
  uniform float uTime;
  uniform vec3 uLightDir;
  varying vec3 vNormal;
  varying vec3 vPosition;
  varying vec3 vWorldPos;

  ${noiseGLSL}

  void main(){
    vec3 sp = normalize(vPosition);
    vec3 drift = vec3(uTime * 0.0055, uTime * 0.0009, 0.0);
    float c = fbm(sp * 2.4 + drift);
    c += 0.5 * fbm(sp * 5.6 + drift * 1.5);
    c += 0.25 * fbm(sp * 12.0 + drift * 2.0);
    float clouds = smoothstep(0.18, 0.62, c);

    vec3 N = normalize(vNormal);
    vec3 L = normalize(uLightDir);
    float diff = smoothstep(-0.2, 0.4, dot(N, L));

    vec3 V = normalize(cameraPosition - vWorldPos);
    float fres = pow(1.0 - max(dot(N, V), 0.0), 2.0);

    float alpha = clouds * (0.22 + 0.6 * diff);
    vec3 col = vec3(1.0) * (0.45 + 0.55 * diff);
    // slight warm/cool tint at the terminator
    col = mix(col, vec3(1.0, 0.82, 0.68), (1.0 - diff) * 0.25);
    // fade clouds at the silhouette so they wrap the globe
    alpha *= (1.0 - fres * 0.5);
    gl_FragColor = vec4(col, alpha);
  }
`;

// A second, thinner high-altitude cloud layer drifting at a different speed
// and scale — this is what makes clouds read as independent layers with
// real parallax rather than a single painted shell.
const cloudHighFragment = /* glsl */ `
  uniform float uTime;
  uniform vec3 uLightDir;
  varying vec3 vNormal;
  varying vec3 vPosition;
  varying vec3 vWorldPos;

  ${noiseGLSL}

  void main(){
    vec3 sp = normalize(vPosition);
    vec3 drift = vec3(-uTime * 0.0032, uTime * 0.0016, 0.0);
    float c = fbm4(sp * 3.6 + drift);
    float clouds = smoothstep(0.35, 0.7, c);

    vec3 N = normalize(vNormal);
    vec3 L = normalize(uLightDir);
    float diff = smoothstep(-0.2, 0.4, dot(N, L));
    vec3 V = normalize(cameraPosition - vWorldPos);
    float fres = pow(1.0 - max(dot(N, V), 0.0), 2.2);

    float alpha = clouds * (0.12 + 0.28 * diff);
    alpha *= (1.0 - fres * 0.6);
    vec3 col = vec3(1.0) * (0.5 + 0.5 * diff);
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
    float fres = pow(1.0 - max(dot(N, V), 0.0), 3.2);
    float lightAmount = smoothstep(-0.35, 0.5, dot(N, normalize(uLightDir)));
    // Gradient from a deep indigo edge to a brighter cyan-blue toward the
    // lit limb, closer to real Rayleigh scattering than a flat tint.
    vec3 glowDim = vec3(0.14, 0.28, 0.62);
    vec3 glowBright = vec3(0.35, 0.62, 1.0);
    vec3 glow = mix(glowDim, glowBright, lightAmount);
    float intensity = fres * (0.45 + 0.95 * lightAmount) * uIntensity;
    gl_FragColor = vec4(glow, intensity);
  }
`;

// Outer, wider halo shell — very soft, adds the "glow bleeding into space"
// look product renders use, on top of the tighter rim-light shell above.
const haloFragment = /* glsl */ `
  uniform vec3 uLightDir;
  uniform float uIntensity;
  varying vec3 vNormal;
  varying vec3 vWorldPos;
  void main(){
    vec3 N = normalize(vNormal);
    vec3 V = normalize(cameraPosition - vWorldPos);
    float fres = pow(1.0 - max(dot(N, V), 0.0), 5.0);
    float lightAmount = smoothstep(-0.4, 0.6, dot(N, normalize(uLightDir)));
    vec3 glow = vec3(0.22, 0.45, 0.98);
    gl_FragColor = vec4(glow, fres * 0.35 * (0.5 + 0.6 * lightAmount) * uIntensity);
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

function Globe({ pointer, hovered }: { pointer: React.MutableRefObject<PointerState>; hovered: React.MutableRefObject<boolean> }) {
  const spinGroup = useRef<THREE.Group>(null); // owns perpetual spin + drag
  const floatGroup = useRef<THREE.Group>(null); // owns float/breathing offset
  const earthMat = useRef<THREE.ShaderMaterial>(null);
  const cloudMat = useRef<THREE.ShaderMaterial>(null);
  const cloudHighMat = useRef<THREE.ShaderMaterial>(null);
  const atmoMat = useRef<THREE.ShaderMaterial>(null);
  const haloMat = useRef<THREE.ShaderMaterial>(null);
  const cloudMesh = useRef<THREE.Mesh>(null);
  const cloudHighMesh = useRef<THREE.Mesh>(null);
  const { viewport, camera } = useThree();

  const lightDir = useMemo(() => new THREE.Vector3(1.0, 0.35, 0.75).normalize(), []);
  const rimColor = useMemo(() => new THREE.Color(0.16, 0.42, 0.98), []);

  const uniforms = useMemo(
    () => ({
      earth: {
        uTime: { value: 0 },
        uLightDir: { value: lightDir },
        uRimColor: { value: rimColor },
        uRimBoost: { value: 1 },
      },
      cloud: { uTime: { value: 0 }, uLightDir: { value: lightDir } },
      cloudHigh: { uTime: { value: 0 }, uLightDir: { value: lightDir } },
      atmo: { uLightDir: { value: lightDir }, uIntensity: { value: 1 } },
      halo: { uLightDir: { value: lightDir }, uIntensity: { value: 1 } },
    }),
    [lightDir, rimColor],
  );

  // Inertial drag-rotation velocity, persists across frames.
  const spinVelocity = useRef(0);
  const baseSpinSpeed = 0.021; // slow, elegant, premium — not mechanical
  const glowBoost = useRef(0); // eased 0..1 hover/interaction glow boost

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    const dt = Math.min(delta, 1 / 30);

    if (earthMat.current) earthMat.current.uniforms.uTime.value = t;
    if (cloudMat.current) cloudMat.current.uniforms.uTime.value = t;
    if (cloudHighMat.current) cloudHighMat.current.uniforms.uTime.value = t;

    const p = pointer.current;

    // --- Spin: perpetual + drag inertia, independent of camera parallax ---
    if (p.down) {
      // While dragging, follow the pointer directly (converted to angular
      // velocity) rather than snapping, so the globe feels physically held.
      spinVelocity.current = damp(spinVelocity.current, p.dragDX * 2.4, 10, dt);
    } else {
      // Ease drag velocity back down to the perpetual cruise speed.
      spinVelocity.current = damp(spinVelocity.current, baseSpinSpeed, 1.6, dt);
    }
    if (spinGroup.current) {
      spinGroup.current.rotation.y += spinVelocity.current * dt;
    }
    // consume per-frame drag delta so it doesn't re-apply
    p.dragDX = damp(p.dragDX, 0, 14, dt);

    // --- Gentle floating + breathing scale, decoupled from spin ---
    if (floatGroup.current) {
      floatGroup.current.position.y = Math.sin(t * 0.42) * 0.055;
      floatGroup.current.position.x = Math.sin(t * 0.27) * 0.02;
      const breathe = 1 + Math.sin(t * 0.33) * 0.006;
      floatGroup.current.scale.setScalar(breathe);
    }

    // --- Cinematic camera parallax (dolly + tilt) instead of fighting the
    // globe's own rotation with mouse-driven tilt ---
    const targetCamX = p.x * 0.45;
    const targetCamY = 0.15 + p.y * -0.28;
    camera.position.x = damp(camera.position.x, targetCamX, 2.2, dt);
    camera.position.y = damp(camera.position.y, targetCamY, 2.2, dt);
    camera.position.z = damp(camera.position.z, 6, 2.2, dt);
    camera.lookAt(0, 0, 0);

    // --- Hover / interaction glow boost, eased ---
    const targetGlow = hovered.current || p.down ? 1 : 0;
    glowBoost.current = damp(glowBoost.current, targetGlow, 4, dt);
    const rim = 1 + glowBoost.current * 0.35;
    if (earthMat.current) earthMat.current.uniforms.uRimBoost.value = rim;
    if (atmoMat.current) atmoMat.current.uniforms.uIntensity.value = 1 + glowBoost.current * 0.5;
    if (haloMat.current) haloMat.current.uniforms.uIntensity.value = 1 + glowBoost.current * 0.65;

    // Cloud layers drift at their own independent (slow) rates on top of
    // the shader-internal noise scroll, for real layered parallax.
    if (cloudMesh.current) cloudMesh.current.rotation.y += dt * 0.0085;
    if (cloudHighMesh.current) cloudHighMesh.current.rotation.y -= dt * 0.0048;
  });

  // Scale globe responsively so it never crowds the headline.
  const scale = Math.min(1, viewport.width / 8) * 2.35;

  return (
    <group ref={floatGroup}>
      <group ref={spinGroup} scale={scale}>
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

        {/* Low cloud layer */}
        <mesh ref={cloudMesh} scale={1.012}>
          <sphereGeometry args={[1, 110, 110]} />
          <shaderMaterial
            ref={cloudMat}
            vertexShader={cloudVertex}
            fragmentShader={cloudFragment}
            uniforms={uniforms.cloud}
            transparent
            depthWrite={false}
          />
        </mesh>

        {/* High, thin independent cloud layer for real parallax between layers */}
        <mesh ref={cloudHighMesh} scale={1.026}>
          <sphereGeometry args={[1, 90, 90]} />
          <shaderMaterial
            ref={cloudHighMat}
            vertexShader={cloudVertex}
            fragmentShader={cloudHighFragment}
            uniforms={uniforms.cloudHigh}
            transparent
            depthWrite={false}
          />
        </mesh>

        {/* Tight atmospheric rim shell */}
        <mesh scale={1.14}>
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
        <mesh scale={1.32}>
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

export default function Earth() {
  const pointer = useRef<PointerState>({ x: 0, y: 0, down: false, dragDX: 0, dragDY: 0, velX: 0 });
  const hovered = useRef(false);
  const lastX = useRef(0);

  return (
    <Canvas
      camera={{ position: [0, 0.15, 6], fov: 40 }}
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      style={{ touchAction: "none" }}
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
      <Stars radius={90} depth={50} count={3200} factor={3.2} saturation={0} fade speed={0.35} />
      <Globe pointer={pointer} hovered={hovered} />
    </Canvas>
  );
}
