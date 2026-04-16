import constants from "./constants.js";
import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.178.0/build/three.module.js";
import { state } from "./state.js";
import { setupControls } from "./controls.js";
import { createEnemies } from "./enemies.js";
import { createPlayerPhysics } from "./playerPhysics.js";
import { GLTFLoader } from "https://cdn.jsdelivr.net/npm/three@0.178.0/examples/jsm/loaders/GLTFLoader.js";
import * as BufferGeometryUtils from "https://cdn.jsdelivr.net/npm/three@0.178.0/examples/jsm/utils/BufferGeometryUtils.js";
import { world } from "./physics.js";
import RAPIER from "https://cdn.jsdelivr.net/npm/@dimforge/rapier3d-compat@0.12.0/+esm";
import { GLTFExporter } from "https://cdn.jsdelivr.net/npm/three@0.178.0/examples/jsm/exporters/GLTFExporter.js";
import { OBJLoader } from "https://cdn.jsdelivr.net/npm/three@0.178.0/examples/jsm/loaders/OBJLoader.js";

// ================= INIT SCENE =================

export function initScene() {
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
  if (!state.isCreatorMode && state.mapType === "glb") {
    loadGLBMap(scene);
  } else {
    state.objects = createWorld(scene, state.worldData);
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
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(1, 2, 1),
    new THREE.MeshStandardMaterial({ color: data.color }),
  );

  mesh.userData.isPlayer = true;
  mesh.userData.id = id;

  const label = createNameLabel(data.name);
  label.position.set(0, 2.5, 0);
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

export function exportMapGLB() {
  const exporter = new GLTFExporter();

  const geometries = [];

  state.scene.traverse((obj) => {
    if (!obj.isMesh) return;

    // 🚫 skip unwanted things
    if (
      obj.userData.isPlayer ||
      obj.userData.isPreview ||
      obj.userData.isGround
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
  mergedGeometry = mergedGeometry.toNonIndexed();

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
      console.log("Is ArrayBuffer:", result instanceof ArrayBuffer);

      let blob;

      if (result instanceof ArrayBuffer) {
        console.log("✅ GLB export success");

        blob = new Blob([result], {
          type: "model/gltf-binary",
        });

        downloadFile(blob, "map.glb");
      } else {
        console.error("❌ Still exporting JSON — something is wrong");

        const json = JSON.stringify(result);
        blob = new Blob([json], { type: "application/json" });

        downloadFile(blob, "debug.gltf");
      }
    },
    { binary: true },
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

  reader.onload = async (e) => {
    try {
      const arrayBuffer = e.target.result;

      const loader = new GLTFLoader();

      loader.parse(arrayBuffer, "", (gltf) => {
        // 🧹 clear existing world
        // 🧹 remove old blocks
        rebuildWorld(state.scene, []);

        // 🧹 remove old GLB
        if (state.compiledMap) {
          state.scene.remove(state.compiledMap);
        }

        state.compiledBodies.forEach((b) => world.removeRigidBody(b));
        state.compiledBodies.length = 0;

        // ✅ set mode
        state.mapType = "glb";
        state.isCreatorMode = false;

        // ✅ add new map
        const map = gltf.scene;
        state.scene.add(map);
        state.compiledMap = map;

        // 🔥 build physics
        const geometries = [];

        map.traverse((child) => {
          if (!child.isMesh) return;

          let geometry = child.geometry.clone();

          child.updateWorldMatrix(true, false);
          geometry.applyMatrix4(child.matrixWorld);

          if (!geometry.index) {
            geometry = BufferGeometryUtils.mergeVertices(geometry);
          }

          geometries.push(geometry);
        });

        const merged = BufferGeometryUtils.mergeGeometries(geometries);

        const vertices = new Float32Array(merged.attributes.position.array);
        const indices = new Uint32Array(merged.index.array);

        const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
        state.compiledBodies.push(body);

        world.createCollider(
          RAPIER.ColliderDesc.trimesh(vertices, indices),
          body,
        );

        console.log("GLB map loaded");
      });
    } catch (err) {
      console.error("Failed to load GLB:", err);
    }
  };

  reader.readAsArrayBuffer(file);
}

export function loadOBJFromFile(file) {
  const reader = new FileReader();

  reader.onload = (e) => {
    try {
      const text = e.target.result;

      const loader = new OBJLoader();
      const obj = loader.parse(text);

      // 🧹 CLEAN OLD WORLD
      rebuildWorld(state.scene, []);

      if (state.compiledMap) {
        state.scene.remove(state.compiledMap);
      }

      state.compiledBodies.forEach((b) => world.removeRigidBody(b));
      state.compiledBodies.length = 0;

      state.mapType = "obj";
      state.isCreatorMode = false;

      // ✅ ADD TO SCENE
      state.scene.add(obj);
      state.compiledMap = obj;

      // ================= PHYSICS =================
      const geometries = [];

      obj.traverse((child) => {
        if (!child.isMesh) return;

        let geometry = child.geometry.clone();

        child.updateWorldMatrix(true, false);
        geometry.applyMatrix4(child.matrixWorld);

        // ensure indexed
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

      const vertices = new Float32Array(merged.attributes.position.array);
      const indices = new Uint32Array(merged.index.array);

      const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
      state.compiledBodies.push(body);

      world.createCollider(
        RAPIER.ColliderDesc.trimesh(vertices, indices),
        body,
      );

      console.log("✅ OBJ map loaded");
    } catch (err) {
      console.error("Failed to load OBJ:", err);
    }
  };

  reader.readAsText(file); // OBJ is TEXT, not ArrayBuffer
}

function loadGLBMap(scene) {
  const loader = new GLTFLoader();

  loader.load("/map.glb", (gltf) => {
    // 🧹 remove old blocks
    rebuildWorld(scene, []);

    // 🧹 remove old GLB
    if (state.compiledMap) {
      scene.remove(state.compiledMap);
    }

    state.compiledBodies.forEach((b) => world.removeRigidBody(b));
    state.compiledBodies.length = 0;

    // ✅ add new map
    const map = gltf.scene;
    scene.add(map);
    state.compiledMap = map;

    // 🔥 physics
    map.traverse((child) => {
      if (!child.isMesh) return;

      let geometry = child.geometry.clone();

      child.updateWorldMatrix(true, false);
      geometry.applyMatrix4(child.matrixWorld);

      if (!geometry.index) {
        geometry = BufferGeometryUtils.mergeVertices(geometry);
      }

      const vertices = geometry.attributes.position.array;
      const indices = geometry.index.array;

      const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
      state.compiledBodies.push(body);

      world.createCollider(
        RAPIER.ColliderDesc.trimesh(vertices, indices),
        body,
      );
    });
  });
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
