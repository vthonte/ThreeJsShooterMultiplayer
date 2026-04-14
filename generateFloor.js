import fs from "fs";

// ---- CONFIG ----
const INPUT_FILE = "./maps/world.json";
const OUTPUT_FILE = "./maps/world_filled.json";
const FLOOR_Y = 0;

// -----------------

function generateFullFloor(worldData) {
  let minX = Infinity,
    maxX = -Infinity;
  let minZ = Infinity,
    maxZ = -Infinity;

  // find bounds
  for (const b of worldData) {
    if (b.x < minX) minX = b.x;
    if (b.x > maxX) maxX = b.x;
    if (b.z < minZ) minZ = b.z;
    if (b.z > maxZ) maxZ = b.z;
  }

  const existing = new Set(worldData.map((b) => `${b.x},${b.y},${b.z}`));
  const result = [...worldData];

  // fill missing floor
  for (let x = minX; x <= maxX; x++) {
    for (let z = minZ; z <= maxZ; z++) {
      const key = `${x},${FLOOR_Y},${z}`;

      if (!existing.has(key)) {
        result.push({
          x,
          y: FLOOR_Y,
          z,
          type: "grass",
        });
      }
    }
  }

  return result;
}

// ---- RUN ----
function main() {
  if (!fs.existsSync(INPUT_FILE)) {
    console.error("Input file not found:", INPUT_FILE);
    return;
  }

  const raw = fs.readFileSync(INPUT_FILE, "utf-8");
  const data = JSON.parse(raw);

  const world = data.world || data;

  const filled = generateFullFloor(world);

  const output = {
    world: filled,
    savedAt: new Date().toISOString(),
  };

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2));

  console.log("Done!");
  console.log("Original blocks:", world.length);
  console.log("New blocks:", filled.length);
  console.log("Saved to:", OUTPUT_FILE);
}

main();
