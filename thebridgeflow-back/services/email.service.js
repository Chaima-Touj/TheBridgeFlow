import nodemailer from "nodemailer";
import User from "../models/users.model.js";
import { normalizeTunisianPhone } from "../utils/tunisianPhone.js";
import {
  EMAIL_BRAND,
  brandHtml,
  ctaButton,
  detailsTable,
  escapeHtml,
  featureCards,
  getEmailSender,
  greeting,
  heroActionCard,
  heroFacts,
  heroHighlight,
  heroSteps,
  htmlToPlainText,
  infoBox,
  kicker,
  neutralBox,
  note,
  paragraph,
  quoteBox,
  renderEmail,
  safeUrl,
  sectionTitle,
  statusPill,
  strong,
  strongBlue,
  strongWhite,
} from "./emailLayout.js";

// ─── Configuration SMTP ────────────────────────────────────────────────────────
// Serveur configurable par .env (SMTP_HOST, SMTP_PORT, SMTP_SECURE) afin de
// pouvoir passer à un service transactionnel (ex. Brevo :
// smtp-relay.brevo.com:587) sans modifier le code. Sans ces variables, le
// comportement historique est conservé : smtp.gmail.com:465 en SMTPS.
const REQUIRED_ENV = ["SMTP_USER", "SMTP_PASS", "EMAIL_FROM"];

const getMissingEnv = () => REQUIRED_ENV.filter((key) => !process.env[key]);

export const getSmtpSettings = (env = process.env) => {
  const host = (env.SMTP_HOST || "").trim() || "smtp.gmail.com";
  const parsedPort = Number.parseInt(env.SMTP_PORT, 10);
  const port = Number.isInteger(parsedPort) && parsedPort > 0 ? parsedPort : 465;
  // 465 = TLS implicite (SMTPS) ; 587 / 2525 = STARTTLS (secure:false, TLS exigé).
  const secureSetting = String(env.SMTP_SECURE || "").trim().toLowerCase();
  const secure = secureSetting === "true" ? true : secureSetting === "false" ? false : port === 465;
  return { host, port, secure, requireTLS: !secure };
};

// ─── Transporter Nodemailer singleton ──────────────────────────────────────────
let _transporter = null;

const getTransporter = () => {
  if (_transporter) return _transporter;

  const { host, port, secure, requireTLS } = getSmtpSettings();
  console.log(`📨 [email] Initialisation du transporter Nodemailer — ${host}:${port} (${secure ? "SMTPS" : "STARTTLS"})`);

  _transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    requireTLS,
    family: 4, // le réseau sortant de Render ne supporte pas l'IPv6 (ENETUNREACH sur l'IP AAAA de Gmail)
    connectionTimeout: 10000,
    greetingTimeout:   10000,
    socketTimeout:     15000,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  return _transporter;
};

// Vérifie que la connexion SMTP Gmail est valide — à appeler au démarrage du
// serveur pour un diagnostic immédiat (n'empêche pas le serveur de démarrer si ça échoue).
export const verifyEmailConfig = async () => {
  const missing = getMissingEnv();
  if (missing.length) {
    console.error(`❌ [email] Vérification SMTP ignorée — variable(s) manquante(s) : ${missing.join(", ")}`);
    return false;
  }

  try {
    const transporter = getTransporter();
    await transporter.verify();
    console.log(`✅ [email] Connexion SMTP vérifiée — serveur=${getSmtpSettings().host} compte=${process.env.SMTP_USER}`);
    return true;
  } catch (err) {
    console.error(`❌ [email] Échec de la vérification SMTP (${getSmtpSettings().host}) :`, {
      message: err.message,
      code:    err.code,
      stack:   err.stack,
    });
    return false;
  }
};

// ─── Design commun (kit 9antra.tn) ─────────────────────────────────
// Mise en page, composants et version texte : voir services/emailLayout.js.
const BRAND = EMAIL_BRAND;
const TIMEZONE = "Africa/Tunis";

const clientUrl = (path = "") => `${(process.env.CLIENT_URL || "http://localhost:5173").replace(/\/+$/, "")}${path}`;

const LONG_DATE = { weekday: "long", day: "numeric", month: "long", year: "numeric" };
const SHORT_DATE = { day: "numeric", month: "long", year: "numeric" };
const TIME = { hour: "2-digit", minute: "2-digit" };

/* Dates toujours à l'heure de Tunis (le serveur peut tourner en UTC) ; une
   date absente ou invalide donne "" (la ligne correspondante est masquée). */
const formatDate = (value, options, { locale = "fr-FR", timeZone = TIMEZONE } = {}) => {
  if (value === null || value === undefined || value === "") return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  try {
    return new Intl.DateTimeFormat(locale, { timeZone, ...options }).format(date);
  } catch {
    return new Intl.DateTimeFormat(locale, { timeZone: TIMEZONE, ...options }).format(date);
  }
};

const capitalize = (value) => {
  const text = String(value ?? "");
  return text.charAt(0).toUpperCase() + text.slice(1);
};

// « Mardi 15 décembre 2026 à 10:00 »
const dateAndTime = (value, zone) => {
  const date = formatDate(value, LONG_DATE, zone);
  const time = formatDate(value, TIME, zone);
  return date ? capitalize(time ? `${date} à ${time}` : date) : "";
};

const ROLE_LABELS = { étudiant: "Étudiant", admin: "Administrateur" };
const roleLabelOf = (role) => ROLE_LABELS[role] || String(role || "Utilisateur");

const mailtoLink = (email) => (email
  ? `<a href="mailto:${encodeURIComponent(email)}" style="color:#1D4ED8; text-decoration:none; font-weight:700;">${escapeHtml(email)}</a>`
  : "");

const isWebUrl = (value) => Boolean(safeUrl(value)) && /^https?:/i.test(String(value).trim());
// Lien cliquable si la valeur est une adresse web, sinon texte simple.
const linkOrText = (value) => (isWebUrl(value)
  ? `<a href="${escapeHtml(String(value).trim())}" style="color:#1D4ED8; text-decoration:none; font-weight:700; word-break:break-all;">${escapeHtml(value)}</a>`
  : escapeHtml(value));

const contactRows = ({ name, email, phone }) => [
  { label: "Nom", value: name || "Non renseigné" },
  { label: "Email", valueHtml: mailtoLink(email) || "Non renseigné" },
  { label: "Téléphone", value: phone || "Non renseigné" },
];

const studentContactSection = ({ studentName, studentEmail, studentPhone } = {}) =>
  detailsTable(contactRows({ name: studentName, email: studentEmail, phone: studentPhone }), { title: "Coordonnées de l'étudiant" });

const formatStudentPhone = (phone) => {
  const normalizedPhone = normalizeTunisianPhone(phone);
  return normalizedPhone ? normalizedPhone.replace(/^\+216\s*/, "") : "Non renseigné";
};

const studentInfoSection = ({ studentName, studentEmail, studentPhone } = {}) =>
  detailsTable(contactRows({ name: studentName, email: studentEmail, phone: formatStudentPhone(studentPhone) }), { title: "Informations étudiant" });

const joinHtml = (...parts) => parts.filter(Boolean).join("");

// ─── Templates ────────────────────────────────────────────────────────────────

// 1. Bienvenue après inscription
const WELCOME_FEATURES = {
  étudiant: [
    { title: "Stages", text: "Parcourez les offres et postulez en un clic" },
    { title: "Suivi", text: "Suivez chaque étape de vos candidatures" },
    { title: "Échanges", text: "Contactez directement les entreprises" },
  ],
  admin: [
    { title: "Offres", text: "Gérez les offres et les candidatures" },
    { title: "Entretiens", text: "Planifiez et suivez les entretiens" },
    { title: "Formations", text: "Gérez les formations et les comptes" },
  ],
};

const welcomeTemplate = ({ name, role }) => {
  const roleLabel = roleLabelOf(role);
  return {
    subject: `Bienvenue sur ${BRAND} ! 🎉`,
    html: renderEmail({
      title: `Bienvenue sur ${BRAND}`,
      preheader: `Votre compte ${roleLabel} sur ${BRAND} est prêt.`,
      hero: {
        badge: "Compte créé",
        title: name ? `Bienvenue, ${name} !` : "Bienvenue !",
        subtitleHtml: `Votre compte ${strongWhite(roleLabel)} a été créé avec succès.`,
      },
      bodyHtml: joinHtml(
        paragraph(`${strongBlue(BRAND)} est votre plateforme tout-en-un pour gérer vos stages de A à Z. Découvrez toutes les fonctionnalités disponibles pour votre profil ${strong(roleLabel)}.`),
        featureCards(WELCOME_FEATURES[role] || WELCOME_FEATURES.étudiant),
        ctaButton("Accéder à mon espace", clientUrl("/login")),
      ),
    }),
  };
};

// 2. Candidature envoyée (à l'étudiant) — kit « Candidature envoyée »
const applicationSentTemplate = ({ studentName, offerTitle, companyName }) => ({
  subject: `Candidature envoyée — ${offerTitle} 📩`,
  html: renderEmail({
    title: "Candidature envoyée",
    preheader: `Votre candidature a bien été reçue sur ${BRAND}.`,
    hero: {
      badge: "Confirmation",
      title: "Candidature envoyée !",
      subtitleHtml: "Votre dossier a bien été transmis au recruteur.",
      extraHtml: heroSteps([{ label: "Envoyée", done: true }, { label: "Étude profil" }, { label: "Entretien" }]),
    },
    bodyHtml: joinHtml(
      greeting(studentName || "Étudiant", "votre candidature a été transmise avec succès. L'entreprise vous contactera directement si votre profil correspond à ses attentes."),
      detailsTable([
        { label: "Offre", value: offerTitle },
        { label: "Entreprise", value: companyName },
        { label: "Statut", valueHtml: statusPill("En attente") },
        { label: "Date", value: formatDate(new Date(), SHORT_DATE) },
      ]),
      infoBox("<strong>Conseil :</strong> Préparez-vous en avance en relisant l'offre, en préparant vos projets GitHub et en vous renseignant sur l'entreprise."),
      ctaButton("Voir mes candidatures", clientUrl("/dashboard/student/applications")),
    ),
  }),
});

// 3. Nouvelle candidature reçue (à l'entreprise)
const applicationReceivedTemplate = ({ companyName, studentName, studentEmail, studentPhone, offerTitle }) => ({
  subject: `Nouvelle candidature — ${offerTitle} 👤`,
  html: renderEmail({
    title: "Nouvelle candidature reçue",
    preheader: `${studentName || "Un étudiant"} a postulé à l'offre ${offerTitle || ""}.`,
    hero: {
      badge: "Nouvelle candidature",
      title: "Nouvelle candidature reçue",
      subtitleHtml: "Un étudiant a postulé à l'une de vos offres.",
    },
    bodyHtml: joinHtml(
      greeting(companyName || "Administrateur", `un nouvel étudiant vient de postuler à votre offre ${strongBlue(offerTitle)}. Consultez sa candidature dès maintenant.`),
      detailsTable([
        { label: "Offre", value: offerTitle },
        { label: "Candidat", value: studentName },
        { label: "Reçue le", value: formatDate(new Date(), SHORT_DATE) },
        { label: "Statut", valueHtml: statusPill("Nouvelle") },
      ]),
      studentContactSection({ studentName, studentEmail, studentPhone }),
      ctaButton("Voir la candidature", clientUrl("/dashboard/admin/candidatures")),
    ),
  }),
});

// 4. Statut de candidature mis à jour (à l'étudiant)
const APPLICATION_STATUSES = {
  "acceptée": {
    icon: "🎉", tone: "green", title: "Candidature acceptée !",
    subtitle: "Félicitations, votre profil a retenu l'attention de l'entreprise.",
    message: "votre candidature a été acceptée. L'entreprise vous contactera prochainement pour les prochaines étapes.",
    steps: [{ label: "Envoyée", done: true }, { label: "Étude profil", done: true }, { label: "Entretien" }],
  },
  "refusée": {
    icon: "😔", tone: "red", title: "Candidature non retenue",
    subtitle: "Ne vous découragez pas, de nouvelles offres sont publiées régulièrement.",
    message: "nous sommes désolés, votre candidature n'a pas été retenue cette fois. Ne vous découragez pas, continuez à postuler !",
  },
  "en cours": {
    icon: "🔍", tone: "amber", title: "Candidature en cours d'examen",
    subtitle: "L'entreprise étudie actuellement votre profil.",
    message: "bonne nouvelle ! Votre candidature est en cours d'examen par l'entreprise. Restez disponible pour un éventuel contact.",
    steps: [{ label: "Envoyée", done: true }, { label: "Étude profil" }, { label: "Entretien" }],
  },
};

const applicationStatusTemplate = ({ studentName, offerTitle, companyName, status }) => {
  const cfg = APPLICATION_STATUSES[status] || APPLICATION_STATUSES["en cours"];
  return {
    subject: `Candidature ${status} — ${offerTitle} ${cfg.icon}`,
    html: renderEmail({
      title: `Candidature ${status}`,
      preheader: `${cfg.title} — ${offerTitle || ""}`,
      hero: {
        badge: "Suivi de candidature",
        title: cfg.title,
        subtitleHtml: escapeHtml(cfg.subtitle),
        extraHtml: cfg.steps ? heroSteps(cfg.steps) : "",
      },
      bodyHtml: joinHtml(
        greeting(studentName || "Étudiant", escapeHtml(cfg.message)),
        detailsTable([
          { label: "Offre", value: offerTitle },
          { label: "Entreprise", value: companyName },
          { label: "Nouveau statut", valueHtml: statusPill(capitalize(status), cfg.tone) },
        ]),
        ctaButton("Voir mes candidatures", clientUrl("/dashboard/student/applications")),
      ),
    }),
  };
};

// 5. Entretien proposé (à l'étudiant) — kit « Entretien proposé »
const interviewModeLabel = (mode) => (String(mode || "").toLowerCase() === "présentiel" ? "Présentiel" : "En ligne");

const interviewProposedTemplate = ({ studentName, companyName, offerTitle, scheduledAt, mode, location }) => {
  const company = companyName || BRAND;
  const modeLabel = interviewModeLabel(mode);
  const place = String(location || "").trim();
  return {
    subject: `Entretien proposé — ${offerTitle} 📅`,
    html: renderEmail({
      title: "Entretien proposé",
      preheader: `${company} souhaite vous rencontrer — confirmez votre créneau sur ${BRAND}.`,
      hero: {
        badge: "Proposition d'entretien",
        title: "Entretien proposé !",
        subtitleHtml: `${strongWhite(company)} souhaite vous rencontrer.`,
        extraHtml: heroHighlight({
          label: "Date & Heure proposées",
          value: dateAndTime(scheduledAt),
          // Un lien de visio est trop long pour la pastille : il reste dans le tableau.
          pill: place && !isWebUrl(place) ? [modeLabel, place] : modeLabel,
        }),
      },
      bodyHtml: joinHtml(
        greeting(studentName || "Étudiant", `vous avez reçu une proposition d'entretien de la part de ${strongBlue(company)}. Connectez-vous pour confirmer ou refuser ce créneau.`),
        detailsTable([
          { label: "Entreprise", value: company },
          { label: "Offre", value: offerTitle },
          { label: "Mode", value: modeLabel },
          place ? { label: "Lieu / Lien", valueHtml: linkOrText(place) } : null,
        ]),
        ctaButton("Confirmer l'entretien", clientUrl("/dashboard/student/interviews")),
        note(`Un empêchement ? Gérez votre réponse directement depuis votre espace <strong>${BRAND}</strong>.`),
      ),
    }),
  };
};

// 6. Statut entretien mis à jour
const interviewStatusTemplate = ({
  recipientName,
  status,
  offerTitle,
  scheduledAt,
  recipientRole,
  studentName,
  studentEmail,
  studentPhone,
  mode,
  location,
  link = "/dashboard/student/interviews",
  linkLabel = "Voir mes entretiens",
}) => {
  const isAdmin = recipientRole === "admin";
  const configs = {
    "confirmé": {
      icon: "✅", tone: "green", title: "Entretien confirmé !",
      message: isAdmin
        ? "l'entretien a été confirmé par l'étudiant. Consultez la plateforme pour plus de détails."
        : "l'entretien a été confirmé. Préparez-vous bien !",
    },
    "annulé": { icon: "❌", tone: "red", title: "Entretien annulé", message: "l'entretien a été annulé. Consultez la plateforme pour plus d'informations." },
    "terminé": { icon: "🏁", tone: "violet", title: "Entretien terminé", message: "l'entretien est maintenant marqué comme terminé." },
  };
  const cfg = configs[status] || { icon: "📅", tone: "blue", title: "Mise à jour entretien", message: `le statut de votre entretien est maintenant : ${status}.` };
  const place = String(location || "").trim();

  return {
    subject: `Entretien ${status} — ${offerTitle} ${cfg.icon}`,
    html: renderEmail({
      title: `Entretien ${status}`,
      preheader: `${cfg.title} — ${offerTitle || ""}`,
      hero: {
        badge: "Suivi d'entretien",
        title: cfg.title,
        subtitleHtml: offerTitle ? `Offre : ${strongWhite(offerTitle)}` : "",
        extraHtml: heroHighlight({
          label: "Date & heure prévues",
          value: dateAndTime(scheduledAt),
          pill: mode ? interviewModeLabel(mode) : "",
        }),
      },
      bodyHtml: joinHtml(
        greeting(recipientName || "Étudiant", escapeHtml(cfg.message)),
        isAdmin ? studentInfoSection({ studentName, studentEmail, studentPhone }) : "",
        detailsTable([
          { label: "Offre", value: offerTitle },
          { label: "Date prévue", value: capitalize(formatDate(scheduledAt, LONG_DATE)) },
          { label: "Heure prévue", value: formatDate(scheduledAt, TIME) },
          isAdmin && mode ? { label: "Mode", value: interviewModeLabel(mode) } : null,
          isAdmin && place ? { label: "Lieu / Lien", valueHtml: linkOrText(place) } : null,
          { label: "Nouveau statut", valueHtml: statusPill(capitalize(status), cfg.tone) },
        ]),
        ctaButton(linkLabel, clientUrl(link)),
      ),
    }),
  };
};

// 7. Nouvelle demande / inscription à une formation (à l'administration)
const enrollmentRequestReceivedTemplate = ({ adminName, studentName, studentEmail, studentPhone, formationTitle, mode }) => {
  const directEnrollment = mode === "Inscription directe";
  const cta = directEnrollment
    ? { label: "Voir les inscriptions", path: "/dashboard/admin/inscriptions" }
    : { label: "Traiter la demande", path: "/dashboard/admin/demandes" };
  const title = directEnrollment ? "Nouvelle inscription à une formation" : "Nouvelle demande de formation";
  return {
    subject: `${directEnrollment ? "Nouvelle inscription" : "Nouvelle demande d'inscription"} — ${formationTitle}`,
    html: renderEmail({
      title: directEnrollment ? "Nouvelle inscription" : "Nouvelle demande d'inscription",
      preheader: `${studentName || "Un étudiant"} — ${formationTitle || ""}`,
      hero: {
        badge: "Inscription formation",
        title,
        subtitleHtml: `${strongWhite(studentName || "Un étudiant")} ${directEnrollment ? "s'est inscrit à une formation." : "a demandé son inscription à une formation."}`,
      },
      bodyHtml: joinHtml(
        greeting(adminName || "Administrateur", `${strong(studentName || "Un étudiant")} ${directEnrollment ? "s'est inscrit à" : "a demandé son inscription à"} la formation ${strongBlue(formationTitle)}.`),
        detailsTable([
          { label: "Étudiant", value: studentName },
          { label: "Formation", value: formationTitle },
          { label: "Mode", value: mode },
          { label: "Statut", valueHtml: directEnrollment ? statusPill("Inscrit", "green") : statusPill("En attente de traitement") },
        ]),
        studentContactSection({ studentName, studentEmail, studentPhone }),
        ctaButton(cta.label, clientUrl(cta.path)),
      ),
    }),
  };
};

// 8. Demande d'inscription enregistrée (à l'étudiant) — kit « Demande d'inscription »
const enrollmentRequestSentTemplate = ({ studentName, formationTitle, mode, message }) => ({
  subject: `Demande d'inscription envoyée — ${formationTitle}`,
  html: renderEmail({
    title: "Demande d'inscription enregistrée",
    preheader: `Votre demande d'inscription à la formation ${formationTitle || ""} a bien été enregistrée.`,
    hero: {
      badge: "Inscription Formation",
      title: "Demande d'inscription enregistrée",
      subtitleHtml: "Notre équipe traite votre dossier dans les plus brefs délais.",
      extraHtml: heroSteps([{ label: "Demande reçue", done: true }, { label: "Validation" }, { label: "Démarrage" }]),
    },
    bodyHtml: joinHtml(
      greeting(studentName || "Étudiant", `votre demande d'inscription à la formation ${strongBlue(formationTitle)} a bien été enregistrée.`),
      detailsTable([
        { label: "Formation", value: formationTitle },
        { label: "Mode", value: mode },
        { label: "Statut", valueHtml: statusPill("En attente de traitement") },
        message ? { label: "Votre message", value: message } : null,
      ]),
      infoBox("<strong>Prochaine étape :</strong> Vous recevrez un nouvel email de confirmation dès que notre équipe aura validé votre demande. Pour toute question urgente : <strong>+216 58 840 064</strong>."),
      ctaButton("Accéder à mon espace", clientUrl("/dashboard/student/demandes")),
    ),
  }),
});

// 9. Inscription à une formation mise à jour (acceptée, inscrite, refusée, annulée)
const enrollmentRequestStatusTemplate = ({ studentName, formationTitle, status, link }) => {
  const accepted = status === "acceptée" || status === "inscrite";
  const declined = status === "refusée" || status === "annulée";
  const tone = accepted ? "green" : declined ? "red" : "blue";
  const statusLabel = capitalize(status);
  return {
    subject: `Mise à jour de votre inscription — ${formationTitle}`,
    html: renderEmail({
      title: "Mise à jour de votre inscription",
      preheader: `${formationTitle || "Formation"} : ${statusLabel}`,
      hero: {
        badge: "Inscription Formation",
        title: accepted ? "Inscription confirmée" : "Mise à jour de votre demande",
        subtitleHtml: `Formation : ${strongWhite(formationTitle)}`,
        extraHtml: accepted
          ? heroSteps([{ label: "Demande reçue", done: true }, { label: "Validation", done: true }, { label: "Démarrage" }])
          : "",
      },
      bodyHtml: joinHtml(
        greeting(studentName || "Étudiant", `votre demande concernant la formation ${strongBlue(formationTitle)} a été mise à jour.`),
        detailsTable([
          { label: "Formation", value: formationTitle },
          { label: "Statut", valueHtml: statusPill(statusLabel, tone) },
        ]),
        accepted ? infoBox("<strong>Prochaine étape :</strong> Retrouvez votre formation et toutes ses informations depuis votre espace étudiant.") : "",
        ctaButton("Voir mes formations", clientUrl(link || "/dashboard/student/demandes")),
      ),
    }),
  };
};

// ─── Événements ───────────────────────────────────────────────────────────────
const EVENT_MODE_LABELS = { onsite: "Présentiel", online: "En ligne", hybrid: "Hybride" };

// Données d'affichage d'un événement (texte brut : l'échappement est fait au rendu).
const eventEmailData = ({ eventTitle, startsAt, timezone, location, description, mode, meetingUrl, eventId } = {}) => {
  const zone = { timeZone: timezone || TIMEZONE };
  return {
    eventTitle: String(eventTitle || "Événement"),
    dateLabel: capitalize(formatDate(startsAt, LONG_DATE, zone)),
    timeLabel: formatDate(startsAt, TIME, zone),
    location: String(location || "").trim(),
    modeLabel: EVENT_MODE_LABELS[mode] || "",
    description: description ? String(description).slice(0, 600) : "",
    meetingUrl: safeUrl(meetingUrl),
    eventUrl: clientUrl(`/events/${encodeURIComponent(eventId ?? "")}`),
  };
};

// « Google Meet », « Zoom », « Microsoft Teams » d'après le lien ("" si inconnu).
const meetingPlatform = (url) => {
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (host === "meet.google.com") return "Google Meet";
    if (host === "zoom.us" || host.endsWith(".zoom.us") || host === "zoom.com" || host.endsWith(".zoom.com")) return "Zoom";
    if (host.endsWith("teams.microsoft.com") || host.endsWith("teams.live.com")) return "Microsoft Teams";
  } catch {
    // lien invalide : plateforme inconnue
  }
  return "";
};

const eventWhen = (details) => [details.dateLabel, details.timeLabel].filter(Boolean).join(" à ");

/* Email d'événement. Avec un lien de réunion (rappel d'un événement en ligne) :
   carte « Session en direct » + bouton « Rejoindre » (kit Workshop Meet) ;
   sinon encadré Date | Lieu dans l'en-tête (kit Nouveauté).
   hero : "auto" | "facts" | "none". introHtml : suite de « Bonjour <Nom>, ». */
const eventEmailBody = ({
  badge,
  heading,
  subtitleHtml,
  liveSubtitleHtml,
  introHtml,
  liveIntroHtml,
  recipientName,
  event,
  studentContact,
  status,
  hero = "auto",
  actionLabel = "Voir l'événement",
  actionUrl,
  preheader,
}) => {
  const details = eventEmailData(event);
  const live = hero !== "none" && Boolean(details.meetingUrl);
  const platform = live ? meetingPlatform(details.meetingUrl) : "";
  const heroExtra = live
    ? heroActionCard({ url: details.meetingUrl, kicker: `Session en direct • ${platform || "En ligne"}`, title: details.eventTitle })
    : hero === "none"
      ? ""
      : heroFacts([
        { label: "Date", value: eventWhen(details) },
        { label: "Lieu", value: details.location || details.modeLabel },
      ]);
  const actions = live
    ? joinHtml(
      ctaButton(platform ? `Rejoindre sur ${platform}` : "Rejoindre la session", details.meetingUrl, { icon: "play" }),
      note(`Lien direct : <a href="${escapeHtml(details.meetingUrl)}" style="color:#1D4ED8; word-break:break-all;">${escapeHtml(details.meetingUrl)}</a>`),
    )
    : ctaButton(actionLabel, actionUrl || details.eventUrl);

  return renderEmail({
    title: heading,
    preheader: preheader || `${heading} — ${details.eventTitle}`,
    hero: {
      badge,
      title: heading,
      subtitleHtml: live && liveSubtitleHtml ? liveSubtitleHtml : subtitleHtml,
      extraHtml: heroExtra,
    },
    bodyHtml: joinHtml(
      greeting(recipientName || "Étudiant", live && liveIntroHtml ? liveIntroHtml : introHtml),
      detailsTable([
        { label: "Événement", value: details.eventTitle },
        { label: "Date", value: details.dateLabel },
        { label: "Heure", value: details.timeLabel },
        { label: "Format", value: details.modeLabel },
        { label: "Lieu", value: details.location },
        live ? { label: "Plateforme", value: platform ? `${platform} (En ligne)` : "En ligne" } : null,
        status ? { label: "Statut", valueHtml: statusPill(status.label, status.tone) } : null,
      ]),
      neutralBox({ title: "À propos de l'événement", html: escapeHtml(details.description) }),
      studentContact ? studentContactSection(studentContact) : "",
      actions,
    ),
  });
};

const LIVE_SUBTITLE = "Connectez-vous 5 minutes avant le début de la session.";

const eventPublishedTemplate = (data) => ({
  subject: `Nouvel événement disponible — ${data.event.eventTitle}`,
  html: eventEmailBody({
    badge: "Nouvel événement",
    heading: "Un nouvel événement est disponible !",
    subtitleHtml: "Ne manquez pas les prochains événements et opportunités sélectionnés pour vous.",
    introHtml: `nous avons le plaisir de vous informer qu'un nouvel événement vient d'être publié sur ${strongBlue(BRAND)}.`,
    preheader: `Nouvel événement sur ${BRAND} : ${data.event.eventTitle}`,
    recipientName: data.recipientName,
    event: data.event,
  }),
});

const eventRegistrationConfirmedTemplate = (data) => ({
  subject: `Participation confirmée — ${data.event.eventTitle}`,
  html: eventEmailBody({
    badge: "Participation confirmée",
    heading: "Votre participation est confirmée",
    subtitleHtml: "Nous avons hâte de vous retrouver.",
    liveSubtitleHtml: LIVE_SUBTITLE,
    introHtml: "votre participation à l'événement suivant a bien été enregistrée.",
    recipientName: data.recipientName,
    event: data.event,
    status: { label: "Confirmée", tone: "green" },
  }),
});

const eventRegistrationReceivedTemplate = (data) => ({
  subject: `Nouvelle participation — ${data.event.eventTitle}`,
  html: eventEmailBody({
    badge: "Nouvelle participation",
    heading: "Nouvelle participation à un événement",
    subtitleHtml: `${strongWhite(data.studentName || "Un étudiant")} vient de s'inscrire.`,
    introHtml: `${strong(data.studentName || "Un étudiant")} vient de participer à l'événement suivant.`,
    recipientName: data.adminName || "Administrateur",
    event: data.event,
    hero: "facts",
    studentContact: {
      studentName: data.studentName,
      studentEmail: data.studentEmail,
      studentPhone: data.studentPhone,
    },
  }),
});

// Kit « Participation annulée » (annulation par l'étudiant ou événement annulé).
const eventRegistrationCancelledTemplate = (data) => {
  const intro = data.studentName
    ? `${strong(data.studentName)} a annulé sa participation à l'événement suivant.`
    : data.eventCancelled
      ? "l'événement suivant a été annulé par l'organisateur : votre participation a donc été annulée."
      : "nous vous confirmons que votre participation à l'événement suivant a bien été annulée.";
  return {
    subject: `Participation annulée — ${data.event.eventTitle}`,
    html: eventEmailBody({
      badge: "Mise à jour inscription",
      heading: "Participation annulée",
      subtitleHtml: "Vous pouvez vous réinscrire ou découvrir d'autres événements à tout moment.",
      introHtml: intro,
      preheader: `Votre participation à l'événement a bien été annulée sur ${BRAND}.`,
      recipientName: data.recipientName,
      event: data.event,
      hero: "none",
      status: { label: "Annulée", tone: "neutral" },
      actionLabel: "Voir les prochains événements",
      actionUrl: clientUrl("/events"),
      studentContact: data.studentEmail ? {
        studentName: data.studentName,
        studentEmail: data.studentEmail,
        studentPhone: data.studentPhone,
      } : null,
    }),
  };
};

const eventUpdatedTemplate = (data) => ({
  subject: `Informations mises à jour — ${data.event.eventTitle}`,
  html: eventEmailBody({
    badge: "Mise à jour",
    heading: "Un événement a été mis à jour",
    subtitleHtml: "Vérifiez la date, l'heure et le lieu de votre événement.",
    introHtml: "des informations importantes concernant votre événement ont changé.",
    recipientName: data.recipientName,
    event: data.event,
  }),
});

// Kit « Workshop Google Meet » quand l'événement a un lien de réunion.
const eventReminderTemplate = (data) => ({
  subject: `Rappel : ${data.event.eventTitle} dans ${data.reminderHours} heures`,
  html: eventEmailBody({
    badge: "Rappel",
    heading: `Votre événement commence dans ${data.reminderHours} heures`,
    subtitleHtml: "Nous avons hâte de vous retrouver.",
    liveSubtitleHtml: LIVE_SUBTITLE,
    introHtml: `voici un rappel pour l'événement auquel vous participez, prévu dans environ ${escapeHtml(data.reminderHours)} heures.`,
    liveIntroHtml: `voici votre lien d'accès direct pour participer à l'événement ${strongBlue(data.event.eventTitle)}, prévu dans environ ${escapeHtml(data.reminderHours)} heures.`,
    recipientName: data.recipientName,
    event: data.event,
  }),
});

const eventFeedbackRequestTemplate = ({ recipientName, event, feedbackUrl }) => {
  const details = eventEmailData(event);
  return {
    subject: `Votre avis sur l'événement — ${event.eventTitle}`,
    html: renderEmail({
      title: "Votre avis compte",
      preheader: `Partagez votre avis sur ${details.eventTitle}.`,
      hero: {
        badge: "Retour d'expérience",
        title: "Votre avis compte",
        subtitleHtml: "Merci d'avoir participé. Partagez votre expérience en quelques instants.",
        extraHtml: heroFacts([
          { label: "Date", value: eventWhen(details) },
          { label: "Lieu", value: details.location || details.modeLabel },
        ]),
      },
      bodyHtml: joinHtml(
        greeting(recipientName || "Étudiant", `merci d'avoir participé à ${strongBlue(details.eventTitle)}. Votre retour aidera notre équipe à améliorer les prochains événements.`),
        detailsTable([
          { label: "Événement", value: details.eventTitle },
          { label: "Date", value: details.dateLabel },
          { label: "Heure", value: details.timeLabel },
          { label: "Format", value: details.modeLabel },
          { label: "Lieu", value: details.location },
        ]),
        ctaButton("Donner mon avis", feedbackUrl),
        note("Le lien ouvrira la page de l'événement et le formulaire de feedback. Connectez-vous à votre compte étudiant si nécessaire."),
      ),
    }),
  };
};

const eventRecordingAvailableTemplate = ({ recipientName, eventTitle, recordingUrl }) => {
  const url = clientUrl(recordingUrl || "");
  return {
    subject: `Enregistrement disponible — ${eventTitle}`,
    html: renderEmail({
      title: "Enregistrement disponible",
      preheader: `L'enregistrement de ${eventTitle || "l'événement"} est disponible.`,
      hero: {
        badge: "Replay disponible",
        title: "L'enregistrement est disponible",
        subtitleHtml: "Revivez l'événement quand vous le souhaitez.",
        extraHtml: heroActionCard({ url, kicker: "Enregistrement • Replay", title: eventTitle || "Événement" }),
      },
      bodyHtml: joinHtml(
        greeting(recipientName || "Étudiant", `l'enregistrement de l'événement ${strongBlue(eventTitle)} est maintenant disponible sur ${strongBlue(BRAND)}. Connectez-vous à votre compte pour le visionner.`),
        ctaButton("Voir l'enregistrement", url, { icon: "play" }),
      ),
    }),
  };
};

// 10. Nouveau message reçu
const newMessageTemplate = ({
  recipientName,
  senderName,
  senderEmail,
  senderPhone,
  recipientRole,
  preview,
  link,
}) => {
  const text = String(preview || "");
  const excerpt = text.length > 200 ? `${text.substring(0, 200)}…` : text;
  const isAdmin = recipientRole === "admin";
  return {
    subject: `Nouveau message de ${senderName} 💬`,
    html: renderEmail({
      title: "Nouveau message",
      preheader: `${senderName || "Quelqu'un"} vous a envoyé un message.`,
      hero: {
        badge: "Messagerie",
        title: "Nouveau message",
        subtitleHtml: `${strongWhite(senderName || "Un utilisateur")} vous a envoyé un message.`,
      },
      bodyHtml: joinHtml(
        greeting(recipientName || "Utilisateur", "vous avez reçu un nouveau message sur votre espace."),
        isAdmin ? studentInfoSection({ studentName: senderName, studentEmail: senderEmail, studentPhone: senderPhone }) : "",
        quoteBox({ label: isAdmin ? `Message de ${senderName || "l'étudiant"}` : `Message de ${senderName || "votre interlocuteur"}`, text: excerpt }),
        ctaButton("Répondre au message", clientUrl(link || "")),
      ),
    }),
  };
};

// 11. Nouvelle inscription — notification admin
const newUserAdminTemplate = ({ userName, userEmail, userPhone, userRole }) => {
  const roleLabel = roleLabelOf(userRole);
  const isStudent = userRole === "étudiant";
  const title = isStudent ? "Nouvelle inscription étudiant vérifiée" : "Nouvelle inscription";

  return {
    subject: isStudent ? `Nouvelle inscription étudiant vérifiée — ${userName} 👤` : `Nouvelle inscription — ${userName} (${roleLabel}) 👤`,
    html: renderEmail({
      title,
      preheader: `${userName || "Un utilisateur"} vient de rejoindre ${BRAND}.`,
      hero: {
        badge: "Nouvelle inscription",
        title,
        subtitleHtml: isStudent
          ? `Un nouvel étudiant vient de créer et vérifier son compte sur ${strongWhite(BRAND)}.`
          : `Un nouvel utilisateur vient de rejoindre ${strongWhite(BRAND)}.`,
      },
      bodyHtml: joinHtml(
        detailsTable([
          { label: "Nom", value: userName },
          { label: "Email", valueHtml: mailtoLink(userEmail) },
          { label: "Téléphone", value: userPhone || "Non renseigné" },
          { label: "Rôle", valueHtml: statusPill(roleLabel, userRole === "admin" ? "violet" : "blue") },
          { label: "Date", value: dateAndTime(new Date()) },
        ]),
        ctaButton("Gérer les utilisateurs", clientUrl("/dashboard/admin/users")),
      ),
    }),
  };
};

// 12. Compte créé par un administrateur (identifiants de connexion)
const accountCreatedByAdminTemplate = ({ name, email, password, role }) => {
  const roleLabel = roleLabelOf(role);
  return {
    subject: `Votre compte ${BRAND} a été créé 🔑`,
    html: renderEmail({
      title: "Compte créé",
      preheader: `Vos identifiants de connexion à ${BRAND}.`,
      hero: {
        badge: "Compte créé",
        title: name ? `Bienvenue, ${name} !` : "Bienvenue !",
        subtitleHtml: `Un administrateur vous a créé un compte ${strongWhite(roleLabel)} sur ${strongWhite(BRAND)}.`,
      },
      bodyHtml: joinHtml(
        paragraph("Voici vos identifiants pour vous connecter à votre espace :"),
        detailsTable([
          { label: "Email", value: email },
          { label: "Mot de passe temporaire", valueHtml: `<span style="font-family:'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace; font-size:15px; letter-spacing:0.5px;">${escapeHtml(password)}</span>` },
          { label: "Rôle", valueHtml: statusPill(roleLabel, role === "admin" ? "violet" : "blue") },
        ]),
        infoBox("<strong>Pensez à changer ce mot de passe</strong> dès votre première connexion, depuis votre profil.", { tone: "amber" }),
        ctaButton("Me connecter", clientUrl("/login")),
      ),
    }),
  };
};

// 13. Code de vérification email
const verifyCodeTemplate = ({ name, code }) => ({
  subject: `Votre code de vérification ${BRAND} — ${code} 🔐`,
  html: renderEmail({
    title: "Code de vérification",
    preheader: `Votre code de vérification : ${code}`,
    hero: {
      badge: "Sécurité du compte",
      title: "Vérifiez votre email",
      subtitleHtml: "Utilisez ce code pour accéder à votre espace.",
      extraHtml: heroHighlight({ label: "Votre code de vérification", value: code, code: true, footnote: "Ce code expire dans 15 minutes" }),
    },
    bodyHtml: joinHtml(
      greeting(name || "Utilisateur", `voici votre code de vérification pour accéder à votre espace ${strongBlue(BRAND)}. Il expire dans <strong>15 minutes</strong>.`),
      infoBox(`<strong>Important :</strong> Ne partagez jamais ce code. ${BRAND} ne vous demandera jamais ce code par téléphone.`, { tone: "amber" }),
      note("Si vous n'avez pas demandé ce code, ignorez cet email."),
    ),
  }),
});

// 14. Réinitialisation de mot de passe
const resetPasswordTemplate = ({ name, resetUrl }) => ({
  subject: `Réinitialisez votre mot de passe ${BRAND} 🔑`,
  html: renderEmail({
    title: "Réinitialisation du mot de passe",
    preheader: "Choisissez un nouveau mot de passe (lien valable 1 heure).",
    hero: {
      badge: "Sécurité du compte",
      title: "Réinitialisez votre mot de passe",
      subtitleHtml: "Une demande de réinitialisation a été effectuée pour votre compte.",
    },
    bodyHtml: joinHtml(
      greeting(name || "Utilisateur", "cliquez sur le bouton ci-dessous pour choisir un nouveau mot de passe."),
      infoBox("<strong>Ce lien expire dans 1 heure</strong> et ne peut être utilisé qu'une seule fois.", { tone: "amber" }),
      ctaButton("Choisir un nouveau mot de passe", resetUrl),
      note("Si vous n'êtes pas à l'origine de cette demande, ignorez cet email — votre mot de passe reste inchangé."),
    ),
  }),
});

// 15. Confirmation de vote — Cérémonie
const voteConfirmationTemplate = ({ studentName, projectTitles = [] }) => ({
  subject: `Votre vote a bien été enregistré — Cérémonie ${BRAND} 🏆`,
  html: renderEmail({
    title: "Vote enregistré",
    preheader: "Votre vote pour la Cérémonie a bien été pris en compte.",
    hero: {
      badge: "Cérémonie",
      title: "Merci pour votre vote !",
      subtitleHtml: "Votre vote pour la Cérémonie a bien été pris en compte.",
    },
    bodyHtml: joinHtml(
      greeting(studentName || "Étudiant", "voici les projets que vous avez sélectionnés :"),
      detailsTable((Array.isArray(projectTitles) ? projectTitles : []).map((title, index) => ({ label: `Projet ${index + 1}`, value: title })), { title: "Vos projets sélectionnés" }),
      infoBox("Un seul vote par étudiant est autorisé — celui-ci est désormais <strong>définitif</strong>."),
      ctaButton("Voir le classement", clientUrl("/ceremonie")),
    ),
  }),
});

// 16. Félicitations au gagnant — clôture de la Cérémonie
const winnerCongratsTemplate = ({ studentName, projectTitle, edition }) => ({
  subject: `Félicitations, vous avez gagné la Cérémonie ${edition} ! 🏆`,
  html: renderEmail({
    title: "Vous avez gagné !",
    preheader: `Votre projet a remporté la Cérémonie ${edition ?? ""}.`,
    hero: {
      badge: `Cérémonie ${edition ?? ""}`.trim(),
      title: studentName ? `Félicitations, ${studentName} !` : "Félicitations !",
      subtitleHtml: `Votre projet a remporté la Cérémonie ${escapeHtml(edition ?? "")} de ${strongWhite(BRAND)}.`,
      extraHtml: heroHighlight({ label: "Projet gagnant", value: projectTitle }),
    },
    bodyHtml: joinHtml(
      paragraph(`Un grand bravo pour ce travail — la communauté ${strongBlue(BRAND)} a voté, et votre projet s'est démarqué. Merci pour votre engagement !`),
      detailsTable([
        { label: "Projet gagnant", value: projectTitle },
        { label: "Édition", value: edition },
      ]),
      ctaButton("Voir le classement final", clientUrl("/ceremonie")),
    ),
  }),
});

// 17. Résultats de la Cérémonie — envoyé aux autres participants (votants et/ou
// soumetteurs) à la clôture, annonce le nom du projet/étudiant gagnant.
const ceremonyResultsTemplate = ({ studentName, winnerTitle, winnerStudentName, edition }) => ({
  subject: `Résultats de la Cérémonie ${edition} — ${BRAND}`,
  html: renderEmail({
    title: "Résultats de la Cérémonie",
    preheader: `La Cérémonie ${edition ?? ""} est terminée : découvrez le projet gagnant.`,
    hero: {
      badge: "Résultats",
      title: `La Cérémonie ${edition ?? ""} est terminée !`.replace(/\s+/g, " "),
      subtitleHtml: "Voici le résultat du vote.",
      extraHtml: heroHighlight({ label: "Projet gagnant", value: winnerTitle, pill: winnerStudentName }),
    },
    bodyHtml: joinHtml(
      greeting(studentName || "Étudiant", "merci d'avoir participé à cette édition — que ce soit en soumettant un projet ou en votant. Retrouvez le classement complet et tous les projets sur la page Cérémonie."),
      detailsTable([
        { label: "Projet gagnant", value: winnerTitle },
        { label: "Étudiant", value: winnerStudentName },
      ]),
      ctaButton("Voir le classement", clientUrl("/ceremonie")),
    ),
  }),
});

const ceremonyProjectDecisionTemplate = ({ studentName, projectTitle, edition, accepted }) => {
  const decision = accepted ? "accepté" : "refusé";
  const ceremonyName = edition === undefined || edition === null || edition === ""
    ? "Cérémonie"
    : `Cérémonie ${edition}`;

  return {
    subject: `Votre projet a été ${decision} — ${BRAND}`,
    html: renderEmail({
      title: `Projet ${decision}`,
      preheader: `Votre projet a été ${decision} pour la ${ceremonyName}.`,
      hero: {
        badge: ceremonyName,
        title: `Votre projet a été ${decision}`,
        subtitleHtml: `${escapeHtml(ceremonyName)} de ${strongWhite(BRAND)}`,
      },
      bodyHtml: joinHtml(
        greeting(studentName || "Étudiant", `votre projet a été <strong>${decision}</strong> pour la ${escapeHtml(ceremonyName)} de ${strongBlue(BRAND)}.`),
        detailsTable([
          { label: "Projet", value: projectTitle || "Non renseigné" },
          { label: "Cérémonie", value: ceremonyName },
          { label: "Décision", valueHtml: statusPill(accepted ? "Accepté" : "Refusé", accepted ? "green" : "red") },
        ]),
        ctaButton("Voir la Cérémonie", clientUrl("/ceremonie")),
      ),
    }),
  };
};

// ─── Newsletter (fr / en / ar) ───────────────────────────────────────────────
const NEWSLETTER_COPY = {
  fr: {
    locale: "fr-FR",
    welcomeSubject: `Bienvenue dans la newsletter ${BRAND}`,
    welcomePreheader: `Bienvenue dans la communauté ${BRAND} !`,
    welcomeBadge: "Newsletter Confirmée",
    welcomeTitle: "Bienvenue dans la communauté !",
    welcomeSubtitle: `Ravi de vous compter parmi les talents de ${strongWhite(BRAND)}.`,
    welcomeBody: `Votre inscription à la newsletter ${strongBlue(BRAND)} est confirmée ! Vous recevrez désormais en priorité nos meilleurs événements, ateliers gratuits et offres carrière.`,
    welcomeCards: [
      { title: "Free Workshops", text: "AI, DevOps, Cyber & Full-Stack" },
      { title: "Stages & Emplois", text: "Job Fairs & offres partenaires" },
      { title: "PFE & Summer Camp", text: "Projets réels & mentorat" },
    ],
    welcomeButton: `Explorer ${BRAND}`,
    adminSubject: "Nouvel abonné à la newsletter",
    adminBadge: "Newsletter",
    adminTitle: "Nouvelle inscription à la newsletter",
    adminBody: "Un visiteur vient de s'abonner à la newsletter.",
    adminEmailLabel: "Email",
    publicationSubject: `Nouveauté ${BRAND} : `,
    publicationPreheader: `Une nouvelle opportunité carrière est disponible sur ${BRAND} !`,
    publicationBadge: "Nouveauté & Opportunité",
    publicationTitle: "Une nouveauté est disponible !",
    publicationSubtitle: "Ne manquez pas les prochains événements et opportunités sélectionnés pour vous.",
    publicationKicker: "À la une",
    publicationGoal: "<strong>Objectif :</strong> Préparez votre CV, rencontrez les recruteurs et décrochez votre prochain <strong>stage, PFE ou premier emploi</strong>.",
    publicationButton: "Découvrir l'opportunité",
    dateLabel: "Date",
    placeLabel: "Lieu",
    at: "à",
    modes: EVENT_MODE_LABELS,
  },
  en: {
    locale: "en-GB",
    welcomeSubject: `Welcome to the ${BRAND} newsletter`,
    welcomePreheader: `Welcome to the ${BRAND} community!`,
    welcomeBadge: "Newsletter confirmed",
    welcomeTitle: "Welcome to the community!",
    welcomeSubtitle: `We are glad to count you among the talents of ${strongWhite(BRAND)}.`,
    welcomeBody: `Your subscription to the ${strongBlue(BRAND)} newsletter is confirmed! From now on, you will be the first to receive our best events, free workshops and career opportunities.`,
    welcomeCards: [
      { title: "Free Workshops", text: "AI, DevOps, Cyber & Full-Stack" },
      { title: "Internships & Jobs", text: "Job fairs & partner offers" },
      { title: "PFE & Summer Camp", text: "Real projects & mentoring" },
    ],
    welcomeButton: `Explore ${BRAND}`,
    adminSubject: "New newsletter subscriber",
    adminBadge: "Newsletter",
    adminTitle: "New newsletter subscription",
    adminBody: "A visitor has subscribed to the newsletter.",
    adminEmailLabel: "Email",
    publicationSubject: `${BRAND} update: `,
    publicationPreheader: `A new career opportunity is available on ${BRAND}!`,
    publicationBadge: "News & Opportunity",
    publicationTitle: "A new update is available!",
    publicationSubtitle: "Don't miss the upcoming events and opportunities selected for you.",
    publicationKicker: "Featured",
    publicationGoal: "<strong>Goal:</strong> Prepare your CV, meet recruiters and land your next <strong>internship, final-year project or first job</strong>.",
    publicationButton: "Discover the opportunity",
    dateLabel: "Date",
    placeLabel: "Location",
    at: "at",
    modes: { onsite: "On site", online: "Online", hybrid: "Hybrid" },
  },
  ar: {
    locale: "ar-TN",
    welcomeSubject: `مرحبًا بك في نشرة ${BRAND}`,
    welcomePreheader: `مرحبًا بك في مجتمع ${BRAND}!`,
    welcomeBadge: "تم تأكيد الاشتراك",
    welcomeTitle: "مرحبًا بك في مجتمعنا!",
    welcomeSubtitle: `يسعدنا انضمامك إلى مواهب ${brandHtml("color:#FFFFFF; font-weight:700;")}.`,
    welcomeBody: `تم تأكيد اشتراكك في نشرة ${brandHtml("color:#1D4ED8; font-weight:700;")}! ستصلك من الآن وبالأولوية أفضل فعالياتنا وورشاتنا المجانية وفرص العمل.`,
    welcomeCards: [
      { title: "ورشات مجانية", text: "AI وDevOps والأمن السيبراني وFull-Stack" },
      { title: "تربصات ووظائف", text: "معارض توظيف وعروض الشركاء" },
      { title: "PFE وSummer Camp", text: "مشاريع حقيقية وتأطير" },
    ],
    welcomeButton: `اكتشف ${BRAND}`,
    adminSubject: "مشترك جديد في النشرة",
    adminBadge: "النشرة",
    adminTitle: "اشتراك جديد في النشرة",
    adminBody: "اشترك زائر جديد في النشرة.",
    adminEmailLabel: "البريد الإلكتروني",
    publicationSubject: `جديد ${BRAND}: `,
    publicationPreheader: `فرصة مهنية جديدة متاحة على ${BRAND}!`,
    publicationBadge: "جديد وفرص",
    publicationTitle: "هناك جديد متاح!",
    publicationSubtitle: "لا تفوّت الفعاليات والفرص القادمة المختارة لك.",
    publicationKicker: "في الواجهة",
    publicationGoal: "<strong>الهدف:</strong> حضّر سيرتك الذاتية، التقِ بالمشغّلين واحصل على <strong>تربّصك أو مشروع تخرّجك أو أول وظيفة</strong>.",
    publicationButton: "اكتشف الفرصة",
    dateLabel: "التاريخ",
    placeLabel: "المكان",
    at: "على الساعة",
    modes: { onsite: "حضوري", online: "عن بعد", hybrid: "هجين" },
  },
};

const newsletterLanguage = (language) => (NEWSLETTER_COPY[language] ? language : "fr");
const newsletterCopy = (language) => NEWSLETTER_COPY[newsletterLanguage(language)];
const newsletterDir = (language) => (newsletterLanguage(language) === "ar" ? "rtl" : "ltr");

// Kit « Bienvenue newsletter »
const newsletterWelcomeTemplate = ({ language = "fr", unsubscribeUrl }) => {
  const lang = newsletterLanguage(language);
  const copy = newsletterCopy(lang);
  return {
    subject: copy.welcomeSubject,
    html: renderEmail({
      lang,
      title: copy.welcomeTitle,
      preheader: copy.welcomePreheader,
      hero: { badge: copy.welcomeBadge, title: copy.welcomeTitle, subtitleHtml: copy.welcomeSubtitle },
      bodyHtml: joinHtml(
        paragraph(copy.welcomeBody, { center: true }),
        featureCards(copy.welcomeCards),
        ctaButton(copy.welcomeButton, clientUrl("/"), { dir: newsletterDir(lang) }),
      ),
      unsubscribeUrl,
    }),
  };
};

const newsletterAdminTemplate = ({ language = "fr", subscriberEmail }) => {
  const lang = newsletterLanguage(language);
  const copy = newsletterCopy(lang);
  return {
    subject: copy.adminSubject,
    html: renderEmail({
      lang,
      title: copy.adminTitle,
      preheader: copy.adminBody,
      hero: { badge: copy.adminBadge, title: copy.adminTitle, subtitleHtml: escapeHtml(copy.adminBody) },
      bodyHtml: detailsTable([{ label: copy.adminEmailLabel, valueHtml: mailtoLink(subscriberEmail) }]),
    }),
  };
};

// Kit « Nouveauté » : actualité ou événement publié, envoyé aux abonnés.
const newsletterPublicationTemplate = ({ language = "fr", title, excerpt, url, unsubscribeUrl, startsAt, timezone, location, mode }) => {
  const lang = newsletterLanguage(language);
  const copy = newsletterCopy(lang);
  const dir = newsletterDir(lang);
  const subjectTitle = String(title || "").replace(/[\u0000-\u001F\u007F]/g, " ").trim().slice(0, 200);
  const zone = { locale: copy.locale, timeZone: timezone || TIMEZONE };
  const date = formatDate(startsAt, LONG_DATE, zone);
  const time = formatDate(startsAt, TIME, zone);
  const summary = String(excerpt || "").trim();
  const shortSummary = summary.length > 600 ? `${summary.slice(0, 600).trimEnd()}…` : summary;
  return {
    subject: `${copy.publicationSubject}${subjectTitle}`,
    html: renderEmail({
      lang,
      title: copy.publicationTitle,
      preheader: copy.publicationPreheader,
      hero: {
        badge: copy.publicationBadge,
        title: copy.publicationTitle,
        subtitleHtml: escapeHtml(copy.publicationSubtitle),
        // Date | Lieu seulement pour un événement (une actualité n'en a pas).
        extraHtml: heroFacts([
          { label: copy.dateLabel, value: date ? capitalize(time ? `${date} ${copy.at} ${time}` : date) : "" },
          { label: copy.placeLabel, value: date ? (String(location || "").trim() || copy.modes[mode] || "") : "" },
        ], { dir }),
      },
      bodyHtml: joinHtml(
        kicker(copy.publicationKicker),
        sectionTitle(title || ""),
        shortSummary ? paragraph(escapeHtml(shortSummary), { size: 14.5 }) : "",
        infoBox(copy.publicationGoal, { dir }),
        ctaButton(copy.publicationButton, url, { dir }),
      ),
      unsubscribeUrl,
    }),
  };
};

// Tous les templates (aperçus et tests) : (données) → { subject, html }.
export const emailTemplates = {
  welcome: welcomeTemplate,
  applicationSent: applicationSentTemplate,
  applicationReceived: applicationReceivedTemplate,
  applicationStatus: applicationStatusTemplate,
  interviewProposed: interviewProposedTemplate,
  interviewStatus: interviewStatusTemplate,
  enrollmentRequestReceived: enrollmentRequestReceivedTemplate,
  enrollmentRequestSent: enrollmentRequestSentTemplate,
  enrollmentRequestStatus: enrollmentRequestStatusTemplate,
  eventPublished: eventPublishedTemplate,
  eventRegistrationConfirmed: eventRegistrationConfirmedTemplate,
  eventRegistrationReceived: eventRegistrationReceivedTemplate,
  eventRegistrationCancelled: eventRegistrationCancelledTemplate,
  eventUpdated: eventUpdatedTemplate,
  eventReminder: eventReminderTemplate,
  eventFeedbackRequest: eventFeedbackRequestTemplate,
  eventRecordingAvailable: eventRecordingAvailableTemplate,
  newMessage: newMessageTemplate,
  newUserAdmin: newUserAdminTemplate,
  accountCreatedByAdmin: accountCreatedByAdminTemplate,
  verifyCode: verifyCodeTemplate,
  resetPassword: resetPasswordTemplate,
  voteConfirmation: voteConfirmationTemplate,
  winnerCongrats: winnerCongratsTemplate,
  ceremonyResults: ceremonyResultsTemplate,
  ceremonyProjectDecision: ceremonyProjectDecisionTemplate,
  newsletterWelcome: newsletterWelcomeTemplate,
  newsletterAdmin: newsletterAdminTemplate,
  newsletterPublication: newsletterPublicationTemplate,
};

const sendEmail = async ({ to, subject, html, allowUnverified = false }) => {
  const startedAt = Date.now();
  if (!allowUnverified) {
    try {
      const recipients = (Array.isArray(to) ? to : String(to).split(/[;,]/))
        .map((recipient) => String(recipient).trim().toLowerCase())
        .filter(Boolean);
      const accounts = await User.find({ email: { $in: recipients } })
        .select("isVerified isActive")
        .lean();
      if (accounts.some((account) => account.isVerified !== true || account.isActive !== true)) {
        console.info("[email] Skipping email to an unverified or inactive account", { recipient: to, subject });
        return { success: false, skipped: true, reason: "account_not_verified_and_active" };
      }
    } catch (err) {
      console.error("[email] Could not verify recipient account status; email was not sent", {
        recipient: to,
        subject,
        errorMessage: err.message,
      });
      return { success: false, error: "Recipient account status could not be verified." };
    }
  }
  console.info("[email] Sending email", { recipient: to, subject });
  try {
    const transporter = getTransporter();
    // Affiché « 9antra.tn » dans la boîte de réception (EMAIL_FROM_NAME pour changer).
    const sender = getEmailSender();
    const from = sender.address ? sender : process.env.EMAIL_FROM;
    const info = await transporter.sendMail({
      from,
      replyTo: from,
      to,
      subject,
      html,
      text: htmlToPlainText(html),
    });
    console.info("[email] Email sent successfully", {
      recipient: to,
      messageId: info.messageId,
      durationMs: Date.now() - startedAt,
    });
    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error("[email] Email sending failed", {
      recipient: to,
      subject,
      errorCode: err.code,
      errorMessage: err.message,
      durationMs: Date.now() - startedAt,
    });
    return { success: false, error: err.message, code: err.code };
  }
};

// ─── Exports ──────────────────────────────────────────────────────────────────
const emailService = {
  sendWelcome:             (to, data) => sendEmail({ to, ...welcomeTemplate(data) }),
  sendApplicationSent:     (to, data) => sendEmail({ to, ...applicationSentTemplate(data) }),
  sendApplicationReceived: (to, data) => sendEmail({ to, ...applicationReceivedTemplate(data) }),
  sendApplicationStatus:   (to, data) => sendEmail({ to, ...applicationStatusTemplate(data) }),
  sendInterviewProposed:   (to, data) => sendEmail({ to, ...interviewProposedTemplate(data) }),
  sendInterviewStatus:     (to, data) => sendEmail({ to, ...interviewStatusTemplate(data) }),
  sendEnrollmentRequestReceived: (to, data) => sendEmail({ to, ...enrollmentRequestReceivedTemplate(data) }),
  sendEnrollmentRequestSent: (to, data) => sendEmail({ to, ...enrollmentRequestSentTemplate(data) }),
  sendEnrollmentRequestStatus:   (to, data) => sendEmail({ to, ...enrollmentRequestStatusTemplate(data) }),
  sendEventPublished:      (to, data) => sendEmail({ to, ...eventPublishedTemplate(data) }),
  sendEventRegistrationConfirmed: (to, data) => sendEmail({ to, ...eventRegistrationConfirmedTemplate(data) }),
  sendEventRegistrationReceived: (to, data) => sendEmail({ to, ...eventRegistrationReceivedTemplate(data) }),
  sendEventRegistrationCancelled: (to, data) => sendEmail({ to, ...eventRegistrationCancelledTemplate(data) }),
  sendEventUpdated:        (to, data) => sendEmail({ to, ...eventUpdatedTemplate(data) }),
  sendEventReminder:       (to, data) => sendEmail({ to, ...eventReminderTemplate(data) }),
  sendEventFeedbackRequest: (to, data) => sendEmail({ to, ...eventFeedbackRequestTemplate(data) }),
  sendEventRecordingAvailable: (to, data) => sendEmail({ to, ...eventRecordingAvailableTemplate(data) }),
  sendNewMessage:          (to, data) => sendEmail({ to, ...newMessageTemplate(data) }),
  sendNewUserAdmin:        (to, data) => sendEmail({ to, ...newUserAdminTemplate(data) }),
  sendAccountCreatedByAdmin: (to, data) => sendEmail({ to, ...accountCreatedByAdminTemplate(data) }),
  sendVerifyCode:          (to, data) => sendEmail({ to, ...verifyCodeTemplate(data), allowUnverified: true }),
  sendResetPassword:       (to, data) => sendEmail({ to, ...resetPasswordTemplate(data) }),
  sendVoteConfirmation:    (to, data) => sendEmail({ to, ...voteConfirmationTemplate(data) }),
  sendWinnerCongrats:      (to, data) => sendEmail({ to, ...winnerCongratsTemplate(data) }),
  sendCeremonyResults:     (to, data) => sendEmail({ to, ...ceremonyResultsTemplate(data) }),
  sendNewsletterWelcome: (to, data) => sendEmail({ to, ...newsletterWelcomeTemplate(data) }),
  sendNewsletterAdmin: (to, data) => sendEmail({ to, ...newsletterAdminTemplate(data) }),
  sendNewsletterPublication: (to, data) => sendEmail({ to, ...newsletterPublicationTemplate(data) }),
  sendCeremonyProjectAccepted: (to, data) => sendEmail({ to, ...ceremonyProjectDecisionTemplate({ ...data, accepted: true }) }),
  sendCeremonyProjectRejected: (to, data) => sendEmail({ to, ...ceremonyProjectDecisionTemplate({ ...data, accepted: false }) }),
};

export default emailService;
