const { NotFoundError, ConflictError, ValidationError, ForbiddenError } = require("../../errors/AppError");

const MINUTE = 60 * 1000;
const MIN_DURATION = 15 * MINUTE;  // 15 minut
const MAX_DURATION = 8 * 60 * MINUTE; // 8 godzin

// state machine: dozwolone przejścia statusów zapisane jako dane
const ALLOWED_TRANSITIONS = {
  CONFIRMED: ["CANCELLED"],
  CANCELLED: [] // stan końcowy
};

// przedziały półotwarte [start, end): nakładają się, gdy A.start < B.end i B.start < A.end
function overlaps(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}

function bodyError(field, message) {
  return new ValidationError([{ location: "body", field, message }]);
}

// ownership: właściciel albo ADMIN
function canAccess(reservation, currentUser) {
  return currentUser.role === "ADMIN" || reservation.userId === currentUser.id;
}

function createReservationsService({ runInTransaction, now = () => new Date() }) {
  async function listReservations(query, currentUser) {
    let userId = query.userId;

    if (currentUser.role !== "ADMIN") {
      // filtr ?userId= jest tylko dla ADMINa - USER dostaje jawne 403
      if (query.userId !== undefined) {
        throw new ForbiddenError("Filter userId is available only for ADMIN");
      }
      // USER widzi wyłącznie swoje rezerwacje - filtr dokłada backend, niezależnie od query
      userId = currentUser.id;
    }

    return runInTransaction(async ({ reservations }) => {
      const { items, total } = await reservations.list({ ...query, userId });
      return {
        items,
        meta: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) }
      };
    });
  }

  // cudza rezerwacja -> 404 (rezerwacje są prywatne - nie zdradzamy, że istnieją)
  async function findAccessible(reservations, id, currentUser) {
    const reservation = await reservations.findById(id);
    if (!reservation || !canAccess(reservation, currentUser)) throw new NotFoundError("Reservation");
    return reservation;
  }

  async function getReservation(id, currentUser) {
    return runInTransaction(({ reservations }) => findAccessible(reservations, id, currentUser));
  }

  async function createReservation(input, currentUser) {
    const start = new Date(input.startTime).getTime();
    const end = new Date(input.endTime).getTime();
    const duration = end - start;

    // reguły czasu -> 400
    if (end <= start) {
      throw bodyError("endTime", "Czas zakonczenia musi byc pozniejszy niz czas rozpoczecia");
    }
    if (duration < MIN_DURATION) {
      throw bodyError("endTime", "Rezerwacja musi trwac minimum 15 minut");
    }
    if (duration > MAX_DURATION) {
      throw bodyError("endTime", "Rezerwacja nie moze byc dluzsza niz 8 godzin");
    }
    if (start < now().getTime()) {
      throw bodyError("startTime", "Czas rozpoczecia musi byc w przyszlosci");
    }

    return runInTransaction(async ({ rooms, reservations }) => {
      // sala musi istnieć -> 404
      const room = await rooms.findById(input.roomId);
      if (!room) throw new NotFoundError("Room");

      // pojemność sali -> 409
      if (input.participants > room.capacity) {
        throw new ConflictError("Przekroczono pojemnosc sali", "ROOM_CAPACITY_EXCEEDED");
      }

      // blokujemy wiersz sali: równoległe rezerwacje TEJ SAMEJ sali czekają tu w kolejce,
      // aż poprzednia transakcja zrobi COMMIT - dopiero wtedy sprawdzają kolizje
      await rooms.lockById(room.id);

      // brak nakładających się aktywnych rezerwacji -> 409
      // (druga linia obrony: exclusion constraint reservations_no_overlap w bazie -> 23P01 -> 409)
      const active = await reservations.findByRoomAndStatus(room.id, "CONFIRMED");
      const collision = active.some(r =>
        overlaps(start, end, new Date(r.startTime).getTime(), new Date(r.endTime).getTime())
      );
      if (collision) {
        throw new ConflictError("Sala jest juz zarezerwowana w tym czasie", "ROOM_ALREADY_BOOKED");
      }

      return reservations.create({
        roomId: room.id,
        userId: currentUser.id, // właściciel wyłącznie z tokenu
        participants: input.participants,
        startTime: new Date(start),
        endTime: new Date(end),
        status: "CONFIRMED",
        createdAt: now(),
        cancelledAt: null,
        internalNote: "created via API v2"
      });
    });
  }

  async function cancelReservation(id, currentUser) {
    return runInTransaction(async ({ reservations }) => {
      const reservation = await findAccessible(reservations, id, currentUser);

      const newStatus = "CANCELLED";

      // idempotentność: ponowne anulowanie zwraca rezerwację bez zmian
      if (reservation.status === newStatus) return reservation;

      if (!ALLOWED_TRANSITIONS[reservation.status].includes(newStatus)) {
        throw new ConflictError(
          `Nie mozna zmienic statusu z ${reservation.status} na ${newStatus}`,
          "INVALID_STATUS_TRANSITION"
        );
      }

      // reguła obowiązuje także ADMINa
      if (new Date(reservation.startTime).getTime() <= now().getTime()) {
        throw new ConflictError(
          "Nie mozna anulowac rezerwacji, ktora juz sie rozpoczela",
          "RESERVATION_ALREADY_STARTED"
        );
      }

      return reservations.update(id, { status: newStatus, cancelledAt: now() });
    });
  }

  return { listReservations, getReservation, createReservation, cancelReservation };
}

module.exports = { createReservationsService };
