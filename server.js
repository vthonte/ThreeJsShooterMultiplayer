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
    };

    socket.room = room;

    // send current room players
    socket.emit("currentPlayers", rooms[room]);

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

  socket.on("shootPlayer", ({ targetId }) => {
    const room = socket.room;
    if (!room) return;

    if (rooms[room][targetId]) {
      io.to(targetId).emit("hit", { damage: 10 });
    }
  });

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
