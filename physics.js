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
