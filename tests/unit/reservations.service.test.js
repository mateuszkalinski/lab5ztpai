// Unit testy logiki biznesowej rezerwacji.
// Bez bazy danych: repositories in-memory + wstrzyknięty czas (now). Działają przy wyłączonym PostgreSQL.
const { MINUTE, HOUR, NOW, at, USERS, asUser, ROOM_A, ROOM_B, reservation, createContext, input } = require("./helpers");

describe("ReservationsService.createReservation - nakładanie się rezerwacji", () => {
  // istniejąca rezerwacja w sali A: 10:00 - 11:00
  const existing = reservation({ startTime: at("10:00"), endTime: at("11:00") });

  test.each([
    ["nakładanie częściowe - początek w środku istniejącej", ROOM_A.id, "10:30", "11:30"],
    ["nakładanie częściowe - koniec w środku istniejącej", ROOM_A.id, "09:30", "10:30"],
    ["zawieranie - nowa w całości wewnątrz istniejącej", ROOM_A.id, "10:15", "10:45"],
    ["zawieranie - nowa obejmuje istniejącą", ROOM_A.id, "09:00", "12:00"],
    ["identyczny przedział", ROOM_A.id, "10:00", "11:00"]
  ])("odrzuca: %s", async (_name, roomId, start, end) => {
    const { service } = createContext({ reservations: [existing] });

    await expect(
      service.createReservation(
        input({ roomId, startTime: at(start).toISOString(), endTime: at(end).toISOString() }),
        asUser(USERS.stranger)
      )
    ).rejects.toMatchObject({ code: "ROOM_ALREADY_BOOKED", statusCode: 409 });
  });

  test.each([
    ["przedział stykający się - zaczyna się dokładnie, gdy tamta się kończy", ROOM_A.id, "11:00", "12:00"],
    ["przedział stykający się - kończy się dokładnie, gdy tamta się zaczyna", ROOM_A.id, "09:00", "10:00"],
    ["inna sala w tym samym czasie", ROOM_B.id, "10:00", "11:00"]
  ])("pozwala: %s", async (_name, roomId, start, end) => {
    const { service } = createContext({ reservations: [existing] });

    const created = await service.createReservation(
      input({ roomId, startTime: at(start).toISOString(), endTime: at(end).toISOString() }),
      asUser(USERS.stranger)
    );

    expect(created).toMatchObject({ roomId, status: "CONFIRMED", userId: USERS.stranger.id });
  });

  test("rezerwacja CANCELLED nie blokuje przedziału", async () => {
    const cancelled = reservation({ status: "CANCELLED", cancelledAt: NOW });
    const { service } = createContext({ reservations: [cancelled] });

    const created = await service.createReservation(
      input({ startTime: at("10:00").toISOString(), endTime: at("11:00").toISOString() }),
      asUser(USERS.stranger)
    );

    expect(created.status).toBe("CONFIRMED");
  });
});

describe("ReservationsService.createReservation - pojemność sali", () => {
  test("participants == capacity jest dozwolone", async () => {
    const { service } = createContext();

    const created = await service.createReservation(input({ participants: ROOM_A.capacity }), asUser(USERS.owner));

    expect(created.participants).toBe(ROOM_A.capacity);
  });

  test("participants == capacity + 1 jest odrzucone", async () => {
    const { service } = createContext();

    await expect(
      service.createReservation(input({ participants: ROOM_A.capacity + 1 }), asUser(USERS.owner))
    ).rejects.toMatchObject({ code: "ROOM_CAPACITY_EXCEEDED" });
  });
});

describe("ReservationsService.createReservation - czas trwania", () => {
  const start = at("12:00").getTime();

  test.each([
    ["dokładnie 15 min", 15 * MINUTE],
    ["dokładnie 8 h", 8 * HOUR]
  ])("pozwala: %s", async (_name, duration) => {
    const { service } = createContext();

    const created = await service.createReservation(
      input({ startTime: new Date(start).toISOString(), endTime: new Date(start + duration).toISOString() }),
      asUser(USERS.owner)
    );

    expect(new Date(created.endTime) - new Date(created.startTime)).toBe(duration);
  });

  test.each([
    ["14 min", 14 * MINUTE],
    ["8 h 1 min", 8 * HOUR + MINUTE]
  ])("odrzuca: %s", async (_name, duration) => {
    const { service } = createContext();

    await expect(
      service.createReservation(
        input({ startTime: new Date(start).toISOString(), endTime: new Date(start + duration).toISOString() }),
        asUser(USERS.owner)
      )
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR", statusCode: 400 });
  });
});

describe("ReservationsService.cancelReservation", () => {
  test("rozpoczętej rezerwacji nie da się anulować", async () => {
    // "teraz" = 10:30, rezerwacja 10:00 - 11:00 już trwa
    const { service } = createContext({ reservations: [reservation()], now: at("10:30") });

    await expect(service.cancelReservation(1, asUser(USERS.owner)))
      .rejects.toMatchObject({ code: "RESERVATION_ALREADY_STARTED" });
  });

  test("podwójne anulowanie jest idempotentne - cancelledAt się nie zmienia", async () => {
    const { service, clock } = createContext({ reservations: [reservation()] });

    const first = await service.cancelReservation(1, asUser(USERS.owner));
    clock.set(new Date(NOW.getTime() + 5 * MINUTE)); // drugie wywołanie 5 minut później
    const second = await service.cancelReservation(1, asUser(USERS.owner));

    expect(first.status).toBe("CANCELLED");
    expect(second.status).toBe("CANCELLED");
    expect(second.cancelledAt).toEqual(first.cancelledAt);
    expect(second.cancelledAt).toEqual(NOW);
  });

  test("obcy USER nie może anulować cudzej rezerwacji", async () => {
    const { service, repos } = createContext({ reservations: [reservation()] });

    await expect(service.cancelReservation(1, asUser(USERS.stranger)))
      .rejects.toMatchObject({ code: "NOT_FOUND" });

    // rezerwacja nietknięta
    expect((await repos.reservations.findById(1)).status).toBe("CONFIRMED");
  });

  test("ADMIN może anulować cudzą rezerwację", async () => {
    const { service } = createContext({ reservations: [reservation()] });

    const cancelled = await service.cancelReservation(1, asUser(USERS.admin));

    expect(cancelled).toMatchObject({ status: "CANCELLED", userId: USERS.owner.id });
  });

  test("właściciel może anulować swoją rezerwację", async () => {
    const { service } = createContext({ reservations: [reservation()] });

    const cancelled = await service.cancelReservation(1, asUser(USERS.owner));

    expect(cancelled.status).toBe("CANCELLED");
  });
});

describe("ReservationsService.getReservation - ownership", () => {
  test("obcy USER dostaje NOT_FOUND (nie zdradzamy, że rezerwacja istnieje)", async () => {
    const { service } = createContext({ reservations: [reservation()] });

    await expect(service.getReservation(1, asUser(USERS.stranger))).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  test("ADMIN widzi cudzą rezerwację", async () => {
    const { service } = createContext({ reservations: [reservation()] });

    await expect(service.getReservation(1, asUser(USERS.admin))).resolves.toMatchObject({ id: 1 });
  });
});
