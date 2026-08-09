/**
 * Client OAuth2 partagé pour les 2 comptes Google Drive (migration Cloudinary
 * → Drive). Utilisé par authenticate.js (étape 1) et inventory.js (étape 2).
 *
 * IMPORTANT — credentials-drive1.json / credentials-drive2.json sont des
 * clients OAuth de type "Web application" (pas "Desktop app") : Google exige
 * que REDIRECT_URI soit enregistrée EXACTEMENT telle quelle dans la Google
 * Cloud Console pour CHACUN des deux Client ID (APIs & Services →
 * Credentials → [Client ID] → Authorized redirect URIs), sinon l'échange du
 * code d'autorisation échoue avec "redirect_uri_mismatch". Voir authenticate.js.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { google } from "googleapis";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER_ROOT = path.resolve(__dirname, "../.."); // thebridgeflow-back/

export const REDIRECT_URI = "http://localhost:53682/oauth2callback";
// drive.file (en plus de readonly, pas à la place) : périmètre minimal pour
// pouvoir CRÉER de nouveaux fichiers (upload des miniatures générées) sans
// élargir à l'accès complet en écriture ("drive") sur tout le contenu
// existant — readonly reste nécessaire pour toutes les lectures déjà
// utilisées par les autres scripts (inventory.js, migrate.js...), drive.file
// ne couvrirait pas seul la lecture de fichiers préexistants non créés par
// cette appli. Nécessite une nouvelle exécution de authenticate.js pour que
// le token existant (autorisé sous l'ancien scope) prenne en compte celui-ci.
export const SCOPES = [
  "https://www.googleapis.com/auth/drive.readonly",
  "https://www.googleapis.com/auth/drive.file",
];

export const ACCOUNTS = {
  drive1: {
    credentialsPath: path.join(SERVER_ROOT, "credentials-drive1.json"),
    tokenPath: path.join(SERVER_ROOT, "token-drive1.json"),
  },
  drive2: {
    credentialsPath: path.join(SERVER_ROOT, "credentials-drive2.json"),
    tokenPath: path.join(SERVER_ROOT, "token-drive2.json"),
  },
};

function loadCredentials(credentialsPath) {
  if (!fs.existsSync(credentialsPath)) {
    throw new Error(`Fichier de credentials introuvable : ${credentialsPath}`);
  }
  const raw = JSON.parse(fs.readFileSync(credentialsPath, "utf8"));
  // credentials-drive2.json a une clé racine non standard ("web_2" au lieu de
  // "web" généré par Google Cloud Console) — on prend la première valeur de
  // l'objet plutôt que de supposer une clé fixe, pour rester robuste aux deux.
  const block = raw.web || raw.installed || Object.values(raw)[0];
  if (!block?.client_id || !block?.client_secret) {
    throw new Error(`Fichier de credentials invalide (client_id/client_secret manquants) : ${credentialsPath}`);
  }
  return block;
}

export function createOAuthClient(accountKey) {
  const account = ACCOUNTS[accountKey];
  if (!account) throw new Error(`Compte inconnu : "${accountKey}" (attendu: drive1 ou drive2)`);
  const { client_id, client_secret } = loadCredentials(account.credentialsPath);
  return new google.auth.OAuth2(client_id, client_secret, REDIRECT_URI);
}

export function loadSavedToken(accountKey) {
  const { tokenPath } = ACCOUNTS[accountKey];
  if (!fs.existsSync(tokenPath)) return null;
  return JSON.parse(fs.readFileSync(tokenPath, "utf8"));
}

export function saveToken(accountKey, token) {
  const { tokenPath } = ACCOUNTS[accountKey];
  fs.writeFileSync(tokenPath, JSON.stringify(token, null, 2));
}

/** Client OAuth2 prêt à l'emploi, avec le token sauvegardé chargé. Lève une
 *  erreur explicite si authenticate.js n'a pas encore été lancé pour ce compte. */
export async function getAuthorizedClient(accountKey) {
  const oAuth2Client = createOAuthClient(accountKey);
  const token = loadSavedToken(accountKey);
  if (!token) {
    throw new Error(
      `Aucun token trouvé pour "${accountKey}". Lance d'abord :\n` +
      `  node thebridgeflow-back/scripts/drive/authenticate.js ${accountKey}`
    );
  }
  oAuth2Client.setCredentials(token);
  return oAuth2Client;
}
