function validateRequest(schemas) {
  return (req, _res, next) => {
    const validated = {};

    for (const [part, schema] of Object.entries(schemas)) {
      const result = schema.safeParse(req[part]);
      if (!result.success) {
        return next(result.error);
      }
      validated[part] = result.data;
    }

    req.validated = { ...req.validated, ...validated };
    return next();
  };
}

module.exports = { validateRequest };
