function toAuditEntryResponse(entry) {
  return {
    id: entry.id,
    eventType: entry.eventType,
    payload: entry.payload,
    createdAt: new Date(entry.createdAt).toISOString()
  };
}

function createAuditController(auditService) {
  return {
    async list(req, res) {
      const { items, meta } = await auditService.listAuditLog(req.validated.query);
      res.json({ data: items.map(toAuditEntryResponse), meta });
    }
  };
}

module.exports = { createAuditController };
