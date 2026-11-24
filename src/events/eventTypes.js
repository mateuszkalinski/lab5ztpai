// nazwy eventów w jednym miejscu (literówka = błąd przy require, a nie cichy brak eventu)
const EVENTS = Object.freeze({
  RESERVATION_CREATED: "reservation.created",
  RESERVATION_CANCELLED: "reservation.cancelled"
});

module.exports = { EVENTS, EVENT_TYPES: Object.values(EVENTS) };
