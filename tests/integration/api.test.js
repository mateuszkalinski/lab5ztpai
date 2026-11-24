// Testy integracyjne API: Supertest + prawdziwy PostgreSQL (baza *_test).
// createApp() bez app.listen() - Supertest sam obsługuje requesty, bez zajmowania portu.
const request = require("supertest");
const bcrypt = require("bcryptjs");
const db = require("../../src/db/knex");
const { createApp } = require("../../src/app");
const { createKnexUnitOfWork } = require("../../src/db/unitOfWork.knex");
const { createEventBus } = require("../../src/events/eventBus");

const NOW = new Date("2030-01-01T08:00:00.000Z");
const PASSWORD = "Test-Haslo-12345";

let app;
let eventBus;

// godzina dnia 2030-01-02 (UTC) jako ISO string
const at = time => `2030-01-02T${time}:00.000Z`;

async function createUser(email, role = "USER") {
  const passwordHash = await bcrypt.hash(PASSWORD, 4); // niski koszt - to tylko dane testowe
  const [user] = await db("users").insert({ email, password_hash: passwordHash, role }).returning("*");
  return user;
}

async function login(email) {
  const res = await request(app).post("/api/auth/login").send({ email, password: PASSWORD }).expect(200);
  return res.body.accessToken;
}

async function createUserWithToken(email, role = "USER") {
  const user = await createUser(email, role);
  return { user, token: await login(email) };
}

async function createRoom({ name = "T101", capacity = 20 } = {}) {
  const [building] = await db("buildings").insert({ name: `Budynek ${name}`, address: "ul. Testowa 1, Kraków" }).returning("*");
  const [room] = await db("rooms").insert({ building_id: building.id, name, capacity }).returning("*");
  return room;
}

function postReservation(token, body) {
  return request(app).post("/api/reservations").set("Authorization", `Bearer ${token}`).send(body);
}

function reservationBody(room, overrides = {}) {
  return { roomId: room.id, participants: 5, startTime: at("10:00"), endTime: at("11:00"), ...overrides };
}

beforeAll(async () => {
  // schemat bazy testowej tworzony migracjami
  await db.migrate.latest();

  eventBus = createEventBus();
  const { runInTransaction } = createKnexUnitOfWork(db);
  app = createApp({ runInTransaction, now: () => NOW, eventBus });
});

beforeEach(async () => {
  // listenery z poprzedniego testu mogą jeszcze zapisywać audit log - czekamy, potem czyścimy
  await eventBus.drain();
  await db.raw("TRUNCATE audit_log, reservations, rooms, buildings, users RESTART IDENTITY CASCADE");
});

afterAll(async () => {
  await eventBus.drain();
  await db.destroy(); // zamknięta pula połączeń -> brak ostrzeżenia Jest o open handles
});

describe("Auth", () => {
  test("rejestracja + logowanie + GET /api/auth/me", async () => {
    const register = await request(app)
      .post("/api/auth/register")
      .send({ email: "  Nowy.Uzytkownik@Test.local ", password: PASSWORD })
      .expect(201);

    expect(register.body).toMatchObject({ email: "nowy.uzytkownik@test.local", role: "USER" });
    expect(register.body).not.toHaveProperty("passwordHash");

    const token = await login("nowy.uzytkownik@test.local");

    const me = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${token}`).expect(200);
    expect(me.body).toMatchObject({ id: register.body.id, email: "nowy.uzytkownik@test.local", role: "USER" });
  });

  test("401 bez tokenu", async () => {
    const res = await request(app).get("/api/reservations").expect(401);

    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });
});

describe("Rezerwacje", () => {
  test("POST /api/reservations -> 201, nagłówek Location i rekord w bazie", async () => {
    const { user, token } = await createUserWithToken("jan@test.local");
    const room = await createRoom();

    const res = await postReservation(token, reservationBody(room)).expect(201);

    expect(res.headers.location).toBe(`/api/reservations/${res.body.id}`);
    expect(res.body).toMatchObject({ status: "CONFIRMED", user: { id: user.id }, room: { id: room.id } });

    const row = await db("reservations").where({ id: res.body.id }).first();
    expect(row).toMatchObject({ room_id: room.id, user_id: user.id, participants: 5, status: "CONFIRMED" });
    expect(new Date(row.start_time).toISOString()).toBe(at("10:00"));
  });

  test("400 VALIDATION_ERROR z poprawnymi details dla błędnego body", async () => {
    const { token } = await createUserWithToken("jan@test.local");

    const res = await postReservation(token, { roomId: "abc", participants: 0, startTime: "jutro rano" }).expect(400);

    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    const fields = res.body.error.details.map(d => d.field);
    expect(fields).toEqual(expect.arrayContaining(["roomId", "participants", "startTime", "endTime"]));
    expect(res.body.error.details.every(d => d.location === "body")).toBe(true);
    expect(await db("reservations").count({ n: "id" }).first()).toEqual({ n: "0" });
  });

  test("404 gdy USER pobiera cudzą rezerwację", async () => {
    const owner = await createUserWithToken("wlasciciel@test.local");
    const stranger = await createUserWithToken("obcy@test.local");
    const room = await createRoom();
    const created = await postReservation(owner.token, reservationBody(room)).expect(201);

    const res = await request(app)
      .get(`/api/reservations/${created.body.id}`)
      .set("Authorization", `Bearer ${stranger.token}`)
      .expect(404);

    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  test("409 ROOM_ALREADY_BOOKED dla nakładającej się rezerwacji", async () => {
    const first = await createUserWithToken("pierwszy@test.local");
    const second = await createUserWithToken("drugi@test.local");
    const room = await createRoom();
    await postReservation(first.token, reservationBody(room)).expect(201);

    const res = await postReservation(second.token, reservationBody(room, { startTime: at("10:30"), endTime: at("11:30") }))
      .expect(409);

    expect(res.body.error.code).toBe("ROOM_ALREADY_BOOKED");
    expect(await db("reservations").count({ n: "id" }).first()).toEqual({ n: "1" });
  });

  test("pagination: meta.total i liczba elementów w data dla limit < liczby rekordów", async () => {
    const { token } = await createUserWithToken("jan@test.local");
    const room = await createRoom();
    for (const [start, end] of [["08:00", "09:00"], ["09:00", "10:00"], ["10:00", "11:00"]]) {
      await postReservation(token, reservationBody(room, { startTime: at(start), endTime: at(end) })).expect(201);
    }

    const res = await request(app)
      .get("/api/reservations?limit=2&page=1")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(res.body.data).toHaveLength(2);
    expect(res.body.meta).toEqual({ page: 1, limit: 2, total: 3, totalPages: 2 });
  });
});

describe("Uprawnienia", () => {
  test("403 gdy USER próbuje utworzyć salę", async () => {
    const { token } = await createUserWithToken("jan@test.local");

    const res = await request(app)
      .post("/api/rooms")
      .set("Authorization", `Bearer ${token}`)
      .send({ buildingId: 1, name: "X1", capacity: 10 })
      .expect(403);

    expect(res.body.error.code).toBe("FORBIDDEN");
  });
});

describe("Audit log", () => {
  test("scenariusz: utworzenie -> kolizja -> anulowanie przez ADMINa -> ponowne anulowanie", async () => {
    const owner = await createUserWithToken("wlasciciel@test.local");
    const other = await createUserWithToken("inny@test.local");
    const admin = await createUserWithToken("admin@test.local", "ADMIN");
    const room = await createRoom();

    const created = await postReservation(owner.token, reservationBody(room)).expect(201);
    await eventBus.drain(); // deterministyczna kolejność wpisów w audit_log
    await postReservation(other.token, reservationBody(room)).expect(409); // nieudana -> brak eventu
    const cancelUrl = `/api/reservations/${created.body.id}/cancel`;
    await request(app).patch(cancelUrl).set("Authorization", `Bearer ${admin.token}`).expect(200);
    await request(app).patch(cancelUrl).set("Authorization", `Bearer ${admin.token}`).expect(200); // idempotentne -> brak eventu

    await eventBus.drain(); // listenery działają asynchronicznie

    const res = await request(app)
      .get("/api/admin/audit-log")
      .set("Authorization", `Bearer ${admin.token}`)
      .expect(200);

    expect(res.body.meta.total).toBe(2);
    expect(res.body.data.map(e => e.eventType)).toEqual(["reservation.cancelled", "reservation.created"]);
    expect(res.body.data[0].payload).toEqual({
      reservationId: created.body.id,
      roomId: room.id,
      userId: owner.user.id,
      cancelledBy: admin.user.id
    });

    const filtered = await request(app)
      .get("/api/admin/audit-log?eventType=reservation.created")
      .set("Authorization", `Bearer ${admin.token}`)
      .expect(200);
    expect(filtered.body.data).toHaveLength(1);
    expect(filtered.body.data[0].payload).toMatchObject({ reservationId: created.body.id, startTime: at("10:00") });
  });

  test("GET /api/admin/audit-log jest tylko dla ADMINa", async () => {
    const { token } = await createUserWithToken("jan@test.local");

    await request(app).get("/api/admin/audit-log").set("Authorization", `Bearer ${token}`).expect(403);
  });
});
