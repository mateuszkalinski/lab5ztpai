const express = require("express");
const swaggerUi = require("swagger-ui-express");
const config = require("./config");
const openapi = require("./docs/openapi");
const requestLogger = require("./middleware/requestLogger");
const authenticate = require("./middleware/authenticate");
const notFound = require("./middleware/notFound");
const errorHandler = require("./middleware/errorHandler");

const { createAuthService } = require("./modules/auth/auth.service");
const { createAuthController } = require("./modules/auth/auth.controller");
const { createAuthRouter } = require("./modules/auth/auth.routes");

const { createBuildingsService } = require("./modules/buildings/buildings.service");
const { createBuildingsController } = require("./modules/buildings/buildings.controller");
const { createBuildingsRouter } = require("./modules/buildings/buildings.routes");

const { createRoomsService } = require("./modules/rooms/rooms.service");
const { createRoomsController } = require("./modules/rooms/rooms.controller");
const { createRoomsRouter } = require("./modules/rooms/rooms.routes");

const { createReservationsService } = require("./modules/reservations/reservations.service");
const { createReservationsController } = require("./modules/reservations/reservations.controller");
const { createReservationsRouter } = require("./modules/reservations/reservations.routes");

function createApp({ runInTransaction, now }) {
  const app = express();
  app.set("json spaces", 2);

  app.use(requestLogger);
  app.use(express.json());

  const authService = createAuthService({
    runInTransaction,
    jwtSecret: config.jwt.secret,
    jwtExpiresIn: config.jwt.expiresIn,
    bcryptRounds: config.bcryptRounds
  });
  const buildingsService = createBuildingsService({ runInTransaction });
  const roomsService = createRoomsService({ runInTransaction });
  const reservationsService = createReservationsService({ runInTransaction, now });

  // publiczne: dokumentacja, rejestracja i logowanie (/api/auth/me ma authenticate w routerze)
  app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(openapi));
  app.use("/api/auth", createAuthRouter(createAuthController(authService)));

  // wszystko poniżej wymaga zalogowania
  app.use("/api/buildings", authenticate, createBuildingsRouter(createBuildingsController(buildingsService)));
  app.use("/api/rooms", authenticate, createRoomsRouter(createRoomsController(roomsService)));
  app.use("/api/reservations", authenticate, createReservationsRouter(createReservationsController(reservationsService)));

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
