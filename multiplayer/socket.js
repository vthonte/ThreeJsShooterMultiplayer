import constants from "../constants.js";
import { animate } from "../core/loop.js";
import { loadGLTFFromJSON, saveGLTFToStorage } from "../mapOperations.js";
import { createPlayerMesh, rebuildWorld } from "../scene.js";
import { state } from "../state.js";
import { updatePlayerUI } from "../ui/hud.js";

state.socket = io(
  `http://${window.location.hostname}:${constants.SERVER_PORT}`,
  {
    query: { playerId: state.playerId },
  },
);

// ---------------- SOCKET ----------------

state.socket.on("connect", () => {
  if (!state.isCreatorMode) {
    state.socket.emit("join", {
      name: state.playerName,
      room: state.roomId,
      playerId: state.playerId,
    });
  }
});

state.socket.on("adminUpdate", (adminId) => {
  state.adminId = adminId;

  // optional helper
  state.isAdmin = state.playerId === adminId;

  console.log("Admin is:", adminId);
});

state.socket.on("mapData", async (map) => {
  console.log(`Map received: ${map}`);
  if (!map) return;

  await saveGLTFToStorage(map);

  loadGLTFFromJSON(map, state.scene);
});

state.socket.on("playerDied", ({ id }) => {
  if (state.otherPlayers[id]) {
    state.scene.remove(state.otherPlayers[id]);
    delete state.otherPlayers[id];
  }

  if (id === state.playerId) {
    gameOver();
  }

  updatePlayerUI();
});

state.socket.on("currentPlayers", (players) => {
  for (let id in players) {
    state.playersState[id] = {
      name: players[id].name,
      kills: players[id].kills || 0,
      deaths: players[id].deaths || 0,
    };

    if (id === state.playerId) continue;
    if (state.otherPlayers[id]) continue;

    createPlayerMesh(id, players[id]);
  }
  updatePlayerUI();
});

state.socket.on("playerRespawn", (player) => {
  state.playersState[player.id] = {
    name: player.name,
    kills: player.kills,
    deaths: player.deaths,
  };

  const spectateText = document.getElementById("spectateText");
  if (spectateText) spectateText.remove();

  if (player.id === state.playerId) {
    state.playerHealth = 100;
    state.isAlive = true;
    state.isSpectating = false;
    state.isGameOver = false;

    const healthBar = document.getElementById("health-bar");
    const healthText = document.getElementById("health-text");

    if (healthBar) healthBar.style.width = "100%";
    if (healthText) healthText.innerText = "100";

    // animate();
  } else {
    if (state.otherPlayers[player.id]) {
      state.scene.remove(state.otherPlayers[player.id]);
      delete state.otherPlayers[player.id];
    }
    createPlayerMesh(player.id, player);
  }

  updatePlayerUI();
});

state.socket.on("newPlayer", (player) => {
  if (state.otherPlayers[player.id]) return;

  state.playersState[player.id] = {
    name: player.name,
    kills: player.kills || 0,
    deaths: player.deaths || 0,
  };

  createPlayerMesh(player.id, player);
  updatePlayerUI();
});

state.socket.on("playerMoved", (data) => {
  const player = state.otherPlayers[data.id];
  if (player) player.position.set(data.x, data.y, data.z);
});

state.socket.on("playerDisconnected", (id) => {
  delete state.playersState[id];

  if (state.otherPlayers[id]) {
    state.scene.remove(state.otherPlayers[id]);
    delete state.otherPlayers[id];
  }

  updatePlayerUI();
});

state.socket.on("hit", ({ damage, health }) => {
  state.playerHealth = health;
  updateHealthUI();

  if (state.playerHealth <= 0) gameOver();
});

state.socket.on("scoreUpdate", (players) => {
  for (let id in players) {
    if (!state.playersState[id]) continue;

    state.playersState[id].kills = players[id].kills;
    state.playersState[id].deaths = players[id].deaths;
  }

  updatePlayerUI();
});

function updateHealthUI() {
  const healthBar = document.getElementById("health-bar");
  const healthText = document.getElementById("health-text");

  if (healthBar) healthBar.style.width = state.playerHealth + "%";
  if (healthText) healthText.innerText = state.playerHealth;
}

export function gameOver() {
  if (state.isGameOver) return;

  state.isAlive = false;
  state.isSpectating = true;
  state.isGameOver = true;

  state.move.forward =
    state.move.back =
    state.move.left =
    state.move.right =
      false;

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
