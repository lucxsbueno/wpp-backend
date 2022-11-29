
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

const { Client, LocalAuth } = require("whatsapp-web.js");

io.on("connection", (socket) => {
  console.log("Socket conectado:", socket.id);

  socket.emit("message", { message: "Novo socket conectado: " + socket.id });

  /**
   * 
   * 
   * 
   * WhatsApp
   */
  socket.on("generate-session", data => {
    console.log("Localizando sessão: " + data.id);

    const client = new Client({
      authStrategy: new LocalAuth({
        clientId: data.id
      }),
      puppeteer: {
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-accelerated-2d-canvas",
          "--no-first-run",
          "--no-zygote",
          "--single-process", // <- this one doesn"t works in Windows
          "--disable-gpu"
        ],
        headless: true
      }
    });

    client.initialize();

    client.on("qr", qr => {
      qrcode.toDataURL(qr, (err, url) => {
        if (!err) {
          console.log("Nova sessão, por favor leia o qrcode: " + url);

          socket.emit("qr", url);

          socket.emit("message", "Para prosseguir, por favor escaneie o QrCode!");
        }
      });
    });

    client.on("ready", async () => {
      socket.emit("message", "WhatsApp está pronto!");
    });
  
    client.on("authenticated", () => {
      socket.emit("message", "O WhatsApp está logado!");
    });
  
    client.on("message", async message => {
      socket.emit("new_message", message._data.notifyName + ": " + message.body);
    });
  });

  /**
   * 
   * 
   * 
   * 
   * 
   * 
   */
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