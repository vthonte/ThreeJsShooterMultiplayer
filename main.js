import { state } from "./state.js";
import "./ui/hud.js";
import "./player/playerDetails.js";
import "./multiplayer/socket.js";
import "./player/input.js";
import { animate } from "./core/loop.js";
import { initPhysics } from "./physics.js";
import { initScene } from "./scene.js";

state.roomId = localStorage.getItem("roomId") || "default";
state.isCreatorMode = localStorage.getItem("mode") === "creator";
state.playerName = localStorage.getItem("playerName") || "Player";
state.worldData = JSON.parse(localStorage.getItem("myWorld")) || [];
console.log("Initialized local storage");

window.joinGame = function () {
  const input = document.getElementById("nameInput");
  state.playerName = input.value || "Player";

  document.getElementById("namePrompt").style.display = "none";
  if (!state.isCreatorMode) {
    alert(state.playerId);
    state.socket.emit("join", {
      name: state.playerName,
      room: state.roomId,
      playerId: state.playerId || setPlayerId(),
    });
  }
};

// ✅ STEP 1: init physics FIRST
await initPhysics();

// ✅ STEP 2: THEN init scene (safe now)
initScene();

// ✅ STEP 3: start loop
animate();
