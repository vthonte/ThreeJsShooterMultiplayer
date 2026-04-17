import { state } from "./state.js";
import "./ui/hud.js";
import "./player/playerDetails.js";
import "./player/input.js";
import { animate } from "./core/loop.js";
import { initPhysics } from "./physics.js";
import { initScene } from "./scene.js";
import { generatePlayerId } from "./utils/generatePlayerId.js";

state.roomId = localStorage.getItem("roomId") || "default";
state.isCreatorMode = localStorage.getItem("mode") === "creator";
state.playerName = localStorage.getItem("playerName") || "Player";
// state.worldData = JSON.parse(localStorage.getItem("myWorld")) || [];
state.playerId =
  localStorage.getItem("playerId") ||
  localStorage.setItem("playerId", generatePlayerId()) ||
  localStorage.getItem("playerId");
console.log("Initialized local storage");
// ✅ STEP 1: init physics FIRST
await initPhysics();

// ✅ STEP 2: THEN init scene (safe now)
initScene();

import "./multiplayer/socket.js";

// ✅ STEP 3: start loop
animate();
