// JEDYNE miejsce w aplikacji, które czyta process.env.
// Wczytuje .env, waliduje wszystkie zmienne schematem Zod i przy błędzie zatrzymuje aplikację (fail fast).
const { z } = require("zod");

try {
  process.loadEnvFile();
} catch {
  // brak pliku .env - zmienne mogą przyjść z zewnątrz (np. z Dockera)
}

const envSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATABASE_URL: z.string().regex(/^postgres(ql)?:\/\/[^/]+\/.+$/, "musi być adresem postgres://user:haslo@host:port/baza"),
  JWT_SECRET: z.string().min(32, "musi mieć co najmniej 32 znaki"),
  JWT_EXPIRES_IN: z.string().regex(/^\d+[smhd]$/, "format np. 15m, 10s, 1h").default("15m"),
  BCRYPT_ROUNDS: z.coerce.number().int().min(10).max(15).default(12),
  REPOSITORY: z.enum(["knex", "memory"]).default("knex")
});

const result = envSchema.safeParse(process.env);

if (!result.success) {
  console.error("Niepoprawna konfiguracja - aplikacja nie zostanie uruchomiona:");
  for (const issue of result.error.issues) {
    console.error(`  - ${issue.path.join(".")}: ${issue.message}`);
  }
  process.exit(1);
}

const env = result.data;

module.exports = Object.freeze({
  port: env.PORT,
  databaseUrl: env.DATABASE_URL,
  jwt: Object.freeze({ secret: env.JWT_SECRET, expiresIn: env.JWT_EXPIRES_IN }),
  bcryptRounds: env.BCRYPT_ROUNDS,
  repository: env.REPOSITORY
});
