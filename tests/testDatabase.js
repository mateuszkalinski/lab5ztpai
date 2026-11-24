// Adres bazy testowej: TEST_DATABASE_URL (z .env albo ze środowiska, np. w CI),
// domyślnie lokalny PostgreSQL z docker-compose i baza roombooking_test.
const DEFAULT_TEST_DATABASE_URL = "postgres://postgres:postgres@localhost:5432/roombooking_test";

function getTestDatabaseUrl() {
  try {
    process.loadEnvFile(); // nie nadpisuje zmiennych, które już są ustawione
  } catch {
    // brak .env (np. w CI) - zmienne przychodzą ze środowiska
  }

  const url = process.env.TEST_DATABASE_URL || DEFAULT_TEST_DATABASE_URL;
  const databaseName = new URL(url).pathname.slice(1);

  // bezpiecznik: testy czyszczą tabele (TRUNCATE) - NIGDY nie mogą trafić w bazę deweloperską
  if (!databaseName.endsWith("_test")) {
    throw new Error(`Baza testowa musi mieć nazwę kończącą się na "_test" (jest: "${databaseName}")`);
  }

  return url;
}

module.exports = { getTestDatabaseUrl };
