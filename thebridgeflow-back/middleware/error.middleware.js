export function notFound(req, res, next) {
  const err = new Error(`Not Found - ${req.originalUrl}`);
  err.statusCode = 404;
  next(err);
}

export function errorHandler(err, req, res, next) {
  let statusCode = err.statusCode || 500;
  let message    = err.message || "Server Error";

  // Erreurs spécifiques Multer
  if (err.name === "MulterError") {
    statusCode = 400;
    if (err.code === "LIMIT_FILE_SIZE") message = "Le fichier dépasse la taille maximale autorisée (5MB)";
  }

  const payload = { message };
  // Code métier optionnel (ex: "AI_CONVERSATION_LIMIT_REACHED") — permet au
  // frontend de distinguer un cas attendu d'une erreur générique sans avoir à
  // comparer le texte du message.
  if (err.code && typeof err.code === "string") payload.code = err.code;
  if (process.env.NODE_ENV === "development") payload.stack = err.stack;
  res.status(statusCode).json(payload);
}
