const { EventEmitter } = require("node:events");

// Event bus oparty o EventEmitter.
// - publish() nigdy nie rzuca: listenery uruchamiają się asynchronicznie (po zakończeniu bieżącego kodu),
//   więc nie opóźniają i nie psują odpowiedzi API,
// - błąd listenera (sync throw albo odrzucony Promise) jest łapany i tylko logowany (izolacja błędów),
// - drain() czeka na wszystkie trwające listenery (graceful shutdown, testy).
function createEventBus({ logger = console } = {}) {
  const emitter = new EventEmitter();
  const pending = new Set();

  function subscribe(eventType, handler) {
    emitter.on(eventType, event => {
      const task = Promise.resolve()
        .then(() => handler(event))
        .catch(err => {
          logger.error(`[events] listener "${handler.name || "anonymous"}" dla ${eventType} rzucił błąd:`, err);
        })
        .finally(() => pending.delete(task));
      pending.add(task);
    });
  }

  function publish(eventType, payload) {
    const event = { type: eventType, payload, occurredAt: new Date().toISOString() };
    emitter.emit(eventType, event);
  }

  async function drain() {
    while (pending.size > 0) {
      await Promise.allSettled([...pending]);
    }
  }

  return { subscribe, publish, drain };
}

// bus, który nic nie robi - domyślny dla service'ów tworzonych bez eventów
const noopEventBus = Object.freeze({ subscribe() {}, publish() {}, async drain() {} });

module.exports = { createEventBus, noopEventBus };
