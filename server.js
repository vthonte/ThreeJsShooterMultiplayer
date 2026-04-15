import express from "express";
import http from "http";
import { Server } from "socket.io";
import constants from "./constants.js";

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*" },
});

app.post("/saveWorld", (req, res) => {
  fs.writeFileSync("world.json", JSON.stringify(req.body));
});

const rooms = {};

function randomColor() {
  return Math.floor(Math.random() * 0xffffff);
}

function findSocketByPlayerId(playerId) {
  for (let s of io.sockets.sockets.values()) {
    if (s.playerId === playerId) return s;
  }
  return null;
}

io.on("connection", (socket) => {
  const queryPlayerId = socket.handshake.query.playerId;

  socket.on("join", ({ name, room, playerId }) => {
    socket.join(room);
    console.log(name, room, playerId);

    if (!rooms[room]) rooms[room] = {};

    const id = playerId || queryPlayerId || socket.id;

    socket.playerId = id;
    socket.room = room;

    let player;

    if (rooms[room][id]) {
      player = rooms[room][id];
      player.isOnline = true;
    } else {
      player = {
        x: 0,
        y: 2,
        z: 0,
        name,
        color: randomColor(),
        kills: 0,
        deaths: 0,
        health: 100,
        isAlive: true,
        isOnline: true,
      };
    }

    rooms[room][id] = player;

    socket.emit("currentPlayers", rooms[room]);
    io.to(room).emit("scoreUpdate", rooms[room]);

    socket.to(room).emit("newPlayer", {
      id,
      ...player,
    });
  });

  socket.on("move", (data) => {
    const room = socket.room;
    const id = socket.playerId;

    if (!room || !id) return;

    const player = rooms[room][id];
    if (!player || !player.isAlive) return;

    Object.assign(player, data);

    socket.to(room).emit("playerMoved", {
      id,
      ...data,
    });
  });

  socket.on("getRooms", () => {
    const roomList = Object.entries(rooms).map(([roomId, players]) => {
      return {
        id: roomId,
        count: Object.values(players).filter((p) => p.isOnline).length,
      };
    });

    socket.emit("roomsList", roomList);
  });

  socket.on("shootPlayer", ({ targetId }) => {
    const room = socket.room;
    const shooterId = socket.playerId;

    if (!room || !targetId || targetId === shooterId) return;

    const target = rooms[room][targetId];
    const shooter = rooms[room][shooterId];

    if (!target || !shooter || !target.isAlive) return;

    target.health -= 10;

    // ✅ send hit ONLY to target
    const targetSocket = findSocketByPlayerId(targetId);
    if (targetSocket) {
      targetSocket.emit("hit", {
        damage: 10,
        health: target.health,
      });
    }

    if (target.health <= 0 && target.isAlive) {
      target.deaths += 1;
      shooter.kills += 1;
      target.isAlive = false;

      io.to(room).emit("playerDied", {
        id: targetId,
        killer: shooter.name,
        victim: target.name,
      });

      io.to(room).emit("scoreUpdate", rooms[room]);

      setTimeout(() => {
        if (!rooms[room] || !rooms[room][targetId]) return;

        const p = rooms[room][targetId];

        p.health = 100;
        p.x = 0;
        p.y = 2;
        p.z = 0;
        p.isAlive = true;

        io.to(room).emit("playerRespawn", {
          id: targetId,
          ...p,
        });
      }, 3000);
    }
  });

  socket.on("disconnect", () => {
    const room = socket.room;
    const id = socket.playerId;

    if (!room || !rooms[room] || !id) return;

    const player = rooms[room][id];
    if (player) player.isOnline = false;

    socket.to(room).emit("playerDisconnected", id);
  });
});

server.listen(constants.SERVER_PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${constants.SERVER_PORT}`);
});
