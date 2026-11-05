// Zadanie 5: 10 równoległych, identycznych POST /api/reservations (ta sama sala, ten sam przedział).
// Użycie (server musi działać): node scripts/double-booking.js
const config = require("../src/config");
const db = require("../src/db/knex");

const API = `http://localhost:${config.port}/api`;
const REQUESTS = 10;
const ROOM_ID = 2; // A102, 35 miejsc
const START = "2027-01-20T10:00:00.000Z";
const END = "2027-01-20T12:00:00.000Z";

// rezerwacje sali nakładające się na przedział [START, END)
const overlapping = () =>
  db("reservations").where("room_id", ROOM_ID).where("start_time", "<", END).where("end_time", ">", START);

async function sendOne(n, token) {
  const res = await fetch(`${API}/reservations`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      roomId: ROOM_ID,
      participants: 20,
      startTime: START,
      endTime: END
    })
  });
  const body = await res.json();
  return { n, status: res.status, code: body.error?.code ?? `id ${body.id}` };
}

async function main() {
  // sprzątanie po poprzednim uruchomieniu, żeby każdy test startował z pustym przedziałem
  const removed = await overlapping().del();
  console.log(`Usunięto rezerwacji z poprzednich uruchomień: ${removed}`);
  console.log(`Wysyłam ${REQUESTS} równoległych requestów: sala ${ROOM_ID}, ${START} - ${END}\n`);

  const loginRes = await fetch(`${API}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "mateusz.kalinski@example.com", password: "Haslo-Testowe-2026" })
  });
  const { accessToken } = await loginRes.json();

  const results = await Promise.all(Array.from({ length: REQUESTS }, (_, i) => sendOne(i + 1, accessToken)));

  for (const r of results) console.log(`request ${String(r.n).padStart(2)}: ${r.status}  ${r.code}`);

  const byStatus = {};
  for (const r of results) byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
  console.log("\nPodsumowanie:", Object.entries(byStatus).map(([s, c]) => `${c} x ${s}`).join(", "));

  const { count } = await overlapping().where("status", "CONFIRMED").count({ count: "*" }).first();
  console.log(`Rezerwacji CONFIRMED w bazie dla sali ${ROOM_ID} w tym przedziale: ${count}`);
}

main()
  .catch(err => { console.error(err); process.exitCode = 1; })
  .finally(() => db.destroy());
