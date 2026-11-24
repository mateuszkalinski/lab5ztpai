// Uruchamiany przez Jest przed każdym plikiem testów integracyjnych - ZANIM test zrobi require("src/...").
// src/config czyta process.env, a process.loadEnvFile() nie nadpisuje zmiennych ustawionych tutaj,
// więc aplikacja w testach zawsze łączy się z bazą testową, a nie deweloperską.
const { getTestDatabaseUrl } = require("./testDatabase");

process.env.DATABASE_URL = getTestDatabaseUrl();
process.env.REPOSITORY = "knex";
// sekret tylko na potrzeby testów (tokeny żyją kilka sekund w pamięci procesu testów)
process.env.JWT_SECRET = "test-only-secret-for-jest-0123456789-abcdefghij";
process.env.JWT_EXPIRES_IN = "15m";
process.env.BCRYPT_ROUNDS = "10"; // minimum dozwolone przez config - szybsze testy
