import constants from "./constants.js";
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

export function rebuildWorld(scene, THREE, worldData) {
  // remove old world mesh
  const old = scene.children.filter((c) => c.userData.isWorld);

  old.forEach((m) => scene.remove(m));

  // create new instanced world
  return createWorld(scene, THREE, worldData);
}
