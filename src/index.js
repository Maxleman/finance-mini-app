require("dotenv").config();

const createServer = require("./server");
const createBot = require("./bot");
const db = require("./db");

const PORT = process.env.PORT || 3000;
const BOT_TOKEN = process.env.BOT_TOKEN;
const WEBAPP_URL = process.env.WEBAPP_URL;
const DATABASE_URL = process.env.DATABASE_URL;

if (!BOT_TOKEN) {
  console.error("Ошибка: переменная BOT_TOKEN не задана. Проверь .env (локально) или Environment (на Render).");
  process.exit(1);
}

if (!DATABASE_URL) {
  console.error("Ошибка: переменная DATABASE_URL не задана. Пропиши строку подключения Supabase в Environment на Render.");
  process.exit(1);
}

if (!WEBAPP_URL) {
  console.warn("Внимание: WEBAPP_URL не задан — кнопка открытия Mini App в боте работать не будет, пока не пропишешь её.");
}

async function start() {
  try {
    await db.initSchema();
    console.log("Подключение к базе данных установлено, таблица готова.");
  } catch (err) {
    console.error("Не удалось подключиться к базе данных:", err.message);
    process.exit(1);
  }

  const app = createServer();
  app.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
  });

  createBot(BOT_TOKEN, WEBAPP_URL || "https://example.com");
  console.log("Бот запущен и слушает сообщения.");
}

start();
