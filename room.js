import constants from "./constants.js";
import { setPlayerId } from "./player/playerDetails.js";
import { state } from "./state.js";

// let playerId = localStorage.getItem("playerId");

const socket = window.io(
  `http://${window.location.hostname}:${constants.SERVER_PORT}`,
);

window.join = function () {
  console.log("join in room.js");
  const name = document.getElementById("name").value || "Player";
  const room = document.getElementById("room").value || "default";
  state.playerId = localStorage.getItem("playerId") || setPlayerId();

  console.log("JOIN CLICKED");

  localStorage.setItem("playerName", name);
  localStorage.setItem("roomId", room);

  socket.emit("join", {
    name,
    room,
    playerId: state.playerId || setPlayerId(),
  });

  window.location.href = "./game.html";
};

function loadRooms() {
  socket.emit("getRooms");
}

socket.on("roomsList", (rooms) => {
  const div = document.getElementById("rooms");
  div.innerHTML = "";

  if (rooms.length === 0) {
    div.innerHTML = "No rooms yet";
    return;
  }

  rooms.forEach((room) => {
    const btn = document.createElement("button");
    btn.innerText = room.id + " (" + room.count + " players)";

    btn.onclick = () => {
      localStorage.setItem(
        "playerName",
        document.getElementById("name").value || "Player",
      );
      localStorage.setItem("roomId", room.id);
      window.location.href = "game.html";
    };

    div.appendChild(btn);
    div.appendChild(document.createElement("br"));
  });
});

// auto load rooms
loadRooms();

// refresh every 3 sec
setInterval(loadRooms, 3000);
