import express from "express";
import http from "http";
import { Server } from "socket.io";
import fs from "fs";
import constants from "./constants.js";

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*" },
});

app.use(express.json());

app.post("/saveWorld", (req, res) => {
  fs.writeFileSync("world.json", JSON.stringify(req.body));
  res.sendStatus(200);
});

// rooms structure:
// rooms[roomId] = {
//   players: {},
//   adminId: null,
//   joinOrder: []
// }
const rooms = {};
const roomMaps = {}; // { roomId: worldData[] }

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

  // ✅ UPDATE MAP (admin only)
  socket.on("updateMap", ({ room, worldData }) => {
    if (!room || !rooms[room]) return;

    const roomData = rooms[room];

    // allow only admin
    if (socket.playerId !== roomData.adminId) {
      console.log("Non-admin tried to update map");
      return;
    }

    console.log("Map updated for room:", room);

    roomMaps[room] = worldData;

    io.to(room).emit("mapData", worldData);
  });

  // ✅ JOIN ROOM
  socket.on("join", ({ name, room, playerId }) => {
    socket.join(room);
    console.log(name, room, playerId);

    if (!rooms[room]) {
      rooms[room] = {
        players: {},
        adminId: null,
        joinOrder: [],
      };
    }

    const roomData = rooms[room];

    const id = playerId || queryPlayerId || socket.id;

    socket.playerId = id;
    socket.room = room;

    let player;

    if (roomData.players[id]) {
      player = roomData.players[id];
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

      roomData.joinOrder.push(id);
    }

    roomData.players[id] = player;

    // ✅ assign admin if none
    if (!roomData.adminId) {
      roomData.adminId = id;
    }

    // send current state
    socket.emit("currentPlayers", roomData.players);
    socket.emit("adminUpdate", roomData.adminId);

    io.to(room).emit("scoreUpdate", roomData.players);

    socket.to(room).emit("newPlayer", {
      id,
      ...player,
    });

    // broadcast admin info
    io.to(room).emit("adminUpdate", roomData.adminId);

    // ✅ send map ONLY to joining player (fixed)
    if (roomMaps[room]) {
      socket.emit("mapData", roomMaps[room]);
    }
  });

  // ✅ PLAYER MOVEMENT
  socket.on("move", (data) => {
    const room = socket.room;
    const id = socket.playerId;

    if (!room || !id || !rooms[room]) return;

    const player = rooms[room].players[id];
    if (!player || !player.isAlive) return;

    Object.assign(player, data);

    socket.to(room).emit("playerMoved", {
      id,
      ...data,
    });
  });

  // ✅ ROOM LIST
  socket.on("getRooms", () => {
    const roomList = Object.entries(rooms).map(([roomId, roomData]) => {
      return {
        id: roomId,
        count: Object.values(roomData.players).filter((p) => p.isOnline).length,
      };
    });

    socket.emit("roomsList", roomList);
  });

  // ✅ SHOOT PLAYER
  socket.on("shootPlayer", ({ targetId }) => {
    const room = socket.room;
    const shooterId = socket.playerId;

    if (!room || !targetId || targetId === shooterId || !rooms[room]) return;

    const roomData = rooms[room];
    const target = roomData.players[targetId];
    const shooter = roomData.players[shooterId];

    if (!target || !shooter || !target.isAlive) return;

    target.health -= 10;

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

      io.to(room).emit("scoreUpdate", roomData.players);

      setTimeout(() => {
        if (!rooms[room] || !rooms[room].players[targetId]) return;

        const p = rooms[room].players[targetId];

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

  // ✅ DISCONNECT
  socket.on("disconnect", () => {
    const room = socket.room;
    const id = socket.playerId;

    if (!room || !rooms[room] || !id) return;

    const roomData = rooms[room];
    const player = roomData.players[id];

    if (player) player.isOnline = false;

    socket.to(room).emit("playerDisconnected", id);

    // ✅ if admin left → assign next
    if (roomData.adminId === id) {
      const nextAdmin = roomData.joinOrder.find(
        (pid) => roomData.players[pid]?.isOnline,
      );

      roomData.adminId = nextAdmin || null;

      io.to(room).emit("adminUpdate", roomData.adminId);
    }

    // ✅ delete room if empty
    const anyoneOnline = Object.values(roomData.players).some(
      (p) => p.isOnline,
    );

    if (!anyoneOnline) {
      delete rooms[room];
      delete roomMaps[room];
      console.log("Room deleted:", room);
    }
  });
});

server.listen(constants.SERVER_PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${constants.SERVER_PORT}`);
});
