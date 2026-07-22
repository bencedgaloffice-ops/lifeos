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

    // Coastline & terrain detail
    float detail = fbm(sp * 9.0);

    // --- Colors ---
    vec3 deepOcean = vec3(0.015, 0.06, 0.16);
    vec3 shallow   = vec3(0.03, 0.16, 0.34);
    vec3 ocean = mix(deepOcean, shallow, smoothstep(-0.2, 0.05, continent));

    vec3 lowland = vec3(0.05, 0.19, 0.10);
    vec3 forest  = vec3(0.08, 0.26, 0.13);
    vec3 desert  = vec3(0.32, 0.27, 0.14);
    vec3 landCol = mix(lowland, forest, smoothstep(0.0, 0.5, detail));
    landCol = mix(landCol, desert, smoothstep(0.55, 0.85, detail) * 0.6);

    // Polar ice caps
    float lat = abs(sp.y);
    float ice = smoothstep(0.78, 0.92, lat);
    landCol = mix(landCol, vec3(0.85, 0.9, 0.95), ice);
    ocean = mix(ocean, vec3(0.7, 0.8, 0.9), ice * 0.5);

    vec3 surface = mix(ocean, landCol, land);

    // --- Lighting (day/night terminator) ---
    vec3 N = normalize(vNormal);
    vec3 L = normalize(uLightDir);
    float diff = dot(N, L);
    float dayAmount = smoothstep(-0.18, 0.35, diff);

    // Night side: city lights on land
    float cityMask = land * smoothstep(0.35, 0.75, detail);
    float cities = cityMask * fbm(sp * 40.0);
    cities = smoothstep(0.25, 0.6, cities);
    vec3 nightGlow = vec3(1.0, 0.75, 0.4) * cities * 0.9;

    vec3 dayColor = surface * (0.35 + 0.85 * max(diff, 0.0));
    // specular sheen on oceans
    vec3 V = normalize(cameraPosition - vWorldPos);
    vec3 H = normalize(L + V);
    float spec = pow(max(dot(N, H), 0.0), 40.0) * (1.0 - land) * dayAmount;
    dayColor += vec3(0.5, 0.7, 1.0) * spec * 0.6;

    vec3 color = mix(nightGlow + surface * 0.02, dayColor, dayAmount);

    // --- Fresnel rim (blue atmosphere at the edge) ---
    float fres = pow(1.0 - max(dot(N, V), 0.0), 3.0);
    color += vec3(0.16, 0.4, 0.95) * fres * (0.35 + 0.65 * dayAmount);

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
    vec3 drift = vec3(uTime * 0.006, 0.0, 0.0);
    float c = fbm(sp * 2.6 + drift);
    c += 0.5 * fbm(sp * 6.0 + drift * 1.4);
    float clouds = smoothstep(0.15, 0.6, c);

    vec3 N = normalize(vNormal);
    vec3 L = normalize(uLightDir);
    float diff = smoothstep(-0.2, 0.4, dot(N, L));

    vec3 V = normalize(cameraPosition - vWorldPos);
    float fres = pow(1.0 - max(dot(N, V), 0.0), 2.0);

    float alpha = clouds * (0.25 + 0.6 * diff);
    vec3 col = vec3(1.0) * (0.5 + 0.5 * diff);
    // fade clouds at the silhouette so they wrap the globe
    alpha *= (1.0 - fres * 0.5);
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
  varying vec3 vNormal;
  varying vec3 vWorldPos;
  void main(){
    vec3 N = normalize(vNormal);
    vec3 V = normalize(cameraPosition - vWorldPos);
    float fres = pow(1.0 - max(dot(N, V), 0.0), 3.2);
    float lightAmount = smoothstep(-0.35, 0.5, dot(N, normalize(uLightDir)));
    vec3 glow = vec3(0.23, 0.5, 1.0);
    float intensity = fres * (0.5 + 0.9 * lightAmount);
    gl_FragColor = vec4(glow, intensity);
  }
`;

function Globe({ pointer }: { pointer: React.MutableRefObject<{ x: number; y: number }> }) {
  const group = useRef<THREE.Group>(null);
  const earthMat = useRef<THREE.ShaderMaterial>(null);
  const cloudMat = useRef<THREE.ShaderMaterial>(null);
  const cloudMesh = useRef<THREE.Mesh>(null);
  const { viewport } = useThree();

  const lightDir = useMemo(() => new THREE.Vector3(1.0, 0.35, 0.75).normalize(), []);

  const uniforms = useMemo(
    () => ({
      earth: {
        uTime: { value: 0 },
        uLightDir: { value: lightDir },
      },
      cloud: {
        uTime: { value: 0 },
        uLightDir: { value: lightDir },
      },
      atmo: {
        uLightDir: { value: lightDir },
      },
    }),
    [lightDir],
  );

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    if (earthMat.current) earthMat.current.uniforms.uTime.value = t;
    if (cloudMat.current) cloudMat.current.uniforms.uTime.value = t;

    if (group.current) {
      // Perpetual slow rotation
      group.current.rotation.y += delta * 0.045;
      // Gentle float
      group.current.position.y = Math.sin(t * 0.5) * 0.06;
      // Smooth mouse parallax
      const targetX = pointer.current.y * 0.18;
      const targetZ = pointer.current.x * 0.18;
      group.current.rotation.x += (targetX - group.current.rotation.x) * 0.05;
      group.current.rotation.z += (targetZ - group.current.rotation.z) * 0.05;
    }
    // Clouds drift slightly faster than the surface
    if (cloudMesh.current) cloudMesh.current.rotation.y += delta * 0.01;
  });

  // Scale globe responsively so it never crowds the headline.
  const scale = Math.min(1, viewport.width / 8) * 2.35;

  return (
    <group ref={group} scale={scale}>
      {/* Earth surface */}
      <mesh>
        <sphereGeometry args={[1, 128, 128]} />
        <shaderMaterial
          ref={earthMat}
          vertexShader={globeVertex}
          fragmentShader={globeFragment}
          uniforms={uniforms.earth}
        />
      </mesh>

      {/* Clouds */}
      <mesh ref={cloudMesh} scale={1.012}>
        <sphereGeometry args={[1, 96, 96]} />
        <shaderMaterial
          ref={cloudMat}
          vertexShader={cloudVertex}
          fragmentShader={cloudFragment}
          uniforms={uniforms.cloud}
          transparent
          depthWrite={false}
        />
      </mesh>

      {/* Atmospheric glow shell (rendered on the backfaces) */}
      <mesh scale={1.16}>
        <sphereGeometry args={[1, 64, 64]} />
        <shaderMaterial
          vertexShader={atmosphereVertex}
          fragmentShader={atmosphereFragment}
          uniforms={uniforms.atmo}
          transparent
          side={THREE.BackSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

export default function Earth() {
  const pointer = useRef({ x: 0, y: 0 });

  return (
    <Canvas
      camera={{ position: [0, 0, 6], fov: 40 }}
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      onPointerMove={(e) => {
        const x = (e.clientX / window.innerWidth) * 2 - 1;
        const y = (e.clientY / window.innerHeight) * 2 - 1;
        pointer.current = { x, y };
      }}
      style={{ pointerEvents: "auto" }}
    >
      <ambientLight intensity={0.4} />
      <directionalLight position={[5, 2, 4]} intensity={1.2} />
      <Stars radius={80} depth={40} count={2600} factor={3.4} saturation={0} fade speed={0.6} />
      <Globe pointer={pointer} />
    </Canvas>
  );
}
