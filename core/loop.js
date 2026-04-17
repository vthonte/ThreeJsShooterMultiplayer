import { damagePlayer } from "../player/playerDetails.js";
import { state } from "../state.js";
import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.178.0/build/three.module.js";
import { world } from "../physics.js";

import Stats from "https://cdnjs.cloudflare.com/ajax/libs/stats.js/r17/Stats.min.js";

const stats = new Stats();
document.body.appendChild(stats.dom);

export function animate() {
  stats.begin();
  if (!state.isAlive && !state.isSpectating) return;
  // if (!state.camera) return;

  requestAnimationFrame(animate);

  // ================= PHYSICS STEP =================
  world.step();

  // ================= SPECTATE =================
  if (state.isSpectating) {
    const targets = Object.values(state.otherPlayers);

    if (targets.length > 0) {
      const target = targets[state.spectateIndex % targets.length];

      state.camera.position.lerp(
        new THREE.Vector3(
          target.position.x,
          target.position.y + 3,
          target.position.z + 6,
        ),
        0.1,
      );

      state.camera.lookAt(target.position);
    }

    state.renderer.render(state.scene, state.camera);

    stats.end();
    return;
  }

  // ================= PLAYER MOVEMENT =================
  const body = state.playerPhysics?.body;

  if (body) {
    const vel = body.linvel();

    // movement input
    const direction = new THREE.Vector3();

    if (state.move.forward) direction.z -= 1;
    if (state.move.back) direction.z += 1;
    if (state.move.left) direction.x -= 1;
    if (state.move.right) direction.x += 1;

    direction.normalize();

    // rotate movement with camera
    direction.applyQuaternion(state.camera.quaternion);

    // apply velocity (keep Y from physics)
    body.setLinvel(
      {
        x: direction.x * 5,
        y: vel.y,
        z: direction.z * 5,
      },
      true,
    );

    // ================= JUMP =================
    if (state.move.jump && Math.abs(vel.y) < 0.05) {
      body.applyImpulse({ x: 0, y: state.jumpForce, z: 0 }, true);
      state.move.jump = false;
    }

    // ================= CAMERA SYNC =================
    const pos = body.translation();
    state.camera.position.set(pos.x, pos.y + 1, pos.z);
  }

  // ================= MULTIPLAYER =================
  if (state.camera)
    state.socket.emit("move", {
      x: state.camera.position.x,
      y: state.camera.position.y,
      z: state.camera.position.z,
    });

  // ================= ENEMIES =================
  state.enemies.forEach((enemy) => {
    const dir = new THREE.Vector3()
      .subVectors(state.camera.position, enemy.position)
      .normalize();

    const distance = enemy.position.distanceTo(state.camera.position);

    // move enemy
    enemy.position.add(dir.multiplyScalar(enemy.userData.speed));

    // attack
    if (distance < 2) {
      if (enemy.userData.attackCooldown <= 0) {
        damagePlayer(5);
        enemy.userData.attackCooldown = 1;
      }
    }

    enemy.userData.attackCooldown -= 0.016;
  });

  // ================= RENDER =================
  if (state.renderer?.render) state.renderer.render(state.scene, state.camera);

  stats.end();
}
