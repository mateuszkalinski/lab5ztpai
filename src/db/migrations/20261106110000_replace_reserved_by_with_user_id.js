// reservations.reserved_by (tekst) -> reservations.user_id (FK do users).
// Migracja działa na bazie z danymi: dla każdej osoby z reserved_by znajduje albo tworzy
// konto użytkownika i przypisuje mu jej rezerwacje. Dopiero potem kolumna staje się NOT NULL.
const crypto = require("node:crypto");
const bcrypt = require("bcryptjs");

// "Mateusz Kaliński" -> "mateusz.kalinski@example.com"
function emailFromName(name) {
  const local = name
    .replace(/ł/g, "l").replace(/Ł/g, "L")
    .normalize("NFD").replace(/[̀-ͯ]/g, "") // usuwa polskie znaki diakrytyczne
    .toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, ".").replace(/^\.+|\.+$/g, "");
  return `${local || "user"}@example.com`;
}

exports.up = async function (knex) {
  await knex.schema.alterTable("reservations", table => {
    table.integer("user_id").references("id").inTable("users").onDelete("RESTRICT");
  });

  const names = await knex("reservations").distinct("reserved_by").pluck("reserved_by");

  for (const name of names) {
    const email = emailFromName(name);
    let user = await knex("users").where({ email }).first();
    if (!user) {
      // konto z losowym hasłem - właściciel ustawi własne (np. reset hasła); seed nadpisuje dane testowe
      const passwordHash = await bcrypt.hash(crypto.randomUUID(), 10);
      [user] = await knex("users").insert({ email, password_hash: passwordHash, role: "USER" }).returning("*");
    }
    await knex("reservations").where({ reserved_by: name }).update({ user_id: user.id });
  }

  await knex.raw("ALTER TABLE reservations ALTER COLUMN user_id SET NOT NULL");
  await knex.schema.alterTable("reservations", table => {
    table.index("user_id");
    table.dropColumn("reserved_by");
  });
};

exports.down = async function (knex) {
  await knex.schema.alterTable("reservations", table => {
    table.string("reserved_by", 100);
  });
  // przywracamy tekstowe pole na podstawie emaila właściciela
  await knex.raw("UPDATE reservations r SET reserved_by = u.email FROM users u WHERE u.id = r.user_id");
  await knex.raw("ALTER TABLE reservations ALTER COLUMN reserved_by SET NOT NULL");
  await knex.schema.alterTable("reservations", table => {
    table.dropColumn("user_id");
  });
};
