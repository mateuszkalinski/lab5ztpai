const { ForbiddenError } = require("../errors/AppError");

// authorize("ADMIN") - wpuszcza tylko użytkowników z jedną z podanych ról (po authenticate)
function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(new ForbiddenError());
    }
    next();
  };
}

module.exports = authorize;
