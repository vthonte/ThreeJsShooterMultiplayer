export function generateWorld(size) {
  const world = [];

  const SIZE = size;
  const HALF = SIZE / 2;

  // -------------------------
  // 1. FLAT GROUND PLATFORM
  // -------------------------
  for (let x = -HALF; x <= HALF; x += 2) {
    for (let z = -HALF; z <= HALF; z += 2) {
      world.push({
        x,
        y: 0,
        z,
        type: "grass",
      });
    }
  }

  // -------------------------
  // 2. CENTRAL FORT (MAIN FIGHT AREA)
  // -------------------------
  const fortSize = 20;

  for (let x = -fortSize; x <= fortSize; x += 2) {
    for (let z = -fortSize; z <= fortSize; z += 2) {
      world.push({
        x,
        y: 1,
        z,
        type: "stone",
      });
    }
  }

  // -------------------------
  // 3. CENTRAL TOWER
  // -------------------------
  for (let y = 2; y <= 10; y++) {
    world.push({ x: 0, y, z: 0, type: "stone" });
  }

  // -------------------------
  // 4. 4 CORNER OUTPOST TOWERS
  // -------------------------
  const corners = [
    [-80, -80],
    [80, -80],
    [-80, 80],
    [80, 80],
  ];

  for (const [x, z] of corners) {
    for (let y = 1; y <= 6; y++) {
      world.push({ x, y, z, type: "stone" });
    }
  }

  // -------------------------
  // 5. BRIDGES TO CENTER
  // -------------------------
  for (let i = -80; i <= 80; i += 2) {
    world.push({ x: i, y: 2, z: 0, type: "stone" }); // east-west bridge
    world.push({ x: 0, y: 2, z: i, type: "stone" }); // north-south bridge
  }

  // -------------------------
  // 6. RANDOM COVER ROCKS
  // -------------------------
  for (let i = 0; i < 120; i++) {
    const x = Math.floor(Math.random() * 160 - 80);
    const z = Math.floor(Math.random() * 160 - 80);

    world.push({
      x,
      y: 1,
      z,
      type: "stone",
    });
  }

  return world;
}
