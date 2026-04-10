// server.js
import express from "express";
import http from "http";
import { Server } from "socket.io";
import path from "path";
import constants from "./constants.js";

const app = express();
const server = http.createServer(app);

// Static frontend
// app.use(express.static(path.join(path.resolve(), "public")));

const io = new Server(server, {
  cors: { origin: "*" },
});

const rooms = {};

function randomColor() {
  return Math.floor(Math.random() * 0xffffff);
}

io.on("connection", (socket) => {
  console.log("Player connected:", socket.id);

  socket.on("join", ({ name, room }) => {
    socket.join(room);

    if (!rooms[room]) rooms[room] = {};

    rooms[room][socket.id] = {
      x: 0,
      y: 2,
      z: 0,
      name,
      color: randomColor(),
      kills: 0, // ✅ NEW
      deaths: 0, // ✅ NEW
      health: 100, // ✅ NEW (server authority)
    };

    socket.room = room;

    // send current room players
    socket.emit("currentPlayers", rooms[room]);

    io.to(room).emit("scoreUpdate", rooms[room]);

    // notify others
    socket.to(room).emit("newPlayer", {
      id: socket.id,
      ...rooms[room][socket.id],
    });
  });

  socket.on("getRooms", () => {
    const roomList = Object.keys(rooms).map((roomId) => ({
      id: roomId,
      count: Object.keys(rooms[roomId]).length,
    }));

    socket.emit("roomsList", roomList);
  });

  socket.on("move", (data) => {
    const room = socket.room;
    if (!room || !rooms[room][socket.id]) return;

    Object.assign(rooms[room][socket.id], data);

    socket.to(room).emit("playerMoved", {
      id: socket.id,
      ...data,
    });
  });

  socket.on("shootPlayer", ({ targetId, shooterId }) => {
    const room = socket.room;
    if (!room) return;

    const target = rooms[room][targetId];
    const shooter = rooms[room][shooterId];

    if (!target || !shooter) return;

    // reduce health
    target.health -= 10;

    // notify target
    io.to(targetId).emit("hit", { damage: 10 });

    // if dead
    if (target.health <= 0) {
      target.deaths += 1;
      shooter.kills += 1;

      // reset health (simple respawn logic)
      target.health = 100;
      target.x = 0;
      target.y = 2;
      target.z = 0;

      // notify all players in room
      io.to(room).emit("scoreUpdate", rooms[room]);

      // optional: notify death event
      io.to(room).emit("playerKilled", {
        killer: shooter.name,
        victim: target.name,
      });
    }
  });

  // socket.on("playerDied", ({ id }) => {
  //   const room = socket.room;
  //   if (!room) return;

  //   delete rooms[room][socket.id];

  //   socket.to(room).emit("playerDisconnected", socket.id);
  // });

  // socket.on("playerKilled", ({ killer, victim }) => {
  //   console.log(`${killer} killed ${victim}`);
  // });

  socket.on("disconnect", () => {
    const room = socket.room;
    if (!room || !rooms[room]) return;

    delete rooms[room][socket.id];

    socket.to(room).emit("playerDisconnected", socket.id);
  });
});

server.listen(constants.SERVER_PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${constants.SERVER_PORT}`);
});
