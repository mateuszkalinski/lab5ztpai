// Wspólne narzędzia dla unit testów: repositories in-memory + wstrzyknięty czas.
// Każde wywołanie createContext() tworzy NOWY, niezależny stan (testy nie dzielą danych).
const { createUsersRepository } = require("../../src/modules/users/users.repository.memory");
const { createBuildingsRepository } = require("../../src/modules/buildings/buildings.repository.memory");
const { createRoomsRepository } = require("../../src/modules/rooms/rooms.repository.memory");
const { createReservationsRepository } = require("../../src/modules/reservations/reservations.repository.memory");
const { createReservationsService } = require("../../src/modules/reservations/reservations.service");

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

// "teraz" w testach - stałe, niezależne od zegara komputera
const NOW = new Date("2030-01-01T08:00:00.000Z");

// godzina dnia 2030-01-02 (UTC) -> Date, np. at("10:30")
function at(time) {
  return new Date(`2030-01-02T${time}:00.000Z`);
}

const USERS = {
  admin: { id: 1, email: "admin@test.local", passwordHash: "x", role: "ADMIN", createdAt: NOW },
  owner: { id: 2, email: "owner@test.local", passwordHash: "x", role: "USER", createdAt: NOW },
  stranger: { id: 3, email: "stranger@test.local", passwordHash: "x", role: "USER", createdAt: NOW }
};

// req.user ma postać { id, role }
const asUser = user => ({ id: user.id, role: user.role });

const ROOM_A = { id: 1, buildingId: 1, name: "A101", capacity: 10 };
const ROOM_B = { id: 2, buildingId: 1, name: "A102", capacity: 10 };

function reservation(overrides = {}) {
  return {
    id: 1,
    roomId: ROOM_A.id,
    userId: USERS.owner.id,
    participants: 5,
    startTime: at("10:00"),
    endTime: at("11:00"),
    status: "CONFIRMED",
    createdAt: NOW,
    cancelledAt: null,
    ...overrides
  };
}

function createContext({ reservations = [], now = NOW } = {}) {
  const repos = {};
  repos.users = createUsersRepository(Object.values(USERS));
  repos.buildings = createBuildingsRepository(
    [{ id: 1, name: "Budynek testowy", address: "ul. Testowa 1", createdAt: NOW }],
    { countRooms: id => repos.rooms.countByBuildingId(id) }
  );
  repos.rooms = createRoomsRepository([ROOM_A, ROOM_B], { findBuilding: id => repos.buildings.findById(id) });
  repos.reservations = createReservationsRepository(reservations, {
    findRoom: id => repos.rooms.findById(id),
    findUser: id => repos.users.findById(id)
  });

  // zegar, który test może przesunąć (clock.set(...))
  let current = new Date(now);
  const clock = {
    now: () => new Date(current),
    set: date => { current = new Date(date); }
  };

  const eventBus = { publish: jest.fn(), subscribe: jest.fn(), drain: jest.fn() };

  const service = createReservationsService({
    runInTransaction: fn => fn(repos),
    now: clock.now,
    eventBus
  });

  return { service, repos, clock, eventBus };
}

// poprawne body rezerwacji (stringi ISO - tak jak po walidacji Zod)
function input(overrides = {}) {
  return {
    roomId: ROOM_A.id,
    participants: 5,
    startTime: at("14:00").toISOString(),
    endTime: at("15:00").toISOString(),
    ...overrides
  };
}

module.exports = { MINUTE, HOUR, NOW, at, USERS, asUser, ROOM_A, ROOM_B, reservation, createContext, input };
