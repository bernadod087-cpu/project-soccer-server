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

app.get("/", (req, res) => {
  res.send("Project Soccer Server está online! ⚽");
});

const rooms = {};

io.on("connection", (socket) => {
  console.log("Jogador conectado:", socket.id);

  socket.on("createRoom", (callback) => {
    let code;

    do {
      code = Math.floor(100000 + Math.random() * 900000).toString();
    } while (rooms[code]);

    rooms[code] = {
      players: [socket.id],
      state: {}
    };

    socket.join(code);

    if (typeof callback === "function") {
      callback({ success: true, code });
    }
  });

  socket.on("joinRoom", (code, callback) => {
    code = String(code || "").trim();

    const room = rooms[code];

    if (!room) {
      if (typeof callback === "function") {
        callback({ success: false, message: "Sala não encontrada." });
      }
      return;
    }

    if (room.players.length >= 2) {
      if (typeof callback === "function") {
        callback({ success: false, message: "Sala cheia." });
      }
      return;
    }

    room.players.push(socket.id);
    socket.join(code);

    io.to(code).emit("playerJoined", {
      count: room.players.length
    });

    if (typeof callback === "function") {
      callback({
        success: true,
        code,
        playerNumber: room.players.length
      });
    }
  });

  socket.on("gameState", (data) => {
    const code = String(data?.code || "");
    const room = rooms[code];

    if (!room || !room.players.includes(socket.id)) return;
    if (room.players[0] !== socket.id) return;

    room.state = data.state;
    socket.to(code).emit("gameState", data.state);
  });

  socket.on("disconnect", () => {
    for (const code of Object.keys(rooms)) {
      const room = rooms[code];

      if (!room.players.includes(socket.id)) continue;

      io.to(code).emit("playerLeft");

      delete rooms[code];
    }

    console.log("Jogador desconectado:", socket.id);
  });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, "0.0.0.0", () => {
  console.log("Servidor rodando na porta " + PORT);
});