const config = require("./src/config");

module.exports = {
  client: "pg",
  connection: config.databaseUrl,
  migrations: { directory: "./src/db/migrations" },
  seeds: { directory: "./src/db/seeds" }
};
