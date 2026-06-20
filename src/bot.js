const TelegramBot = require("node-telegram-bot-api");
const cron = require("node-cron");
const db = require("./db");

function createBot(token, webappUrl) {
  const bot = new TelegramBot(token, { polling: true });

  function mainKeyboard() {
    return {
      reply_markup: {
        inline_keyboard: [
          [{ text: "📊 Открыть трекер", web_app: { url: webappUrl } }],
        ],
      },
    };
  }

  function monthKeyNow() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  }

  // Собирает текстовую сводку по текущему месяцу для конкретного chatId.
  // Используется и в команде /status, и в вечернем автонапоминании — одна логика, без дублирования.
  async function buildSummary(chatId) {
    const data = await db.getUserData(chatId);
    const period = data.periods[monthKeyNow()];

    if (!period) {
      return "За этот месяц пока ничего не записано. Открой трекер чтобы начать.";
    }

    const incomes = period.incomes || [];
    const totalIncome = incomes.reduce((s, i) => s + i.amount, 0);
    const totalExpenses = (period.expenses || []).reduce((s, e) => s + e.amount, 0);
    const activeRecurring = data.recurring.filter(r => !r.installment || r.monthsLeft > 0);
    const paidStatus = period.paidStatus || {};
    const totalPaid = activeRecurring.filter(r => paidStatus[r.id]).reduce((s, r) => s + r.amount, 0);
    const remaining = totalIncome - totalPaid - totalExpenses;

    const goals = period.goals || [];
    const goalsText = goals.length
      ? goals.map(g => `${g.emoji || "🎯"} ${g.name}: ${g.saved}/${g.target} BYN`).join("\n")
      : "нет целей на этот месяц";

    return [
      `💰 Сводка за месяц`,
      ``,
      `Доход: ${totalIncome} BYN`,
      `Потрачено: ${totalExpenses} BYN`,
      `Остаток сейчас: ${remaining} BYN`,
      ``,
      `🎯 Цели:`,
      goalsText,
    ].join("\n");
  }

  bot.onText(/\/start/, async (msg) => {
    const chatId = String(msg.chat.id);
    try {
      await db.ensureUser(chatId);
      bot.sendMessage(
        chatId,
        "Привет! Это твой личный финансовый трекер.\n\nЖми кнопку ниже чтобы открыть приложение — там доход, обязательные платежи, цели и быстрая запись трат.\n\nКоманда /help покажет список всех команд.",
        mainKeyboard()
      );
    } catch (err) {
      console.error("Ошибка /start:", err.message);
      bot.sendMessage(chatId, "Что-то пошло не так при подключении к базе данных. Попробуй ещё раз чуть позже.");
    }
  });

  bot.onText(/\/app/, (msg) => {
    const chatId = String(msg.chat.id);
    bot.sendMessage(chatId, "Открываю трекер 👇", mainKeyboard());
  });

  bot.onText(/\/status/, async (msg) => {
    const chatId = String(msg.chat.id);
    try {
      const summary = await buildSummary(chatId);
      bot.sendMessage(chatId, summary, mainKeyboard());
    } catch (err) {
      console.error("Ошибка /status:", err.message);
      bot.sendMessage(chatId, "Не получилось получить данные. Попробуй ещё раз чуть позже.");
    }
  });

  bot.onText(/\/help/, (msg) => {
    bot.sendMessage(
      String(msg.chat.id),
      [
        "📋 Список команд:",
        "",
        "/app — открыть трекер",
        "/status — краткая сводка за месяц",
        "/help — этот список",
        "",
        "🔔 Автоматические уведомления:",
        "Каждый вечер в 21:00 — сводка по остатку.",
        "1-го числа месяца — напоминание указать доход и проверить обязательные платежи.",
      ].join("\n")
    );
  });

  // ── Автонапоминания ──────────────────────────────────────────
  // Расписание задаётся в часовом поясе Europe/Minsk, не в UTC сервера Render.

  // Каждый вечер в 21:00 — сводка по остатку + кнопка открыть приложение
  cron.schedule("0 21 * * *", async () => {
    try {
      const chatIds = await db.getAllChatIds();
      for (const chatId of chatIds) {
        try {
          const summary = await buildSummary(chatId);
          await bot.sendMessage(chatId, `🌙 Вечерняя сводка\n\n${summary}\n\nНе забыл записать траты за сегодня?`, mainKeyboard());
        } catch (err) {
          console.error(`Не удалось отправить вечернее уведомление ${chatId}:`, err.message);
        }
      }
    } catch (err) {
      console.error("Ошибка вечерней рассылки:", err.message);
    }
  }, { timezone: "Europe/Minsk" });

  // 1-го числа в 9:00 — напомнить указать доход и проверить обязательные платежи
  cron.schedule("0 9 1 * *", async () => {
    try {
      const chatIds = await db.getAllChatIds();
      for (const chatId of chatIds) {
        try {
          const data = await db.getUserData(chatId);
          const activeRecurring = data.recurring.filter(r => !r.installment || r.monthsLeft > 0);
          const recurringText = activeRecurring.length
            ? activeRecurring.map(r => `• ${r.name} — ${r.amount} BYN`).join("\n")
            : "нет обязательных платежей";

          const text = [
            "📅 Новый месяц начался!",
            "",
            "Не забудь указать доход за этот месяц в трекере.",
            "",
            "Обязательные платежи на этот месяц:",
            recurringText,
          ].join("\n");

          await bot.sendMessage(chatId, text, mainKeyboard());
        } catch (err) {
          console.error(`Не удалось отправить месячное уведомление ${chatId}:`, err.message);
        }
      }
    } catch (err) {
      console.error("Ошибка месячной рассылки:", err.message);
    }
  }, { timezone: "Europe/Minsk" });

  bot.on("polling_error", (err) => {
    console.error("Telegram polling error:", err.message);
  });

  return bot;
}

module.exports = createBot;
