import constants from "./constants.js";
import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.178.0/build/three.module.js";
import { state } from "./state.js";
import { setupControls } from "./controls.js";
import { createEnemies } from "./enemies.js";
import { createPlayerPhysics } from "./playerPhysics.js";
import { buildPhysicsFromGLTF, world } from "./physics.js";
import RAPIER from "https://cdn.jsdelivr.net/npm/@dimforge/rapier3d-compat@0.12.0/+esm";
import { GLTFExporter } from "https://cdn.jsdelivr.net/npm/three@0.178.0/examples/jsm/exporters/GLTFExporter.js";
import { OBJLoader } from "https://cdn.jsdelivr.net/npm/three@0.178.0/examples/jsm/loaders/OBJLoader.js";
import { GLTFLoader } from "https://cdn.jsdelivr.net/npm/three@0.178.0/examples/jsm/loaders/GLTFLoader.js";
import * as BufferGeometryUtils from "https://cdn.jsdelivr.net/npm/three@0.178.0/examples/jsm/utils/BufferGeometryUtils.js";
import {
  loadGLTFFromJSON,
  loadGLTFFromStorage,
  openDB,
  saveGLTFToStorage,
} from "./mapOperations.js";

// ================= INIT SCENE =================

export async function initScene() {
  await openDB();
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87ceeb);

  const camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000,
  );
  camera.position.set(0, 2, 5);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);

  // 🌞 lighting
  const sun = new THREE.DirectionalLight(0xffffff, 1.5);
  sun.position.set(10, 20, 10);
  scene.add(sun);

  const ambient = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(ambient);

  // 🌍 visual ground
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(constants.WORLD_SIZE, constants.WORLD_SIZE),
    new THREE.MeshStandardMaterial({ color: 0x88cc88 }),
  );
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  // ✅ PHYSICS GROUND
  const groundBody = world.createRigidBody(
    RAPIER.RigidBodyDesc.fixed().setTranslation(0, 0, 0),
  );

  world.createCollider(
    RAPIER.ColliderDesc.cuboid(
      constants.WORLD_SIZE / 2,
      0.1,
      constants.WORLD_SIZE / 2,
    ),
    groundBody,
  );

  // invisible build plane
  const buildPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(500, 500),
    new THREE.MeshBasicMaterial({ visible: false }),
  );
  buildPlane.rotation.x = -Math.PI / 2;
  buildPlane.userData.isGround = true;
  scene.add(buildPlane);

  // fog
  scene.fog = new THREE.Fog(0x87ceeb, 50, 200);

  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // ================= STATE SETUP =================

  state.scene = scene;
  state.camera = camera;
  state.renderer = renderer;
  state.buildPlane = buildPlane;

  // ✅ create player physics AFTER world exists
  createPlayerPhysics();

  // world blocks

  let savedGLTF = await loadGLTFFromStorage();

  if (savedGLTF) {
    await new Promise((resolve) => {
      loadGLTFFromJSON(savedGLTF, scene, resolve);
    });
  }

  // enemies
  state.enemies = state.isSinglePlayer ? createEnemies(scene, THREE) : [];

  // controls
  state.controls = setupControls(camera, state.isCreatorMode);

  // raycasting
  state.raycaster = new THREE.Raycaster();
  state.center = new THREE.Vector2(0, 0);

  // preview block
  state.preview = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0.5,
    }),
  );

  state.preview.visible = false;
  scene.add(state.preview);

  state.pos = new THREE.Vector3();
}

// ================= PLAYER =================

export function createPlayerMesh(id, data) {
  if (!state.scene || !state.scene.add) {
    console.warn("Scene not ready");
    return;
  }
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(1, 2, 1),
    new THREE.MeshStandardMaterial({ color: data.color }),
  );

  mesh.userData.isPlayer = true;
  mesh.userData.id = id;

  const label = createNameLabel(data.name);
  label.position.set(0, 2, 0);
  mesh.add(label);

  mesh.position.set(data.x, data.y, data.z);

  state.scene.add(mesh);
  state.otherPlayers[id] = mesh;
}

export function createNameLabel(name) {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  canvas.width = 256;
  canvas.height = 64;

  ctx.fillStyle = "white";
  ctx.font = "24px Arial";
  ctx.fillText(name, 10, 40);

  const texture = new THREE.CanvasTexture(canvas);

  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture }));
  sprite.userData.isLabel = true;

  sprite.scale.set(3, 1, 1);
  return sprite;
}

// ================= BLOCKS =================

export function addBlock(x, y, z) {
  if (!state.isCreatorMode) return;
  const exists = state.worldData.some(
    (b) => b.x === x && b.y === y && b.z === z,
  );
  if (exists) return;

  const block = { x, y, z, type: state.selectedColor };
  state.worldData.push(block);

  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({ color: state.selectedColor }),
  );

  mesh.position.set(x, y, z);
  mesh.userData = { isBlock: true, ...block };

  state.scene.add(mesh);
  state.objects.push(mesh);

  // physics
  const body = world.createRigidBody(
    RAPIER.RigidBodyDesc.fixed().setTranslation(x, y, z),
  );

  world.createCollider(RAPIER.ColliderDesc.cuboid(0.5, 0.5, 0.5), body);

  // ✅ store
  mesh.userData.physicsBody = body;
}

export function removeBlock(mesh) {
  state.scene.remove(mesh);

  const { x, y, z } = mesh.position;

  const index = state.worldData.findIndex(
    (b) =>
      b.x === Math.round(x) && b.y === Math.round(y) && b.z === Math.round(z),
  );

  if (index !== -1) state.worldData.splice(index, 1);

  const idx = state.objects.indexOf(mesh);
  if (idx !== -1) state.objects.splice(idx, 1);
}

// ================= WORLD =================

export function exportMapGLTF() {
  const exporter = new GLTFExporter();

  const geometries = [];
  state.scene.traverse((obj) => {
    if (!obj.isMesh) return;

    // 🚫 skip unwanted things
    if (
      obj.userData.isPlayer ||
      obj.userData.isPreview ||
      obj.userData.isGround ||
      obj.userData.isLabel
    )
      return;

    obj.updateWorldMatrix(true, false);

    let geo = obj.geometry.clone();

    // ✅ ensure indexed FIRST
    if (!geo.index) {
      geo = BufferGeometryUtils.mergeVertices(geo);
    }

    // ✅ apply transform AFTER indexing
    geo.applyMatrix4(obj.matrixWorld);

    // ✅ ensure normals exist
    if (!geo.attributes.normal) {
      geo.computeVertexNormals();
    }

    // ✅ remove problematic attributes
    geo.deleteAttribute("color");
    geo.deleteAttribute("uv2");

    geometries.push(geo);
  });

  console.log("Exporting geometries:", geometries.length);

  if (!geometries.length) {
    console.warn("Nothing to export");
    return;
  }

  // ================= MERGE =================
  // ================= MERGE =================
  let mergedGeometry = BufferGeometryUtils.mergeGeometries(geometries);

  if (!mergedGeometry || !mergedGeometry.attributes.position) {
    console.error("❌ Merge failed");
    return;
  }

  // 🔥 CRITICAL FIX: REMOVE INDEX COMPLETELY
  // mergedGeometry = mergedGeometry.toNonIndexed();

  console.log("vertex count:", mergedGeometry.attributes.position.count);

  // recompute normals
  mergedGeometry.computeVertexNormals();

  // ================= CREATE MESH =================
  const mergedMesh = new THREE.Mesh(
    mergedGeometry,
    new THREE.MeshStandardMaterial({ color: 0x00ff00 }),
  );

  const exportScene = new THREE.Scene();
  exportScene.add(mergedMesh);

  // ================= EXPORT =================
  exporter.parse(
    exportScene,
    (result) => {
      const json = JSON.stringify(result, null, 2);

      const blob = new Blob([json], {
        type: "application/json",
      });

      saveGLTFToStorage(json); // STORE STRING (IMPORTANT FIX)

      // state.socket.emit("updateMap", {
      //   room: state.roomId,
      //   map: json,
      // });
    },
    {
      binary: false,
    },
  );

  function downloadFile(blob, name) {
    console.log("Final file size:", blob.size);

    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
  }
}

export function loadGLBFromFile(file) {
  const reader = new FileReader();

  reader.onload = (e) => {
    try {
      const arrayBuffer = e.target.result;

      const loader = new GLTFLoader();

      loader.parse(
        arrayBuffer,
        "", // no path needed (GLB is self-contained)
        (gltf) => {
          console.log("✅ GLB loaded");

          // 🔥 clear old world
          rebuildWorld(state.scene, []);

          // remove old compiled map if exists
          if (state.compiledMap) {
            state.scene.remove(state.compiledMap);
          }

          const model = gltf.scene;

          model.traverse((child) => {
            if (!child.isMesh) return;

            const mat = child.material;

            if (mat) {
              mat.transparent = false;
              mat.opacity = 1;
              mat.depthWrite = true;
            }
          });

          // 🔥 FIX ORIENTATION
          // model.rotation.x = -Math.PI; // most common fix

          // OPTIONAL: if still wrong, try these:
          // model.rotation.x = Math.PI / 2;
          // model.rotation.z = Math.PI;
          // model.rotation.y = Math.PI;

          // 🔥 CENTER + GROUND SNAP (recommended)
          const box = new THREE.Box3().setFromObject(model);
          const center = box.getCenter(new THREE.Vector3());

          model.position.sub(center); // center it

          // snap to ground
          box.setFromObject(model);
          model.position.y -= box.min.y;

          state.compiledMap = model;
          state.scene.add(model);

          // 🔥 OPTIONAL: store it (convert to JSON if needed)
          const exporter = new GLTFExporter();
          exporter.parse(
            gltf.scene,
            (result) => {
              const json = JSON.stringify(result);
              saveGLTFToStorage(json);
            },
            { binary: false },
          );
        },
        (err) => {
          console.error("❌ Failed to parse GLB:", err);
        },
      );
    } catch (err) {
      console.error("❌ Error reading GLB:", err);
    }
  };

  reader.readAsArrayBuffer(file); // 🔥 IMPORTANT
}

export function loadGLTFFromFile(file) {
  const reader = new FileReader();

  reader.onload = (e) => {
    try {
      const text = e.target.result;

      // ✅ Try parsing as JSON
      const json = JSON.parse(text);

      console.log("✅ Parsed JSON:", json);

      // ✅ Store JSON string
      saveGLTFToStorage(JSON.stringify(json));

      // ✅ Load using JSON path
      loadGLTFFromJSON(JSON.stringify(json), state.scene, () => {
        console.log("✅ Loaded via JSON pipeline");
      });
    } catch (err) {
      console.error("❌ Not valid JSON GLTF (probably .glb binary):", err);
    }
  };

  reader.readAsText(file); // 🔥 IMPORTANT: read as TEXT
}

export function loadOBJFromFile(file) {
  const reader = new FileReader();

  reader.onload = (e) => {
    try {
      const text = e.target.result;

      const loader = new OBJLoader();
      const obj = loader.parse(text);

      // ================= CLEAN OLD WORLD =================
      rebuildWorld(state.scene, []);

      if (state.compiledMap) {
        state.scene.remove(state.compiledMap);
      }

      state.compiledBodies.forEach((b) => world.removeRigidBody(b));
      state.compiledBodies.length = 0;

      state.mapType = "obj";
      state.isCreatorMode = false;

      // ================= AUTO DETECTION =================

      const box = new THREE.Box3().setFromObject(obj);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());

      // -------------------------------
      // 1. AUTO ORIENTATION DETECTION
      // -------------------------------
      // Heuristic:
      // If model is very tall → likely Y-up → rotate to horizontal
      // const isVertical = size.y > Math.max(size.x, size.z) * 1.5;

      obj.rotation.x = -Math.PI / 2;

      obj.updateMatrixWorld(true);

      // -------------------------------
      // 2. AUTO SCALE TO WORLD SIZE
      // -------------------------------
      const WORLD_TARGET_SIZE = constants.WORLD_SIZE; // adjust for your game scale
      const maxSize = Math.max(size.x, size.y, size.z);

      if (maxSize > 0) {
        const scale = WORLD_TARGET_SIZE / maxSize;
        obj.scale.setScalar(scale);
      }

      obj.updateMatrixWorld(true);

      // recompute after scaling
      box.setFromObject(obj);

      // -------------------------------
      // 3. CENTER + GROUND SNAP
      // -------------------------------
      const newCenter = box.getCenter(new THREE.Vector3());

      obj.position.sub(newCenter);

      // snap to ground (y = 0)
      // snap to ground (y = 0)
      box.setFromObject(obj);

      // move model so its lowest point sits at Y = 0
      obj.position.y -= box.min.y;

      // 🔥 ADD BUFFER SPACE ABOVE GROUND
      obj.position.y += constants.SPAWN_BUFFER_Y;

      obj.updateMatrixWorld(true);

      // ================= ADD TO SCENE =================
      state.scene.add(obj);
      state.compiledMap = obj;

      // ================= PHYSICS =================
      const geometries = [];

      obj.traverse((child) => {
        if (!child.isMesh) return;

        let geometry = child.geometry.clone();

        child.updateMatrixWorld(true);
        geometry.applyMatrix4(child.matrixWorld);

        if (!geometry.index) {
          geometry = BufferGeometryUtils.mergeVertices(geometry);
        }

        geometries.push(geometry);
      });

      if (!geometries.length) {
        console.warn("No geometry found in OBJ");
        return;
      }

      const merged = BufferGeometryUtils.mergeGeometries(geometries);

      if (!merged || !merged.attributes.position) {
        console.error("Failed to merge geometry");
        return;
      }

      merged.computeVertexNormals();

      const vertices = new Float32Array(merged.attributes.position.array);
      const indices = new Uint32Array(merged.index.array);

      const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
      state.compiledBodies.push(body);

      world.createCollider(
        RAPIER.ColliderDesc.trimesh(vertices, indices),
        body,
      );
      // SAVE AS GLTF ALWAYS
      exportMapGLTF();

      console.log("✅ Smart OBJ loaded (auto-scale + auto-orientation)");
    } catch (err) {
      console.error("Failed to load OBJ:", err);
    }
  };

  reader.readAsText(file);
}

export function createWorld(scene, worldData) {
  const objects = [];

  worldData?.forEach((b) => {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial({ color: 0x00ff00 }),
    );

    mesh.position.set(b.x, b.y, b.z);
    mesh.userData = { isBlock: true };

    scene.add(mesh);
    objects.push(mesh);

    // physics
    const body = world.createRigidBody(
      RAPIER.RigidBodyDesc.fixed().setTranslation(b.x, b.y, b.z),
    );

    world.createCollider(RAPIER.ColliderDesc.cuboid(0.5, 0.5, 0.5), body);

    // ✅ store reference
    mesh.userData.physicsBody = body;
  });

  return objects;
}

// ================= REBUILD WORLD =================

export function rebuildWorld(scene, worldData) {
  if (state.compiledMap) {
    scene.remove(state.compiledMap);
    state.compiledMap = null;
  }

  state.compiledBodies.forEach((b) => world.removeRigidBody(b));
  state.compiledBodies.length = 0;
  // ================= REMOVE OLD BLOCKS =================
  state.objects?.forEach((obj) => {
    // remove mesh
    scene.remove(obj);

    // remove physics body
    if (obj.userData.physicsBody) {
      world.removeRigidBody(obj.userData.physicsBody);
    }
  });

  state.objects.length = 0;

  // ================= REBUILD BLOCKS =================
  state.objects = createWorld(scene, worldData);
}
