const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { UnauthorizedError } = require("../../errors/AppError");

function createAuthService({ runInTransaction, jwtSecret, jwtExpiresIn, bcryptRounds }) {
  // hash porównywany, gdy email nie istnieje - żeby czas odpowiedzi nie zdradzał, czy konto istnieje
  const dummyHash = bcrypt.hashSync("dummy-password-for-timing", bcryptRounds);

  async function register({ email, password }) {
    const passwordHash = await bcrypt.hash(password, bcryptRounds);
    // rolę ustawia backend - nigdy na podstawie danych od klienta
    // zajęty email -> UNIQUE w bazie -> 409 EMAIL_TAKEN (w repository)
    return runInTransaction(({ users }) => users.create({ email, passwordHash, role: "USER" }));
  }

  async function login({ email, password }) {
    const user = await runInTransaction(({ users }) => users.findByEmail(email));
    const passwordOk = await bcrypt.compare(password, user ? user.passwordHash : dummyHash);

    // zły email i złe hasło -> ta sama odpowiedź (nie zdradzamy, które konta istnieją)
    if (!user || !passwordOk) {
      throw new UnauthorizedError("Invalid email or password", "INVALID_CREDENTIALS");
    }

    // w payloadzie tylko ID i rola - bez emaila, hasha i innych danych osobowych
    const accessToken = jwt.sign({ role: user.role }, jwtSecret, {
      algorithm: "HS256",
      subject: String(user.id),
      expiresIn: jwtExpiresIn
    });

    return { accessToken, tokenType: "Bearer", expiresIn: jwtExpiresIn };
  }

  async function getCurrentUser(currentUser) {
    const user = await runInTransaction(({ users }) => users.findById(currentUser.id));
    if (!user) throw new UnauthorizedError("User no longer exists", "INVALID_TOKEN");
    return user;
  }

  return { register, login, getCurrentUser };
}

module.exports = { createAuthService };
