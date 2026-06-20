require("dotenv").config();

const createServer = require("./server");
const createBot = require("./bot");

const PORT = process.env.PORT || 3000;
const BOT_TOKEN = process.env.BOT_TOKEN;
const WEBAPP_URL = process.env.WEBAPP_URL;

if (!BOT_TOKEN) {
  console.error("Ошибка: переменная BOT_TOKEN не задана. Проверь .env (локально) или Environment (на Render).");
  process.exit(1);
}

if (!WEBAPP_URL) {
  console.warn("Внимание: WEBAPP_URL не задан — кнопка открытия Mini App в боте работать не будет, пока не пропишешь её.");
}

const app = createServer();
app.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
});

createBot(BOT_TOKEN, WEBAPP_URL || "https://example.com");
console.log("Бот запущен и слушает сообщения.");
