const { EVENTS, EVENT_TYPES } = require("./eventTypes");
const { createAuditLogListener } = require("../modules/audit/audit.listener");
const { createCancellationNotificationListener } = require("../modules/notifications/notifications.listener");

// JEDYNE miejsce, gdzie podpinamy listenery do eventów
function registerListeners({ eventBus, runInTransaction, logger = console }) {
  const auditLogListener = createAuditLogListener({ runInTransaction });
  for (const eventType of EVENT_TYPES) {
    eventBus.subscribe(eventType, auditLogListener);
  }

  eventBus.subscribe(
    EVENTS.RESERVATION_CANCELLED,
    createCancellationNotificationListener({ runInTransaction, logger })
  );
}

module.exports = { registerListeners };
