function createAuditService({ runInTransaction }) {
  async function listAuditLog(query) {
    return runInTransaction(async ({ auditLog }) => {
      const { items, total } = await auditLog.list(query);
      return {
        items,
        meta: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) }
      };
    });
  }

  return { listAuditLog };
}

module.exports = { createAuditService };
