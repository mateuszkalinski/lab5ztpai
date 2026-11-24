function createAuditLogRepository(seed = []) {
  const entries = structuredClone(seed);
  let nextId = Math.max(0, ...entries.map(e => e.id)) + 1;

  return {
    async create({ eventType, payload }) {
      const entry = { id: nextId++, eventType, payload: structuredClone(payload), createdAt: new Date() };
      entries.push(entry);
      return entry;
    },

    async list({ eventType, page, limit }) {
      const filtered = entries
        .filter(e => eventType === undefined || e.eventType === eventType)
        .sort((a, b) => b.createdAt - a.createdAt || b.id - a.id);

      const start = (page - 1) * limit;
      return { items: filtered.slice(start, start + limit), total: filtered.length };
    }
  };
}

module.exports = { createAuditLogRepository };
