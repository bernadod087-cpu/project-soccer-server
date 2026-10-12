const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
cors: {
origin: "*",
methods: ["GET", "POST"]
}
});

const rooms = new Map();

app.get("/", (_req, res) => {
res.send("Project Soccer Server está online! ⚽");
});

app.get("/health", (_req, res) => {
res.json({ online: true, rooms: rooms.size });
});

function reply(callback, data) {
if (typeof callback === "function") callback(data);
}

function findRoomBySocket(socketId) {
for (const [code, room] of rooms) {
if (room.players.includes(socketId)) {
return [code, room];
}
}
return null;
}

io.on("connection", socket => {
console.log("Jogador conectado:", socket.id);

socket.on("createRoom", callback => {
let code;

do {
  code = String(
    Math.floor(100000 + Math.random() * 900000)
  );
} while (rooms.has(code));

rooms.set(code, {
  players: [socket.id],
  state: null
});

socket.join(code);

reply(callback, {
  success: true,
  code,
  playerNumber: 1,
  count: 1
});

});

socket.on("joinRoom", (rawCode, callback) => {
const code = String(rawCode || "").trim();
const room = rooms.get(code);

if (!room) {
  return reply(callback, {
    success: false,
    message: "Sala não encontrada."
  });
}

if (room.players.includes(socket.id)) {
  return reply(callback, {
    success: true,
    code,
    playerNumber: room.players.indexOf(socket.id) + 1,
    count: room.players.length
  });
}

if (room.players.length >= 2) {
  return reply(callback, {
    success: false,
    message: "A sala já está cheia."
  });
}

room.players.push(socket.id);
socket.join(code);

io.to(code).emit("playerJoined", {
  count: room.players.length
});

reply(callback, {
  success: true,
  code,
  playerNumber: 2,
  count: room.players.length
});

if (room.state) {
  io.to(socket.id).emit("gameState", room.state);
}

});

socket.on("gameState", data => {
const code = String(data?.code || "");
const room = rooms.get(code);

if (!room || room.players[0] !== socket.id || !data.state) {
  return;
}

room.state = data.state;
socket.to(code).emit("gameState", data.state);

});

socket.on("playerInput", data => {
const code = String(data?.code || "");
const room = rooms.get(code);

if (!room || room.players[1] !== socket.id) {
  return;
}

const x = Math.max(
  -1,
  Math.min(1, Number(data?.input?.x) || 0)
);

const y = Math.max(
  -1,
  Math.min(1, Number(data?.input?.y) || 0)
);

io.to(room.players[0]).emit("remoteInput", { x, y });

});

socket.on("playerAction", data => {
const code = String(data?.code || "");
const room = rooms.get(code);

if (!room || room.players[1] !== socket.id) {
  return;
}

const action = data?.action;

if (!action || !["tackle", "shoot"].includes(action.type)) {
  return;
}

io.to(room.players[0]).emit("remoteAction", {
  type: action.type,
  power: Math.max(
    0,
    Math.min(1, Number(action.power) || 0.2)
  )
});

});

socket.on("disconnect", () => {
const found = findRoomBySocket(socket.id);

if (found) {
  const [code] = found;
  io.to(code).emit("playerLeft");
  rooms.delete(code);
}

console.log("Jogador desconectado:", socket.id);

});
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, "0.0.0.0", () => {
console.log("Project Soccer rodando na porta " + PORT);
});