const bcrypt = require("bcryptjs");
const { ConflictError } = require("../../errors/AppError");

function defaultUsers() {
  return [
    { id: 1, email: "admin@example.com", passwordHash: bcrypt.hashSync("Admin-Haslo-2026", 10), role: "ADMIN", createdAt: new Date() },
    { id: 2, email: "mateusz.kalinski@example.com", passwordHash: bcrypt.hashSync("Haslo-Testowe-2026", 10), role: "USER", createdAt: new Date() }
  ];
}

function createUsersRepository(seed = defaultUsers()) {
  const users = structuredClone(seed);
  let nextId = Math.max(0, ...users.map(u => u.id)) + 1;

  return {
    async findById(id) {
      return users.find(u => u.id === id) ?? null;
    },

    async findByEmail(email) {
      return users.find(u => u.email === email) ?? null;
    },

    async create({ email, passwordHash, role }) {
      if (users.some(u => u.email === email)) {
        throw new ConflictError("Email is already taken", "EMAIL_TAKEN");
      }
      const user = { id: nextId++, email, passwordHash, role, createdAt: new Date() };
      users.push(user);
      return user;
    }
  };
}

module.exports = { createUsersRepository };
