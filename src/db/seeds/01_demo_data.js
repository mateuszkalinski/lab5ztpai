const bcrypt = require("bcryptjs");

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

// hasła kont testowych (tylko dane deweloperskie)
const ADMIN_PASSWORD = "Admin-Haslo-2026";
const USER_PASSWORD = "Haslo-Testowe-2026";

// data względem "teraz": dni do przodu + godzina (czas lokalny)
function at(daysFromNow, hour, minute = 0) {
  const date = new Date(Date.now() + daysFromNow * DAY);
  date.setHours(hour, minute, 0, 0);
  return date;
}

exports.seed = async function (knex) {
  // czyścimy tabele i resetujemy liczniki ID -> po każdym seed:run ten sam stan
  await knex.raw("TRUNCATE audit_log, reservations, rooms, buildings, users RESTART IDENTITY CASCADE");

  const adminHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
  const userHash = await bcrypt.hash(USER_PASSWORD, 10);

  // konto ADMIN powstaje tylko tutaj - przez API nie da się go utworzyć
  await knex("users").insert([
    { email: "admin@example.com", password_hash: adminHash, role: "ADMIN" },              // id 1
    { email: "mateusz.kalinski@example.com", password_hash: userHash, role: "USER" },     // id 2
    { email: "karolina.nowak@example.com", password_hash: userHash, role: "USER" },       // id 3
    { email: "tomasz.zajac@example.com", password_hash: userHash, role: "USER" },         // id 4
    { email: "agnieszka.wojcik@example.com", password_hash: userHash, role: "USER" },     // id 5
    { email: "pawel.lewandowski@example.com", password_hash: userHash, role: "USER" }     // id 6
  ]);

  await knex("buildings").insert([
    { name: "Budynek A - Informatyka", address: "ul. Kampusowa 12, Kraków" },     // id 1
    { name: "Budynek B - Elektrotechnika", address: "ul. Kampusowa 14, Kraków" }, // id 2
    { name: "Budynek C - Biblioteka", address: "ul. Kampusowa 20, Kraków" }       // id 3 - bez sal
  ]);

  await knex("rooms").insert([
    { building_id: 1, name: "A101", capacity: 30 }, // id 1
    { building_id: 1, name: "A102", capacity: 35 }, // id 2
    { building_id: 1, name: "A103", capacity: 40 }, // id 3
    { building_id: 1, name: "A104", capacity: 45 }, // id 4
    { building_id: 2, name: "B201", capacity: 20 }, // id 5
    { building_id: 2, name: "B202", capacity: 60 }  // id 6
  ]);

  const now = Date.now();

  await knex("reservations").insert([
    // id 1 - już trwa (zaczęła się godzinę temu)
    { room_id: 4, user_id: 2, participants: 10, start_time: new Date(now - HOUR), end_time: new Date(now + HOUR), status: "CONFIRMED", created_at: new Date(now - 3 * DAY) },
    // id 2
    { room_id: 1, user_id: 3, participants: 25, start_time: at(2, 8, 15), end_time: at(2, 9, 45), status: "CONFIRMED", created_at: new Date(now - 2 * DAY) },
    // id 3
    { room_id: 1, user_id: 4, participants: 18, start_time: at(2, 10, 0), end_time: at(2, 11, 30), status: "CONFIRMED", created_at: new Date(now - 2 * DAY + 3 * HOUR) },
    // id 4 - anulowana
    { room_id: 5, user_id: 5, participants: 12, start_time: at(3, 12, 0), end_time: at(3, 14, 0), status: "CANCELLED", cancelled_at: new Date(now - 2 * HOUR), created_at: new Date(now - DAY) },
    // id 5
    { room_id: 6, user_id: 6, participants: 50, start_time: at(5, 9, 0), end_time: at(5, 12, 0), status: "CONFIRMED", created_at: new Date(now - 5 * HOUR) },
    // id 6
    { room_id: 2, user_id: 2, participants: 30, start_time: at(7, 16, 0), end_time: at(7, 17, 30), status: "CONFIRMED", created_at: new Date(now - HOUR) }
  ]);
};
