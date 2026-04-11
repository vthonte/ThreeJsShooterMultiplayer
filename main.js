import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.178.0/build/three.module.js";
import { initScene } from "./scene.js";
import { createWorld } from "./world.js";
import { setupControls } from "./controls.js";
import { createEnemies } from "./enemies.js";
import constants from "./constants.js";

let playerName = localStorage.getItem("playerName") || "Player";
const roomId = localStorage.getItem("roomId") || "default";
const singlePlayer = constants.IS_SINGLE_PLAYER;

let savedId = localStorage.getItem("playerId");

if (!savedId) {
  if (window.crypto && crypto.randomUUID) {
    savedId = crypto.randomUUID();
  } else {
    // fallback UUID generator
    savedId = "xxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  localStorage.setItem("playerId", savedId);
}

let isAlive = true;
let isSpectating = false;
let spectateIndex = 0;

const socket = io(
  `http://${window.location.hostname}:${constants.SERVER_PORT}`,
  {
    query: { playerId: savedId },
  },
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

socket.on("playerDied", ({ id }) => {
  if (otherPlayers[id]) {
    scene.remove(otherPlayers[id]);
    delete otherPlayers[id];
  }

  if (id === savedId) {
    gameOver();
  }

  updatePlayerUI();
});

socket.on("currentPlayers", (players) => {
  for (let id in players) {
    playersState[id] = {
      name: players[id].name,
      kills: players[id].kills || 0,
      deaths: players[id].deaths || 0,
    };

    if (id === savedId) continue;
    if (otherPlayers[id]) continue;

    createPlayerMesh(id, players[id]);
  }
  updatePlayerUI();
});

socket.on("playerRespawn", (player) => {
  playersState[player.id] = {
    name: player.name,
    kills: player.kills,
    deaths: player.deaths,
  };

  const spectateText = document.getElementById("spectateText");
  if (spectateText) spectateText.remove();

  if (player.id === savedId) {
    playerHealth = 100;
    isAlive = true;
    isSpectating = false;
    isGameOver = false;

    const healthBar = document.getElementById("health-bar");
    const healthText = document.getElementById("health-text");

    if (healthBar) healthBar.style.width = "100%";
    if (healthText) healthText.innerText = "100";

    animate();
  } else {
    if (otherPlayers[player.id]) {
      scene.remove(otherPlayers[player.id]);
      delete otherPlayers[player.id];
    }
    createPlayerMesh(player.id, player);
  }

  updatePlayerUI();
});

socket.on("newPlayer", (player) => {
  if (otherPlayers[player.id]) return;

  playersState[player.id] = {
    name: player.name,
    kills: player.kills || 0,
    deaths: player.deaths || 0,
  };

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

// ✅ FIXED: only apply damage to correct player
socket.on("hit", ({ damage, health }) => {
  playerHealth = health; // server authoritative
  damagePlayer(0); // just refresh UI
});

socket.on("scoreUpdate", (players) => {
  for (let id in players) {
    if (!playersState[id]) continue;

    playersState[id].kills = players[id].kills;
    playersState[id].deaths = players[id].deaths;
  }

  updatePlayerUI();
});

// ---------------- PLAYER CREATE ----------------

function createPlayerMesh(id, data) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(1, 2, 1),
    new THREE.MeshStandardMaterial({ color: data.color }),
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

// ---------------- UI ----------------

function updatePlayerUI() {
  playerList.innerHTML = "<b>Players</b><br>";

  Object.entries(playersState)
    .sort((a, b) => b[1].kills - a[1].kills)
    .forEach(([id, player]) => {
      const stats = `(K: ${player.kills} | D: ${player.deaths})`;

      if (id === savedId && !isAlive) {
        playerList.innerHTML += `☠️ ${player.name} ${stats} (spectating)<br>`;
      } else {
        playerList.innerHTML +=
          (id === savedId ? "🟢 " : "🔵 ") + `${player.name} ${stats}<br>`;
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
      socket.emit("shootPlayer", {
        targetId: hit.userData.id,
      });
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

  // ✅ FIX: clamp health
  playerHealth = Math.max(0, playerHealth);

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

  document.getElementById("health-bar").style.width = "0%";

  if (!document.getElementById("spectateText")) {
    const div = document.createElement("div");
    div.id = "spectateText";
    div.innerText = "SPECTATING MODE";

    Object.assign(div.style, {
      position: "absolute",
      top: "50%",
      left: "50%",
      transform: "translate(-50%, -50%)",
      color: "white",
      fontSize: "40px",
    });

    document.body.appendChild(div);
  }
}

animate();
