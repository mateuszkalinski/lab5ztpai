# Room Booking API

[![CI](https://github.com/mateuszkalinski/lab5ztpai/actions/workflows/ci.yml/badge.svg)](https://github.com/mateuszkalinski/lab5ztpai/actions/workflows/ci.yml)

REST API do rezerwacji sal: budynki, sale, rezerwacje, konta USER / ADMIN (JWT).
Stack: Node.js 22, Express 5, PostgreSQL 16 (Knex), Zod, Jest + Supertest, Docker Compose, GitHub Actions.

## Uruchomienie od zera (Docker)

Wymagany tylko Docker (z Docker Compose).

```bash
git clone https://github.com/mateuszkalinski/lab5ztpai.git
cd lab5ztpai
cp .env.example .env
docker compose up --build
```

- API: <http://localhost:3000>
- Swagger UI: <http://localhost:3000/api/docs>

Migracje uruchamiają się automatycznie przy starcie kontenera `api`.

### Dane demo i konto ADMIN

W drugim terminalu, przy działających kontenerach:

```bash
docker compose exec api npx knex seed:run
```

| Konto | Email | Hasło |
| --- | --- | --- |
| ADMIN | `admin@example.com` | `Admin-Haslo-2026` |
| USER | `mateusz.kalinski@example.com` | `Haslo-Testowe-2026` |

Seed czyści tabele i wstawia dane od nowa.

### Zatrzymanie

```bash
docker compose down        # dane w bazie zostają (named volume roombooking-pgdata)
docker compose down -v     # usuwa także dane
```

Aplikacja obsługuje `SIGTERM` (graceful shutdown), więc `docker compose down` nie czeka 10 s na `SIGKILL`.

## Testy

```bash
npm install
npm run test:unit          # unit testy - bez bazy danych
docker compose up -d db    # PostgreSQL dla testów integracyjnych
npm run test:integration   # Supertest + osobna baza roombooking_test (tworzona automatycznie)
npm test                   # wszystko razem
```

Testy integracyjne używają `TEST_DATABASE_URL` (nazwa bazy musi kończyć się na `_test`) i nigdy nie dotykają bazy deweloperskiej.

## Uruchomienie bez Dockera (development)

```bash
npm install
docker compose up -d db
npm run migrate
npm run seed
npm start
```

## Najważniejsze endpointy

| Metoda | Ścieżka | Dostęp |
| --- | --- | --- |
| POST | `/api/auth/register`, `/api/auth/login` | publiczne |
| GET | `/api/auth/me` | zalogowany |
| GET | `/api/buildings`, `/api/rooms` | zalogowany |
| POST | `/api/buildings`, `/api/rooms` | ADMIN |
| GET, POST | `/api/reservations` | zalogowany (USER - tylko własne) |
| PATCH | `/api/reservations/:id/cancel` | właściciel albo ADMIN |
| GET | `/api/admin/audit-log?eventType=&page=&limit=` | ADMIN |

Pełna dokumentacja: Swagger UI pod `/api/docs`.
