const qrcode = require("qrcode");

const express = require("express");
const app = express();

const http = require("http");
const server = http.createServer(app);

/**
 * 
 * 
 * 
 * 
 * 
 * WhatsApp Web
 */
const { Client, LocalAuth } = require("whatsapp-web.js");

const client = new Client({
  authStrategy: new LocalAuth(),
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

const io = require("socket.io")(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"]
  }
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/", (req, res) => {
  res.json({
    message: "Welcome to my server application! 😊"
  });
});

app.post("/messages", async (req, res) => {
  const { message, number } = req.body;

  try {
    const response = await client.sendMessage(number, message);

    res.status(200).json({
      error: false,
      message: "Mensagem enviada!",
      response
    });
  } catch (error) {
    res.status(500).json({
      error: true,
      message: err.message
    });
  }
});

/**
 * 
 * 
 * Socke.io
 */
io.on("connection", (socket) => {
  console.log("Um usuário se conectou:", socket.id);

  socket.emit("message", "Sincronizando...");

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

    if (message.body === "!amor") {
      message.reply("Bárbara amor🧡🧡");
      const chat = await message.getChat();

      console.log(chat);
    }
  });

  socket.on("create-session", data => {
    console.log(data);
  });
});

server.listen(5000, () => {
  console.log(`Server is runnig on: http://localhost:${5000}. 👌`);
});