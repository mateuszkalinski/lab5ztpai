// Raz przed testami integracyjnymi: tworzy bazę testową, jeśli jeszcze nie istnieje.
// Dzięki temu "npm run test:integration" działa od zera - wystarczy działający PostgreSQL.
// Schemat (tabele) tworzą migracje w beforeAll w samych testach.
const knex = require("knex");
const { getTestDatabaseUrl } = require("../testDatabase");

module.exports = async function globalSetup() {
  const testUrl = new URL(getTestDatabaseUrl());
  const databaseName = testUrl.pathname.slice(1);

  // łączymy się z bazą systemową "postgres", bo testowej może jeszcze nie być
  const adminUrl = new URL(testUrl);
  adminUrl.pathname = "/postgres";
  const admin = knex({ client: "pg", connection: adminUrl.toString() });

  try {
    const exists = await admin("pg_database").where({ datname: databaseName }).first();
    if (!exists) {
      await admin.raw("CREATE DATABASE ??", [databaseName]);
      console.log(`\n[globalSetup] utworzono baze testowa ${databaseName}`);
    }
  } finally {
    await admin.destroy();
  }
};
