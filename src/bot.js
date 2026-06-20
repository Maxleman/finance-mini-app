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

  bot.onText(/\/start/, (msg) => {
    const chatId = String(msg.chat.id);
    db.ensureUser(chatId);
    bot.sendMessage(
      chatId,
      "Привет! Это твой личный финансовый трекер.\n\nЖми кнопку ниже чтобы открыть приложение — там доход, обязательные платежи, цели и быстрая запись трат.",
      mainKeyboard()
    );
  });

  bot.onText(/\/app/, (msg) => {
    const chatId = String(msg.chat.id);
    bot.sendMessage(chatId, "Открываю трекер 👇", mainKeyboard());
  });

  // /status — быстрая сводка прямо в чате, без открытия Mini App
  bot.onText(/\/status/, (msg) => {
    const chatId = String(msg.chat.id);
    const data = db.getUserData(chatId);
    const now = new Date();
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const period = data.periods[monthKey];

    if (!period) {
      bot.sendMessage(chatId, "За этот месяц пока ничего не записано. Открой трекер чтобы начать.", mainKeyboard());
      return;
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

    const text = [
      `💰 Сводка за месяц`,
      ``,
      `Доход: ${totalIncome} BYN`,
      `Потрачено: ${totalExpenses} BYN`,
      `Остаток сейчас: ${remaining} BYN`,
      ``,
      `🎯 Цели:`,
      goalsText,
    ].join("\n");

    bot.sendMessage(chatId, text, mainKeyboard());
  });

  bot.onText(/\/help/, (msg) => {
    bot.sendMessage(
      String(msg.chat.id),
      "Команды:\n/app — открыть трекер\n/status — быстрая сводка\n/remind — настроить напоминания"
    );
  });

  // По твоему запросу — уведомления только когда сам попросишь, без автоматики по расписанию.
  // Если захочешь автоматические — раскомментируй cron ниже и пропиши OWNER_CHAT_ID.
  /*
  cron.schedule("0 21 * * *", () => {
    const ownerChatId = process.env.OWNER_CHAT_ID;
    if (!ownerChatId) return;
    bot.sendMessage(ownerChatId, "Не забыл записать траты сегодня? 👀", mainKeyboard());
  });
  */

  bot.on("polling_error", (err) => {
    console.error("Telegram polling error:", err.message);
  });

  return bot;
}

module.exports = createBot;
