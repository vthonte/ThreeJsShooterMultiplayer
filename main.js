import { state } from "./state.js";
import "./ui/hud.js";
import "./player/playerDetails.js";
import "./multiplayer/socket.js";
import "./player/input.js";
import "./scene.js";
import { animate } from "./core/loop.js";

state.roomId = localStorage.getItem("roomId") || "default";
state.isCreatorMode = localStorage.getItem("mode") === "creator";
state.playerName = localStorage.getItem("playerName") || "Player";
state.worldData = JSON.parse(localStorage.getItem("myWorld")) || [];

window.joinGame = function () {
  const input = document.getElementById("nameInput");
  playerName = input.value || "Player";

  document.getElementById("namePrompt").style.display = "none";
  if (!isCreatorMode) {
    socket.emit("join", { name: playerName, room: roomId });
  }
};
animate();
