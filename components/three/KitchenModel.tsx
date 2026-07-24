"use client";

import { useMemo, useRef } from "react";
import { useGLTF } from "@react-three/drei";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";

/**
 * Generic GLB kitchen loader — the drop-in path for a real 3D model
 * (e.g. a Sketchfab "Modern Kitchen"). It loads any standardized GLB by URL,
 * normalizes it (deep-clone, measure bounding box, recenter horizontally, sit
 * the base on the floor, uniformly scale to a room-sized footprint), enables
 * shadows and boosts reflections.
 *
 * Interactivity is best-effort: on click it walks up from the hit mesh looking
 * for a node whose name reads like a door / fridge / freezer / pantry / drawer
 * and animates it (doors swing, drawers slide). Whether this looks right
 * depends entirely on how the source model was authored — if its doors are a
 * single fused mesh, or the hinge pivot isn't at the door edge, the per-part
 * mapping has to be tuned once the real node names are known (logged to the
 * console on load).
 */

const OPEN_RE = /(door|ajtó|ajto|drzwi|fridge|refriger|freezer|pantry|cupboard|cabinet|oven)/i;
const DRAWER_RE = /(drawer|fiók|fiok)/i;

type Track = { obj: THREE.Object3D; baseRot: number; baseZ: number; open: boolean; drawer: boolean };

export function KitchenModel({ url, target = 8, slide = 0.4, swing = 1.6 }: { url: string; target?: number; slide?: number; swing?: number }) {
  const { scene } = useGLTF(url);
  const tracks = useRef<Map<string, Track>>(new Map());

  const fitted = useMemo(() => {
    const root = scene.clone(true);
    const names: string[] = [];
    root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        const mat = mesh.material as THREE.MeshStandardMaterial | THREE.MeshStandardMaterial[];
        for (const m of Array.isArray(mat) ? mat : [mat]) {
          if (m && "envMapIntensity" in m) {
            m.envMapIntensity = 1.1;
            m.needsUpdate = true;
          }
        }
      }
      if (o.name) names.push(o.name);
    });
    const box = new THREE.Box3().setFromObject(root);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.z) || 1;
    const scale = target / maxDim;
    // Recenter horizontally on the origin and sit the base on the floor.
    root.position.set(-center.x, -box.min.y, -center.z);
    if (typeof window !== "undefined") {
      const openable = names.filter((n) => OPEN_RE.test(n) || DRAWER_RE.test(n));
      // eslint-disable-next-line no-console
      console.log("[KitchenModel] loaded", names.length, "named nodes. Openable candidates:", openable);
    }
    return { root, scale };
  }, [scene, target]);

  useFrame(() => {
    tracks.current.forEach((t) => {
      if (t.drawer) {
        const tz = t.open ? t.baseZ + slide : t.baseZ;
        t.obj.position.z = THREE.MathUtils.lerp(t.obj.position.z, tz, 0.15);
      } else {
        const tr = t.open ? t.baseRot - swing : t.baseRot;
        t.obj.rotation.y = THREE.MathUtils.lerp(t.obj.rotation.y, tr, 0.12);
      }
    });
  });

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    let o: THREE.Object3D | null = e.object;
    while (o) {
      if (o.name && (OPEN_RE.test(o.name) || DRAWER_RE.test(o.name))) break;
      o = o.parent;
    }
    if (!o) return;
    const key = o.uuid;
    let t = tracks.current.get(key);
    if (!t) {
      t = { obj: o, baseRot: o.rotation.y, baseZ: o.position.z, open: false, drawer: DRAWER_RE.test(o.name) };
      tracks.current.set(key, t);
    }
    t.open = !t.open;
  };

  return (
    <group
      scale={fitted.scale}
      onClick={onClick}
      onPointerOver={() => {
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        document.body.style.cursor = "default";
      }}
    >
      <primitive object={fitted.root} />
    </group>
  );
}

export function preloadKitchenModel(url: string) {
  if (url) useGLTF.preload(url);
}
