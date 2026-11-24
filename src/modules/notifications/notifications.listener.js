// Listener: symulacja powiadomienia mailowego.
// Gdy ADMIN anuluje CUDZĄ rezerwację, właściciel dostaje "maila" (tutaj: wpis w konsoli).
function createCancellationNotificationListener({ runInTransaction, logger = console }) {
  return async function cancellationNotificationListener(event) {
    const { reservationId, roomId, userId, cancelledBy } = event.payload;

    // właściciel anulował sam - nie ma kogo powiadamiać
    if (cancelledBy === userId) return;

    const { canceller, owner } = await runInTransaction(async ({ users }) => ({
      canceller: await users.findById(cancelledBy),
      owner: await users.findById(userId)
    }));

    if (!canceller || canceller.role !== "ADMIN" || !owner) return;

    logger.log(
      `[notification] to: ${owner.email} - Twoja rezerwacja #${reservationId} (sala ${roomId}) ` +
      `zostala anulowana przez administratora (${canceller.email})`
    );
  };
}

module.exports = { createCancellationNotificationListener };
