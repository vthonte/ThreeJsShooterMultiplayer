import { damagePlayer } from "../player/playerDetails.js";
import { state } from "../state.js";
import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.178.0/build/three.module.js";

export function animate() {
  if (!state.isAlive && !state.isSpectating) return;

  // spectate mode
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

    requestAnimationFrame(animate);
    state.renderer.render(state.scene, state.camera);
    return;
  }

  state.socket.emit("move", {
    x: state.camera.position.x,
    y: state.camera.position.y,
    z: state.camera.position.z,
  });

  // gravity
  state.yVelocity += state.gravity;
  state.camera.position.y += state.yVelocity;

  if (state.camera.position.y <= 2) {
    state.camera.position.y = 2;
    state.yVelocity = 0;
    state.isOnGround = true;
  }

  state.enemies.forEach((enemy) => {
    const dir = new THREE.Vector3()
      .subVectors(state.camera.position, enemy.position)
      .normalize();

    const distance = enemy.position.distanceTo(state.camera.position);

    // move
    enemy.position.add(dir.multiplyScalar(enemy.userData.speed));

    // attack
    if (distance < 2) {
      if (enemy.userData.attackCooldown <= 0) {
        damagePlayer(5); // 👈 THIS WAS MISSING
        enemy.userData.attackCooldown = 1;
      }
    }

    enemy.userData.attackCooldown -= 0.016; // approx frame time
  });

  requestAnimationFrame(animate);

  if (state.move.forward) state.controls.moveForward(0.1);
  if (state.move.back) state.controls.moveForward(-0.1);
  if (state.move.left) state.controls.moveRight(-0.1);
  if (state.move.right) state.controls.moveRight(0.1);

  state.renderer.render(state.scene, state.camera);
}
