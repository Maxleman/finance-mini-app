const fs = require("fs");
const path = require("path");

const DB_PATH = path.join(__dirname, "..", "data.json");

const DEFAULT_RECURRING = [
  { id: "rent", name: "Аренда квартиры", amount: 650, day: 5 },
  { id: "utilities", name: "Коммунальные услуги", amount: 85, day: 10 },
  { id: "transport_pass", name: "Проездной", amount: 65, day: 1 },
  { id: "claude", name: "Claude подписка", amount: 45, day: 15 },
  { id: "monitor", name: "Рассрочка монитор", amount: 58, day: 20, installment: true, monthsLeft: 7 },
];

const DEFAULT_TEMPLATES = [
  { id: "t1", name: "Обед на работе", cat: "food", amount: 12 },
  { id: "t2", name: "Кофе", cat: "food", amount: 5 },
  { id: "t3", name: "Такси", cat: "transport", amount: 8 },
];

function defaultUserData() {
  return {
    periods: {},
    recurring: DEFAULT_RECURRING,
    templates: DEFAULT_TEMPLATES,
    limits: {},
  };
}

// Весь файл читается и пишется целиком — для одного-двух пользователей
// и объёма данных (траты/цели за несколько месяцев) этого с большим запасом достаточно,
// а простота важнее: нет риска поломки нативного модуля при деплое на Render.
function readDb() {
  if (!fs.existsSync(DB_PATH)) {
    return {};
  }
  try {
    const raw = fs.readFileSync(DB_PATH, "utf8");
    return raw ? JSON.parse(raw) : {};
  } catch (err) {
    console.error("Ошибка чтения базы данных, использую пустую:", err.message);
    return {};
  }
}

function writeDb(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), "utf8");
}

function ensureUser(chatId) {
  const all = readDb();
  if (!all[chatId]) {
    all[chatId] = defaultUserData();
    writeDb(all);
  }
}

function getUserData(chatId) {
  const all = readDb();
  if (!all[chatId]) {
    all[chatId] = defaultUserData();
    writeDb(all);
  }
  return all[chatId];
}

function saveField(chatId, field, value) {
  const all = readDb();
  if (!all[chatId]) {
    all[chatId] = defaultUserData();
  }
  all[chatId][field] = value;
  writeDb(all);
}

function getAllChatIds() {
  const all = readDb();
  return Object.keys(all);
}

module.exports = { getUserData, saveField, getAllChatIds, ensureUser };
