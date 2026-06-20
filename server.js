const express = require("express");
const cors = require("cors");
const path = require("path");
const db = require("./db");

function createServer() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  // Отдаём собранный фронтенд (папка public, см. ниже)
  app.use(express.static(path.join(__dirname, "..", "public")));

  // Получить все данные пользователя одним запросом — фронт дёргает это при загрузке
  app.get("/api/data/:chatId", (req, res) => {
    try {
      const data = db.getUserData(req.params.chatId);
      res.json(data);
    } catch (err) {
      console.error("GET /api/data error:", err);
      res.status(500).json({ error: "internal_error" });
    }
  });

  // Сохранить одно поле (periods / recurring / templates / limits)
  app.post("/api/data/:chatId/:field", (req, res) => {
    const { chatId, field } = req.params;
    const allowed = ["periods", "recurring", "templates", "limits"];
    if (!allowed.includes(field)) {
      return res.status(400).json({ error: "invalid_field" });
    }
    try {
      db.saveField(chatId, field, req.body.value);
      res.json({ ok: true });
    } catch (err) {
      console.error("POST /api/data error:", err);
      res.status(500).json({ error: "internal_error" });
    }
  });

  // Healthcheck — используем и для пинга от cron-job.org, чтобы не засыпал
  app.get("/health", (req, res) => res.json({ ok: true, time: new Date().toISOString() }));

  return app;
}

module.exports = createServer;
