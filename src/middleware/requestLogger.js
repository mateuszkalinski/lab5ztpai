const { randomUUID } = require("node:crypto");

function requestLogger(req, res, next) {
  req.id = req.get("X-Request-Id") || randomUUID();
  res.set("X-Request-Id", req.id);

  const start = process.hrtime.bigint();

  res.on("finish", () => {
    const ms = Number(process.hrtime.bigint() - start) / 1e6;
    // req.user ustawia authenticate - w logu widać, kto wykonał request
    const who = req.user ? `user ${req.user.id} ${req.user.role}` : "bez tokenu";
    console.log(`[${req.id}] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${ms.toFixed(1)} ms) [${who}]`);
  });

  next();
}

module.exports = requestLogger;
