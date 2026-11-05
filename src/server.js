const config = require("./config");
const { createApp } = require("./app");

// JEDYNE miejsce wyboru implementacji repositories (REPOSITORY=knex | memory)
function createUnitOfWork() {
  if (config.repository === "memory") {
    const { createMemoryUnitOfWork } = require("./db/unitOfWork.memory");
    console.log("Repositories: in-memory");
    return createMemoryUnitOfWork();
  }

  const db = require("./db/knex");
  const { createKnexUnitOfWork } = require("./db/unitOfWork.knex");
  console.log("Repositories: PostgreSQL (Knex)");
  return createKnexUnitOfWork(db);
}

const { runInTransaction } = createUnitOfWork();

const app = createApp({
  runInTransaction,
  now: () => new Date()
});

app.listen(config.port, () => {
  console.log(`Server running on http://localhost:${config.port}`);
});
