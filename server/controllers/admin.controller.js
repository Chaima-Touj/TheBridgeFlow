import crypto            from "crypto";
import User             from "../models/users.model.js";
import Offer            from "../models/offers.model.js";
import Formation        from "../models/formation.model.js";
import Enrollment        from "../models/enrollment.model.js";
import EnrollmentRequest from "../models/enrollmentRequest.model.js";
import Application       from "../models/applications.model.js";
import Interview         from "../models/interview.model.js";
import Conversation      from "../models/conversation.model.js";
import PageVisit        from "../models/pageVisit.model.js";
import asyncHandler      from "../utils/asyncHandler.js";
import emailService      from "../services/email.service.js";

const USER_SELECT = "-password -verifyCode -verifyCodeExpires";
const ASSIGNABLE_ROLES = ["étudiant", "admin"];

// Mot de passe temporaire lisible (évite les caractères ambigus 0/O/1/l)
const generateTempPassword = () => {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  return Array.from(crypto.randomFillSync(new Uint8Array(12)))
    .map((b) => chars[b % chars.length])
    .join("");
};

/* ── GET /api/admin/dashboard-stats ───────────────────────────────────────────
   Agrégats pour la page Tableau de bord admin.                                */
export const getDashboardStats = asyncHandler(async (req, res) => {
  const [
    totalStudents,
    totalFormations,
    pendingRequests,
    activeEnrollments,
    enrollmentsByMonth,
    formationsByLevel,
  ] = await Promise.all([
    User.countDocuments({ role: "étudiant" }),
    Formation.countDocuments({}),
    EnrollmentRequest.countDocuments({ status: "en_attente" }),
    Enrollment.countDocuments({ overallStatus: "in_progress" }),

    // Évolution des inscriptions par mois (line chart)
    Enrollment.aggregate([
      {
        $group: {
          _id:   { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
      { $project: { _id: 0, month: "$_id", count: 1 } },
    ]),

    // Répartition des formations par niveau (donut chart).
    // Note : Formation n'a pas de champ "domain"/"catégorie" — "level" est le
    // seul champ catégoriel existant, utilisé ici comme meilleur proxy disponible.
    Formation.aggregate([
      { $group: { _id: "$level", count: { $sum: 1 } } },
      { $project: { _id: 0, level: "$_id", count: 1 } },
    ]),
  ]);

  res.json({
    totalStudents,
    totalFormations,
    pendingRequests,
    activeEnrollments,
    enrollmentsByMonth,
    formationsByLevel,
  });
});

/* ── GET /api/admin/stats ─────────────────────────────────────────────────────
   Statistiques avancées pour la page Statistiques dédiée — au-delà des
   compteurs déjà affichés sur le Tableau de bord : pipeline demandes vs
   inscriptions dans le temps, répartition par formation, taux de conversion.  */
export const getAdvancedStats = asyncHandler(async (req, res) => {
  const [
    enrollmentsByMonthRaw,
    requestsByMonthRaw,
    enrollmentsByFormationRaw,
    requestsByStatusRaw,
  ] = await Promise.all([
    Enrollment.aggregate([
      { $group: { _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } }, count: { $sum: 1 } } },
    ]),
    EnrollmentRequest.aggregate([
      { $group: { _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } }, count: { $sum: 1 } } },
    ]),
    Enrollment.aggregate([
      { $group: { _id: "$formation", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
      { $lookup: { from: "formations", localField: "_id", foreignField: "_id", as: "formation" } },
      { $unwind: "$formation" },
      { $project: { _id: 0, title: "$formation.title", count: 1 } },
    ]),
    EnrollmentRequest.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
  ]);

  // Fusionne les deux séries mensuelles (demandes / inscriptions) sur un même
  // axe de temps — les deux agrégations ci-dessus sont indépendantes (deux
  // collections distinctes), donc le rapprochement par mois se fait ici.
  const monthMap = new Map();
  for (const r of enrollmentsByMonthRaw) monthMap.set(r._id, { month: r._id, enrollments: r.count, requests: 0 });
  for (const r of requestsByMonthRaw) {
    const existing = monthMap.get(r._id);
    if (existing) existing.requests = r.count;
    else monthMap.set(r._id, { month: r._id, enrollments: 0, requests: r.count });
  }
  const pipelineByMonth = [...monthMap.values()].sort((a, b) => a.month.localeCompare(b.month));

  const requestsByStatus = { en_attente: 0, "acceptée": 0, "refusée": 0 };
  for (const s of requestsByStatusRaw) requestsByStatus[s._id] = s.count;
  const totalRequests = requestsByStatus.en_attente + requestsByStatus["acceptée"] + requestsByStatus["refusée"];
  const conversionRate = totalRequests > 0 ? Math.round((requestsByStatus["acceptée"] / totalRequests) * 100) : 0;

  res.json({
    pipelineByMonth,
    enrollmentsByFormation: enrollmentsByFormationRaw,
    requestsByStatus,
    totalRequests,
    conversionRate,
  });
});

/* ── GET /api/admin/top-offers — 10 offres les plus consultées ─────────────── */
export const getTopOffers = asyncHandler(async (req, res) => {
  const offers = await Offer.find().sort({ views: -1 }).limit(10).lean();
  res.json({ offers });
});

/* ── GET /api/admin/top-formations — 10 formations les plus consultées ────── */
export const getTopFormations = asyncHandler(async (req, res) => {
  const formations = await Formation.find().sort({ views: -1 }).limit(10).lean();
  res.json({ formations });
});

/* ── GET /api/admin/visits-by-day — visites/jour sur les 30 derniers jours ──── */
export const getVisitsByDay = asyncHandler(async (req, res) => {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const visits = await PageVisit.aggregate([
    { $match: { timestamp: { $gte: thirtyDaysAgo } } },
    {
      $group: {
        _id:   { $dateToString: { format: "%Y-%m-%d", date: "$timestamp" } },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
    { $project: { _id: 0, date: "$_id", count: 1 } },
  ]);
  res.json({ visits });
});

/* ── GET /api/admin/top-pages — 15 pages les plus visitées ──────────────────── */
export const getTopPages = asyncHandler(async (req, res) => {
  const pages = await PageVisit.aggregate([
    {
      $group: {
        _id:   "$path",
        count: { $sum: 1 },
      },
    },
    { $sort: { count: -1 } },
    { $limit: 15 },
    {
      $project: {
        _id:   0,
        path:  "$_id",
        count: 1,
      },
    },
  ]);

  res.json({ pages });
});

/* ── GET /api/admin/online-count — utilisateurs actifs depuis moins de 2 min ── */
export const getOnlineCount = asyncHandler(async (req, res) => {
  const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
  const count = await User.countDocuments({ lastActiveAt: { $gte: twoMinutesAgo } });
  res.json({ online: count });
});

/* ── POST /api/admin/users — créer un utilisateur (réservé à l'admin) ─────────
   Contrairement à l'inscription publique (register), tous les rôles sont
   autorisés et le compte est immédiatement vérifié : l'admin vouche pour le
   compte, pas besoin du flux de vérification par code.                       */
export const createUser = asyncHandler(async (req, res) => {
  const { name, email, password, role } = req.body;

  if (!name || !email) {
    const err = new Error("Nom et email requis.");
    err.statusCode = 400;
    throw err;
  }

  if (!ASSIGNABLE_ROLES.includes(role)) {
    const err = new Error(`Rôle invalide. Attendu : ${ASSIGNABLE_ROLES.join(", ")}.`);
    err.statusCode = 400;
    throw err;
  }

  if (password && password.length < 6) {
    const err = new Error("Le mot de passe doit contenir au moins 6 caractères.");
    err.statusCode = 400;
    throw err;
  }

  const existing = await User.findOne({ email });
  if (existing) {
    const err = new Error("Email déjà utilisé.");
    err.statusCode = 409;
    throw err;
  }

  const generatedPassword = password ? null : generateTempPassword();

  const user = await User.create({
    name,
    email,
    password: password || generatedPassword,
    role,
    isVerified: true,
  });

  console.log(`📝 Utilisateur créé par l'admin : ${user.name} (${user.email}) — rôle: ${user.role}`);

  const emailResult = await emailService.sendAccountCreatedByAdmin(user.email, {
    name: user.name,
    email: user.email,
    password: password || generatedPassword,
    role: user.role,
  });
  if (!emailResult.success) {
    console.error(`⚠️  Email d'identifiants non envoyé à ${user.email} : ${emailResult.error}`);
  }

  const safeUser = await User.findById(user._id).select(USER_SELECT).lean();
  res.status(201).json({
    user: safeUser,
    generatedPassword,
    emailSent: emailResult.success,
  });
});

/* ── GET /api/admin/users ──────────────────────────────────────────────────────
   Liste complète — pas de pagination serveur, même choix que getAllFormations :
   le volume actuel ne le justifie pas, le tri/filtre/pagination se fait côté
   client (cohérent avec AdminFormations.jsx).                                 */
export const getUsers = asyncHandler(async (req, res) => {
  const users = await User.find()
    .select(USER_SELECT)
    .sort({ createdAt: -1 })
    .lean();
  res.json(users);
});

/* ── GET /api/admin/users/:id ──────────────────────────────────────────────── */
export const getUserById = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id).select(USER_SELECT).lean();
  if (!user) {
    const err = new Error("Utilisateur introuvable.");
    err.statusCode = 404;
    throw err;
  }
  res.json(user);
});

/* ── PATCH /api/admin/users/:id/status — activer / désactiver ───────────────── */
export const updateUserStatus = asyncHandler(async (req, res) => {
  const { isActive } = req.body;
  if (typeof isActive !== "boolean") {
    const err = new Error("Le champ isActive doit être un booléen.");
    err.statusCode = 400;
    throw err;
  }

  if (!isActive && String(req.params.id) === String(req.user._id)) {
    const err = new Error("Vous ne pouvez pas désactiver votre propre compte.");
    err.statusCode = 400;
    throw err;
  }

  const user = await User.findByIdAndUpdate(
    req.params.id,
    { isActive },
    { new: true, runValidators: true }
  ).select(USER_SELECT);

  if (!user) {
    const err = new Error("Utilisateur introuvable.");
    err.statusCode = 404;
    throw err;
  }

  res.json({ message: isActive ? "Compte activé." : "Compte désactivé.", user });
});

/* ── PATCH /api/admin/users/:id/role — changer le rôle ───────────────────────── */
export const updateUserRole = asyncHandler(async (req, res) => {
  const { role } = req.body;
  if (!ASSIGNABLE_ROLES.includes(role)) {
    const err = new Error(`Rôle invalide. Attendu : ${ASSIGNABLE_ROLES.join(", ")}.`);
    err.statusCode = 400;
    throw err;
  }

  if (role !== "admin" && String(req.params.id) === String(req.user._id)) {
    const err = new Error("Vous ne pouvez pas retirer votre propre rôle admin.");
    err.statusCode = 400;
    throw err;
  }

  const user = await User.findByIdAndUpdate(
    req.params.id,
    { role },
    { new: true, runValidators: true }
  ).select(USER_SELECT);

  if (!user) {
    const err = new Error("Utilisateur introuvable.");
    err.statusCode = 404;
    throw err;
  }

  res.json({ message: "Rôle mis à jour.", user });
});

/* ── DELETE /api/admin/users/:id ───────────────────────────────────────────────
   Même garde-fou que deleteFormation : bloque (409) si des données liées
   existent, plutôt que de supprimer en cascade silencieusement.               */
export const deleteUser = asyncHandler(async (req, res) => {
  if (String(req.params.id) === String(req.user._id)) {
    const err = new Error("Vous ne pouvez pas supprimer votre propre compte depuis cette page.");
    err.statusCode = 400;
    throw err;
  }

  const user = await User.findById(req.params.id);
  if (!user) {
    const err = new Error("Utilisateur introuvable.");
    err.statusCode = 404;
    throw err;
  }

  const [applicationCount, interviewCount, conversationCount] = await Promise.all([
    Application.countDocuments({ studentId: user._id }),
    Interview.countDocuments({ $or: [{ studentId: user._id }, { companyId: user._id }] }),
    Conversation.countDocuments({ participants: user._id }),
  ]);

  if (applicationCount > 0 || interviewCount > 0 || conversationCount > 0) {
    const parts = [];
    if (applicationCount > 0)  parts.push(`${applicationCount} candidature(s)`);
    if (interviewCount > 0)    parts.push(`${interviewCount} entretien(s)`);
    if (conversationCount > 0) parts.push(`${conversationCount} conversation(s)`);
    const err = new Error(`Impossible de supprimer : ${parts.join(", ")} lié(s) à ce compte.`);
    err.statusCode = 409;
    throw err;
  }

  await user.deleteOne();
  res.json({ message: "Utilisateur supprimé.", id: user._id });
});
