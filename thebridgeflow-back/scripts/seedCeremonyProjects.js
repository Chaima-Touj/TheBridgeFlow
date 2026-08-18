/**
 * Script one-off — crée 6 CeremonyProject de démo (contenu plausible,
 * voteCount variés) pour visualiser le rendu réel (cartes, détail,
 * leaderboard podium) avant que de vrais étudiants ne soumettent des
 * projets. Associés à des comptes étudiants EXISTANTS en base (aucun faux
 * utilisateur créé).
 *
 * Image de couverture : compressImageToBase64 (utils/imageCompression.js)
 * est un utilitaire CÔTÉ NAVIGATEUR (FileReader + <canvas>, voir son
 * commentaire) — inutilisable tel quel dans un script Node. Même résultat
 * de stockage obtenu autrement : un SVG généré localement (pas de nouvelle
 * dépendance), encodé en base64 dans une data URI — CeremonyProject.coverImage
 * est un simple String, agnostique de la méthode de génération ; le rendu
 * (<img src={coverImage}>) fonctionne à l'identique.
 *
 * Marqueur `isSeedData: true` (voir models/ceremonyProject.model.js) — jamais
 * positionné par le flux normal de création, sert uniquement à --clean pour
 * ne retirer QUE les documents créés ici.
 *
 * SANS --confirm : dry run, affiche ce qui serait créé/supprimé. AUCUNE écriture.
 * AVEC --confirm : exécute réellement.
 *
 * Usage :
 *   node thebridgeflow-back/scripts/seedCeremonyProjects.js                     (dry run création)
 *   node thebridgeflow-back/scripts/seedCeremonyProjects.js --confirm           (création réelle)
 *   node thebridgeflow-back/scripts/seedCeremonyProjects.js --clean             (dry run suppression)
 *   node thebridgeflow-back/scripts/seedCeremonyProjects.js --clean --confirm   (suppression réelle)
 */
import "dotenv/config";
import mongoose from "mongoose";
import CeremonyProject from "../models/ceremonyProject.model.js";
import User from "../models/users.model.js";

const CONFIRM = process.argv.includes("--confirm");
const CLEAN   = process.argv.includes("--clean");

// ── Génération d'une couverture placeholder (SVG → base64 data URI) ────────
// Pas de photo réelle disponible pour des projets fictifs — un aplat de
// couleur + les initiales du titre suffit à distinguer visuellement les
// cartes dans le leaderboard/la grille, sans dépendance supplémentaire.
function initials(title) {
  return title
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}

// Éclaircit (percent > 0) ou assombrit (percent < 0) une couleur hex — deux
// tons de la même teinte pour un dégradé au lieu d'un aplat uni.
function shade(hex, percent) {
  const num = parseInt(hex.replace("#", ""), 16);
  const amt = Math.round(2.55 * percent);
  const r = Math.min(255, Math.max(0, (num >> 16) + amt));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0xff) + amt));
  const b = Math.min(255, Math.max(0, (num & 0xff) + amt));
  return `#${(0x1000000 + r * 0x10000 + g * 0x100 + b).toString(16).slice(1)}`;
}

function makeSvgCover(title, color) {
  const label = initials(title);
  const light = shade(color, 16);
  const dark = shade(color, -16);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360">
  <defs>
    <linearGradient id="cover" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${light}"/>
      <stop offset="100%" stop-color="${dark}"/>
    </linearGradient>
  </defs>
  <rect width="640" height="360" fill="url(#cover)"/>
  <text x="320" y="200" font-family="Arial, sans-serif" font-size="120" font-weight="700"
        fill="#ffffff" text-anchor="middle" opacity="0.9">${label}</text>
</svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

// ── Faux identifiants Drive/GitHub — format valide, aucune ressource réelle ─
const DRIVE_ID_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-";
function fakeDriveId() {
  let id = "";
  for (let i = 0; i < 33; i++) id += DRIVE_ID_CHARS[Math.floor(Math.random() * DRIVE_ID_CHARS.length)];
  return id;
}
function fakeDriveUrl() {
  return `https://drive.google.com/file/d/${fakeDriveId()}/view`;
}
function slugify(s) {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

// ── Les 6 projets de démo ────────────────────────────────────────────────
// studentEmail : associé à un compte étudiant réel existant (résolu en
// studentId juste avant l'écriture, jamais codé en dur).
const DEMO_PROJECTS = [
  {
    title: "EcoTrack",
    description: "Application de suivi de l'empreinte carbone pour les campus universitaires, avec tableau de bord de recommandations personnalisées.",
    technologies: ["React Native", "Node.js", "MongoDB", "Chart.js"],
    color: "#10B981",
    studentEmail: "chaima.touj@imset.com",
    voteCount: 15,
    teamMembers: [],
  },
  {
    title: "StudyBuddy",
    description: "Plateforme de révision collaborative avec génération de flashcards et de quiz assistée par IA.",
    technologies: ["Next.js", "Python", "FastAPI", "OpenAI API"],
    color: "#6366F1",
    studentEmail: "shimaa.benali@isi.utm.tn",
    voteCount: 10,
    teamMembers: ["Amine Kort"],
  },
  {
    title: "CampusMap",
    description: "Carte interactive du campus avec navigation en intérieur et géolocalisation des salles et événements.",
    technologies: ["Flutter", "Firebase", "Google Maps API"],
    color: "#F59E0B",
    studentEmail: "tjchaima08@gmail.com",
    voteCount: 8,
    teamMembers: [],
  },
  {
    title: "SkillMatch AI",
    description: "Moteur de recommandation qui associe automatiquement le profil d'un étudiant aux offres de stage les plus pertinentes via traitement du langage naturel.",
    technologies: ["Python", "FastAPI", "scikit-learn", "PostgreSQL"],
    color: "#8B5CF6",
    studentEmail: "michoum746@gmail.com",
    voteCount: 5,
    teamMembers: ["Sarra Nasri", "Wassim Trabelsi"],
  },
  {
    title: "SecureVote",
    description: "Système de vote électronique sécurisé pour les élections étudiantes, basé sur une blockchain privée.",
    technologies: ["Node.js", "Solidity", "React", "Hardhat"],
    color: "#EF4444",
    studentEmail: "yasmineothmani284@gmail.com",
    voteCount: 2,
    teamMembers: [],
  },
  {
    title: "BizIntel Dashboard",
    description: "Tableau de bord Business Intelligence pour PME, avec ETL automatisé et visualisations en temps réel.",
    technologies: ["Power BI", "Python", "SQL Server", "Airflow"],
    color: "#0EA5E9",
    studentEmail: "ahmed.bensalah@universite.tn",
    voteCount: 0,
    teamMembers: [],
  },
];

async function runSeed() {
  const emails = DEMO_PROJECTS.map((p) => p.studentEmail);
  const students = await User.find({ email: { $in: emails } }).select("_id name email").lean();
  const byEmail = new Map(students.map((s) => [s.email, s]));

  const missing = emails.filter((e) => !byEmail.has(e));
  if (missing.length > 0) {
    console.error(`❌ Compte(s) étudiant introuvable(s) en base, arrêt : ${missing.join(", ")}`);
    process.exitCode = 1;
    return;
  }

  console.log(`${DEMO_PROJECTS.length} projet(s) de démo à ${CONFIRM ? "créer" : "prévisualiser"} :\n`);

  for (const p of DEMO_PROJECTS) {
    const student = byEmail.get(p.studentEmail);
    const doc = {
      studentId:     student._id,
      title:         p.title,
      description:   p.description,
      technologies:  p.technologies,
      coverImage:    makeSvgCover(p.title, p.color),
      driveAppUrl:   fakeDriveUrl(),
      driveVideoUrl: fakeDriveUrl(),
      githubUrl:     `https://github.com/${slugify(student.name)}/${slugify(p.title)}`,
      teamMembers:   p.teamMembers,
      voteCount:     p.voteCount,
      isSeedData:    true,
      // Explicite plutôt que de compter sur le default du schéma — des
      // projets de démo doivent être visibles immédiatement, sans passer
      // par la modération admin.
      status:        "approuvé",
    };

    console.log(`  📁 ${doc.title}  (${doc.voteCount} votes)`);
    console.log(`     Auteur      : ${student.name} <${student.email}>`);
    console.log(`     Description : ${doc.description}`);
    console.log(`     Tech        : ${doc.technologies.join(", ")}`);
    console.log(`     Équipe      : ${doc.teamMembers.length ? doc.teamMembers.join(", ") : "(solo)"}`);
    console.log(`     Drive app   : ${doc.driveAppUrl}`);
    console.log(`     Drive vidéo : ${doc.driveVideoUrl}`);
    console.log(`     GitHub      : ${doc.githubUrl}`);
    console.log(`     Couverture  : SVG base64, ${doc.coverImage.length} caractères`);
    console.log("");

    if (CONFIRM) {
      await CeremonyProject.create(doc);
    }
  }

  console.log(
    CONFIRM
      ? `✅ ${DEMO_PROJECTS.length} projet(s) créé(s).`
      : `👁  Dry run — rien écrit. Relance avec --confirm pour créer réellement.`
  );
}

async function runClean() {
  const existing = await CeremonyProject.find({ isSeedData: true }).select("title voteCount studentId").populate("studentId", "name").lean();

  if (existing.length === 0) {
    console.log("Aucun projet de démo (isSeedData: true) trouvé en base — rien à nettoyer.");
    return;
  }

  console.log(`${existing.length} projet(s) de démo trouvé(s) (isSeedData: true) :\n`);
  for (const p of existing) {
    console.log(`  📁 ${p.title}  (${p.voteCount} votes, auteur: ${p.studentId?.name || "?"})`);
  }

  if (CONFIRM) {
    const res = await CeremonyProject.deleteMany({ isSeedData: true });
    console.log(`\n✅ ${res.deletedCount} projet(s) de démo supprimé(s).`);
  } else {
    console.log(`\n👁  Dry run — rien supprimé. Relance avec --clean --confirm pour supprimer réellement.`);
  }
}

async function main() {
  console.log("Connexion à MongoDB...");
  await mongoose.connect(process.env.MONGO_URI);

  if (CLEAN) {
    await runClean();
  } else {
    await runSeed();
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("\nErreur :", err.message);
  process.exit(1);
});
