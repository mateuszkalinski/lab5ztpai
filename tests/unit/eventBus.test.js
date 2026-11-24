const { createEventBus } = require("../../src/events/eventBus");

describe("EventBus", () => {
  test("dostarcza event do listenera z typem i payloadem", async () => {
    const bus = createEventBus({ logger: { error: jest.fn() } });
    const listener = jest.fn();
    bus.subscribe("reservation.created", listener);

    bus.publish("reservation.created", { reservationId: 1 });
    await bus.drain();

    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({ type: "reservation.created", payload: { reservationId: 1 } })
    );
  });

  test("błąd jednego listenera nie przerywa publish() ani pozostałych listenerów", async () => {
    const logger = { error: jest.fn() };
    const bus = createEventBus({ logger });
    const failingSync = jest.fn(() => { throw new Error("sync boom"); });
    const failingAsync = jest.fn(async () => { throw new Error("async boom"); });
    const healthy = jest.fn();
    bus.subscribe("reservation.created", failingSync);
    bus.subscribe("reservation.created", failingAsync);
    bus.subscribe("reservation.created", healthy);

    expect(() => bus.publish("reservation.created", { reservationId: 1 })).not.toThrow();
    await bus.drain();

    expect(healthy).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledTimes(2);
  });
});
