import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.178.0/build/three.module.js";
import { initScene } from "./scene.js";
import { createWorld } from "./world.js";
import { setupControls } from "./controls.js";
import { createEnemies } from "./enemies.js";

const raycaster = new THREE.Raycaster();
const center = new THREE.Vector2(0, 0);
let playerHealth = 100;
let isGameOver = false;

document.addEventListener("click", () => {
  shoot();
});

function shoot() {
  raycaster.setFromCamera(center, camera);

  const intersects = raycaster.intersectObjects(enemies, true);

  if (intersects.length > 0) {
    let hit = intersects[0].object;

    // 🔥 climb up to find the actual enemy group
    while (hit && !hit.userData.isEnemy) {
      hit = hit.parent;
    }

    if (hit && hit.userData.isEnemy) {
      // damage
      hit.userData.health -= 1;

      // hit feedback
      hit.children.forEach((child) => {
        if (child.material) {
          child.material.color.set(0xff5555);
        }
      });

      setTimeout(() => {
        hit.children.forEach((child) => {
          if (child.material) {
            child.material.color.set(0xff0000);
          }
        });
      }, 100);

      // death
      if (hit.userData.health <= 0) {
        scene.remove(hit);

        const index = enemies.indexOf(hit);
        if (index > -1) enemies.splice(index, 1);
      }
    }
  }
}

// make THREE available globally if needed
window.THREE = THREE;

const { scene, camera, renderer } = initScene(THREE);
const objects = createWorld(scene, THREE);
const enemies = createEnemies(scene, THREE);
const controls = setupControls(camera);

let move = { forward: false, back: false, left: false, right: false };
const speed = 0.1;

document.addEventListener("keydown", (e) => {
  if (e.key === "w") move.forward = true;
  if (e.key === "s") move.back = true;
  if (e.key === "a") move.left = true;
  if (e.key === "d") move.right = true;
});

document.addEventListener("keyup", (e) => {
  if (e.key === "w") move.forward = false;
  if (e.key === "s") move.back = false;
  if (e.key === "a") move.left = false;
  if (e.key === "d") move.right = false;
});

function animate() {
  enemies.forEach((enemy) => {
    const dir = new THREE.Vector3();
    dir.subVectors(camera.position, enemy.position);

    const distance = dir.length();
    dir.normalize();

    // 👇 try new position
    const nextPos = enemy.position
      .clone()
      .addScaledVector(dir, enemy.userData.speed);

    let collision = false;

    // check collision with buildings
    objects.forEach((obj) => {
      const box1 = new THREE.Box3().setFromObject(obj);
      const box2 = new THREE.Box3().setFromCenterAndSize(
        nextPos,
        new THREE.Vector3(1, 2, 1),
      );

      if (box1.intersectsBox(box2)) {
        collision = true;
      }
    });

    // move only if no collision
    if (!collision) {
      enemy.position.copy(nextPos);
    }

    // 👇 keep on ground
    enemy.position.y = 0;
  });

  requestAnimationFrame(animate);

  if (isGameOver) return;

  if (move.forward) controls.moveForward(speed);
  if (move.back) controls.moveForward(-speed);
  if (move.left) controls.moveRight(-speed);
  if (move.right) controls.moveRight(speed);

  renderer.render(scene, camera);
}

function damagePlayer(amount) {
  if (isGameOver) return;

  playerHealth -= amount;

  document.getElementById("health").innerText = "Health: " + playerHealth;

  // screen flash effect
  document.body.style.background = "#330000";
  setTimeout(() => {
    document.body.style.background = "";
  }, 100);

  if (playerHealth <= 0) {
    gameOver();
  }
}

function gameOver() {
  isGameOver = true;

  const div = document.createElement("div");
  div.innerText = "GAME OVER";
  div.style.position = "absolute";
  div.style.top = "50%";
  div.style.left = "50%";
  div.style.transform = "translate(-50%, -50%)";
  div.style.color = "white";
  div.style.fontSize = "50px";

  document.body.appendChild(div);
}

animate();
