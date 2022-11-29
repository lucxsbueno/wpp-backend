
const express = require("express");
const app = express();
const http = require("http");
const server = http.createServer(app);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/", (req, res) => {
  res.json({
    message: "Welcome to my server application! 😊"
  });
});

const io = require("socket.io")(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"]
  }
});

io.on("connection", (socket) => {
  console.log("Socket conectado:", socket.id);

  socket.emit("message", { message: "Novo socket conectado: " + socket.id });

  socket.on("create-session", data => {
    console.log("Criando sessão: " + data.id);
    socket.join(data.id);
    socket.to(data.id).emit("message", {
      message: "Você criou uma sessão!",
      session: data
    });
  });

  socket.on("join-session", id => {
    socket.join(id);
  });

  socket.on("unsubscribe-session", id => {
    socket.leave(id);
  });

  socket.on("send_message", data => {
    socket.to(data.id).emit("message", { message: data.message });
  });
});

server.listen(5000, () => {
  console.log(`Server is runnig on: http://localhost:${5000}. 👌`);
});