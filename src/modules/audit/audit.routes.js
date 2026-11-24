const { Router } = require("express");
const validate = require("../../middleware/validate");
const authorize = require("../../middleware/authorize");
const { listAuditLogQuery } = require("./audit.schemas");

// /api/admin/audit-log - tylko ADMIN (authenticate jest podpięty w app.js)
function createAuditRouter(controller) {
  const router = Router();

  router.get("/audit-log", authorize("ADMIN"), validate({ query: listAuditLogQuery }), controller.list);

  return router;
}

module.exports = { createAuditRouter };
