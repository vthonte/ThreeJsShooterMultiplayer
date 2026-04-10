import constants from "./constants.js";

export function createWorld(scene, THREE) {
  const objects = [];

  // floor
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(constants.WORLD_SIZE, constants.WORLD_SIZE),
    new THREE.MeshStandardMaterial({ color: 0xaaaaaa }),
  );
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);

  // buildings
  for (let i = 0; i < 50; i++) {
    const geo = new THREE.BoxGeometry(
      Math.random() * 3 + 1,
      Math.random() * 10 + 2,
      Math.random() * 3 + 1,
    );

    const box = new THREE.Mesh(
      geo,
      new THREE.MeshStandardMaterial({ color: Math.random() * 0xffffff }),
    );

    box.position.set(
      (Math.random() - 0.5) * 100,
      geo.parameters.height / 2,
      (Math.random() - 0.5) * 100,
    );

    scene.add(box);
    objects.push(box); // 👈 track collision objects
  }

  return objects;
}
