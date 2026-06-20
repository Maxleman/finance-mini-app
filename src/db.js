const { Pool } = require("pg");

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

let pool;

// Подключение создаётся один раз и переиспользуется (пул соединений),
// а не открывается заново на каждый запрос.
function getPool() {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL не задана. Пропиши строку подключения Supabase в переменных окружения.");
    }
    pool = new Pool({
      connectionString,
      ssl: { rejectUnauthorized: false }, // Supabase требует SSL, но с самоподписанным цепочка не всегда проверяется чисто
    });
  }
  return pool;
}

// Создаёт таблицу, если её ещё нет. Безопасно вызывать при каждом старте сервера —
// IF NOT EXISTS не даст пересоздать существующую таблицу и стереть данные.
async function initSchema() {
  const db = getPool();
  await db.query(`
    CREATE TABLE IF NOT EXISTS user_data (
      chat_id TEXT PRIMARY KEY,
      periods JSONB NOT NULL DEFAULT '{}'::jsonb,
      recurring JSONB NOT NULL DEFAULT '[]'::jsonb,
      templates JSONB NOT NULL DEFAULT '[]'::jsonb,
      limits_data JSONB NOT NULL DEFAULT '{}'::jsonb,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
}

async function ensureUser(chatId) {
  const db = getPool();
  const existing = await db.query("SELECT chat_id FROM user_data WHERE chat_id = $1", [chatId]);
  if (existing.rows.length === 0) {
    await db.query(
      `INSERT INTO user_data (chat_id, periods, recurring, templates, limits_data)
       VALUES ($1, '{}'::jsonb, $2::jsonb, $3::jsonb, '{}'::jsonb)`,
      [chatId, JSON.stringify(DEFAULT_RECURRING), JSON.stringify(DEFAULT_TEMPLATES)]
    );
  }
}

async function getUserData(chatId) {
  await ensureUser(chatId);
  const db = getPool();
  const result = await db.query("SELECT * FROM user_data WHERE chat_id = $1", [chatId]);
  const row = result.rows[0];
  return {
    periods: row.periods,
    recurring: row.recurring,
    templates: row.templates,
    limits: row.limits_data,
  };
}

async function saveField(chatId, field, value) {
  await ensureUser(chatId);
  const db = getPool();
  const column = field === "limits" ? "limits_data" : field;
  const allowedColumns = ["periods", "recurring", "templates", "limits_data"];
  if (!allowedColumns.includes(column)) {
    throw new Error(`Недопустимое поле: ${field}`);
  }
  await db.query(
    `UPDATE user_data SET ${column} = $1::jsonb, updated_at = now() WHERE chat_id = $2`,
    [JSON.stringify(value), chatId]
  );
}

async function getAllChatIds() {
  const db = getPool();
  const result = await db.query("SELECT chat_id FROM user_data");
  return result.rows.map(r => r.chat_id);
}

module.exports = { getUserData, saveField, getAllChatIds, ensureUser, initSchema };
