// Zadanie 4: service publikuje event TYLKO po sukcesie (eventBus.publish to jest.fn()).
const { at, USERS, asUser, reservation, createContext, input } = require("./helpers");

describe("ReservationsService - publikowanie eventów", () => {
  test("po utworzeniu rezerwacji publikuje reservation.created z poprawnym payloadem", async () => {
    const { service, eventBus } = createContext();

    const created = await service.createReservation(input(), asUser(USERS.owner));

    expect(eventBus.publish).toHaveBeenCalledTimes(1);
    expect(eventBus.publish).toHaveBeenCalledWith("reservation.created", {
      reservationId: created.id,
      roomId: created.roomId,
      userId: USERS.owner.id,
      startTime: at("14:00").toISOString(),
      endTime: at("15:00").toISOString()
    });
  });

  test("nieudana rezerwacja (409 ROOM_ALREADY_BOOKED) nie publikuje eventu", async () => {
    const { service, eventBus } = createContext({ reservations: [reservation()] });

    await expect(
      service.createReservation(
        input({ startTime: at("10:30").toISOString(), endTime: at("11:30").toISOString() }),
        asUser(USERS.stranger)
      )
    ).rejects.toMatchObject({ code: "ROOM_ALREADY_BOOKED" });

    expect(eventBus.publish).not.toHaveBeenCalled();
  });

  test("przekroczona pojemność (409 ROOM_CAPACITY_EXCEEDED) nie publikuje eventu", async () => {
    const { service, eventBus } = createContext();

    await expect(
      service.createReservation(input({ participants: 999 }), asUser(USERS.owner))
    ).rejects.toMatchObject({ code: "ROOM_CAPACITY_EXCEEDED" });

    expect(eventBus.publish).not.toHaveBeenCalled();
  });

  test("anulowanie publikuje reservation.cancelled, a ponowne anulowanie już nie", async () => {
    const { service, eventBus } = createContext({ reservations: [reservation()] });

    await service.cancelReservation(1, asUser(USERS.admin));
    await service.cancelReservation(1, asUser(USERS.admin)); // idempotentne - bez eventu

    expect(eventBus.publish).toHaveBeenCalledTimes(1);
    expect(eventBus.publish).toHaveBeenCalledWith("reservation.cancelled", {
      reservationId: 1,
      roomId: 1,
      userId: USERS.owner.id,
      cancelledBy: USERS.admin.id
    });
  });

  test("nieudane anulowanie (rezerwacja już trwa) nie publikuje eventu", async () => {
    const { service, eventBus } = createContext({ reservations: [reservation()], now: at("10:30") });

    await expect(service.cancelReservation(1, asUser(USERS.owner))).rejects.toMatchObject({
      code: "RESERVATION_ALREADY_STARTED"
    });

    expect(eventBus.publish).not.toHaveBeenCalled();
  });
});
