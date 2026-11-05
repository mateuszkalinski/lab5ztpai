// Testy zadań 1-4 (lab 04). Server musi działać: npm start
// Użycie: node scripts/auth-tests.js
// Na starcie uruchamia seed (stały stan bazy). Wynik wypisuje w konsoli i zapisuje do auth-tests-output.txt
const fs = require("node:fs");
const jwt = require("jsonwebtoken");
const config = require("../src/config");
const db = require("../src/db/knex");
const { seed } = require("../src/db/seeds/01_demo_data");

const API = `http://localhost:${config.port}/api`;
const out = [];
const log = (text = "") => { console.log(text); out.push(text); };
const section = title => { log(""); log("=".repeat(90)); log(title); log("=".repeat(90)); };

async function call(method, path, { token, auth, body } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (auth !== undefined) headers.Authorization = auth;
  else if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

const short = r => (r.body?.error ? `${r.body.error.code}: ${r.body.error.message}` : "");
const line = (label, r) => log(`${label.padEnd(64)} -> ${r.status} ${short(r)}`);
const pretty = obj => JSON.stringify(obj, null, 2).split("\n").map(l => "    " + l).join("\n");

async function login(email, password) {
  const r = await call("POST", "/auth/login", { body: { email, password } });
  return r.body.accessToken;
}

async function main() {
  await seed(db);
  log("Baza ustawiona seedem (6 użytkowników, w tym admin@example.com).");

  // ------------------------------------------------------------------ ZADANIE 1
  section("ZADANIE 1 - Rejestracja");
  let r = await call("POST", "/auth/register", { body: { email: "Jan.Kowalski@example.com", password: "bardzo-dlugie-haslo" } });
  line("POST /auth/register Jan.Kowalski@example.com", r);
  log(pretty(r.body));

  r = await call("POST", "/auth/register", { body: { email: "haker@example.com", password: "bardzo-dlugie-haslo", role: "ADMIN" } });
  line('POST /auth/register z polem "role": "ADMIN"', r);
  log(pretty(r.body.error.details));

  r = await call("POST", "/auth/register", { body: { email: "ewa@example.com", password: "krotkie" } });
  line("POST /auth/register haslo 7 znakow", r);
  log(pretty(r.body.error.details));

  r = await call("POST", "/auth/register", { body: { email: "JAN.KOWALSKI@EXAMPLE.COM", password: "inne-dlugie-haslo" } });
  line("POST /auth/register JAN.KOWALSKI@EXAMPLE.COM (duplikat)", r);

  const parallel = await Promise.all(Array.from({ length: 5 }, () =>
    call("POST", "/auth/register", { body: { email: "rownolegla@example.com", password: "bardzo-dlugie-haslo" } })));
  log(`5 równoległych rejestracji rownolegla@example.com              -> ${parallel.map(p => p.status).join(", ")}`);

  const userRow = await db("users").where({ email: "jan.kowalski@example.com" }).first();
  log("\nWiersz z tabeli users:");
  log(pretty(userRow));

  // ------------------------------------------------------------------ ZADANIE 2
  section("ZADANIE 2 - Logowanie i JWT");
  r = await call("POST", "/auth/login", { body: { email: "mateusz.kalinski@example.com", password: "Haslo-Testowe-2026" } });
  line("POST /auth/login mateusz.kalinski@example.com", r);
  log(pretty(r.body));
  const ownerToken = r.body.accessToken;

  const decoded = jwt.decode(ownerToken, { complete: true });
  log("\nZdekodowany token - header i payload:");
  log(pretty({ header: decoded.header, payload: decoded.payload }));
  log(`    iat = ${new Date(decoded.payload.iat * 1000).toISOString()}, exp = ${new Date(decoded.payload.exp * 1000).toISOString()}`);

  r = await call("GET", "/auth/me", { token: ownerToken });
  line("\nGET /auth/me", r);
  log(pretty(r.body));

  const badEmail = await call("POST", "/auth/login", { body: { email: "nie.ma.takiego@example.com", password: "Haslo-Testowe-2026" } });
  const badPassword = await call("POST", "/auth/login", { body: { email: "mateusz.kalinski@example.com", password: "zle-haslo-123" } });
  log("\nZły email:");
  log(`    ${badEmail.status} ${JSON.stringify(badEmail.body)}`);
  log("Złe hasło:");
  log(`    ${badPassword.status} ${JSON.stringify(badPassword.body)}`);

  // ------------------------------------------------------------------ ZADANIE 3
  section("ZADANIE 3 - authenticate (GET /api/reservations)");
  line("brak nagłówka Authorization", await call("GET", "/reservations"));
  line('Authorization: "Basic YWRtaW46aGFzbG8="', await call("GET", "/reservations", { auth: "Basic YWRtaW46aGFzbG8=" }));
  line('Authorization: "Bearer" (bez tokenu)', await call("GET", "/reservations", { auth: "Bearer" }));
  line('Authorization: "Token <token>"', await call("GET", "/reservations", { auth: `Token ${ownerToken}` }));

  const [h, p, sig] = ownerToken.split(".");
  const i = 10; // zmieniamy jeden znak w środku podpisu
  const badSig = sig.slice(0, i) + (sig[i] === "A" ? "B" : "A") + sig.slice(i + 1);
  line("token ze zmienionym jednym znakiem podpisu", await call("GET", "/reservations", { token: `${h}.${p}.${badSig}` }));

  const payload = JSON.parse(Buffer.from(p, "base64url").toString());
  const forgedPayload = Buffer.from(JSON.stringify({ ...payload, role: "ADMIN" })).toString("base64url");
  line("token z payloadem zmienionym na role ADMIN (stary podpis)", await call("GET", "/reservations", { token: `${h}.${forgedPayload}.${sig}` }));

  // token poprawnie podpisany, ale z exp w przeszłości (wydany 20 s temu, ważny 10 s)
  const nowSec = Math.floor(Date.now() / 1000);
  const expired = jwt.sign({ role: "USER", iat: nowSec - 20, exp: nowSec - 10 }, config.jwt.secret, { algorithm: "HS256", subject: "2" });
  line("token wygasły (wydany 20 s temu, ważny 10 s)", await call("GET", "/reservations", { token: expired }));

  r = await call("POST", "/reservations", { token: ownerToken, body: { roomId: 3, participants: 10, startTime: "2027-03-01T10:00:00Z", endTime: "2027-03-01T11:00:00Z", userId: 3 } });
  line("\nPOST /reservations z userId w body", r);
  log(pretty(r.body.error.details));
  r = await call("POST", "/reservations", { token: ownerToken, body: { roomId: 3, participants: 10, startTime: "2027-03-01T10:00:00Z", endTime: "2027-03-01T11:00:00Z", reservedBy: "Ktos Inny" } });
  line("POST /reservations z reservedBy w body", r);

  r = await call("GET", "/reservations/6", { token: ownerToken });
  line("\nGET /reservations/6 (rezerwacja z polem user zamiast reservedBy)", r);
  log(pretty(r.body));

  // ------------------------------------------------------------------ ZADANIE 4
  section("ZADANIE 4 - role i ownership");
  const adminToken = await login("admin@example.com", "Admin-Haslo-2026");
  const otherToken = await login("karolina.nowak@example.com", "Haslo-Testowe-2026");
  log("USER właściciel = mateusz.kalinski@example.com (id 2, właściciel rezerwacji 1 i 6)");
  log("USER obcy       = karolina.nowak@example.com (id 3, właścicielka rezerwacji 2)");
  log("ADMIN           = admin@example.com (id 1)");

  const who = [["brak tokenu", null], ["USER właściciel", ownerToken], ["USER obcy", otherToken], ["ADMIN", adminToken]];
  const rows = [
    ["GET    /api/buildings", "GET", "/buildings"],
    ["GET    /api/rooms/1", "GET", "/rooms/1"],
    ["POST   /api/buildings", "POST", "/buildings", () => ({ name: "Budynek D - Mechanika", address: "ul. Kampusowa 22, Kraków" })],
    ["POST   /api/rooms", "POST", "/rooms", () => ({ buildingId: 3, name: "C001", capacity: 25 })],
    ["GET    /api/reservations", "GET", "/reservations"],
    ["GET    /api/reservations?userId=3", "GET", "/reservations?userId=3"],
    ["GET    /api/reservations/6", "GET", "/reservations/6"],
    ["PATCH  /api/reservations/6/cancel", "PATCH", "/reservations/6/cancel"],
    ["POST   /api/reservations", "POST", "/reservations",
      k => ({ roomId: 3, participants: 10, startTime: `2027-03-01T${10 + 2 * k}:00:00Z`, endTime: `2027-03-01T${11 + 2 * k}:00:00Z` })]
  ];

  const lists = {};
  const table = [];
  for (const [label, method, path, bodyFn] of rows) {
    const cells = [];
    for (let k = 0; k < who.length; k++) {
      const [name, token] = who[k];
      const res = await call(method, path, { token, body: bodyFn ? bodyFn(k) : undefined });
      cells.push(String(res.status));
      if (path === "/reservations" && method === "GET" && res.status === 200) {
        lists[name] = res.body.data.map(d => `#${d.id} (user ${d.user.id})`).join(", ");
      }
    }
    table.push([label, ...cells]);
  }

  const widths = [36, 13, 17, 11, 7];
  const fmt = cols => cols.map((c, j) => String(c).padEnd(widths[j])).join(" | ");
  log("");
  log(fmt(["Endpoint", ...who.map(w => w[0])]));
  log(widths.map(w => "-".repeat(w)).join("-+-"));
  for (const t of table) log(fmt(t));

  log("\nGET /api/reservations - co widzi kto:");
  for (const [name, list] of Object.entries(lists)) log(`    ${name.padEnd(16)}: ${list}`);

  r = await call("PATCH", "/reservations/1/cancel", { token: adminToken });
  line("\nADMIN: PATCH /reservations/1/cancel (rezerwacja już trwa)", r);
  r = await call("POST", "/reservations", { token: adminToken, body: { roomId: 3, participants: 10, startTime: "2027-03-01T12:30:00Z", endTime: "2027-03-01T13:30:00Z" } });
  line("ADMIN: POST /reservations nakładająca się na istniejącą", r);
  r = await call("POST", "/reservations", { token: adminToken, body: { roomId: 5, participants: 99, startTime: "2027-03-02T10:00:00Z", endTime: "2027-03-02T11:00:00Z" } });
  line("ADMIN: POST /reservations 99 osób w sali na 20", r);

  fs.writeFileSync("auth-tests-output.txt", out.join("\n") + "\n");
  log("\nWynik zapisany do auth-tests-output.txt");
}

main()
  .catch(err => { console.error(err); process.exitCode = 1; })
  .finally(() => db.destroy());
