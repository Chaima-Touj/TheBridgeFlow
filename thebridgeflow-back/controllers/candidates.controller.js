import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Application from "../models/applications.model.js";
import Interview from "../models/interview.model.js";
import Offer from "../models/offers.model.js";
import User from "../models/users.model.js";
import FollowUpTask from "../models/followUpTask.model.js";
import asyncHandler from "../utils/asyncHandler.js";
import { autoCompletePastInterviews } from "../utils/interviewStatus.js";
import {
  OPEN_TASK_STATUSES, UPCOMING_INTERVIEW_STATUSES, buildGlobalStatusSwitch, computeGlobalStatus,
  isTaskOverdue, summarizeTasks, validateTaskInput, parseListQuery, parseTaskQuery, escapeRegex,
  parseDocumentKey, resolveLocalUpload, safeHttpUrl, fileExtension, ensureExtension,
  buildContentDisposition, truncateText,
} from "../utils/candidateFollowUp.js";

/* Espace admin « Candidatures » : étudiants regroupés avec leurs candidatures,
   dossier individuel et historique de suivi PARTAGÉ entre administrateurs.
   Toutes ces routes sont montées sous /api/admin (protect + authorize admin). */

const UPLOADS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "../uploads");

const STUDENT_FIELDS = "name email phone gender avatarUrl university specialty bio cv education experience skills languages socialLinks createdAt lastLoginAt lastActiveAt isActive isVerified role";
const OFFER_FIELDS = "title companyName location type domain duration description deadline isActive";

const TASK_POPULATE = [
  { path: "createdBy", select: "name" },
  { path: "updatedBy", select: "name" },
  { path: "completedBy", select: "name" },
  { path: "applicationId", select: "status offerId", populate: { path: "offerId", select: "title companyName" } },
];

function httpError(statusCode, message, code) {
  const err = new Error(message);
  err.statusCode = statusCode;
  if (code) err.code = code;
  return err;
}

const toId = (value) => (value === null || value === undefined ? null : String(value._id ?? value));
const maxDate = (...values) => {
  const times = values.map((v) => (v ? new Date(v).getTime() : NaN)).filter((t) => !Number.isNaN(t));
  return times.length ? new Date(Math.max(...times)) : null;
};
const person = (user) => (user && typeof user === "object" && user._id ? { _id: user._id, name: user.name || "" } : null);

function sameValue(a, b) {
  const aEmpty = a === null || a === undefined;
  const bEmpty = b === null || b === undefined;
  if (aEmpty || bEmpty) return aEmpty && bEmpty;
  if (a instanceof Date || b instanceof Date) return new Date(a).getTime() === new Date(b).getTime();
  return String(a) === String(b);
}

/* Étudiant (rôle « étudiant ») ayant au moins une candidature : sinon le
   dossier n'existe pas dans cet espace (404), quel que soit l'identifiant. */
async function loadCandidateOr404(studentId, select = "name role cv") {
  const student = await User.findOne({ _id: studentId, role: "étudiant" }).select(select).lean();
  if (!student || !(await Application.exists({ studentId }))) {
    throw httpError(404, "Dossier étudiant introuvable.");
  }
  return student;
}

async function assertApplicationBelongs(applicationId, studentId) {
  if (!applicationId) return;
  if (!(await Application.exists({ _id: applicationId, studentId }))) {
    throw httpError(400, "Cette candidature n'appartient pas à cet étudiant.");
  }
}

async function studentTaskSummary(studentId, now = new Date()) {
  const tasks = await FollowUpTask.find({ studentId }).select("status dueDate").lean();
  return summarizeTasks(tasks, now);
}

function serializeTask(task, now = new Date()) {
  const application = task.applicationId && typeof task.applicationId === "object" && task.applicationId._id
    ? {
      _id: task.applicationId._id,
      status: task.applicationId.status,
      offer: task.applicationId.offerId && task.applicationId.offerId._id
        ? { _id: task.applicationId.offerId._id, title: task.applicationId.offerId.title || "", companyName: task.applicationId.offerId.companyName || "" }
        : null,
    }
    : null;
  return {
    _id: task._id,
    studentId: task.studentId,
    applicationId: application ? application._id : null,
    application,
    type: task.type,
    title: task.title,
    description: task.description || "",
    activityDate: task.activityDate,
    dueDate: task.dueDate || null,
    status: task.status,
    isOverdue: isTaskOverdue(task, now),
    createdBy: person(task.createdBy),
    updatedBy: person(task.updatedBy),
    completedAt: task.completedAt || null,
    completedBy: person(task.completedBy),
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
  };
}

async function loadSerializedTask(taskId, now) {
  const task = await FollowUpTask.findById(taskId).populate(TASK_POPULATE).lean();
  return task ? serializeTask(task, now) : null;
}

// Jointure des offres en égalité localField/foreignField : utilise l'index
// _id (un $in dans $expr parcourrait toute la collection pour chaque étudiant).
function offerLookupStages() {
  return [
    { $lookup: { from: Offer.collection.name, localField: "apps.offerId", foreignField: "_id", as: "offerDocs" } },
    { $set: { offerDocs: { $map: { input: "$offerDocs", as: "offer", in: { _id: "$$offer._id", title: "$$offer.title", companyName: "$$offer.companyName" } } } } },
  ];
}

/* ── Agrégation commune : une ligne par étudiant candidat ──────────────────
   Part de Application (groupée par studentId) puis joint l'utilisateur, ses
   tâches et ses entretiens. Exclut les candidatures orphelines (compte
   supprimé) et les comptes non étudiants. */
function candidateStages(now, { withOffers = true } = {}) {
  const dueSet = { $gt: ["$dueDate", null] };
  const isOpen = { $in: ["$status", OPEN_TASK_STATUSES] };
  const isUpcoming = { $and: [{ $in: ["$status", UPCOMING_INTERVIEW_STATUSES] }, { $gte: ["$scheduledAt", now] }] };
  const countStatus = (status) => ({ $sum: { $cond: [{ $eq: ["$status", status] }, 1, 0] } });

  const stages = [
    {
      $group: {
        _id: "$studentId",
        applicationsCount: { $sum: 1 },
        pendingCount: countStatus("en attente"),
        inReviewCount: countStatus("en cours"),
        acceptedCount: countStatus("acceptée"),
        refusedCount: countStatus("refusée"),
        lastApplicationActivityAt: { $max: "$updatedAt" },
        firstAppliedAt: { $min: "$createdAt" },
        apps: { $push: { applicationId: "$_id", offerId: "$offerId", status: "$status", appliedAt: "$createdAt" } },
      },
    },
    {
      $lookup: {
        from: User.collection.name,
        let: { sid: "$_id" },
        pipeline: [
          { $match: { $expr: { $eq: ["$_id", "$$sid"] } } },
          { $project: { name: 1, email: 1, phone: 1, avatarUrl: 1, university: 1, specialty: 1, role: 1 } },
        ],
        as: "student",
      },
    },
    { $unwind: "$student" },
    { $match: { "student.role": "étudiant" } },
  ];

  if (withOffers) stages.push(...offerLookupStages());

  stages.push(
    {
      $lookup: {
        from: FollowUpTask.collection.name,
        let: { sid: "$_id" },
        pipeline: [
          { $match: { $expr: { $eq: ["$studentId", "$$sid"] } } },
          {
            $group: {
              _id: null,
              total: { $sum: 1 },
              open: { $sum: { $cond: [isOpen, 1, 0] } },
              overdue: { $sum: { $cond: [{ $and: [isOpen, dueSet, { $lt: ["$dueDate", now] }] }, 1, 0] } },
              nextDueAt: { $min: { $cond: [{ $and: [isOpen, dueSet, { $gte: ["$dueDate", now] }] }, "$dueDate", null] } },
              lastTaskAt: { $max: "$updatedAt" },
            },
          },
        ],
        as: "taskStats",
      },
    },
    {
      $lookup: {
        from: Interview.collection.name,
        let: { sid: "$_id" },
        pipeline: [
          { $match: { $expr: { $eq: ["$studentId", "$$sid"] } } },
          {
            $group: {
              _id: null,
              upcoming: { $sum: { $cond: [isUpcoming, 1, 0] } },
              nextAt: { $min: { $cond: [isUpcoming, "$scheduledAt", null] } },
              lastInterviewAt: { $max: "$updatedAt" },
            },
          },
        ],
        as: "interviewStats",
      },
    },
    {
      $addFields: {
        taskStats: { $ifNull: [{ $arrayElemAt: ["$taskStats", 0] }, { total: 0, open: 0, overdue: 0, nextDueAt: null, lastTaskAt: null }] },
        interviewStats: { $ifNull: [{ $arrayElemAt: ["$interviewStats", 0] }, { upcoming: 0, nextAt: null, lastInterviewAt: null }] },
      },
    },
    {
      $addFields: {
        globalStatus: buildGlobalStatusSwitch({
          applicationsCount: "$applicationsCount",
          acceptedCount: "$acceptedCount",
          refusedCount: "$refusedCount",
          inReviewCount: "$inReviewCount",
          upcomingInterviews: "$interviewStats.upcoming",
          tasksTotal: "$taskStats.total",
        }),
        lastActivityAt: { $max: ["$lastApplicationActivityAt", "$taskStats.lastTaskAt", "$interviewStats.lastInterviewAt"] },
      },
    },
  );
  return stages;
}

const FILTER_MATCH = {
  new: { globalStatus: "new" },
  in_progress: { globalStatus: "in_progress" },
  interview: { globalStatus: "interview" },
  accepted: { globalStatus: "accepted" },
  rejected: { globalStatus: "rejected" },
  multiple: { applicationsCount: { $gte: 2 } },
  overdue: { "taskStats.overdue": { $gt: 0 } },
};

const SORTS = {
  recent: { lastActivityAt: -1, _id: 1 },
  name: { "student.name": 1, _id: 1 },
  applications: { applicationsCount: -1, lastActivityAt: -1, _id: 1 },
};

const sumIf = (condition) => ({ $sum: { $cond: [condition, 1, 0] } });

/* ── GET /api/admin/candidates/stats ─────────────────────────────────────── */
// « Entretien programmé » = proposé/confirmé ET date à venir : un entretien
// dépassé non encore basculé en « terminé » n'est donc jamais compté.
export const getCandidateStats = asyncHandler(async (req, res) => {
  // Tous les indicateurs portent sur le même ensemble (étudiants candidats
  // existants) que la liste et ses filtres : aucun écart possible entre eux.
  const now = new Date();
  const [totals = {}] = await Application.aggregate([
    ...candidateStages(now, { withOffers: false }),
    {
      $group: {
        _id: null,
        totalStudents: { $sum: 1 },
        totalApplications: { $sum: "$applicationsCount" },
        studentsToContact: sumIf({ $eq: ["$globalStatus", "new"] }),
        scheduledInterviews: { $sum: "$interviewStats.upcoming" },
        pendingTasks: { $sum: "$taskStats.open" },
        overdueTasks: { $sum: "$taskStats.overdue" },
      },
    },
  ]);
  res.json({
    stats: {
      totalStudents: totals.totalStudents || 0,
      totalApplications: totals.totalApplications || 0,
      studentsToContact: totals.studentsToContact || 0,
      scheduledInterviews: totals.scheduledInterviews || 0,
      pendingTasks: totals.pendingTasks || 0,
      overdueTasks: totals.overdueTasks || 0,
    },
  });
});

/* ── GET /api/admin/candidates ───────────────────────────────────────────── */
export const listCandidates = asyncHandler(async (req, res) => {
  const { search, filter, sort, page, limit } = parseListQuery(req.query);
  const now = new Date();

  // Les offres ne sont jointes avant la pagination que si la recherche en a
  // besoin ; sinon uniquement pour la page affichée (10 à 50 lignes).
  const pipeline = candidateStages(now, { withOffers: Boolean(search) });
  if (search) {
    const rx = new RegExp(escapeRegex(search), "i");
    pipeline.push({ $match: { $or: [{ "student.name": rx }, { "student.email": rx }, { "offerDocs.title": rx }, { "offerDocs.companyName": rx }] } });
  }
  const filterStages = FILTER_MATCH[filter] ? [{ $match: FILTER_MATCH[filter] }] : [];
  pipeline.push({
    $facet: {
      counts: [{
        $group: {
          _id: null,
          all: { $sum: 1 },
          new: sumIf({ $eq: ["$globalStatus", "new"] }),
          in_progress: sumIf({ $eq: ["$globalStatus", "in_progress"] }),
          interview: sumIf({ $eq: ["$globalStatus", "interview"] }),
          accepted: sumIf({ $eq: ["$globalStatus", "accepted"] }),
          rejected: sumIf({ $eq: ["$globalStatus", "rejected"] }),
          multiple: sumIf({ $gte: ["$applicationsCount", 2] }),
          overdue: sumIf({ $gt: ["$taskStats.overdue", 0] }),
        },
      }],
      total: [...filterStages, { $count: "value" }],
      items: [
        ...filterStages,
        { $sort: SORTS[sort] },
        { $skip: (page - 1) * limit },
        { $limit: limit },
        ...(search ? [] : offerLookupStages()),
        {
          $project: {
            student: 1, applicationsCount: 1, pendingCount: 1, inReviewCount: 1, acceptedCount: 1, refusedCount: 1,
            apps: 1, offerDocs: 1, firstAppliedAt: 1, lastActivityAt: 1, globalStatus: 1, taskStats: 1, interviewStats: 1,
          },
        },
      ],
    },
  });

  // Tri « Nom » insensible à la casse (et aux accents en français).
  const [result] = await Application.aggregate(pipeline).collation({ locale: "fr", strength: 1 });
  const total = result?.total?.[0]?.value || 0;
  const countsRow = result?.counts?.[0] || {};
  const counts = Object.fromEntries(
    ["all", "new", "in_progress", "interview", "accepted", "rejected", "multiple", "overdue"].map((key) => [key, countsRow[key] || 0]),
  );

  const students = (result?.items || []).map((row) => {
    const offersById = new Map((row.offerDocs || []).map((offer) => [String(offer._id), offer]));
    const offers = [...(row.apps || [])]
      .sort((a, b) => new Date(b.appliedAt) - new Date(a.appliedAt))
      .slice(0, 3)
      .map((app) => {
        const offer = offersById.get(String(app.offerId));
        return {
          applicationId: app.applicationId,
          offerId: app.offerId,
          title: offer?.title || "",
          companyName: offer?.companyName || "",
          status: app.status,
          appliedAt: app.appliedAt,
        };
      });
    return {
      _id: row._id,
      name: row.student.name || "",
      email: row.student.email || "",
      phone: row.student.phone || "",
      avatarUrl: row.student.avatarUrl || "",
      university: row.student.university || "",
      specialty: row.student.specialty || "",
      applicationsCount: row.applicationsCount,
      applicationStatusCounts: {
        "en attente": row.pendingCount,
        "en cours": row.inReviewCount,
        "acceptée": row.acceptedCount,
        "refusée": row.refusedCount,
      },
      offers,
      lastActivityAt: row.lastActivityAt,
      firstAppliedAt: row.firstAppliedAt,
      globalStatus: row.globalStatus,
      tasks: {
        total: row.taskStats.total,
        open: row.taskStats.open,
        overdue: row.taskStats.overdue,
        nextDueAt: row.taskStats.nextDueAt || null,
      },
      upcomingInterviewAt: row.interviewStats.nextAt || null,
    };
  });

  res.json({
    students,
    pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    counts,
  });
});

/* ── Documents d'un dossier ──────────────────────────────────────────────── */
async function isRegularFile(filePath) {
  try {
    const stat = await fs.lstat(filePath);
    return stat.isFile() && !stat.isSymbolicLink();
  } catch {
    return false;
  }
}

function sameStoredFile(urlA, urlB) {
  if (!urlA || !urlB) return false;
  const a = resolveLocalUpload(urlA, UPLOADS_DIR);
  const b = resolveLocalUpload(urlB, UPLOADS_DIR);
  if (a && b) return a.name === b.name;
  return urlA.trim() === urlB.trim();
}

async function describeDocument({ key, kind, source, applicationId = null, offerTitle = "", url, fileName }) {
  const local = resolveLocalUpload(url, UPLOADS_DIR);
  const available = local ? await isRegularFile(local.filePath) : false;
  const extension = local?.extension || fileExtension(fileName) || fileExtension(url);
  return {
    key,
    kind,
    source,
    applicationId,
    offerTitle,
    fileName: ensureExtension(fileName, extension),
    extension,
    available,
    externalUrl: local ? "" : safeHttpUrl(url),
  };
}

function applicationCvName(studentName, offerTitle) {
  return ["CV", studentName, offerTitle].filter(Boolean).join(" - ");
}

async function buildDocuments(student, applications) {
  const profileUrl = student.cv?.fileUrl || "";
  const jobs = [];
  if (profileUrl || student.cv?.fileName) {
    jobs.push(describeDocument({
      key: "profile-cv", kind: "cv", source: "profile", url: profileUrl,
      fileName: student.cv?.fileName || "CV",
    }));
  }
  for (const app of applications) {
    const offerTitle = app.offerId?.title || "";
    if (app.cvUrl && !sameStoredFile(app.cvUrl, profileUrl)) {
      jobs.push(describeDocument({
        key: `application-cv:${app._id}`, kind: "cv", source: "application", applicationId: app._id,
        offerTitle, url: app.cvUrl, fileName: applicationCvName(student.name, offerTitle),
      }));
    }
  }
  for (const app of applications) {
    if (app.coverLetterUrl) {
      jobs.push(describeDocument({
        key: `cover-letter:${app._id}`, kind: "coverLetter", source: "application", applicationId: app._id,
        offerTitle: app.offerId?.title || "", url: app.coverLetterUrl, fileName: app.coverLetterName || "Lettre de motivation",
      }));
    }
  }
  return Promise.all(jobs);
}

function buildSystemEvents(applications, interviewsByApp) {
  const events = [];
  for (const app of applications) {
    const offerTitle = app.offerId?.title || "";
    events.push({
      id: `application_received:${app._id}`,
      kind: "application_received",
      date: app.createdAt,
      applicationId: app._id,
      offerTitle,
      meta: { status: app.status },
    });
    for (const interview of interviewsByApp.get(String(app._id)) || []) {
      const meta = {
        scheduledAt: interview.scheduledAt,
        mode: interview.mode,
        location: interview.location || "",
        interviewStatus: interview.status,
        proposedBy: interview.companyId?.name || "",
      };
      events.push({ id: `interview_proposed:${interview._id}`, kind: "interview_proposed", date: interview.createdAt, applicationId: app._id, offerTitle, meta });
      if (interview.status !== "annulé") {
        events.push({ id: `interview_scheduled:${interview._id}`, kind: "interview_scheduled", date: interview.scheduledAt, applicationId: app._id, offerTitle, meta });
      }
    }
    if (["acceptée", "refusée"].includes(app.status)) {
      events.push({
        id: `application_decision:${app._id}`,
        kind: "application_decision",
        date: app.updatedAt,
        applicationId: app._id,
        offerTitle,
        meta: { status: app.status },
      });
    }
  }
  return events.sort((a, b) => new Date(b.date) - new Date(a.date));
}

/* ── GET /api/admin/candidates/:studentId ────────────────────────────────── */
export const getCandidateDossier = asyncHandler(async (req, res) => {
  const { studentId } = req.params;
  const student = await User.findOne({ _id: studentId, role: "étudiant" }).select(STUDENT_FIELDS).lean();
  if (!student) throw httpError(404, "Dossier étudiant introuvable.");

  await autoCompletePastInterviews({ studentId: student._id });
  const now = new Date();
  const [applications, interviews, tasks] = await Promise.all([
    Application.find({ studentId }).populate("offerId", OFFER_FIELDS).sort({ createdAt: -1 }).lean(),
    Interview.find({ studentId }).populate("companyId", "name").sort({ scheduledAt: 1 }).lean(),
    FollowUpTask.find({ studentId }).select("applicationId status dueDate updatedAt").lean(),
  ]);
  if (!applications.length) throw httpError(404, "Dossier étudiant introuvable.");

  const interviewsByApp = new Map();
  for (const interview of interviews) {
    const key = toId(interview.applicationId);
    if (!interviewsByApp.has(key)) interviewsByApp.set(key, []);
    interviewsByApp.get(key).push(interview);
  }
  const tasksByApp = new Map();
  for (const task of tasks) {
    const key = toId(task.applicationId);
    if (!key) continue;
    if (!tasksByApp.has(key)) tasksByApp.set(key, []);
    tasksByApp.get(key).push(task);
  }

  const profileCvUrl = student.cv?.fileUrl || "";
  const serializedApplications = applications.map((app) => {
    const appInterviews = interviewsByApp.get(String(app._id)) || [];
    const appTasks = tasksByApp.get(String(app._id)) || [];
    const offer = app.offerId && app.offerId._id ? app.offerId : null;
    return {
      _id: app._id,
      status: app.status,
      createdAt: app.createdAt,
      updatedAt: app.updatedAt,
      note: app.note || "",
      coverLetter: app.coverLetter || "",
      coverLetterName: app.coverLetterName || "",
      hasCoverLetterFile: Boolean(app.coverLetterUrl),
      cvSource: app.cvUrl ? (sameStoredFile(app.cvUrl, profileCvUrl) ? "profile" : "application") : "none",
      offer: offer ? {
        _id: offer._id,
        title: offer.title || "",
        companyName: offer.companyName || "",
        location: offer.location || "",
        type: offer.type || "",
        domain: offer.domain || "",
        duration: offer.duration || "",
        description: truncateText(offer.description, 600),
        deadline: offer.deadline || null,
        isActive: offer.isActive !== false,
      } : null,
      interviews: appInterviews.map((interview) => ({
        _id: interview._id,
        scheduledAt: interview.scheduledAt,
        mode: interview.mode,
        location: interview.location || "",
        status: interview.status,
        notes: interview.notes || "",
        createdAt: interview.createdAt,
        proposedBy: person(interview.companyId),
      })),
      lastActivityAt: maxDate(app.updatedAt, ...appInterviews.map((i) => i.updatedAt), ...appTasks.map((t) => t.updatedAt)),
      taskCount: appTasks.length,
    };
  });

  const counts = {
    applicationsCount: applications.length,
    acceptedCount: applications.filter((a) => a.status === "acceptée").length,
    refusedCount: applications.filter((a) => a.status === "refusée").length,
    inReviewCount: applications.filter((a) => a.status === "en cours").length,
    upcomingInterviews: interviews.filter((i) => UPCOMING_INTERVIEW_STATUSES.includes(i.status) && new Date(i.scheduledAt) >= now).length,
    tasksTotal: tasks.length,
  };

  const documents = await buildDocuments(student, applications);
  const { cv: _cv, role: _role, ...publicStudent } = student;

  res.json({
    student: publicStudent,
    globalStatus: computeGlobalStatus(counts),
    applications: serializedApplications,
    documents,
    systemEvents: buildSystemEvents(applications, interviewsByApp),
    taskSummary: summarizeTasks(tasks, now),
  });
});

/* ── GET /api/admin/candidates/:studentId/document?key=&disposition= ─────── */
export const getCandidateDocument = asyncHandler(async (req, res, next) => {
  const { studentId } = req.params;
  const parsed = parseDocumentKey(typeof req.query.key === "string" ? req.query.key : "");
  if (!parsed) throw httpError(400, "Document demandé invalide.");
  const disposition = req.query.disposition === "attachment" ? "attachment" : "inline";
  const student = await loadCandidateOr404(studentId, "name role cv");

  let url = "";
  let fileName = "";
  if (parsed.source === "profile") {
    url = student.cv?.fileUrl || "";
    fileName = student.cv?.fileName || "CV";
  } else {
    const app = await Application.findOne({ _id: parsed.applicationId, studentId })
      .select("cvUrl coverLetterUrl coverLetterName offerId").populate("offerId", "title").lean();
    if (!app) throw httpError(404, "Candidature introuvable pour cet étudiant.", "DOCUMENT_UNAVAILABLE");
    if (parsed.kind === "cv") {
      url = app.cvUrl || "";
      fileName = applicationCvName(student.name, app.offerId?.title || "");
    } else {
      url = app.coverLetterUrl || "";
      fileName = app.coverLetterName || "Lettre de motivation";
    }
  }

  const local = resolveLocalUpload(url, UPLOADS_DIR);
  if (!local || !(await isRegularFile(local.filePath))) {
    throw httpError(404, "Ce document n'est pas disponible sur le serveur.", "DOCUMENT_UNAVAILABLE");
  }

  res.setHeader("Content-Type", local.contentType);
  res.setHeader("Content-Disposition", buildContentDisposition(disposition, ensureExtension(fileName, local.extension)));
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.sendFile(local.filePath, { dotfiles: "deny" }, (error) => {
    if (!error) return;
    // Jamais de chemin serveur dans la réponse : l'erreur brute reste dans les logs.
    console.error("[candidates] Envoi du document impossible", { code: error.code, message: error.message });
    if (!res.headersSent) {
      const missing = error.code === "ENOENT" || error.statusCode === 404 || error.status === 404;
      next(httpError(missing ? 404 : 500, "Ce document n'est pas disponible sur le serveur.", "DOCUMENT_UNAVAILABLE"));
    }
  });
});

/* ── GET /api/admin/candidates/:studentId/tasks ──────────────────────────── */
export const getStudentTasks = asyncHandler(async (req, res) => {
  const { studentId } = req.params;
  await loadCandidateOr404(studentId, "_id role");
  const { status, type, applicationId, overdue } = parseTaskQuery(req.query);
  const now = new Date();

  const query = { studentId };
  if (status) query.status = status;
  if (type) query.type = type;
  if (applicationId === "none") query.applicationId = null;
  else if (applicationId) query.applicationId = applicationId;
  if (overdue) {
    if (status === "completed") query._id = null;
    else if (!status) query.status = { $in: OPEN_TASK_STATUSES };
    query.dueDate = { $ne: null, $lt: now };
  }

  const [tasks, summary] = await Promise.all([
    FollowUpTask.find(query).populate(TASK_POPULATE).sort({ activityDate: -1, createdAt: -1 }).limit(500).lean(),
    studentTaskSummary(studentId, now),
  ]);
  res.json({ tasks: tasks.map((task) => serializeTask(task, now)), summary });
});

/* ── POST /api/admin/candidates/:studentId/tasks ─────────────────────────── */
export const createStudentTask = asyncHandler(async (req, res) => {
  const { studentId } = req.params;
  await loadCandidateOr404(studentId, "_id role");
  const now = new Date();
  const { updates, clientRequestId } = validateTaskInput(req.body, { partial: false, now });
  await assertApplicationBelongs(updates.applicationId, studentId);

  const replyDuplicate = async (existing) => {
    if (String(existing.studentId) !== String(studentId)) {
      throw httpError(409, "Cette requête a déjà été utilisée pour un autre dossier. Actualisez la page.");
    }
    res.status(200).json({ task: await loadSerializedTask(existing._id, now), summary: await studentTaskSummary(studentId, now), duplicate: true });
  };

  if (clientRequestId) {
    const existing = await FollowUpTask.findOne({ createdBy: req.user._id, clientRequestId }).select("_id studentId").lean();
    if (existing) return replyDuplicate(existing);
  }

  const doc = {
    ...updates,
    studentId,
    createdBy: req.user._id,
    ...(updates.status === "completed" ? { completedAt: now, completedBy: req.user._id } : {}),
    ...(clientRequestId ? { clientRequestId } : {}),
  };

  let created;
  try {
    created = await FollowUpTask.create(doc);
  } catch (error) {
    if (error?.code === 11000 && clientRequestId) {
      const existing = await FollowUpTask.findOne({ createdBy: req.user._id, clientRequestId }).select("_id studentId").lean();
      if (existing) return replyDuplicate(existing);
    }
    throw error;
  }

  res.status(201).json({ task: await loadSerializedTask(created._id, now), summary: await studentTaskSummary(studentId, now) });
});

/* ── PATCH /api/admin/candidates/:studentId/tasks/:taskId ────────────────── */
export const updateStudentTask = asyncHandler(async (req, res) => {
  const { studentId, taskId } = req.params;
  await loadCandidateOr404(studentId, "_id role");
  const existing = await FollowUpTask.findOne({ _id: taskId, studentId }).lean();
  if (!existing) throw httpError(404, "Tâche introuvable dans ce dossier.");

  const now = new Date();
  const { updates, expectedUpdatedAt } = validateTaskInput(req.body, { partial: true, existing, now });
  const conflict = () => httpError(409, "Cette tâche a été modifiée par un autre administrateur. Actualisez.", "TASK_CONFLICT");
  if (expectedUpdatedAt && new Date(existing.updatedAt).getTime() !== expectedUpdatedAt.getTime()) throw conflict();

  // Aucun changement réel : on ne réécrit rien (updatedBy inchangé).
  const changed = Object.entries(updates).filter(([key, value]) => !sameValue(value, existing[key]));
  if (!changed.length) {
    return res.json({ task: await loadSerializedTask(existing._id, now), summary: await studentTaskSummary(studentId, now) });
  }

  if ("applicationId" in updates) await assertApplicationBelongs(updates.applicationId, studentId);

  const set = { ...Object.fromEntries(changed), updatedBy: req.user._id };
  const finalStatus = set.status ?? existing.status;
  const leavingNote = existing.type === "note" && (set.type ?? existing.type) !== "note";
  if (finalStatus === "completed" && (existing.status !== "completed" || leavingNote)) {
    set.completedAt = now;
    set.completedBy = req.user._id;
  } else if (finalStatus !== "completed" && existing.status === "completed") {
    set.completedAt = null;
    set.completedBy = null;
  }

  // Filtre sur updatedAt : deux écritures concurrentes ne s'écrasent jamais.
  const updated = await FollowUpTask.findOneAndUpdate(
    { _id: existing._id, studentId, updatedAt: existing.updatedAt },
    { $set: set },
    { returnDocument: "after", runValidators: true },
  );
  if (!updated) throw conflict();

  res.json({ task: await loadSerializedTask(updated._id, now), summary: await studentTaskSummary(studentId, now) });
});

/* ── DELETE /api/admin/candidates/:studentId/tasks/:taskId ───────────────── */
export const deleteStudentTask = asyncHandler(async (req, res) => {
  const { studentId, taskId } = req.params;
  await loadCandidateOr404(studentId, "_id role");
  const task = await FollowUpTask.findOne({ _id: taskId, studentId }).select("createdBy").lean();
  if (!task) throw httpError(404, "Tâche introuvable dans ce dossier.");
  // Seul le créateur supprime sa tâche — sauf si son compte administrateur
  // n'existe plus : la tâche ne doit pas devenir impossible à retirer.
  if (String(task.createdBy) !== String(req.user._id) && (await User.exists({ _id: task.createdBy, role: "admin" }))) {
    throw httpError(403, "Seul l'administrateur qui a créé cette tâche peut la supprimer.", "TASK_DELETE_FORBIDDEN");
  }
  await FollowUpTask.deleteOne({ _id: task._id, studentId });
  res.json({ message: "Tâche supprimée.", taskId: task._id, summary: await studentTaskSummary(studentId) });
});
