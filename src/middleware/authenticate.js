const jwt = require("jsonwebtoken");
const config = require("../config");
const { UnauthorizedError } = require("../errors/AppError");

// Odczytuje token z nagłówka "Authorization: Bearer <token>" i ustawia req.user = { id, role }
function authenticate(req, res, next) {
  const header = req.get("Authorization");
  if (!header) {
    return next(new UnauthorizedError("Missing Authorization header"));
  }

  const [scheme, token, ...rest] = header.split(" ");
  if (scheme !== "Bearer" || !token || rest.length > 0) {
    return next(new UnauthorizedError("Authorization header must have format: Bearer <token>"));
  }

  let payload;
  try {
    // algorytm podany jawnie - token z innym "alg" (np. "none") zostanie odrzucony
    payload = jwt.verify(token, config.jwt.secret, { algorithms: ["HS256"] });
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return next(new UnauthorizedError("Token expired", "TOKEN_EXPIRED"));
    }
    return next(new UnauthorizedError("Invalid token", "INVALID_TOKEN"));
  }

  const id = Number(payload.sub);
  if (!Number.isInteger(id) || !["USER", "ADMIN"].includes(payload.role)) {
    return next(new UnauthorizedError("Invalid token", "INVALID_TOKEN"));
  }

  req.user = { id, role: payload.role };
  next();
}

module.exports = authenticate;
