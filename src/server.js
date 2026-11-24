const config = require("./config");
const { createApp } = require("./app");
const { createEventBus } = require("./events/eventBus");

// JEDYNE miejsce wyboru implementacji repositories (REPOSITORY=knex | memory)
function createUnitOfWork() {
  if (config.repository === "memory") {
    const { createMemoryUnitOfWork } = require("./db/unitOfWork.memory");
    console.log("Repositories: in-memory");
    return { ...createMemoryUnitOfWork(), close: async () => {} };
  }

  const db = require("./db/knex");
  const { createKnexUnitOfWork } = require("./db/unitOfWork.knex");
  console.log("Repositories: PostgreSQL (Knex)");
  return { ...createKnexUnitOfWork(db), close: () => db.destroy() };
}

const { runInTransaction, close } = createUnitOfWork();
const eventBus = createEventBus();

const app = createApp({
  runInTransaction,
  now: () => new Date(),
  eventBus
});

const server = app.listen(config.port, () => {
  console.log(`Server running on http://localhost:${config.port}`);
});

// Graceful shutdown: SIGTERM (docker compose down / stop) albo SIGINT (Ctrl+C)
// 1. przestajemy przyjmować nowe połączenia i czekamy na trwające requesty (server.close),
// 2. czekamy na listenery eventów (audit log),
// 3. zamykamy pulę połączeń z bazą -> proces kończy się sam, Docker nie musi wysyłać SIGKILL.
let shuttingDown = false;

function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[shutdown] ${signal} - zamykanie servera...`);

  // awaryjnie: gdyby coś wisiało dłużej niż 8 s, kończymy sami (Docker czeka 10 s)
  setTimeout(() => {
    console.error("[shutdown] przekroczono czas - wymuszone zakonczenie");
    process.exit(1);
  }, 8000).unref();

  server.close(async err => {
    try {
      console.log("[shutdown] HTTP server zamkniety");
      await eventBus.drain();
      await close();
      console.log("[shutdown] pula polaczen z baza zamknieta - koniec");
      process.exit(err ? 1 : 0);
    } catch (closeErr) {
      console.error("[shutdown] blad podczas zamykania:", closeErr);
      process.exit(1);
    }
  });

  // zamyka bezczynne połączenia keep-alive (inaczej server.close czekałby na ich timeout)
  server.closeIdleConnections();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
