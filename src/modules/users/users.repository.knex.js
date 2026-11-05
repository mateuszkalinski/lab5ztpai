const { ConflictError } = require("../../errors/AppError");

function toUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.password_hash, // tylko do logowania - nigdy nie trafia do odpowiedzi API
    role: row.role,
    createdAt: row.created_at
  };
}

function createUsersRepository(db) {
  return {
    async findById(id) {
      return toUser(await db("users").where({ id }).first());
    },

    async findByEmail(email) {
      return toUser(await db("users").where({ email }).first());
    },

    async create({ email, passwordHash, role }) {
      try {
        const [row] = await db("users")
          .insert({ email, password_hash: passwordHash, role })
          .returning("*");
        return toUser(row);
      } catch (err) {
        // UNIQUE(email) - działa także przy równoległych rejestracjach tego samego emaila
        if (err.code === "23505") throw new ConflictError("Email is already taken", "EMAIL_TAKEN");
        throw err;
      }
    }
  };
}

module.exports = { createUsersRepository };
