// Dwa projekty Jest:
// - unit        -> tests/unit, bez bazy danych (repositories in-memory)
// - integration -> tests/integration, Supertest + OSOBNA baza testowa (*_test)
module.exports = {
  testTimeout: 15000,
  projects: [
    {
      displayName: "unit",
      testEnvironment: "node",
      testMatch: ["<rootDir>/tests/unit/**/*.test.js"]
    },
    {
      displayName: "integration",
      testEnvironment: "node",
      testMatch: ["<rootDir>/tests/integration/**/*.test.js"],
      // tworzy bazę testową, jeśli nie istnieje (raz, przed wszystkimi testami)
      globalSetup: "<rootDir>/tests/integration/globalSetup.js",
      // ustawia zmienne środowiskowe ZANIM aplikacja wczyta src/config
      setupFiles: ["<rootDir>/tests/setupEnv.js"]
    }
  ]
};
