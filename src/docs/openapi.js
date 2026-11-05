// Dokumentacja OpenAPI 3 (Swagger UI pod /api/docs)
const ref = name => ({ $ref: `#/components/schemas/${name}` });
const json = schema => ({ content: { "application/json": { schema } } });
const err = name => ({ $ref: `#/components/responses/${name}` });
const idParam = (description) => ({ name: "id", in: "path", required: true, description, schema: { type: "integer", minimum: 1 } });
const secured = [{ bearerAuth: [] }];

module.exports = {
  openapi: "3.0.3",
  info: {
    title: "Room Booking API",
    version: "4.0.0",
    description: "Rezerwacja sal. Role: USER (budynki i sale do odczytu, własne rezerwacje), ADMIN (zarządzanie budynkami i salami, wszystkie rezerwacje)."
  },
  servers: [{ url: "/" }],
  tags: [{ name: "Auth" }, { name: "Buildings" }, { name: "Rooms" }, { name: "Reservations" }],

  paths: {
    "/api/auth/register": {
      post: {
        tags: ["Auth"], summary: "Rejestracja (nowe konto zawsze z rolą USER)",
        requestBody: { required: true, ...json(ref("RegisterBody")) },
        responses: {
          201: { description: "Utworzono konto", ...json(ref("User")) },
          400: err("BadRequest"),
          409: { description: "Email zajęty (EMAIL_TAKEN)", ...json(ref("Error")) }
        }
      }
    },
    "/api/auth/login": {
      post: {
        tags: ["Auth"], summary: "Logowanie - zwraca token JWT",
        requestBody: { required: true, ...json(ref("LoginBody")) },
        responses: {
          200: { description: "Zalogowano", ...json(ref("LoginResponse")) },
          400: err("BadRequest"),
          401: { description: "Zły email lub hasło (INVALID_CREDENTIALS)", ...json(ref("Error")) }
        }
      }
    },
    "/api/auth/me": {
      get: {
        tags: ["Auth"], summary: "Dane zalogowanego użytkownika", security: secured,
        responses: { 200: { description: "OK", ...json(ref("User")) }, 401: err("Unauthorized") }
      }
    },

    "/api/buildings": {
      get: {
        tags: ["Buildings"], summary: "Lista budynków z liczbą sal", security: secured,
        responses: { 200: { description: "OK", ...json({ type: "array", items: ref("Building") }) }, 401: err("Unauthorized") }
      },
      post: {
        tags: ["Buildings"], summary: "Nowy budynek (tylko ADMIN)", security: secured,
        requestBody: { required: true, ...json(ref("CreateBuildingBody")) },
        responses: {
          201: { description: "Utworzono", ...json(ref("Building")) },
          400: err("BadRequest"), 401: err("Unauthorized"), 403: err("Forbidden"),
          409: { description: "Budynek o tej nazwie już istnieje", ...json(ref("Error")) }
        }
      }
    },
    "/api/buildings/{id}": {
      get: {
        tags: ["Buildings"], summary: "Jeden budynek", security: secured, parameters: [idParam("ID budynku")],
        responses: { 200: { description: "OK", ...json(ref("Building")) }, 400: err("BadRequest"), 401: err("Unauthorized"), 404: err("NotFound") }
      }
    },
    "/api/buildings/{id}/rooms": {
      get: {
        tags: ["Buildings"], summary: "Sale budynku", security: secured, parameters: [idParam("ID budynku")],
        responses: { 200: { description: "OK (pusta tablica, gdy budynek nie ma sal)", ...json({ type: "array", items: ref("Room") }) }, 400: err("BadRequest"), 401: err("Unauthorized"), 404: err("NotFound") }
      }
    },

    "/api/rooms": {
      get: {
        tags: ["Rooms"], summary: "Lista sal z budynkami", security: secured,
        responses: { 200: { description: "OK", ...json({ type: "array", items: ref("Room") }) }, 401: err("Unauthorized") }
      },
      post: {
        tags: ["Rooms"], summary: "Nowa sala (tylko ADMIN)", security: secured,
        requestBody: { required: true, ...json(ref("CreateRoomBody")) },
        responses: {
          201: { description: "Utworzono", ...json(ref("Room")) },
          400: err("BadRequest"), 401: err("Unauthorized"), 403: err("Forbidden"),
          404: { description: "Budynek nie istnieje", ...json(ref("Error")) },
          409: { description: "Sala o tej nazwie już istnieje w budynku", ...json(ref("Error")) }
        }
      }
    },
    "/api/rooms/{id}": {
      get: {
        tags: ["Rooms"], summary: "Jedna sala z budynkiem", security: secured, parameters: [idParam("ID sali")],
        responses: { 200: { description: "OK", ...json(ref("Room")) }, 400: err("BadRequest"), 401: err("Unauthorized"), 404: err("NotFound") }
      }
    },

    "/api/reservations": {
      get: {
        tags: ["Reservations"], summary: "Lista rezerwacji (USER - tylko własne, ADMIN - wszystkie)", security: secured,
        parameters: [
          { name: "roomId", in: "query", schema: { type: "integer", minimum: 1 } },
          { name: "buildingId", in: "query", schema: { type: "integer", minimum: 1 } },
          { name: "userId", in: "query", description: "Tylko ADMIN (USER -> 403)", schema: { type: "integer", minimum: 1 } },
          { name: "status", in: "query", schema: { type: "string", enum: ["CONFIRMED", "CANCELLED"] } },
          { name: "from", in: "query", description: "Początek przedziału [from, to)", schema: { type: "string", format: "date-time" } },
          { name: "to", in: "query", description: "Koniec przedziału, musi być późniejszy niż from", schema: { type: "string", format: "date-time" } },
          { name: "page", in: "query", schema: { type: "integer", minimum: 1, default: 1 } },
          { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 100, default: 20 } },
          { name: "sort", in: "query", schema: { type: "string", enum: ["startTime", "-startTime", "createdAt", "-createdAt", "participants", "-participants"], default: "startTime" } }
        ],
        responses: {
          200: { description: "OK", ...json({ type: "object", properties: { data: { type: "array", items: ref("Reservation") }, meta: ref("PaginationMeta") } }) },
          400: err("BadRequest"), 401: err("Unauthorized"),
          403: { description: "Filtr userId użyty przez USERa", ...json(ref("Error")) }
        }
      },
      post: {
        tags: ["Reservations"], summary: "Nowa rezerwacja (właściciel = zalogowany użytkownik)", security: secured,
        requestBody: { required: true, ...json(ref("CreateReservationBody")) },
        responses: {
          201: { description: "Utworzono", ...json(ref("Reservation")) },
          400: err("BadRequest"), 401: err("Unauthorized"),
          404: { description: "Sala nie istnieje", ...json(ref("Error")) },
          409: { description: "Sala zajęta (ROOM_ALREADY_BOOKED) lub przekroczona pojemność (ROOM_CAPACITY_EXCEEDED)", ...json(ref("Error")) }
        }
      }
    },
    "/api/reservations/{id}": {
      get: {
        tags: ["Reservations"], summary: "Jedna rezerwacja (właściciel albo ADMIN)", security: secured, parameters: [idParam("ID rezerwacji")],
        responses: {
          200: { description: "OK", ...json(ref("Reservation")) }, 400: err("BadRequest"), 401: err("Unauthorized"),
          404: { description: "Nie istnieje albo należy do innego użytkownika", ...json(ref("Error")) }
        }
      }
    },
    "/api/reservations/{id}/cancel": {
      patch: {
        tags: ["Reservations"], summary: "Anulowanie rezerwacji (właściciel albo ADMIN)", security: secured, parameters: [idParam("ID rezerwacji")],
        responses: {
          200: { description: "Anulowano (ponowne anulowanie zwraca rezerwację bez zmian)", ...json(ref("Reservation")) },
          400: err("BadRequest"), 401: err("Unauthorized"),
          404: { description: "Nie istnieje albo należy do innego użytkownika", ...json(ref("Error")) },
          409: { description: "Rezerwacja już się rozpoczęła (RESERVATION_ALREADY_STARTED)", ...json(ref("Error")) }
        }
      }
    }
  },

  components: {
    securitySchemes: {
      bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" }
    },
    responses: {
      BadRequest: { description: "Błędne dane (VALIDATION_ERROR)", ...json(ref("Error")) },
      Unauthorized: { description: "Brak, zły lub wygasły token", ...json(ref("Error")) },
      Forbidden: { description: "Brak uprawnień (FORBIDDEN)", ...json(ref("Error")) },
      NotFound: { description: "Nie znaleziono (NOT_FOUND)", ...json(ref("Error")) }
    },
    schemas: {
      // format błędu - zdefiniowany raz i używany wszędzie przez $ref
      Error: {
        type: "object",
        required: ["error"],
        properties: {
          error: {
            type: "object",
            required: ["code", "message", "requestId"],
            properties: {
              code: { type: "string", example: "VALIDATION_ERROR" },
              message: { type: "string", example: "Validation failed" },
              details: {
                type: "array",
                items: { type: "object", properties: { location: { type: "string" }, field: { type: "string" }, message: { type: "string" } } }
              },
              requestId: { type: "string", example: "5f0c1d1e-9a8b-4c3d-8e2f-1a2b3c4d5e6f" }
            }
          }
        }
      },
      RegisterBody: {
        type: "object", required: ["email", "password"], additionalProperties: false,
        properties: {
          email: { type: "string", format: "email", example: "Jan.Kowalski@example.com" },
          password: { type: "string", minLength: 10, maxLength: 72, example: "bardzo-dlugie-haslo" }
        }
      },
      LoginBody: {
        type: "object", required: ["email", "password"], additionalProperties: false,
        properties: {
          email: { type: "string", format: "email", example: "mateusz.kalinski@example.com" },
          password: { type: "string", example: "Haslo-Testowe-2026" }
        }
      },
      LoginResponse: {
        type: "object",
        properties: {
          accessToken: { type: "string" },
          tokenType: { type: "string", example: "Bearer" },
          expiresIn: { type: "string", example: "15m" }
        }
      },
      User: {
        type: "object",
        properties: {
          id: { type: "integer", example: 2 },
          email: { type: "string", example: "jan.kowalski@example.com" },
          role: { type: "string", enum: ["USER", "ADMIN"] },
          createdAt: { type: "string", format: "date-time" }
        }
      },
      BuildingRef: { type: "object", properties: { id: { type: "integer" }, name: { type: "string" } } },
      Building: {
        type: "object",
        properties: {
          id: { type: "integer", example: 1 },
          name: { type: "string", example: "Budynek A - Informatyka" },
          address: { type: "string", example: "ul. Kampusowa 12, Kraków" },
          roomsCount: { type: "integer", example: 4 }
        }
      },
      CreateBuildingBody: {
        type: "object", required: ["name", "address"], additionalProperties: false,
        properties: {
          name: { type: "string", minLength: 2, maxLength: 100, example: "Budynek D - Mechanika" },
          address: { type: "string", minLength: 5, maxLength: 255, example: "ul. Kampusowa 22, Kraków" }
        }
      },
      Room: {
        type: "object",
        properties: {
          id: { type: "integer", example: 3 },
          name: { type: "string", example: "A103" },
          capacity: { type: "integer", example: 40 },
          building: ref("BuildingRef")
        }
      },
      CreateRoomBody: {
        type: "object", required: ["buildingId", "name", "capacity"], additionalProperties: false,
        properties: {
          buildingId: { type: "integer", example: 3 },
          name: { type: "string", minLength: 1, maxLength: 50, example: "C001" },
          capacity: { type: "integer", minimum: 1, example: 25 }
        }
      },
      Reservation: {
        type: "object",
        properties: {
          id: { type: "integer", example: 7 },
          room: {
            type: "object",
            properties: { id: { type: "integer" }, name: { type: "string" }, building: ref("BuildingRef") }
          },
          user: { type: "object", properties: { id: { type: "integer" }, email: { type: "string" } } },
          participants: { type: "integer", example: 20 },
          startTime: { type: "string", format: "date-time" },
          endTime: { type: "string", format: "date-time" },
          status: { type: "string", enum: ["CONFIRMED", "CANCELLED"] },
          createdAt: { type: "string", format: "date-time" },
          cancelledAt: { type: "string", format: "date-time", nullable: true }
        }
      },
      CreateReservationBody: {
        type: "object", required: ["roomId", "participants", "startTime", "endTime"], additionalProperties: false,
        properties: {
          roomId: { type: "integer", example: 3 },
          participants: { type: "integer", minimum: 1, example: 20 },
          startTime: { type: "string", format: "date-time", example: "2026-12-10T09:00:00+01:00" },
          endTime: { type: "string", format: "date-time", example: "2026-12-10T10:30:00+01:00" }
        }
      },
      PaginationMeta: {
        type: "object",
        properties: {
          page: { type: "integer", example: 1 },
          limit: { type: "integer", example: 20 },
          total: { type: "integer", example: 6 },
          totalPages: { type: "integer", example: 1 }
        }
      }
    }
  }
};
