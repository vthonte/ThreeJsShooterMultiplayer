import { GLTFExporter } from "https://cdn.jsdelivr.net/npm/three@0.178.0/examples/jsm/exporters/GLTFExporter.js";
import { OBJLoader } from "https://cdn.jsdelivr.net/npm/three@0.178.0/examples/jsm/loaders/OBJLoader.js";
import { GLTFLoader } from "https://cdn.jsdelivr.net/npm/three@0.178.0/examples/jsm/loaders/GLTFLoader.js";
import * as BufferGeometryUtils from "https://cdn.jsdelivr.net/npm/three@0.178.0/examples/jsm/utils/BufferGeometryUtils.js";
import RAPIER from "https://cdn.jsdelivr.net/npm/@dimforge/rapier3d-compat@0.12.0/+esm";
import { state } from "./state.js";
import { world } from "./physics.js";
import { rebuildWorld } from "./scene.js";

const DB_NAME = "mapDB";
const DB_VERSION = 1;

let db;

export function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("mapDB", 1);

    request.onupgradeneeded = (e) => {
      const db = e.target.result;

      if (!db.objectStoreNames.contains("maps")) {
        db.createObjectStore("maps");
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = reject;
  });
}

export function convertSceneToGLTF(scene) {
  const exporter = new GLTFExporter();

  exporter.parse(
    scene,
    (result) => {
      if (result instanceof ArrayBuffer) {
        saveGLTFToStorage(result);
      }
    },
    { binary: true },
  );
}

export function restoreMapFromStorage(scene) {
  const data = localStorage.getItem("map_gltf");
  if (!data) return;

  fetch(data)
    .then((res) => res.arrayBuffer())
    .then((buffer) => {
      const loader = new GLTFLoader();

      loader.parse(buffer, "", (gltf) => {
        scene.add(gltf.scene);
        state.compiledMap = gltf.scene;

        rebuildGLTFPhysics(gltf.scene);
      });
    });
}

export async function saveGLTFToStorage(gltfString) {
  const db = await openDB();

  const tx = db.transaction("maps", "readwrite");
  const store = tx.objectStore("maps");

  store.put(gltfString, "main");
}

export async function loadGLTFFromStorage() {
  const db = await openDB();

  return new Promise((resolve) => {
    const tx = db.transaction("maps", "readonly");
    const store = tx.objectStore("maps");

    const req = store.get("main");

    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => resolve(null);
  });
}

export function loadGLTFFromArrayBuffer(buffer, scene) {
  const loader = new GLTFLoader();

  loader.parse(buffer, "", (gltf) => {
    rebuildWorld(scene, []);

    if (state.compiledMap) {
      scene.remove(state.compiledMap);
    }

    const map = gltf.scene;
    scene.add(map);
    state.compiledMap = map;

    buildPhysicsFromGLTF(map);
  });
}

function buildPhysicsFromGLTF(map) {
  state.compiledBodies.forEach((b) => world.removeRigidBody(b));
  state.compiledBodies.length = 0;

  const geometries = [];

  map.traverse((child) => {
    if (!child.isMesh) return;

    let geo = child.geometry.clone();

    child.updateWorldMatrix(true, false);
    geo.applyMatrix4(child.matrixWorld);

    // ✅ FIX 1: ensure indexed
    if (!geo.index) {
      geo = BufferGeometryUtils.mergeVertices(geo);
    }

    geometries.push(geo);
  });

  if (!geometries.length) {
    console.warn("No geometry for physics");
    return;
  }

  // ✅ FIX 2: merge all
  const merged = BufferGeometryUtils.mergeGeometries(geometries);

  if (!merged || !merged.attributes.position) {
    console.error("Physics merge failed");
    return;
  }

  // ✅ FIX 3: ensure index exists
  if (!merged.index) {
    console.error("Merged geometry has no index");
    return;
  }

  const vertices = new Float32Array(merged.attributes.position.array);
  const indices = new Uint32Array(merged.index.array);

  const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  state.compiledBodies.push(body);

  world.createCollider(RAPIER.ColliderDesc.trimesh(vertices, indices), body);

  console.log("✅ Physics rebuilt (merged)");
}

export function resetWorld(scene) {
  if (state.compiledMap) {
    scene.remove(state.compiledMap);
    state.compiledMap = null;
  }

  state.compiledBodies.forEach((b) => world.removeRigidBody(b));
  state.compiledBodies.length = 0;

  state.objects.forEach((obj) => {
    scene.remove(obj);
  });
  state.objects.length = 0;
}
