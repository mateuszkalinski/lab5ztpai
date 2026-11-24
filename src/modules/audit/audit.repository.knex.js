function toAuditEntry(row) {
  if (!row) return null;
  return {
    id: row.id,
    eventType: row.event_type,
    payload: row.payload, // jsonb -> pg zwraca od razu obiekt
    createdAt: row.created_at
  };
}

function createAuditLogRepository(db) {
  return {
    async create({ eventType, payload }) {
      const [row] = await db("audit_log")
        // jsonb: przekazujemy JSON jako tekst, żeby tablice też trafiły do bazy poprawnie
        .insert({ event_type: eventType, payload: JSON.stringify(payload) })
        .returning("*");
      return toAuditEntry(row);
    },

    async list({ eventType, page, limit }) {
      const filtered = db("audit_log").modify(qb => {
        if (eventType !== undefined) qb.where("event_type", eventType);
      });

      const rows = await filtered.clone()
        .select("*")
        .orderBy("created_at", "desc")
        .orderBy("id", "desc") // ten sam created_at (ta sama transakcja) -> nowszy id pierwszy
        .limit(limit)
        .offset((page - 1) * limit);

      const { count } = await filtered.clone().count({ count: "id" }).first();

      return { items: rows.map(toAuditEntry), total: Number(count) };
    }
  };
}

module.exports = { createAuditLogRepository };
