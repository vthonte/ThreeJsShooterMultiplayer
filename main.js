import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.178.0/build/three.module.js";
import { initScene } from "./scene.js";
import { createWorld } from "./world.js";
import { setupControls } from "./controls.js";
import { createEnemies } from "./enemies.js";
import constants from "./constants.js";

const playerName = localStorage.getItem("playerName") || "Player";
const roomId = localStorage.getItem("roomId") || "default";
const singlePlayer = constants.IS_SINGLE_PLAYER;

const socket = io(
  `http://${window.location.hostname}:${constants.SERVER_PORT}`,
);

// const socket = io();

window.joinGame = function () {
  const input = document.getElementById("nameInput");
  playerName = input.value || "Player";

  document.getElementById("namePrompt").style.display = "none";

  // send to server
  socket.emit("join", {
    name: playerName,
    room: roomId,
  });
};

const playerList = document.getElementById("players");
const playersState = {};
const otherPlayers = {};

// 🎬 scene setup
const { scene, camera, renderer } = initScene(THREE);
const objects = createWorld(scene, THREE);
const enemies = singlePlayer ? createEnemies(scene, THREE) : [];
const controls = setupControls(camera);

//Socket

socket.on("connect", () => {
  console.log("Connected:", socket.id);

  socket.emit("join", {
    name: playerName,
    room: roomId,
  });
});

// 🟢 CREATE PLAYERS
socket.on("currentPlayers", (players) => {
  for (let id in players) {
    playersState[id] = players[id].name;

    if (id === socket.id) continue;

    if (otherPlayers[id]) continue;

    const data = players[id];

    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(1, 2, 1),
      new THREE.MeshStandardMaterial({ color: data.color }), // ✅ use server color
    );

    mesh.userData.isPlayer = true;
    mesh.userData.id = id;
    const label = createNameLabel(data.name);
    label.position.set(0, 2.5, 0);
    mesh.add(label);

    mesh.position.set(data.x, data.y, data.z);
    scene.add(mesh);
    otherPlayers[id] = mesh;
  }
  updatePlayerUI();
});

socket.on("hit", ({ damage }) => {
  damagePlayer(damage);
});

// 🟢 NEW PLAYER
socket.on("newPlayer", (player) => {
  if (otherPlayers[player.id]) return;

  playersState[player.id] = player.name;

  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(1, 2, 1),
    new THREE.MeshStandardMaterial({ color: player.color }), // ✅ from server
  );

  mesh.userData.isPlayer = true;
  mesh.userData.id = player.id;

  const label = createNameLabel(player.name); // ✅ FIXED
  label.position.set(0, 2.5, 0);
  mesh.add(label);

  mesh.position.set(player.x, player.y, player.z);

  scene.add(mesh);
  otherPlayers[player.id] = mesh;

  updatePlayerUI();
});

// 🔄 MOVE UPDATE
socket.on("playerMoved", (data) => {
  const player = otherPlayers[data.id];
  if (player) {
    player.position.set(data.x, data.y, data.z);
  }
});

// ❌ REMOVE PLAYER
socket.on("playerDisconnected", (id) => {
  delete playersState[id];

  const player = otherPlayers[id];
  if (player) {
    scene.remove(player);
    delete otherPlayers[id];
  }

  updatePlayerUI();
});

// ================= UI =================

function updatePlayerUI() {
  playerList.innerHTML = "<b>Players</b><br>";

  Object.keys(playersState).forEach((id) => {
    const name = playersState[id];

    playerList.innerHTML +=
      (id === socket.id ? "🟢 " + name : "🔵 " + name) + "<br>";
  });
}

function createNameLabel(name) {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  canvas.width = 256;
  canvas.height = 64;

  ctx.fillStyle = "white";
  ctx.font = "24px Arial";
  ctx.fillText(name, 10, 40);

  const texture = new THREE.CanvasTexture(canvas);

  const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
  const sprite = new THREE.Sprite(spriteMaterial);

  sprite.scale.set(3, 1, 1);

  return sprite;
}

socket.on("disconnecting", () => {
  console.log("Disconnecting:", socket.id);
});

// ================= GAME =================

const raycaster = new THREE.Raycaster();
const center = new THREE.Vector2(0, 0);

let playerHealth = 100;
let isGameOver = false;

let yVelocity = 0;
let isOnGround = true;

const gravity = -0.01;
const jumpForce = 0.35;

document.addEventListener("click", () => {
  shoot();
});

function shoot() {
  raycaster.setFromCamera(center, camera);

  const playerMeshes = Object.values(otherPlayers);

  const intersects = raycaster.intersectObjects(
    [...enemies, ...playerMeshes],
    true,
  );

  if (intersects.length > 0) {
    let hit = intersects[0].object;

    // climb up hierarchy
    while (hit && !hit.userData.isEnemy && !hit.userData.isPlayer) {
      hit = hit.parent;
    }

    // 🤖 ENEMY HIT
    if (hit && hit.userData.isEnemy) {
      hit.userData.health -= 1;

      hit.children.forEach((c) => {
        if (c.material) c.material.color.set(0xff5555);
      });

      setTimeout(() => {
        hit.children.forEach((c) => {
          if (c.material) c.material.color.set(0xff0000);
        });
      }, 100);

      if (hit.userData.health <= 0) {
        scene.remove(hit);
        enemies.splice(enemies.indexOf(hit), 1);
      }
    }

    // 👥 PLAYER HIT
    if (hit && hit.userData.isPlayer) {
      console.log("Hit player:", hit.userData.id);

      // visual feedback
      hit.material.color.set(hit.userData.color);

      setTimeout(() => {
        hit.material.color.set(hit.userData.color);
      }, 100);

      // 🔥 send damage to server
      socket.emit("shootPlayer", {
        targetId: hit.userData.id,
      });
    }
  }
}

// make THREE available globally if needed
window.THREE = THREE;

let move = { forward: false, back: false, left: false, right: false };
const speed = 0.1;

document.addEventListener("keydown", (e) => {
  if (e.key === "w") move.forward = true;
  if (e.key === "s") move.back = true;
  if (e.key === "a") move.left = true;
  if (e.key === "d") move.right = true;
  if (e.code === "Space" && isOnGround) {
    yVelocity = jumpForce;
    isOnGround = false;
  }
});

document.addEventListener("keyup", (e) => {
  if (e.key === "w") move.forward = false;
  if (e.key === "s") move.back = false;
  if (e.key === "a") move.left = false;
  if (e.key === "d") move.right = false;
});

function animate() {
  socket.emit("move", {
    x: camera.position.x,
    y: camera.position.y,
    z: camera.position.z,
  });
  if (camera.position.y < constants.FALL_LIMIT) {
    gameOver();
  }

  if (
    Math.abs(camera.position.x) > constants.WORLD_SIZE ||
    Math.abs(camera.position.z) > constants.WORLD_SIZE
  ) {
    // start falling when outside
    isOnGround = false;
  }

  if (
    Math.abs(camera.position.x) > constants.WORLD_SIZE ||
    Math.abs(camera.position.z) > constants.WORLD_SIZE
  ) {
    // remove ground support
    isOnGround = false;
  }

  if (camera.position.y < constants.FALL_LIMIT) {
    gameOver();
  }
  // apply gravity
  yVelocity += gravity;

  // move player vertically
  camera.position.y += yVelocity;

  // ground collision
  if (camera.position.y <= 2) {
    camera.position.y = 2; // player height
    yVelocity = 0;
    isOnGround = true;
  }

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

  const moveSpeed = isOnGround ? 0.1 : 0.1;

  if (move.forward) controls.moveForward(moveSpeed);
  if (move.back) controls.moveForward(-moveSpeed);
  if (move.left) controls.moveRight(-moveSpeed);
  if (move.right) controls.moveRight(moveSpeed);

  renderer.render(scene, camera);
}

function damagePlayer(amount) {
  if (isGameOver) return;

  playerHealth -= amount;

  const healthBar = document.getElementById("health-bar");
  const healthText = document.getElementById("health-text");

  healthBar.style.width = playerHealth + "%";
  healthText.innerText = playerHealth;

  // screen flash effect
  document.body.style.background = "#330000";
  setTimeout(() => {
    document.body.style.background = "";
  }, 100);

  if (playerHealth > 60) {
    healthBar.style.background = "#00ff00"; // green
  } else if (playerHealth > 30) {
    healthBar.style.background = "#ffaa00"; // orange
  } else {
    healthBar.style.background = "#ff0000"; // red
  }

  if (playerHealth <= 0) {
    gameOver();
  }
}

function gameOver() {
  isGameOver = true;

  const healthBar = document.getElementById("health-bar");
  if (healthBar) healthBar.style.width = "0%";

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
