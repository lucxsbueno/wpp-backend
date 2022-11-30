
const express = require("express");
const app = express();
const http = require("http");
const server = http.createServer(app);
const qrcode = require("qrcode");

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

  socket.emit("message", "Novo socket conectado: " + socket.id);

  /**
   * 
   * 
   * 
   * WhatsApp
   */
  socket.on("generate-session", data => {
    console.log("Localizando sessão: " + data.id);

    socket.emit("loading", { start: true });

    socket.emit("message", "Localizando sessão: " + data.id);

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

          socket.emit("loading", { start: false });
        }
      });
    });

    client.on("ready", async () => {
      console.log("WhatsApp está pronto!");

      socket.emit("message", "O WhatsApp está pronto! " + data.id);

      socket.emit("message", "Carregando chats...");

      /**
       * 
       * Retorna todos os chats apenas com os atributos necessários
       */
      let chats = await client.getChats();

      chats = await Promise.all(chats.map(async chat => {
        const { body, fromMe, hasMedia, id, timestamp, ...rest }
          = { ...(await chat.fetchMessages({ limit: 1 }))[0] };

        return {
          id: chat.id._serialized,
          name: chat.name,
          avatar: await (await client.getContactById(chat.id._serialized)).getProfilePicUrl(),
          is_group: chat.isGroup,
          last_message: {
            id: { ...id }.id,
            body: hasMedia ? "Enviou uma mídia." : body,
            timestamp,
            from_me: fromMe,
            has_media: hasMedia
          }
        }
      }));

      socket.emit("chats", chats);

      socket.emit("message", "Chats carregados com sucesso!");

      socket.emit("loading", { start: false });
    });

    client.on("authenticated", () => {
      socket.emit("qr", "");
      socket.emit("message", "O WhatsApp está logado!");
    });

    client.on("loading_screen", () => {
      socket.emit("message", "Carregando...");

      socket.emit("loading", { start: true });
    });

    client.on("auth_failure", () => {
      socket.emit("message", "Erro ao fazer login!");
    });

    client.on("disconnected", (reason) => {
      console.log("O cliente foi desconectado:", reason);
      client.initialize() // this what i was need
    });

    client.on("message", async message => {
      socket.emit("new_message", message._data.notifyName + ": " + message.body);
    });

    socket.on("close-client", () => {
      client.destroy();
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