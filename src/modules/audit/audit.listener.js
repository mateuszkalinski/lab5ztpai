// Listener: każdy event -> wiersz w tabeli audit_log
function createAuditLogListener({ runInTransaction }) {
  return async function auditLogListener(event) {
    // Zadanie 4 - demonstracja izolacji błędów: odkomentuj linię poniżej, wyślij POST /api/reservations
    // (nadal 201), błąd pojawi się tylko w logach servera. Potem zakomentuj z powrotem.
    // throw new Error("Symulowana awaria listenera audit logu");

    await runInTransaction(({ auditLog }) =>
      auditLog.create({ eventType: event.type, payload: event.payload })
    );
  };
}

module.exports = { createAuditLogListener };
