function toIso(value) {
  return value ? new Date(value).toISOString() : null;
}

function toReservationResponse(reservation) {
  const { room, user } = reservation;
  return {
    id: reservation.id,
    room: {
      id: room.id,
      name: room.name,
      building: { id: room.building.id, name: room.building.name }
    },
    user: { id: user.id, email: user.email },
    participants: reservation.participants,
    startTime: toIso(reservation.startTime),
    endTime: toIso(reservation.endTime),
    status: reservation.status,
    createdAt: toIso(reservation.createdAt),
    cancelledAt: toIso(reservation.cancelledAt)
    // internalNote celowo pominięte - nie może wyjść poza API
  };
}

module.exports = { toReservationResponse };
