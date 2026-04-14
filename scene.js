import constants from "./constants.js";
import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.178.0/build/three.module.js";
import { state } from "./state.js";
import { setupControls } from "./controls.js";
import { createEnemies } from "./enemies.js";

export function initScene(THREE) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87ceeb); // sky blue

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

  // 🌍 ground (no blocks, just floor)
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(constants.WORLD_SIZE, constants.WORLD_SIZE),
    new THREE.MeshStandardMaterial({ color: 0x88cc88 }), // grass color
  );

  const buildPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(500, 500),
    new THREE.MeshBasicMaterial({
      visible: false, // invisible but raycastable
    }),
  );

  buildPlane.rotation.x = -Math.PI / 2;
  buildPlane.position.y = 0;
  buildPlane.userData.isGround = true;

  scene.add(buildPlane);

  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  // 🌫️ fog (gives depth, looks nicer)
  scene.fog = new THREE.Fog(0x87ceeb, 50, 200);

  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  return { scene, camera, renderer, buildPlane };
}

// ---------------- PLAYER CREATE ----------------

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

  scene.add(mesh);
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

export function addBlock(x, y, z) {
  const exists = state.worldData.some(
    (b) => b.x === x && b.y === y && b.z === z,
  );

  if (exists) return;

  const block = { x, y, z, type: "grass" };
  state.worldData.push(block);

  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({ color: state.selectedColor }),
  );

  mesh.position.set(x, y, z);
  mesh.userData = { isBlock: true, ...block };

  scene.add(mesh);
  state.objects.push(mesh);
}

export function removeBlock(mesh) {
  scene.remove(mesh);

  const { x, y, z } = mesh.position;

  const index = state.worldData.findIndex(
    (b) =>
      b.x === Math.round(x) && b.y === Math.round(y) && b.z === Math.round(z),
  );
  if (index !== -1) state.worldData.splice(index, 1);

  const idx = state.objects.indexOf(mesh);
  if (idx !== -1) state.objects.splice(idx, 1);
}

export function createWorld(scene, THREE, worldData) {
  const geometry = new THREE.BoxGeometry(1, 1, 1);

  const materials = {
    grass: new THREE.MeshStandardMaterial({ color: 0x00ff00 }),
    stone: new THREE.MeshStandardMaterial({ color: 0x888888 }),
    default: new THREE.MeshStandardMaterial({ color: 0xffffff }),
  };

  // create ONE instanced mesh per type (important for colors)
  const groups = {
    grass: [],
    stone: [],
    default: [],
  };

  worldData.forEach((b) => {
    const type = groups[b.type] ? b.type : "default";
    groups[type].push(b);
  });

  const instancedMeshes = [];

  for (const type in groups) {
    const list = groups[type];

    const mesh = new THREE.InstancedMesh(
      geometry,
      materials[type],
      list.length,
    );

    const dummy = new THREE.Object3D();

    list.forEach((b, i) => {
      dummy.position.set(b.x, b.y, b.z);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });

    mesh.userData = { type, count: list.length };

    scene.add(mesh);
    instancedMeshes.push(mesh);
  }

  return instancedMeshes;
}

/* =========================
   REBUILD WORLD (IMPORTANT)
   ========================= */

export function rebuildWorld(scene, worldData) {
  // remove old world mesh
  const old = scene.children.filter((c) => c.userData.isWorld);

  old.forEach((m) => scene.remove(m));

  // create new instanced world
  return createWorld(scene, THREE, worldData);
}

// scene
const { scene, camera, renderer, buildPlane } = initScene(THREE);

state.scene = scene;
state.camera = camera;
state.renderer = renderer;
state.buildPlane = buildPlane;

state.objects = createWorld(state.scene, THREE, state.worldData);
state.enemies = state.singlePlayer ? createEnemies(state.scene, THREE) : [];
state.controls = setupControls(state.camera, state.isCreatorMode);

state.raycaster = new THREE.Raycaster();
state.center = new THREE.Vector2(0, 0);

state.preview = new THREE.Mesh(
  new THREE.BoxGeometry(1, 1, 1),
  new THREE.MeshBasicMaterial({
    color: 0xffffff,
    // wireframe: true,
    transparent: true,
    opacity: 0.5,
  }),
);

state.preview.visible = false;
state.scene.add(state.preview);

state.enemies = state.isSinglePlayer ? createEnemies(state.scene, THREE) : [];
state.controls = setupControls(state.camera, state.isCreatorMode);

state.raycaster = new THREE.Raycaster();
state.center = new THREE.Vector2(0, 0);

state.pos = new THREE.Vector3();

state.controls = setupControls(state.camera, state.isCreatorMode);
