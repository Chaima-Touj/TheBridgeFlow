# Guide de déploiement — TheBridgeFlow

Ce document liste tout ce qui est nécessaire pour déployer ou reprendre
le projet TheBridgeFlow à partir de zéro (nouvelle machine, nouveau
serveur, transmission à une autre personne).

## 1. Prérequis (comptes/services externes à créer)

| Service | Usage | Où le créer |
|---|---|---|
| MongoDB Atlas | Base de données | https://cloud.mongodb.com |
| Google Cloud Console | OAuth (login Google) + Google Drive API | https://console.cloud.google.com |
| Facebook for Developers | OAuth (login Facebook) | https://developers.facebook.com |
| Groq | Assistant IA SAGE (LLM) | https://console.groq.com |
| Brevo | Envoi d'emails transactionnels | https://app.brevo.com |
| Render | Hébergement frontend + backend | https://render.com |

## 2. Variables d'environnement — Backend (`thebridgeflow-back/.env`)

| Variable | Description |
|---|---|
| `MONGO_URI` | URI de connexion MongoDB Atlas |
| `JWT_SECRET` | Clé secrète pour signer les jetons JWT |
| `JWT_EXPIRES_IN` | Durée de validité du jeton (ex: `7d`) |
| `PORT` | Port d'écoute du serveur (ex: `5000`) |
| `NODE_ENV` | Environnement d'exécution (`production` en déploiement réel — active le rate limiting sur `/api/auth` et masque les stack traces d'erreur ; toute autre valeur les désactive) |
| `CLIENT_URL` | URL du frontend déployé (pour CORS/redirections) |
| `GROQ_API_KEY` | Clé API Groq pour l'assistant SAGE |
| `BREVO_API_KEY` | Clé API Brevo pour l'envoi d'emails |
| `EMAIL_FROM` | Adresse d'expédition des emails transactionnels |
| `GOOGLE_CLIENT_ID` | Client ID OAuth Google (vérification des jetons) |
| `FACEBOOK_APP_ID` | App ID Facebook |
| `FACEBOOK_APP_SECRET` | App Secret Facebook |

Un exemple sans valeurs réelles est disponible dans
`thebridgeflow-back/.env.example`.

## 3. Variables d'environnement — Frontend (`thebridgeflow-front/.env`)

| Variable | Description |
|---|---|
| `VITE_API_URL` | URL de l'API backend (ex: `http://localhost:5000/api` en local) |
| `VITE_GOOGLE_CLIENT_ID` | Client ID OAuth Google (côté client) |
| `VITE_FACEBOOK_APP_ID` | App ID Facebook (côté client) |

Un exemple sans valeurs réelles est disponible dans
`thebridgeflow-front/.env.example`.

## 4. Google Drive — Stockage des vidéos (important)

Toutes les vidéos de formation, ainsi que les témoignages et la vidéo
promotionnelle de la Landing Page, sont hébergées sur un **Shared Drive
Google nommé "Formation"**, et non sur le disque du serveur.

**Points critiques à respecter en cas de migration ou de reprise :**
- Le Shared Drive "Formation" doit rester partagé en mode
  **"Tous les utilisateurs disposant du lien — Lecteur"**. Si ce
  partage est retiré, toutes les vidéos du site cessent de fonctionner
  (redirection vers une page de connexion Google au lieu de la vidéo).
- Les scripts de migration se trouvent dans
  `thebridgeflow-back/scripts/drive/` (authenticate.js, inventory.js,
  migrate.js, inventory-landing.js, migrate-landing.js).
- L'authentification à l'API Google Drive nécessite un fichier
  `credentials-drive1.json` (Client OAuth Desktop app, téléchargeable
  depuis Google Cloud Console > APIs & Services > Credentials) placé à
  la racine de `thebridgeflow-back/`. Ce fichier n'est PAS versionné
  (`.gitignore`) et doit être régénéré si perdu.
- Une fois authentifié une première fois (`node scripts/drive/authenticate.js
  drive1`), un fichier `token-drive1.json` est généré et permet les
  authentifications suivantes sans repasser par le navigateur.

## 5. Déploiement sur Render

Le projet est un monorepo à deux services Render distincts.

### Service Backend (Node)
- **Root Directory** : `thebridgeflow-back`
- **Build Command** : `npm install`
- **Start Command** : `npm start`
- Renseigner toutes les variables d'environnement de la section 2.

### Service Frontend (Static Site)
- **Root Directory** : `thebridgeflow-front`
- **Build Command** : `npm install && npm run build`
- **Publish Directory** : `dist`
- Renseigner les variables d'environnement de la section 3, avec
  `VITE_API_URL` pointant vers l'URL du service backend Render.

Après toute modification des paramètres, effectuer un **Manual Deploy
> Deploy latest commit** sur les deux services.

## 6. Comptes administrateur

Un compte administrateur est nécessaire pour accéder au tableau de
bord `/dashboard/admin`. Pour en créer un :

```bash
cd thebridgeflow-back
node scripts/createAdmin.js
```

⚠️ Changer immédiatement le mot de passe de tout compte admin de test
avant mise en production réelle.

## 7. Synchronisation avec les dépôts de l'encadrant

Le projet est également synchronisé (miroir) vers deux dépôts distincts
appartenant à l'encadrant Bee Coders (frontend et backend séparés),
via le script `push-all.sh` à la racine du projet :

```bash
./push-all.sh
```

Ce script pousse successivement vers le dépôt principal (`origin`) puis
vers les deux dépôts miroirs (`encadrant-front`, `encadrant-back`) en
utilisant `git subtree split`. Les remotes correspondants doivent être
configurés localement (`git remote -v` pour vérifier).

## 8. Vérifications post-déploiement

- [ ] Le frontend charge sans erreur console
- [ ] L'inscription + vérification email fonctionne (email reçu via Brevo)
- [ ] La connexion Google/Facebook fonctionne
- [ ] Une vidéo de formation se charge correctement (test du partage Drive)
- [ ] Le dashboard admin est accessible et affiche des statistiques réelles
- [ ] L'assistant SAGE répond correctement à une question
