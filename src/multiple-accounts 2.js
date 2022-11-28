const qrcode = require("qrcode");
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

const { Client, LocalAuth } = require("whatsapp-web.js");

const io = require("socket.io")(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"]
  }
});

const createSession = data => {
  console.log("Um usuário se conectou:", socket.id);

  socket.emit("message", "Sincronizando...");

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
        socket.emit("qr", url);
        socket.emit("message", "Para prosseguir, por favor escaneie o QrCode!");
      }
    });
  });

  client.on("ready", async () => {
    socket.emit("message", "WhatsApp está pronto!");

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
  });

  client.on("authenticated", () => {
    socket.emit("message", "O WhatsApp está logado!");
  });

  client.on("message", async message => {
    socket.emit("new_message", message._data.notifyName + ": " + message.body);
  });
}

io.on("connection", (socket) => {
  socket.on("create-session", data => {
    console.log("Criando sessão: " + data.id);
    createSession(data);
  });
});

server.listen(5000, () => {
  console.log(`Server is runnig on: http://localhost:${5000}. 👌`);
});