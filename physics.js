import RAPIER from "https://cdn.jsdelivr.net/npm/@dimforge/rapier3d-compat@0.12.0/+esm";
import { state } from "./state.js";

export let world;

export async function initPhysics() {
  await RAPIER.init();

  world = new RAPIER.World({
    x: 0,
    y: -state.gravity,
    z: 0,
  });

  return world;
}

export function buildPhysicsFromGLTF(map) {
  state.compiledBodies.forEach((b) => world.removeRigidBody(b));
  state.compiledBodies.length = 0;

  map.traverse((child) => {
    if (!child.isMesh) return;

    const geo = child.geometry.clone();

    child.updateWorldMatrix(true, false);
    geo.applyMatrix4(child.matrixWorld);

    const vertices = geo.attributes.position.array;
    const indices = geo.index ? geo.index.array : undefined;

    const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
    state.compiledBodies.push(body);

    world.createCollider(RAPIER.ColliderDesc.trimesh(vertices, indices), body);
  });
}

export function rebuildGLTFPhysics(scene) {
  state.compiledBodies.forEach((b) => world.removeRigidBody(b));
  state.compiledBodies.length = 0;

  const geometries = [];

  scene.traverse((child) => {
    if (!child.isMesh) return;

    let geometry = child.geometry.clone();

    child.updateMatrixWorld(true);
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

  world.createCollider(RAPIER.ColliderDesc.trimesh(vertices, indices), body);
}
