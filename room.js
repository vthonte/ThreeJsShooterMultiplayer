import { generatePlayerId } from "./utils/generatePlayerId.js";

const joinBtn = document.getElementById("joinBtn");

joinBtn.onclick = () => {
  const name = document.getElementById("name").value || "Player";
  const room = document.getElementById("room").value || "default";
  const playerId = localStorage.getItem("playerId") || generatePlayerId();

  // store locally
  localStorage.setItem("playerName", name);
  localStorage.setItem("roomId", room);
  localStorage.setItem("playerId", playerId);

  window.location.href = "game.html";
};

const socket = io(`http://${window.location.hostname}:3001`);

function loadRooms() {
  console.log("emitting socket");
  socket.emit("getRooms");
}
socket.on("roomsList", (rooms) => {
  console.log("received rooms:", rooms);

  const div = document.getElementById("rooms");
  div.innerHTML = "";

  if (!rooms || rooms.length === 0) {
    div.innerHTML = "No rooms yet";
    return;
  }

  rooms.forEach((room) => {
    const btn = document.createElement("button");
    btn.innerText = `${room.id} (${room.count} players)`;

    btn.onclick = () => {
      const name = document.getElementById("name").value || "Player";

      localStorage.setItem("playerName", name);
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
