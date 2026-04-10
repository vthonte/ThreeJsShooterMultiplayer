import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.178.0/build/three.module.js";
import { initScene } from "./scene.js";
import { createWorld } from "./world.js";
import { setupControls } from "./controls.js";
import { createEnemies } from "./enemies.js";
import constants from "./constants.js";

let playerName = localStorage.getItem("playerName") || "Player";
const roomId = localStorage.getItem("roomId") || "default";
const singlePlayer = constants.IS_SINGLE_PLAYER;

let isAlive = true;
let isSpectating = false;
let spectateIndex = 0;

const socket = io(
  `http://${window.location.hostname}:${constants.SERVER_PORT}`,
);

window.joinGame = function () {
  const input = document.getElementById("nameInput");
  playerName = input.value || "Player";

  document.getElementById("namePrompt").style.display = "none";

  socket.emit("join", { name: playerName, room: roomId });
};

const playerList = document.getElementById("players");
const playersState = {};
const otherPlayers = {};

// scene
const { scene, camera, renderer } = initScene(THREE);
const objects = createWorld(scene, THREE);
const enemies = singlePlayer ? createEnemies(scene, THREE) : [];
const controls = setupControls(camera);

// ---------------- SOCKET ----------------

socket.on("connect", () => {
  socket.emit("join", { name: playerName, room: roomId });
});

// create players
socket.on("currentPlayers", (players) => {
  for (let id in players) {
    playersState[id] = players[id].name;
    if (id === socket.id) continue;
    if (otherPlayers[id]) continue;

    createPlayerMesh(id, players[id]);
  }
  updatePlayerUI();
});

socket.on("newPlayer", (player) => {
  if (otherPlayers[player.id]) return;
  playersState[player.id] = player.name;
  createPlayerMesh(player.id, player);
  updatePlayerUI();
});

socket.on("playerMoved", (data) => {
  const player = otherPlayers[data.id];
  if (player) player.position.set(data.x, data.y, data.z);
});

socket.on("playerDisconnected", (id) => {
  delete playersState[id];
  if (otherPlayers[id]) {
    scene.remove(otherPlayers[id]);
    delete otherPlayers[id];
  }
  updatePlayerUI();
});

socket.on("hit", ({ damage }) => {
  damagePlayer(damage);
});

// ---------------- PLAYER CREATE ----------------

function createPlayerMesh(id, data) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(1, 2, 1),
    new THREE.MeshStandardMaterial({ color: data.color }),
  );

  mesh.userData.isPlayer = true;
  mesh.userData.id = id;
  mesh.userData.color = data.color;

  const label = createNameLabel(data.name);
  label.position.set(0, 2.5, 0);
  mesh.add(label);

  mesh.position.set(data.x, data.y, data.z);

  scene.add(mesh);
  otherPlayers[id] = mesh;
}

// ---------------- UI ----------------

function updatePlayerUI() {
  playerList.innerHTML = "<b>Players</b><br>";

  Object.keys(playersState).forEach((id) => {
    const name = playersState[id];

    if (id === socket.id && !isAlive) {
      playerList.innerHTML += "☠️ " + name + " (spectating)<br>";
    } else {
      playerList.innerHTML +=
        (id === socket.id ? "🟢 " : "🔵 ") + name + "<br>";
    }
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

  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture }));

  sprite.scale.set(3, 1, 1);
  return sprite;
}

// ---------------- GAME ----------------

const raycaster = new THREE.Raycaster();
const center = new THREE.Vector2(0, 0);

let playerHealth = 100;
let isGameOver = false;

let yVelocity = 0;
let isOnGround = true;

const gravity = -0.01;
const jumpForce = 0.35;

let move = { forward: false, back: false, left: false, right: false };

// ---------------- INPUT ----------------

document.addEventListener("keydown", (e) => {
  if (!isAlive) return;

  if (e.key === "w") move.forward = true;
  if (e.key === "s") move.back = true;
  if (e.key === "a") move.left = true;
  if (e.key === "d") move.right = true;

  if (e.code === "Space" && isOnGround) {
    yVelocity = jumpForce;
    isOnGround = false;
  }

  // spectate switch
  if (isSpectating) {
    const list = Object.values(otherPlayers);

    if (e.key === "ArrowRight") {
      spectateIndex = (spectateIndex + 1) % list.length;
    }

    if (e.key === "ArrowLeft") {
      spectateIndex = (spectateIndex - 1 + list.length) % list.length;
    }
  }
});

document.addEventListener("keyup", (e) => {
  if (e.key === "w") move.forward = false;
  if (e.key === "s") move.back = false;
  if (e.key === "a") move.left = false;
  if (e.key === "d") move.right = false;
});

// ---------------- SHOOT ----------------

document.addEventListener("click", shoot);

function shoot() {
  if (!isAlive) return;

  raycaster.setFromCamera(center, camera);

  const playerMeshes = Object.values(otherPlayers);

  const intersects = raycaster.intersectObjects(
    [...enemies, ...playerMeshes],
    true,
  );

  if (intersects.length > 0) {
    let hit = intersects[0].object;

    while (hit && !hit.userData.isEnemy && !hit.userData.isPlayer) {
      hit = hit.parent;
    }

    if (hit?.userData.isPlayer) {
      socket.emit("shootPlayer", { targetId: hit.userData.id });
    }
  }
}

// ---------------- GAME LOOP ----------------

function animate() {
  if (!isAlive && !isSpectating) return;

  // spectate mode
  if (isSpectating) {
    const targets = Object.values(otherPlayers);
    if (targets.length > 0) {
      const target = targets[spectateIndex % targets.length];
      camera.position.lerp(
        new THREE.Vector3(
          target.position.x,
          target.position.y + 3,
          target.position.z + 6,
        ),
        0.1,
      );
      camera.lookAt(target.position);
    }

    requestAnimationFrame(animate);
    renderer.render(scene, camera);
    return;
  }

  socket.emit("move", {
    x: camera.position.x,
    y: camera.position.y,
    z: camera.position.z,
  });

  // gravity
  yVelocity += gravity;
  camera.position.y += yVelocity;

  if (camera.position.y <= 2) {
    camera.position.y = 2;
    yVelocity = 0;
    isOnGround = true;
  }

  enemies.forEach((enemy) => {
    const dir = new THREE.Vector3()
      .subVectors(camera.position, enemy.position)
      .normalize();

    const distance = enemy.position.distanceTo(camera.position);

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

  if (move.forward) controls.moveForward(0.1);
  if (move.back) controls.moveForward(-0.1);
  if (move.left) controls.moveRight(-0.1);
  if (move.right) controls.moveRight(0.1);

  renderer.render(scene, camera);
}

// ---------------- DAMAGE / DEATH ----------------

function damagePlayer(amount) {
  if (isGameOver) return;

  playerHealth -= amount;

  const healthBar = document.getElementById("health-bar");
  const healthText = document.getElementById("health-text");

  if (healthBar) healthBar.style.width = playerHealth + "%";
  if (healthText) healthText.innerText = playerHealth;

  if (playerHealth <= 0) gameOver();
}

function gameOver() {
  if (isGameOver) return;

  isAlive = false;
  isSpectating = true;
  isGameOver = true;

  move.forward = move.back = move.left = move.right = false;

  socket.emit("playerDied", { id: socket.id });

  document.getElementById("health-bar").style.width = "0%";

  const div = document.createElement("div");
  div.innerText = "SPECTATING MODE";
  div.style.position = "absolute";
  div.style.top = "50%";
  div.style.left = "50%";
  div.style.transform = "translate(-50%, -50%)";
  div.style.color = "white";
  div.style.fontSize = "40px";

  document.body.appendChild(div);
}

animate();
