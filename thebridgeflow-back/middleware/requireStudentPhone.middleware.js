import { isValidTunisianPhone } from "../utils/tunisianPhone.js";

export function requireStudentPhone(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ message: "Authentification requise." });
  }

  if (req.user.role !== "étudiant") return next();

  if (!isValidTunisianPhone(req.user.phone)) {
    return res.status(403).json({
      code: "STUDENT_PHONE_REQUIRED",
      message: "Un numéro de téléphone tunisien valide est requis pour cette action.",
    });
  }

  next();
}
