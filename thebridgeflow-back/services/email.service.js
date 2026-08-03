import { BrevoClient } from "@getbrevo/brevo";

// ─── Configuration Brevo — API HTTP officielle ─────────────────────────────────
// Toute la communication passe par https://api.brevo.com (HTTPS/443), via le SDK
// officiel @getbrevo/brevo — une simple requête HTTPS, comme n'importe quel appel API.
const REQUEST_TIMEOUT_SECONDS = 10; // l'envoi ne doit jamais bloquer la réponse HTTP au-delà de ça

const REQUIRED_ENV = ["BREVO_API_KEY", "EMAIL_FROM"];

const getMissingEnv = () => REQUIRED_ENV.filter((key) => !process.env[key]);

// ─── Client Brevo singleton ────────────────────────────────────────────────────
let _client = null;

const getClient = () => {
  if (_client) return _client;

  console.log(`📨 [email] Initialisation du client Brevo (API HTTP) — timeout=${REQUEST_TIMEOUT_SECONDS}s`);

  _client = new BrevoClient({
    apiKey: process.env.BREVO_API_KEY,
    timeoutInSeconds: REQUEST_TIMEOUT_SECONDS,
  });

  return _client;
};

// "TheBridgeFlow <chimatouj@gmail.com>" → { name: "TheBridgeFlow", email: "chimatouj@gmail.com" }
const parseSender = (raw) => {
  const match = /^(.*?)\s*<(.+)>$/.exec((raw || "").trim());
  if (match) {
    return { name: match[1].trim() || undefined, email: match[2].trim() };
  }
  return { email: (raw || "").trim() };
};

// Vérifie que la clé API Brevo est valide — à appeler au démarrage du serveur
// pour un diagnostic immédiat (n'empêche pas le serveur de démarrer si ça échoue).
export const verifyEmailConfig = async () => {
  const missing = getMissingEnv();
  if (missing.length) {
    console.error(`❌ [email] Vérification API Brevo ignorée — variable(s) manquante(s) : ${missing.join(", ")}`);
    return false;
  }

  try {
    const client = getClient();
    const account = await client.account.getAccount();
    console.log(`✅ [email] API Brevo vérifiée — compte=${account?.email || "inconnu"}`);
    return true;
  } catch (err) {
    console.error(`❌ [email] Échec de la vérification de l'API Brevo :`, {
      message:    err.message,
      statusCode: err.statusCode,
      body:       err.body,
      stack:      err.stack,
    });
    return false;
  }
};

// ─── Layout HTML commun ───────────────────────────────────────────────────────
const layout = (title, content) => `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#F8FAFC;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F8FAFC;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#2563EB,#1D4ED8);border-radius:16px 16px 0 0;padding:32px 40px;text-align:center;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td align="center">
                  <div style="display:inline-flex;align-items:center;gap:10px;">
                    <span style="display:inline-block;width:40px;height:40px;background:rgba(255,255,255,0.2);border-radius:10px;text-align:center;line-height:40px;font-size:20px;font-weight:900;color:white;">S</span>
                    <span style="font-size:22px;font-weight:800;color:white;letter-spacing:-0.5px;">TheBridgeFlow</span>
                  </div>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="background:#FFFFFF;padding:40px;border-left:1px solid #E2E8F0;border-right:1px solid #E2E8F0;">
            ${content}
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#F1F5F9;border-radius:0 0 16px 16px;border:1px solid #E2E8F0;border-top:none;padding:24px 40px;text-align:center;">
            <p style="margin:0 0 6px;font-size:13px;color:#64748B;">
              Cet email a été envoyé automatiquement par TheBridgeFlow.
            </p>
            <p style="margin:0;font-size:12px;color:#94A3B8;">
              © ${new Date().getFullYear()} TheBridgeFlow · Ariana, Tunis, Tunisie · contact@9antra.tn
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

// ─── Composants réutilisables ─────────────────────────────────────────────────
const badge = (text, color = "#2563EB", bg = "#EFF6FF") =>
  `<span style="display:inline-block;background:${bg};color:${color};padding:4px 12px;border-radius:999px;font-size:12px;font-weight:700;letter-spacing:0.05em;">${text}</span>`;

const button = (text, url, color = "#2563EB") =>
  `<a href="${url}" style="display:inline-block;background:${color};color:white;padding:14px 32px;border-radius:10px;text-decoration:none;font-weight:700;font-size:15px;margin-top:8px;">${text}</a>`;

const infoRow = (label, value) =>
  `<tr>
    <td style="padding:10px 0;border-bottom:1px solid #F1F5F9;font-size:13px;color:#64748B;width:40%;">${label}</td>
    <td style="padding:10px 0;border-bottom:1px solid #F1F5F9;font-size:13px;color:#0F172A;font-weight:600;">${value}</td>
  </tr>`;

// ─── Templates ────────────────────────────────────────────────────────────────

// 1. Bienvenue après inscription
const welcomeTemplate = ({ name, role }) => {
  const roleLabel = { étudiant: "Étudiant", admin: "Administrateur" }[role] || role;
  const roleColor = { étudiant: "#2563EB", admin: "#8B5CF6" }[role] || "#2563EB";

  return {
    subject: "🎉 Bienvenue sur TheBridgeFlow !",
    html: layout("Bienvenue sur TheBridgeFlow", `
      <div style="text-align:center;margin-bottom:32px;">
        <div style="font-size:48px;margin-bottom:16px;">🎉</div>
        <h1 style="margin:0 0 8px;font-size:26px;font-weight:800;color:#0F172A;">Bienvenue, ${name} !</h1>
        <p style="margin:0;color:#64748B;font-size:15px;">Votre compte a été créé avec succès.</p>
      </div>

      <div style="text-align:center;margin-bottom:28px;">
        ${badge(roleLabel, roleColor, roleColor + "18")}
      </div>

      <p style="color:#475569;font-size:15px;line-height:1.7;margin:0 0 24px;">
        TheBridgeFlow est votre plateforme tout-en-un pour gérer vos stages de A à Z.
        Découvrez toutes les fonctionnalités disponibles pour votre profil <strong>${roleLabel}</strong>.
      </p>

      <div style="background:#F8FAFC;border-radius:12px;padding:20px;margin-bottom:28px;">
        <p style="margin:0 0 12px;font-weight:700;color:#0F172A;font-size:14px;">✅ Ce que vous pouvez faire :</p>
        <ul style="margin:0;padding-left:20px;color:#475569;font-size:14px;line-height:2;">
          ${role === "étudiant"
            ? "<li>Parcourir les offres de stage</li><li>Postuler en quelques clics</li><li>Suivre vos candidatures</li><li>Communiquer avec les entreprises</li>"
            : "<li>Gérer les offres de stage et les candidatures</li><li>Planifier des entretiens</li><li>Gérer les formations et les utilisateurs</li>"}
        </ul>
      </div>

      <div style="text-align:center;">
        ${button("Accéder à mon espace", `${process.env.CLIENT_URL || "http://localhost:5173"}/login`)}
      </div>
    `),
  };
};

// 2. Candidature envoyée (à l'étudiant)
const applicationSentTemplate = ({ studentName, offerTitle, companyName }) => ({
  subject: `📩 Candidature envoyée — ${offerTitle}`,
  html: layout("Candidature envoyée", `
    <div style="text-align:center;margin-bottom:32px;">
      <div style="font-size:48px;margin-bottom:16px;">📩</div>
      <h1 style="margin:0 0 8px;font-size:24px;font-weight:800;color:#0F172A;">Candidature envoyée !</h1>
      <p style="margin:0;color:#64748B;font-size:15px;">Votre candidature a bien été reçue.</p>
    </div>

    <p style="color:#475569;font-size:15px;line-height:1.7;margin:0 0 24px;">
      Bonjour <strong>${studentName}</strong>, votre candidature a été transmise avec succès. L'entreprise vous contactera si votre profil correspond à leurs attentes.
    </p>

    <div style="background:#F8FAFC;border-radius:12px;padding:20px;margin-bottom:28px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        ${infoRow("Offre", offerTitle)}
        ${infoRow("Entreprise", companyName)}
        ${infoRow("Statut", "En attente")}
        ${infoRow("Date", new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }))}
      </table>
    </div>

    <div style="background:#EFF6FF;border-radius:12px;padding:16px;margin-bottom:28px;border-left:4px solid #2563EB;">
      <p style="margin:0;font-size:14px;color:#1D4ED8;">
        💡 <strong>Conseil :</strong> Préparez-vous en avance en relisant l'offre et en recherchant l'entreprise.
      </p>
    </div>

    <div style="text-align:center;">
      ${button("Voir mes candidatures", `${process.env.CLIENT_URL || "http://localhost:5173"}/dashboard/student/applications`)}
    </div>
  `),
});

// 3. Nouvelle candidature reçue (à l'entreprise)
const applicationReceivedTemplate = ({ companyName, studentName, studentEmail, offerTitle }) => ({
  subject: `👤 Nouvelle candidature — ${offerTitle}`,
  html: layout("Nouvelle candidature reçue", `
    <div style="text-align:center;margin-bottom:32px;">
      <div style="font-size:48px;margin-bottom:16px;">👤</div>
      <h1 style="margin:0 0 8px;font-size:24px;font-weight:800;color:#0F172A;">Nouvelle candidature reçue</h1>
      <p style="margin:0;color:#64748B;font-size:15px;">Un étudiant a postulé à l'une de vos offres.</p>
    </div>

    <p style="color:#475569;font-size:15px;line-height:1.7;margin:0 0 24px;">
      Bonjour <strong>${companyName}</strong>, un nouvel étudiant vient de postuler à votre offre. Consultez sa candidature dès maintenant.
    </p>

    <div style="background:#F8FAFC;border-radius:12px;padding:20px;margin-bottom:28px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        ${infoRow("Candidat", studentName)}
        ${infoRow("Email", studentEmail)}
        ${infoRow("Offre", offerTitle)}
        ${infoRow("Reçue le", new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }))}
      </table>
    </div>

    <div style="text-align:center;">
      ${button("Voir la candidature", `${process.env.CLIENT_URL || "http://localhost:5173"}/dashboard/admin/candidatures`, "#10B981")}
    </div>
  `),
});

// 4. Statut de candidature mis à jour (à l'étudiant)
const applicationStatusTemplate = ({ studentName, offerTitle, companyName, status }) => {
  const configs = {
    "acceptée": { icon: "🎉", color: "#10B981", bg: "#ECFDF5", borderColor: "#10B981", title: "Candidature acceptée !", message: "Félicitations ! Votre candidature a été acceptée. L'entreprise vous contactera prochainement pour les prochaines étapes." },
    "refusée":  { icon: "😔", color: "#EF4444", bg: "#FEF2F2", borderColor: "#EF4444", title: "Candidature non retenue", message: "Nous sommes désolés, votre candidature n'a pas été retenue cette fois. Ne vous découragez pas, continuez à postuler !" },
    "en cours": { icon: "🔍", color: "#F59E0B", bg: "#FFFBEB", borderColor: "#F59E0B", title: "Candidature en cours d'examen", message: "Bonne nouvelle ! Votre candidature est en cours d'examen par l'entreprise. Restez disponible pour un éventuel contact." },
  };
  const cfg = configs[status] || configs["en cours"];

  return {
    subject: `${cfg.icon} Candidature ${status} — ${offerTitle}`,
    html: layout(`Candidature ${status}`, `
      <div style="text-align:center;margin-bottom:32px;">
        <div style="font-size:48px;margin-bottom:16px;">${cfg.icon}</div>
        <h1 style="margin:0 0 8px;font-size:24px;font-weight:800;color:#0F172A;">${cfg.title}</h1>
      </div>

      <div style="background:${cfg.bg};border-radius:12px;padding:20px;margin-bottom:24px;border-left:4px solid ${cfg.borderColor};">
        <p style="margin:0;font-size:15px;color:#0F172A;line-height:1.7;">${cfg.message}</p>
      </div>

      <div style="background:#F8FAFC;border-radius:12px;padding:20px;margin-bottom:28px;">
        <table width="100%" cellpadding="0" cellspacing="0">
          ${infoRow("Candidat", studentName)}
          ${infoRow("Offre", offerTitle)}
          ${infoRow("Entreprise", companyName)}
          ${infoRow("Nouveau statut", status.charAt(0).toUpperCase() + status.slice(1))}
        </table>
      </div>

      <div style="text-align:center;">
        ${button("Voir mes candidatures", `${process.env.CLIENT_URL || "http://localhost:5173"}/dashboard/student/applications`, cfg.color)}
      </div>
    `),
  };
};

// 5. Entretien proposé (à l'étudiant)
const interviewProposedTemplate = ({ studentName, companyName, offerTitle, scheduledAt, mode, location }) => {
  const date = new Date(scheduledAt).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const time = new Date(scheduledAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  const modeIcon = mode === "présentiel" ? "🏢" : "💻";

  return {
    subject: `📅 Entretien proposé — ${offerTitle}`,
    html: layout("Entretien proposé", `
      <div style="text-align:center;margin-bottom:32px;">
        <div style="font-size:48px;margin-bottom:16px;">📅</div>
        <h1 style="margin:0 0 8px;font-size:24px;font-weight:800;color:#0F172A;">Entretien proposé !</h1>
        <p style="margin:0;color:#64748B;font-size:15px;">${companyName} souhaite vous rencontrer.</p>
      </div>

      <p style="color:#475569;font-size:15px;line-height:1.7;margin:0 0 24px;">
        Bonjour <strong>${studentName}</strong>, vous avez reçu une proposition d'entretien. Connectez-vous pour confirmer ou refuser.
      </p>

      <div style="background:#EFF6FF;border-radius:16px;padding:24px;margin-bottom:28px;text-align:center;">
        <p style="margin:0 0 4px;font-size:13px;color:#64748B;text-transform:uppercase;letter-spacing:0.05em;font-weight:600;">Date & heure</p>
        <p style="margin:0 0 16px;font-size:22px;font-weight:800;color:#1D4ED8;">${date} à ${time}</p>
        <div style="display:inline-block;background:white;border-radius:10px;padding:10px 20px;">
          <span style="font-size:14px;font-weight:600;color:#0F172A;">${modeIcon} ${mode === "présentiel" ? "Présentiel" : "En ligne"}</span>
          ${location ? `<span style="font-size:13px;color:#64748B;margin-left:8px;">— ${location}</span>` : ""}
        </div>
      </div>

      <div style="background:#F8FAFC;border-radius:12px;padding:20px;margin-bottom:28px;">
        <table width="100%" cellpadding="0" cellspacing="0">
          ${infoRow("Entreprise", companyName)}
          ${infoRow("Offre", offerTitle)}
          ${infoRow("Mode", mode === "présentiel" ? "Présentiel" : "En ligne")}
          ${location ? infoRow("Lieu / Lien", location) : ""}
        </table>
      </div>

      <div style="text-align:center;">
        ${button("Confirmer l'entretien", `${process.env.CLIENT_URL || "http://localhost:5173"}/dashboard/student/interviews`)}
      </div>
    `),
  };
};

// 6. Statut entretien mis à jour
const interviewStatusTemplate = ({ recipientName, status, offerTitle, scheduledAt }) => {
  const configs = {
    "confirmé": { icon: "✅", title: "Entretien confirmé !", color: "#10B981", message: "L'entretien a été confirmé. Préparez-vous bien !" },
    "annulé":   { icon: "❌", title: "Entretien annulé",    color: "#EF4444", message: "L'entretien a été annulé. Consultez la plateforme pour plus d'informations." },
    "terminé":  { icon: "🏁", title: "Entretien terminé",   color: "#8B5CF6", message: "L'entretien est maintenant marqué comme terminé." },
  };
  const cfg = configs[status] || { icon: "📅", title: "Mise à jour entretien", color: "#2563EB", message: `Le statut de votre entretien est maintenant : ${status}.` };
  const date = new Date(scheduledAt).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  return {
    subject: `${cfg.icon} Entretien ${status} — ${offerTitle}`,
    html: layout(`Entretien ${status}`, `
      <div style="text-align:center;margin-bottom:32px;">
        <div style="font-size:48px;margin-bottom:16px;">${cfg.icon}</div>
        <h1 style="margin:0 0 8px;font-size:24px;font-weight:800;color:#0F172A;">${cfg.title}</h1>
      </div>

      <p style="color:#475569;font-size:15px;line-height:1.7;margin:0 0 24px;">
        Bonjour <strong>${recipientName}</strong>, ${cfg.message}
      </p>

      <div style="background:#F8FAFC;border-radius:12px;padding:20px;margin-bottom:28px;">
        <table width="100%" cellpadding="0" cellspacing="0">
          ${infoRow("Offre", offerTitle)}
          ${infoRow("Date prévue", date)}
          ${infoRow("Nouveau statut", status.charAt(0).toUpperCase() + status.slice(1))}
        </table>
      </div>

      <div style="text-align:center;">
        ${button("Voir mes entretiens", `${process.env.CLIENT_URL || "http://localhost:5173"}/dashboard/student/interviews`, cfg.color)}
      </div>
    `),
  };
};

// 7. Nouveau message reçu
const newMessageTemplate = ({ recipientName, senderName, preview, link }) => ({
  subject: `💬 Nouveau message de ${senderName}`,
  html: layout("Nouveau message", `
    <div style="text-align:center;margin-bottom:32px;">
      <div style="font-size:48px;margin-bottom:16px;">💬</div>
      <h1 style="margin:0 0 8px;font-size:24px;font-weight:800;color:#0F172A;">Nouveau message</h1>
      <p style="margin:0;color:#64748B;font-size:15px;">${senderName} vous a envoyé un message.</p>
    </div>

    <p style="color:#475569;font-size:15px;line-height:1.7;margin:0 0 20px;">
      Bonjour <strong>${recipientName}</strong>,
    </p>

    <div style="background:#F8FAFC;border-radius:12px;padding:20px;margin-bottom:28px;border-left:4px solid #2563EB;">
      <p style="margin:0 0 8px;font-size:12px;color:#94A3B8;text-transform:uppercase;font-weight:700;letter-spacing:0.05em;">Message de ${senderName}</p>
      <p style="margin:0;font-size:15px;color:#0F172A;line-height:1.6;font-style:italic;">"${preview.length > 200 ? preview.substring(0, 200) + "…" : preview}"</p>
    </div>

    <div style="text-align:center;">
      ${button("Répondre au message", `${process.env.CLIENT_URL || "http://localhost:5173"}${link}`)}
    </div>
  `),
});

// 8. Nouvelle inscription — notification admin
const newUserAdminTemplate = ({ userName, userEmail, userRole }) => {
  const roleLabel = { étudiant: "Étudiant", admin: "Administrateur" }[userRole] || userRole;
  const roleColor = { étudiant: "#2563EB", admin: "#8B5CF6" }[userRole] || "#2563EB";

  return {
    subject: `👤 Nouvelle inscription — ${userName} (${roleLabel})`,
    html: layout("Nouvelle inscription", `
      <div style="text-align:center;margin-bottom:32px;">
        <div style="font-size:48px;margin-bottom:16px;">👤</div>
        <h1 style="margin:0 0 8px;font-size:24px;font-weight:800;color:#0F172A;">Nouvelle inscription</h1>
        <p style="margin:0;color:#64748B;font-size:15px;">Un nouvel utilisateur vient de rejoindre TheBridgeFlow.</p>
      </div>

      <div style="background:#F8FAFC;border-radius:12px;padding:20px;margin-bottom:24px;">
        <table width="100%" cellpadding="0" cellspacing="0">
          ${infoRow("Nom", userName)}
          ${infoRow("Email", userEmail)}
          ${infoRow("Rôle", `<span style="background:${roleColor}18;color:${roleColor};padding:3px 10px;border-radius:999px;font-size:12px;font-weight:700;">${roleLabel}</span>`)}
          ${infoRow("Date", new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }))}
        </table>
      </div>

      <div style="text-align:center;">
        ${button("Gérer les utilisateurs", `${process.env.CLIENT_URL || "http://localhost:5173"}/dashboard/admin/users`, "#8B5CF6")}
      </div>
    `),
  };
};


// 9. Compte créé par un administrateur (identifiants de connexion)
const accountCreatedByAdminTemplate = ({ name, email, password, role }) => {
  const roleLabel = { étudiant: "Étudiant", admin: "Administrateur" }[role] || role;

  return {
    subject: "🔑 Votre compte TheBridgeFlow a été créé",
    html: layout("Compte créé", `
      <div style="text-align:center;margin-bottom:32px;">
        <div style="font-size:48px;margin-bottom:16px;">🔑</div>
        <h1 style="margin:0 0 8px;font-size:26px;font-weight:800;color:#0F172A;">Bienvenue, ${name} !</h1>
        <p style="margin:0;color:#64748B;font-size:15px;">Un administrateur vous a créé un compte ${roleLabel} sur TheBridgeFlow.</p>
      </div>

      <div style="background:linear-gradient(135deg,#EFF6FF,#E0E7FF);border-radius:16px;padding:24px;margin-bottom:28px;">
        <table width="100%" cellpadding="0" cellspacing="0">
          ${infoRow("Email", email)}
          ${infoRow("Mot de passe temporaire", `<span style="font-family:monospace;font-size:15px;">${password}</span>`)}
        </table>
      </div>

      <div style="background:#FEF9C3;border-radius:12px;padding:16px;margin-bottom:28px;border-left:4px solid #F59E0B;">
        <p style="margin:0;font-size:13px;color:#92400E;">
          ⚠️ <strong>Pensez à changer ce mot de passe</strong> dès votre première connexion, depuis votre profil.
        </p>
      </div>

      <div style="text-align:center;">
        ${button("Me connecter", `${process.env.CLIENT_URL || "http://localhost:5173"}/login`)}
      </div>
    `),
  };
};

// 10. Code de vérification email
const verifyCodeTemplate = ({ name, code }) => ({
  subject: `🔐 Votre code de vérification TheBridgeFlow — ${code}`,
  html: layout("Code de vérification", `
    <div style="text-align:center;margin-bottom:32px;">
      <div style="font-size:48px;margin-bottom:16px;">🔐</div>
      <h1 style="margin:0 0 8px;font-size:24px;font-weight:800;color:#0F172A;">Vérifiez votre email</h1>
      <p style="margin:0;color:#64748B;font-size:15px;">Bonjour <strong>${name}</strong>, utilisez ce code pour accéder à votre espace.</p>
    </div>

    <div style="background:linear-gradient(135deg,#EFF6FF,#E0E7FF);border-radius:16px;padding:32px;margin-bottom:28px;text-align:center;">
      <p style="margin:0 0 12px;font-size:13px;color:#64748B;text-transform:uppercase;letter-spacing:0.08em;font-weight:600;">Votre code de vérification</p>
      <div style="display:inline-block;background:white;border-radius:12px;padding:16px 40px;box-shadow:0 4px 12px rgba(37,99,235,0.15);">
        <span style="font-size:42px;font-weight:900;color:#2563EB;letter-spacing:12px;font-family:monospace;">${code}</span>
      </div>
      <p style="margin:16px 0 0;font-size:13px;color:#94A3B8;">⏱️ Ce code expire dans <strong>15 minutes</strong></p>
    </div>

    <div style="background:#FEF9C3;border-radius:12px;padding:16px;margin-bottom:28px;border-left:4px solid #F59E0B;">
      <p style="margin:0;font-size:13px;color:#92400E;">
        ⚠️ <strong>Important :</strong> Ne partagez jamais ce code. TheBridgeFlow ne vous demandera jamais ce code par téléphone.
      </p>
    </div>

    <p style="font-size:13px;color:#94A3B8;text-align:center;margin:0;">
      Si vous n'avez pas demandé ce code, ignorez cet email.
    </p>
  `),
});

// 11. Réinitialisation de mot de passe
const resetPasswordTemplate = ({ name, resetUrl }) => ({
  subject: "🔑 Réinitialisez votre mot de passe TheBridgeFlow",
  html: layout("Réinitialisation du mot de passe", `
    <div style="text-align:center;margin-bottom:32px;">
      <div style="font-size:48px;margin-bottom:16px;">🔑</div>
      <h1 style="margin:0 0 8px;font-size:24px;font-weight:800;color:#0F172A;">Réinitialisez votre mot de passe</h1>
      <p style="margin:0;color:#64748B;font-size:15px;">Bonjour <strong>${name}</strong>, une demande de réinitialisation a été effectuée pour votre compte.</p>
    </div>

    <div style="text-align:center;margin-bottom:28px;">
      ${button("Choisir un nouveau mot de passe", resetUrl)}
    </div>

    <div style="background:#FEF9C3;border-radius:12px;padding:16px;margin-bottom:28px;border-left:4px solid #F59E0B;">
      <p style="margin:0;font-size:13px;color:#92400E;">
        ⏱️ <strong>Ce lien expire dans 1 heure</strong> et ne peut être utilisé qu'une seule fois.
      </p>
    </div>

    <p style="font-size:13px;color:#94A3B8;text-align:center;margin:0;">
      Si vous n'êtes pas à l'origine de cette demande, ignorez cet email — votre mot de passe reste inchangé.
    </p>
  `),
});

const sendEmail = async ({ to, subject, html }) => {
  const startedAt = Date.now();
  try {
    const client = getClient();
    const response = await client.transactionalEmails.sendTransacEmail({
      sender: parseSender(process.env.EMAIL_FROM),
      to: [{ email: to }],
      subject,
      htmlContent: html,
    });
    console.log(`✅ [email] Envoi réussi — destinataire=${to} sujet="${subject}" messageId=${response.messageId} (${Date.now() - startedAt}ms)`);
    return { success: true, messageId: response.messageId };
  } catch (err) {
    console.error(`❌ [email] Échec d'envoi — destinataire=${to} sujet="${subject}" :`, {
      statusCode: err.statusCode,
      message:    err.message,
      body:       err.body,
      durationMs: Date.now() - startedAt,
      stack:      err.stack,
    });
    return { success: false, error: err.message, code: err.statusCode };
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
  sendNewMessage:          (to, data) => sendEmail({ to, ...newMessageTemplate(data) }),
  sendNewUserAdmin:        (to, data) => sendEmail({ to, ...newUserAdminTemplate(data) }),
  sendAccountCreatedByAdmin: (to, data) => sendEmail({ to, ...accountCreatedByAdminTemplate(data) }),
  sendVerifyCode:          (to, data) => sendEmail({ to, ...verifyCodeTemplate(data) }),
  sendResetPassword:       (to, data) => sendEmail({ to, ...resetPasswordTemplate(data) }),
};

export default emailService;
