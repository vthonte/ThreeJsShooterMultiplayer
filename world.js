import constants from "./constants.js";

const worldData = [
  { x: -1, y: 0, z: -1, type: "grass" },
  { x: 0, y: 0, z: -1, type: "grass" },
  { x: 1, y: 0, z: -1, type: "grass" },

  { x: -1, y: 0, z: 0, type: "grass" },
  { x: 0, y: 0, z: 0, type: "grass" },
  { x: 1, y: 0, z: 0, type: "grass" },

  { x: -1, y: 0, z: 1, type: "grass" },
  { x: 0, y: 0, z: 1, type: "grass" },
  { x: 1, y: 0, z: 1, type: "grass" },
];
export function createWorld(scene, THREE, worldData) {
  const blocks = [];

  worldData.forEach((b) => {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial({ color: getColor(b.type) }),
    );

    mesh.position.set(b.x, b.y, b.z);
    mesh.userData = { isBlock: true, ...b };

    scene.add(mesh);
    blocks.push(mesh);
  });

  return blocks;
}

function getColor(type) {
  if (type === "grass") return 0x00ff00;
  if (type === "stone") return 0x888888;
  return 0xffffff;
}
