# Kitchen 3D model drop-in

The Kitchen page loads a real GLB model from this folder if one is present.

## How to add the Sketchfab "Modern Kitchen" model

1. On the Sketchfab model page, click **Download** → choose the
   **glTF** or **glTF Binary (.glb)** format. Prefer the **uncompressed**
   option if offered (avoid Draco), since the app loads it directly in the
   browser without a decoder.
2. If you got a `.zip` / `.gltf` + textures, convert/export it to a single
   **`.glb`** (self-contained). Tools: Blender (File → Export → glTF Binary),
   or gltf.report / gltfpack.
3. Rename the file to exactly:

   ```
   modern-kitchen.glb
   ```

4. Place it here: `public/models/modern-kitchen.glb` and commit it.

That's it — the Kitchen page renders it automatically. Until the file exists
(or if it fails to load), the page falls back to the hand-built kitchen scene.

## Licensing

Only commit a model you have the right to use. Most Sketchfab models are
CC-BY (free to use **with attribution**); some are marked no-download. Please
confirm the license and keep the author credit.

## Door / drawer interactivity

Clicking a part whose node name reads like `door`, `fridge`, `freezer`,
`pantry`, `drawer`, `oven`, … will animate it (doors swing, drawers slide).
This only works if the model was authored with those parts as separate,
sensibly-named, sensibly-pivoted objects. On load, the browser console logs
the model's node names and the openable candidates it found — send me that
list and I'll map each door/drawer precisely.

## Change the path / force the built-in kitchen

The path is set in `components/dashboard/modules/KitchenModule.tsx`
(`KITCHEN_MODEL_URL`). Set it to `null` to always use the built-in kitchen.
