import { getRootObject } from "../player/input.js";
import { state } from "../state.js";
import { rebuildWorld } from "../scene.js";

state.playerList = document.getElementById("players");

state.isCreatorMode = localStorage.getItem("mode") === "creator";

document.getElementById("colorPicker").addEventListener("input", (e) => {
  state.selectedColor = parseInt(e.target.value.replace("#", "0x"));
});

document.getElementById("publishMap").onclick = () => {
  console.log(JSON.stringify(state.worldData));
  state.socket.emit("updateMap", {
    room: state.roomId,
    worldData: state.worldData.length
      ? state.worldData
      : localStorage.getItem("myWorld"),
  });
};

document.getElementById("creatorBtn").onclick = () => {
  start("creator");
};

document.getElementById("playBtn").onclick = () => {
  start("play");
};

document.getElementById("saveWorldBtn").onclick = () => {
  downloadWorld();
};

document.getElementById("refreshWorldBtn").onclick = () => {
  // 5. SAVE TO LOCALSTORAGE
  console.log("saving world");
  localStorage.setItem("myWorld", JSON.stringify([]));
};

document.getElementById("generateWorldBtn").onclick = () => {
  const tempWorld = generateWorld(constants.WORLD_SIZE);

  localStorage.setItem("myWorld", JSON.stringify(tempWorld));

  state.worldData.length = 0;
  state.worldData.push(...tempWorld);

  rebuildWorld(state.scene, state.worldData);
};
document.getElementById("worldFileInput").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (file) loadWorldFromFile(file);
});

// ---------------- SHOOT ----------------

if (!state.isCreatorMode) {
  document.addEventListener("click", shoot);
}

export function shoot() {
  if (!state.isAlive || state.isCreatorMode) return;

  state.raycaster.setFromCamera(state.center, state.camera);

  const playerMeshes = Object.values(state.otherPlayers);

  const intersects = state.raycaster.intersectObjects(
    [...state.enemies, ...playerMeshes, ...state.objects], // 👈 include blocks
    true,
  );

  if (intersects.length > 0) {
    const hit = getRootObject(intersects[0].object);

    // 🧱 CREATOR MODE: remove block
    if (state.isCreatorMode && hit?.userData.isBlock) {
      removeBlock(hit);
      return;
    }

    // 🔫 MULTIPLAYER SHOOT
    if (hit?.userData.isPlayer) {
      state.socket.emit("shootPlayer", {
        targetId: hit.userData.id,
      });
    }
  }
}

function start(mode) {
  console.log("setting mode: " + mode);
  localStorage.setItem("mode", mode);
  window.location.href = "game.html";
}

function downloadWorld() {
  const data = {
    world: state.worldData,
    savedAt: new Date().toISOString(),
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });

  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `world-${Date.now()}.json`;
  a.click();

  URL.revokeObjectURL(url);
}

function loadWorldFromFile(file) {
  const reader = new FileReader();

  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      const newWorld = data.world || [];

      // ✅ update state
      state.worldData.length = 0;
      state.worldData.push(...newWorld);

      // ✅ rebuild cleanly
      rebuildWorld(state.scene, state.worldData);

      // ✅ save
      localStorage.setItem("myWorld", JSON.stringify(state.worldData));

      console.log(
        "World loaded successfully:",
        state.worldData.length,
        "blocks",
      );
    } catch (err) {
      console.error("Failed to load world file:", err);
    }
  };

  reader.readAsText(file);
}
// ---------------- UI ----------------

export function updatePlayerUI() {
  state.playerList.innerHTML = "<b>Players</b><br>";

  Object.entries(state.playersState)
    .sort((a, b) => b[1].kills - a[1].kills)
    .forEach(([id, player]) => {
      const stats = `(K: ${player.kills} | D: ${player.deaths})`;

      if (id === state.playerId && !state.isAlive) {
        state.playerList.innerHTML += `☠️ ${player.name} ${stats} (spectating)<br>`;
      } else {
        state.playerList.innerHTML +=
          (id === state.playerId ? "🟢 " : "🔵 ") +
          `${player.name} ${stats}<br>`;
      }
    });
}
