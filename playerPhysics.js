import { world } from "../physics.js";
import RAPIER from "https://cdn.jsdelivr.net/npm/@dimforge/rapier3d-compat@0.12.0/+esm";
import { state } from "../state.js";

export function createPlayerPhysics() {
  const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
    .setTranslation(0, 50, 0)
    .setLinearDamping(0.9);

  const body = world.createRigidBody(bodyDesc);

  const colliderDesc = RAPIER.ColliderDesc.capsule(0.5, 0.5);
  const collider = world.createCollider(colliderDesc, body);

  state.playerPhysics = { body, collider };
}
