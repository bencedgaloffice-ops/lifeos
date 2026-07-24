"use client";

import { useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";

/**
 * The generic vehicle loader — the heart of the data-driven garage engine.
 *
 * It takes any standardized GLB URL and displays it consistently on the
 * showroom turntable: the model is deep-cloned (so the same URL can appear on
 * multiple platforms), its bounding box is measured, then it is recentered on
 * the origin and uniformly scaled to a fixed footprint and lifted to rest on
 * the platform. That normalization is what lets hundreds or thousands of
 * different real vehicles — each authored at a different scale/origin — drop
 * in as pure data with zero code changes.
 */

const TARGET_SIZE = 4.6; // world units for the longest dimension

export function VehicleModel({ url }: { url: string }) {
  const { scene } = useGLTF(url);

  const fitted = useMemo(() => {
    const root = scene.clone(true);
    root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        const mat = mesh.material as THREE.MeshStandardMaterial | THREE.MeshStandardMaterial[];
        for (const m of Array.isArray(mat) ? mat : [mat]) {
          if (m && "envMapIntensity" in m) {
            m.envMapIntensity = 1.15;
            m.needsUpdate = true;
          }
        }
      }
    });
    const box = new THREE.Box3().setFromObject(root);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const scale = TARGET_SIZE / maxDim;
    // Recenter the model on the origin so scale/lift are predictable.
    root.position.set(-center.x, -center.y, -center.z);
    const liftY = (size.y / 2) * scale + 0.14;
    return { root, scale, liftY };
  }, [scene]);

  return (
    <group scale={fitted.scale} position={[0, fitted.liftY, 0]}>
      <primitive object={fitted.root} />
    </group>
  );
}

/** Warm the drei cache for a model URL (e.g. the next vehicle in the rail). */
export function preloadVehicleModel(url: string) {
  if (url) useGLTF.preload(url);
}
