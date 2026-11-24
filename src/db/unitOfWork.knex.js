const { createUsersRepository } = require("../modules/users/users.repository.knex");
const { createBuildingsRepository } = require("../modules/buildings/buildings.repository.knex");
const { createRoomsRepository } = require("../modules/rooms/rooms.repository.knex");
const { createReservationsRepository } = require("../modules/reservations/reservations.repository.knex");
const { createAuditLogRepository } = require("../modules/audit/audit.repository.knex");

// te same repositories, raz na "db", raz na obiekcie transakcji "trx" (ma to samo API)
function createKnexRepositories(db) {
  return {
    users: createUsersRepository(db),
    buildings: createBuildingsRepository(db),
    rooms: createRoomsRepository(db),
    reservations: createReservationsRepository(db),
    auditLog: createAuditLogRepository(db)
  };
}

function createKnexUnitOfWork(db) {
  return {
    // COMMIT gdy fn zakończy się normalnie, ROLLBACK gdy rzuci wyjątek
    runInTransaction: fn => db.transaction(trx => fn(createKnexRepositories(trx)))
  };
}

module.exports = { createKnexRepositories, createKnexUnitOfWork };
