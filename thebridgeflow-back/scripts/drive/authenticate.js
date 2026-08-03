/**
 * Étape 1 — Authentification OAuth2 (une fois par compte).
 *
 * Usage :
 *   node thebridgeflow-back/scripts/drive/authenticate.js drive1
 *   node thebridgeflow-back/scripts/drive/authenticate.js drive2
 *
 * Prérequis (à faire une seule fois, dans Google Cloud Console, pour CHACUN
 * des deux Client ID utilisés par credentials-drive1.json / -drive2.json) :
 *   APIs & Services → Credentials → cliquer sur le Client ID → section
 *   "Authorized redirect URIs" → Add URI → coller exactement :
 *     http://localhost:53682/oauth2callback
 *   → Save. Sans ça, Google renvoie "redirect_uri_mismatch" et l'échange du
 *   code échoue (voir oauthClient.js pour le détail).
 *
 * Déroulement : génère le lien de consentement, tente de l'ouvrir dans le
 * navigateur par défaut (Windows), démarre un serveur local temporaire qui
 * intercepte la redirection après autorisation, échange le code contre un
 * token, et le sauvegarde dans thebridgeflow-back/token-<compte>.json (gitignore).
 */
import http from "http";
import { URL } from "url";
import { exec } from "child_process";
import { createOAuthClient, saveToken, REDIRECT_URI, SCOPES, ACCOUNTS } from "./oauthClient.js";

const accountKey = process.argv[2];

if (!ACCOUNTS[accountKey]) {
  console.error("Usage : node thebridgeflow-back/scripts/drive/authenticate.js <drive1|drive2>");
  process.exit(1);
}

function openBrowser(url) {
  try {
    // BUG CORRIGÉ — 1re version (spawn("cmd", ["/c","start","",url])) :
    // Google renvoyait "invalid_request — Required parameter is missing:
    // response_type". Cause réelle : `spawn()` avec un tableau d'arguments
    // applique sa PROPRE couche d'échappement Win32/CreateProcess à chaque
    // élément AVANT de lancer cmd.exe — qui, lui, relit ensuite toute la
    // ligne comme un texte brut selon SES propres règles (tout "&" non
    // protégé = séparateur de commandes). Les deux couches d'échappement
    // entraient en conflit : même en enveloppant l'URL de guillemets
    // littéraux ("${url}"), spawn() les transformait en \" avant que cmd.exe
    // ne les voie, donc son "&" restait interprété comme séparateur — l'URL
    // (qui contient access_type=...&scope=...&response_type=code&...) était
    // tronquée au premier "&", d'où le paramètre manquant côté Google.
    //
    // exec() prend une SEULE chaîne brute et la transmet au shell sans la
    // ré-échapper argument par argument — mes guillemets littéraux arrivent
    // intacts à cmd.exe, qui traite alors correctement toute l'URL comme un
    // seul token. Vérifié : `cmd /c echo start "" "<url avec &>"` ressort
    // caractère pour caractère identique en sortie.
    exec(`start "" "${url}"`);
  } catch {
    // Silencieux — l'URL reste affichée dans la console en secours.
  }
}

async function main() {
  const oAuth2Client = createOAuthClient(accountKey);
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent", // force un refresh_token même si déjà autorisé précédemment
    scope: SCOPES,
  });

  const redirectUrl = new URL(REDIRECT_URI);
  const port = Number(redirectUrl.port);

  const code = await new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const reqUrl = new URL(req.url, REDIRECT_URI);
      if (reqUrl.pathname !== redirectUrl.pathname) {
        res.writeHead(404).end();
        return;
      }

      const error = reqUrl.searchParams.get("error");
      const authCode = reqUrl.searchParams.get("code");

      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      if (error) {
        res.end(`<h2>Autorisation refusée (${error}). Vous pouvez fermer cet onglet.</h2>`);
        server.close();
        reject(new Error(`Autorisation refusée par l'utilisateur : ${error}`));
        return;
      }
      res.end("<h2>Autorisation reçue ✅ — vous pouvez fermer cet onglet et revenir au terminal.</h2>");
      server.close();
      resolve(authCode);
    });

    server.on("error", (err) => {
      reject(new Error(
        `Impossible d'écouter sur le port ${port} (déjà utilisé ?) : ${err.message}`
      ));
    });

    server.listen(port, () => {
      console.log(`\n[${accountKey}] Ouvre ce lien dans ton navigateur si l'ouverture automatique échoue :\n`);
      console.log(authUrl + "\n");
      console.log("En attente de l'autorisation (connecte-toi avec le compte Google correspondant)...\n");
      openBrowser(authUrl);
    });
  });

  const { tokens } = await oAuth2Client.getToken(code);
  saveToken(accountKey, tokens);
  console.log(`[${accountKey}] ✅ Token sauvegardé dans thebridgeflow-back/token-${accountKey}.json`);
}

main().catch((err) => {
  console.error(`\n[${accountKey}] Échec de l'authentification : ${err.message}`);
  process.exit(1);
});
