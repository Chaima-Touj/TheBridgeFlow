# Documentation complète — TheBridgeFlow

> Généré par analyse exhaustive du dépôt (parcours récursif de `thebridgeflow-front/` et `thebridgeflow-back/`, à l'exclusion de `node_modules/`, `.git/`, du build généré `thebridgeflow-front/dist/`, et des fichiers binaires/vidéos). Voir §6 pour la vérification d'exhaustivité et la justification de chaque exclusion.

## Sommaire

1. [Vue d'ensemble](#1-vue-densemble)
2. [Frontend (thebridgeflow-front/)](#2-frontend-thebridgeflow-front)
3. [Backend (thebridgeflow-back/)](#3-backend-thebridgeflow-back)
4. [Flux de données clés](#4-flux-de-données-clés)
5. [Tableau récapitulatif final](#5-tableau-récapitulatif-final)
6. [Vérification d'exhaustivité](#6-vérification-dexhaustivité)

---

## 1. Vue d'ensemble

### 1.1 Présentation

**TheBridgeFlow** est une plateforme web centralisée de gestion des **stages**, **PFE** (projets de fin d'études) et **formations complémentaires** au sein d'un institut de formation. Elle remplace les processus manuels dispersés (emails, fichiers Excel) par un écosystème unique avec un assistant IA (**SAGE**) pour guider l'étudiant.

Projet réalisé dans le cadre d'un Projet de Fin de Formation (PFF) — BTS Informatique de Gestion, IMSET, en partenariat avec Bee Coders. Développeuse : Chaima Touj.

### 1.2 Stack technique complète

**Frontend** — `thebridgeflow-front/` (voir `package.json`)
- React `19.2.6` + Vite `8.0.12` (`@vitejs/plugin-react`)
- React Router DOM `7.18.0` (routing)
- Axios `1.18.0` (appels API)
- Framer Motion `12.40.0` (animations)
- react-i18next `17.0.8` / i18next `26.3.1` (FR/EN/AR, RTL)
- Recharts `3.8.1` (graphiques statistiques admin)
- react-hook-form `7.79.0` + Yup `1.7.1` + `@hookform/resolvers` (formulaires + validation)
- `@react-oauth/google` (OAuth Google côté client)
- react-ga4 (Google Analytics 4)
- jsPDF + jspdf-autotable (export PDF de tableaux)
- qrcode.react, lucide-react, react-icons (UI)
- vite-plugin-pwa (Progressive Web App installable)
- Dev only : ESLint 10, sharp (traitement d'images), cloudinary (SDK, utilisé par un script de génération d'icônes/assets), dotenv

**Backend** — `thebridgeflow-back/` (voir `package.json`, type `module` ESM)
- Node.js + Express `5.2.1`
- Mongoose `9.7.2` (ODM MongoDB)
- jsonwebtoken `9.0.3` + bcryptjs `3.0.3` (auth JWT + hash mots de passe)
- google-auth-library + googleapis (vérification OAuth Google + API Google Drive)
- groq-sdk `1.5.0` (LLM Llama 3.1 — assistant SAGE)
- `@google/genai` `2.16.0` (SDK Gemini — service IA alternatif/secondaire)
- nodemailer `9.0.5` (envoi d'emails via Gmail SMTP — **remplace Brevo**, migration récente, voir §1.6)
- helmet (en-têtes de sécurité HTTP), cors, express-rate-limit (anti brute-force)
- multer (upload de fichiers : CV, images)
- cookie-parser, geoip-lite (géolocalisation IP pour les stats admin)
- Dev only : nodemon

**Base de données**
- MongoDB Atlas (cloud), via Mongoose. Inspection locale possible via MongoDB Compass.

**Services externes**
- **Groq API** (Llama 3.1 8B) — moteur principal de l'assistant conversationnel SAGE
- **Google Gemini API** (`@google/genai`) — service IA disponible en secours/alternative (`services/gemini.service.js`)
- **Google Drive API** — hébergement de toutes les vidéos de formation, témoignages et vidéo promotionnelle (Shared Drive "Formation", partagé en lecture publique par lien — voir `DEPLOYMENT.md` et §3.8)
- **Gmail SMTP** (via Nodemailer) — envoi des emails transactionnels (bienvenue, candidature, entretien, message, vérification, reset password, cérémonie). *Le `README.md` mentionne encore Brevo, mais le code actuel (`services/email.service.js`, commits du 2026-08-2x) utilise exclusivement Nodemailer + Gmail SMTP (host `smtp.gmail.com:465`, IPv4 forcé pour compatibilité Render).*
- **Google OAuth** / **Facebook Graph API** — connexion sociale
- **Google Analytics 4** (`react-ga4`) — analytics frontend
- **Cloudinary** — présent comme dépendance frontend (dev) et dans `.env.example` frontend ; utilisé historiquement pour l'hébergement vidéo avant la migration vers Google Drive (cf. scripts `scripts/drive/*migration*`)

**Déploiement**
- Render : un service Web (Node) pour `thebridgeflow-back/`, un service Static Site pour `thebridgeflow-front/` (build Vite → dossier `dist/`)
- Le dépôt est également synchronisé (miroir en lecture) vers deux dépôts séparés appartenant à l'encadrant Bee Coders via `push-all.sh` (racine du repo), utilisant `git subtree split`.

### 1.3 Architecture générale

```
┌────────────────────────┐        REST/JSON via Axios        ┌──────────────────────────┐
│   thebridgeflow-front   │ ─────────────────────────────────▶ │    thebridgeflow-back     │
│   React 19 + Vite       │ ◀───────────────────────────────── │   Node.js + Express 5     │
│   (Render Static Site)  │      cookies (refresh?) + JWT       │   (Render Web Service)    │
└────────────────────────┘        dans le header Authorization └──────────────────────────┘
                                                                          │
                                            ┌─────────────────────────────┼───────────────────────────────┐
                                            ▼                             ▼                                ▼
                                   MongoDB Atlas (Mongoose)      Groq / Gemini (SAGE)          Google Drive API (vidéos)
                                                                                                Gmail SMTP (emails)
                                                                                                Google/Facebook OAuth
```

Le frontend consomme l'API REST du backend via des modules centralisés dans `src/services/*.js`, tous construits au-dessus d'une instance Axios unique configurée dans `src/services/api.js` (base URL = `VITE_API_URL`, intercepteurs pour attacher le JWT et gérer les 401). Le token JWT est conservé côté client (voir `src/utils/tokenStorage.js` et `src/context/AuthContext.jsx`) et renvoyé au backend via l'en-tête `Authorization`. Le backend vérifie ce token dans `middleware/auth.middleware.js` (`protect`, `adminOnly`) avant d'exécuter la logique des controllers, qui interrogent MongoDB via les modèles Mongoose de `models/`.

### 1.4 Sécurité applicative (aperçu, détaillé dans `server.js`)

- `helmet()` sur toutes les routes (en-têtes HTTP sécurisés), avec une exception explicite (`Cross-Origin-Resource-Policy: cross-origin`) sur `/uploads` pour permettre l'affichage cross-origin des images uploadées (CV, news) depuis le frontend en dev (port différent).
- CORS restreint à une liste blanche d'origines (`localhost:5173` + domaines Render de prod/anciens noms).
- `express-rate-limit` : limiteur dédié et strict sur `/api/auth` (actif seulement si `NODE_ENV=production`), limiteur général sur `/api/*`, limiteur dédié plus permissif sur `/api/drive-thumbnail` (fort volume de requêtes de vignettes en simultané sur la Landing Page).
- Sanitisation NoSQL injection maison (`middleware/sanitize.middleware.js`, compatible Express 5 — `express-mongo-sanitize` classique n'est pas utilisable tel quel sous Express 5).
- `app.set("trust proxy", 1)` requis pour que le rate limiter lise correctement l'IP réelle derrière le reverse proxy Render.
- Un endpoint public `GET /sitemap.xml` régénère dynamiquement le sitemap SEO à partir des formations et offres actives en base (pas de fichier statique à maintenir).

### 1.5 Fichiers racine du dépôt (hors `thebridgeflow-front/` et `thebridgeflow-back/`)

| Fichier | Rôle |
|---|---|
| `README.md` | Présentation du projet (contexte académique PFF/IMSET/Bee Coders, stack, fonctionnalités, installation locale, équipe). Contient une architecture ASCII et un tableau des fonctionnalités clés. Mentionne encore Brevo comme service email — **information obsolète**, le code utilise désormais Nodemailer/Gmail SMTP (voir §1.2). |
| `DEPLOYMENT.md` | Guide de déploiement/reprise de zéro : comptes/services externes requis, variables d'environnement backend et frontend, procédure critique de configuration du Google Drive partagé (hébergement vidéos), instructions de déploiement Render (2 services : Web + Static Site), création d'un compte admin via `scripts/createAdmin.js`, checklist de vérification post-déploiement. |
| `.gitignore` (racine) | Ignore `.env` à la racine (générique, en plus des `.gitignore` spécifiques à chaque sous-projet). |
| `push-all.sh` | Script bash de synchronisation : pousse la branche `main` vers `origin`, puis extrait `thebridgeflow-front/` et `thebridgeflow-back/` chacun via `git subtree split` et les force-push vers deux dépôts miroirs distincts (`encadrant-front`, `encadrant-back`) appartenant à l'encadrant Bee Coders. |
| `CLAUDE.md` | Fichier de mémoire de projet pour l'assistant Claude Code (conventions de travail, structure attendue) — méta-fichier d'outillage, sans rapport avec la logique applicative. |
| `.claude/settings.local.json`, `.claude/scheduled_tasks.lock` | Configuration locale de l'outil Claude Code (permissions, verrou de tâches planifiées) — outillage de développement, hors périmètre applicatif. |

---

## 2. Frontend (thebridgeflow-front/)

### 2.1 pages/ — pages publiques, auth, ai, applications, interviews, legal

> Table exacte des routes reproduite plus loin dans cette section 2 (voir `App.jsx`, §2.9 « Fichiers de configuration à la racine »). Pages listées ici avec leur route déduite du contenu, confirmée via `App.jsx`.

#### Pages publiques racine

- **`NotFound.jsx`** (`*`) — 404 générique, lien retour accueil. Aucune donnée chargée.
- **`OffersPage.jsx`** (`/offers`) — Liste publique des offres : recherche (debounce 400ms), filtres domaine/type/ville, tri, pagination. `offersService.getDomains()` + `getAll({page,limit,sort,search,domain,type,location})`. Bouton "Postuler" → redirection `/login` si non connecté (avec `state:{from,offerId}`), sinon vers le formulaire de candidature dashboard.
- **`FormationDetail.jsx`** (`/formations/:slug`) — Détail formation : hero (prix onsite/online/enregistrements, trailer), programme par phase (`CoursePreviewModal`), encadrement, avis, `TechMarquee`, stats animées, `VideoTestimonialCarousel`, FAQ. `formationsService.getBySlug(slug)`. SEO via `useDocumentMeta`.
- **`PublicOfferDetail.jsx`** (`/offers/:id`) — Détail offre publique, compétences liées aux formations via `useFormationsTechMap()` + `buildSkillFormationMatcher` (`utils/techMatch.js`). `offersService.getOne(id)`.
- **`PricingPage.jsx`** (`/tarifs`) — 3 formules statiques (en ligne 390 DT, présentiel 490 DT, enregistrements 150 DT), 100% i18n, sans appel API.
- **`BlogPage.jsx`** (`/blog`) — Délègue tout à `NewsSection` en mode `standalone`.
- **`LandingPage.jsx`** (`/`) — Page marketing complète : hero vidéo, `TechMarquee`, `FormationCategories`, formations populaires, `CeremonySection`, 3 carrousels témoignages vidéo (Summer Camp/Formation/PFE), captures témoignages, vidéo promo (tilt 3D + autoplay `IntersectionObserver`), à propos, `NewsSection` (limit 3), formulaire de contact (**simulé côté front, pas d'appel API réel**), newsletter (idem), footer. `api.get("/formations")`, `settingsService.get()` (actionVideo + testimonialVideos), `feedbacksService.getScreenshots()`.
- **`FormationsPage.jsx`** (`/formations`) — Liste de toutes les formations, accordéon programme, CTA inscription + WhatsApp. `api.get("/formations")`.
- **`CeremonyProjectDetail.jsx`** (`/ceremonie/:id`) *(détail flux cérémonie en §4.3)* — Détail projet édition en cours : bloc de vote, QR code partageable. `ceremonyService.getProject(id)`.
- **`CeremonyArchives.jsx`** (`/ceremonie/archives`) — Liste des éditions passées. `ceremonyService.getArchives()`.
- **`CeremonyArchiveDetail.jsx`** (`/ceremonie/archives/:edition`) — Détail lecture seule d'une édition archivée (pas de vote/QR). `ceremonyService.getArchiveEdition(edition)`.
- **`CeremonyPage.jsx`** (`/ceremonie`) *(détail flux cérémonie en §4.3)* — Page principale cérémonie en cours : `CeremonyLeaderboard`, grille de projets avec tilt 3D, sélection jusqu'à 3 projets, vote. `ceremonyService.getProjects()` + `getArchives()`.

#### `pages/ai/AIAssistant.jsx` *(détail flux SAGE en §4.2)*
Page authentifiée (dashboard) : hero robot 3D CSS, cartes d'actions rapides, chat avec rendu markdown minimal (sans `innerHTML`), sidebar (profil, % complétion, insights contextuels). `aiService.getUserContext()` au montage, `aiService.chat(messages)` à l'envoi. `MAX_USER_MESSAGES=40` côté front (doit rester synchronisé avec `MAX_USER_MESSAGES_PER_CONVERSATION` backend). Gestion d'erreurs typées par `err.response.data.code` (`AI_CONVERSATION_LIMIT_REACHED`, `AI_UNAVAILABLE`, `AI_MODEL_ERROR`).

#### `pages/applications/MyApplications.jsx`
(`/dashboard/student/applications`) Liste des candidatures étudiant : stats, recherche, filtres statut, tri, modal de détail (timeline soumission→révision→décision). `applicationsService.getAll()`, stats/tri dérivés en `useMemo` côté client. *(`Applications.css` du même dossier est orphelin, non importé.)*

#### `pages/interviews/Interviews.jsx`
(`/dashboard/student/interviews`) Entretiens groupés par période (aujourd'hui/semaine/plus tard/passés), countdown, lien visio si en ligne et à venir. `interviewsService.getAll()`. Confirmer/Décliner → mise à jour optimiste + `interviewsService.updateStatus(id,status)` (rollback via re-fetch en cas d'échec).

#### `pages/auth/` *(détail complet du flux d'authentification en §4.1)*
**Constat transversal** : toutes ces pages appellent `api.post("/auth/...")` **directement** via `services/api.js`, pas le wrapper `services/auth.service.js` (qui existe et expose les mêmes endpoints, mais n'est utilisé que par `AuthContext.jsx`) — duplication de la connaissance des endpoints entre deux couches.
- **`Login.jsx`** (`/login`) — email/mot de passe + `rememberMe`, boutons OAuth Google/Facebook.
- **`Register.jsx`** (`/register`) — wizard 5 étapes (compte→formation→expériences→compétences/langues→confirmation).
- **`ForgotPassword.jsx`** (`/forgot-password`), **`ResetPassword.jsx`** (`/reset-password/:token`), **`VerifyEmail.jsx`** (`/verify-email`, accessible seulement via `location.state.email`).

#### `pages/legal/` — contenu statique piloté par i18n, sans appel API
`TermsOfUse.jsx` (`/cgu`), `PrivacyPolicy.jsx` (`/confidentialite`), `LegalNotice.jsx` (`/mentions-legales`), `GuidesPage.jsx` (`/guides`), `HelpPage.jsx` (`/aide`, FAQ accordéon + contact mailto/WhatsApp).

#### `pages/dashboard/` — back-office admin et espace étudiant (31 fichiers)

> Composants transverses : `DashboardLayout`, `Modal`, `ExportMenu` (export PDF via `jspdf`/`jspdf-autotable`, CSV via `utils/exportTable.js`).

**Côté admin** :
- **`AdminApplications.jsx`** — Liste/traite les candidatures (`applicationsService.getAll`), propose un entretien (`interviewsService.propose` → `POST /interviews`), Accepter/Rejeter (`applicationsService.updateStatus`).
- **`AdminCeremony.jsx`** *(détail flux complet en §4.3)* — Modération des projets (`ceremonyService.getAdminProjects/acceptProject/rejectProject`), configuration de la fenêtre de vote (`updateSettings`), clôture+annonce du gagnant (`closeAndAnnounce`), réouverture, reset des votes (`resetVotes`, double confirmation, action destructrice).
- **`AdminDashboard.jsx`** — KPIs + `LineChart`/`PieChart` (`recharts`) via `adminService.getDashboardStats()`.
- **`AdminEnrollmentRequests.jsx`** — Accepte/rejette les demandes d'inscription (`enrollmentRequestsService.getAllAdmin/accept/reject`).
- **`AdminEnrollments.jsx`** — Supervise les inscriptions actives, détail `weekProgress`, annulation (`enrollmentsService.getAllAdmin/cancel`).
- **`AdminFeedbacks.jsx`** — 3 onglets : témoignages vidéo par catégorie (`settingsService`, `addTestimonialVideo/update/delete`) + captures d'écran (`feedbacksService.getScreenshots/add/update/delete`).
- **`AdminFormations.jsx`** — CRUD complet formations : fiche/tarifs/semaines cours+encadrement (vidéos Drive-ou-upload)/trailer (`formationsService`, `updateWeeks`, `updateSupervision`, `updateTrailer`, `deleteFormation`). CSS `AdminFormations.css` sert de **socle** aux autres pages tableaux admin (`af-*`).
- **`AdminNews.jsx`** — CRUD des actualités (`newsService.createNews/updateNews/deleteNews`).
- **`AdminOffers.jsx`** — CRUD offres + activer/désactiver (`offersService.getAllAdmin/create/update/updateStatus/delete`).
- **`AdminProfile.jsx`** — Profil compte admin + changement mot de passe (`profileService.getMyProfile/updateProfile/changePassword`).
- **`AdminSettings.jsx`** — Préférences d'apparence admin (thème/langue/police), 100% local (`localStorage`), aucun appel réseau.
- **`AdminStatistics.jsx`** — Statistiques avancées (`adminService.getAdvancedStats/getOnlineCount(polling 30s)/getTopOffers/getTopFormations/getTopPages/getVisitsByDay`), export PDF multi-tableaux (`jsPDF`+`exportTable.js`).
- **`AdminUsers.jsx`** — Gestion des comptes : créer/activer-désactiver/changer rôle/supprimer (`adminService.getUsers/createUser/updateUserStatus/updateUserRole/deleteUser`), auto-protection (désactivé pour soi-même sur statut/suppression).

**Côté étudiant** :
- **`DashboardFormationDetail.jsx`** — Détail formation + demande d'inscription (`enrollmentRequestsService.create`, gère le 409 "déjà envoyée"), `CoursePreviewModal`.
- **`DashboardFormations.jsx`** — Catalogue des formations (`formationsService.getAll`), navigation vers le détail.
- **`MesDemandes.jsx`** — Suivi lecture seule de ses demandes d'inscription (`enrollmentRequestsService.getAll`).
- **`MyCeremonyProjects.jsx`** *(détail flux complet en §4.3)* — Soumission de projets (`ceremonyService.createProject` → `POST /ceremony/projects`), QR code de partage (`qrcode.react`) vers `/ceremonie/:id`.
- **`Profile.jsx`** — Bascule `ProfileView`/`ProfileEditor`, `profileService.updateProfile/uploadCV`.
- **`StudentDashboard.jsx`** — Vue synthétique (candidatures/entretiens/offres/notifications/demandes/objectifs) + chatbot IA flottant (`aiService.chat`, gère `AI_CONVERSATION_LIMIT_REACHED`/`AI_UNAVAILABLE`).

#### `pages/messages/MessagingPage.jsx`
Messagerie interne partagée admin/étudiant (onglet "Étudiants" pour démarrer une conversation). `messagesService.getConversations()` (polling 15s), `getConversationMessages` (polling 8s sur la conversation active), envoi texte (`send`, optimiste) et fichier (`uploadFile`, max 10 Mo).

#### `pages/notifications/NotificationsPage.jsx`
Centre de notifications complet (historique paginé, groupé par période). `notificationsService.getAll({page,limit:50})`, `markAsRead`/`markAllRead`/`delete` (optimistes avec rollback en cas d'échec).

#### `pages/offers/`
- **`OffersList.jsx`** — Catalogue paginé avec favoris, recommandations locales par score de compétences, filtres avancés (`offersService`, `favoritesService`, `applicationsService`).
- **`ApplyOffer.jsx`** — Formulaire de candidature (lettre de motivation + CV drag&drop) → `applicationsService.create` (multipart), gère le 409 "déjà postulé".
- **`OfferDetail.jsx`** — Fiche détaillée à onglets, favoris, partage natif, offres similaires, compétences liées aux formations via `useFormationsTechMap`.

#### `pages/settings/Settings.jsx`
Centre de paramètres étudiant à 8 sections : Compte, Apparence (thème/langue/police), Notifications (6 toggles → `updateSettings({notifications})`), Confidentialité, Sécurité (changement mot de passe), IA (toggle recommandations, reset historique local), Préférences de stage, Zone de danger (suppression de compte avec confirmation par mot de passe → `deleteAccount` + `logout`). CSS `Settings.css` réutilisé tel quel par `AdminProfile.jsx`/`AdminSettings.jsx` (classes `stg-*`).

**⚠️ Points notables (pages dashboard/messages/notifications/offers/settings)** :
- Le vote lui-même (`ceremonyService.vote()`) et le classement ne sont appelés dans **aucun** des fichiers `AdminCeremony.jsx`/`MyCeremonyProjects.jsx` — ils vivent dans la page publique `/ceremonie/:id` et `CeremonyLeaderboard.jsx` (voir §4.3).
- `MyCeremonyProjects.jsx` n'affiche pas de badge de statut (en_attente/approuvé/refusé) sur les projets de l'étudiant, contrairement à `AdminCeremony.jsx`.
- La réouverture du vote (`isVoteClosed:false`) n'efface pas explicitement le `winnerProjectId` précédent côté code frontend.
- `MessagingPage.jsx` est un composant unique partagé par les deux rôles, sans restriction de rôle visible dans le fichier lui-même (routes distinctes gérées par `Sidebar.jsx`).

**⚠️ Points notables (pages, partie 1)** :
- `services/auth.service.js` contourné par toutes les pages `auth/*` (voir ci-dessus).
- `Register.jsx` : en cas de succès sans `needsVerify`, `navigate("/dashboard/student")` sans jamais appeler `loginWithToken` — chemin potentiellement non authentifié (à vérifier si atteignable en pratique côté backend).
- `pages/applications/Applications.css` orphelin (non importé).
- `pages/auth/Auth.css` contient un bloc explicitement commenté "Rétrocompatibilité ancien code" (CSS mort, ~20 lignes).
- Coquille CSS dans `LandingPage.css` : `align-items: centeRr;` (propriété invalide, ignorée par le navigateur, sans impact visuel).

### 2.2 components/

> 52 fichiers (29 `.jsx` + 23 `.css`), répartis en `auth/` (3), `ceremony/` (2), `common/` (36), `layout/` (8), `profile/` (3). Tous lus intégralement.

#### `components/auth/`

**`AuthOrbit.jsx`** — Fond animé décoratif (`aria-hidden`) du panneau gauche Login/Register : 5 anneaux "ripple" pulsants + icônes de technos (JS, Python, Express, React, Node, MongoDB, HTML, CSS3, TS, Angular, Flutter, Docker) en orbite sur 4 anneaux, vitesses/délais variés. Aucune prop, aucun state — calculé statiquement, animé en CSS pur (variables custom injectées en `style` inline). Dépend de `TECH_LOGOS` (`constants/techLogos.js`). CSS : positionnement absolu, `@keyframes` ripple/spin, `scale()` responsive à 3 breakpoints, respecte `prefers-reduced-motion`.

**`BoxReveal.jsx`** — Wrapper d'animation d'entrée réutilisable : fade+slide vertical suivi d'un balayage de bande colorée (effet rideau), déclenché une fois à l'entrée dans le viewport. Props : `children`, `width` (défaut "fit-content"), `boxColor` (défaut "#2563EB"), `duration` (défaut 0.5), `className`. Utilise `useAnimation`+`useInView` (Framer Motion). Pas de CSS dédié (style inline).

#### `components/ceremony/`

**`CeremonyLeaderboard.jsx`** — Classement de la Cérémonie : podium top 3 (2e/1er/3e, hauteurs de barre variables) + liste pour le rang 4+. Avatar auteur (photo ou initiale colorée déterministe), lien vers `/ceremonie/:id`, votes formatés en notation courte. Skeleton de chargement, polling **30s** (`REFRESH_INTERVAL_MS`) sur `ceremonyService.getLeaderboard()` (seul appel réseau, lecture seule). `useTranslation`. Dépend de Framer Motion (`layoutId` partagé entre podium et liste pour transition FLIP fluide). CSS : dégradés or/argent/bronze, skeleton animé, breakpoint 640px sans jamais empiler les 3 colonnes.

#### `components/common/` (36 fichiers)

- **`SectionCard.jsx`** — Conteneur générique de section (titre+icône optionnels+children). Purement générique, sans dépendance.
- **`LangFlags.jsx`** — Sélecteur de langue à 3 drapeaux (fr/en/ar), pilote `useLang()` (`changeLang`). Images depuis `flagcdn.com` (CDN externe).
- **`FileUpload.jsx`** — Champ de fichier générique avec aperçu + validation de taille max (défaut 5 Mo, `accept` défaut `.pdf,.doc,.docx`). Callback `onUpload(File|null)`.
- **`Modal.jsx`** — Modale générique (overlay+header+body+footer), fermeture `Escape` + clic overlay, verrouille le scroll body.
- **`Loader.jsx`** — Loader "signal WiFi" (3 arcs + point central), 3 tailles, 100% CSS.
- **`TechMarquee.jsx`** — Bandeau de logos technos en scroll infini (liste dupliquée ×2 pour boucle sans coupure). Sans prop `technologies` → liste statique complète ; avec → filtrée (rien si vide).
- **`CustomCursor.jsx`** — Curseur custom desktop (point + anneau traînant, interpolation `requestAnimationFrame`, lerp), détection tactile vs souris au premier événement réel. États hover interactif/texte. Écoute les événements globaux `customcursor:suspend`/`resume` (émis par `CoursePreviewModal` au survol d'iframe cross-origin).
- **`FormationCategories.jsx`** — Rangée de catégories en cercles-icônes avec compteur par catégorie (`formations` en prop), défilement horizontal + `ResizeObserver`. Dépend de `FORMATION_CATEGORIES`.
- **`AnimatedNavBar.jsx`** — Nav en pilule avec glow animé glissant vers l'onglet actif (Framer Motion `layoutId`). Exporte aussi `AnimatedNavBarProbe` (clone statique pour mesure de largeur, utilisé par `useAdaptiveNav`).
- **`ScrollToTop.jsx`** — Composant invisible (`return null`) qui force `window.scrollTo(0,0)` à chaque changement de route (`useLocation`).
- **`NewsSection.jsx`** — Grille "Actualités" branchée sur `newsService.getAll(limit)`. Skeleton, `return null` si vide après chargement, lien "Voir plus" vers `/blog` si `limit` fourni.
- **`GoogleAuthButton.jsx`** / **`FacebookAuthButton.jsx`** — Boutons OAuth. *(Détail du flux dans la section [4.1 Authentification](#41-authentification-jwt--oauth-googlefacebook).)* Se dégradent en désactivé si `VITE_GOOGLE_CLIENT_ID`/`VITE_FACEBOOK_APP_ID` absent. Pas de CSS propre (classes `auth-social-btn*` définies hors de `components/`).
- **`ExportMenu.jsx`** — Menu déroulant Export PDF/CSV (bouton conditionné à la présence du callback correspondant), utilisé sur toutes les pages admin de listing. Réutilise des classes `af-*` définies dans `AdminFormations.css` (couplage assumé, documenté en commentaire du code source).
- **`CoursePreviewModal.jsx`** — Modale de lecture vidéo (semaine de formation ou trailer), 3 sources (YouTube/Drive iframe/vidéo directe), watchdog 2 paliers (7s silencieux/15s fallback avec lien "ouvrir dans Drive") pour les sources iframe cross-origin peu fiables côté `onLoad`. Liste des semaines avec miniatures, verrouillage des semaines sans vidéo, mode plein écran custom pour le trailer.
- **`VideoTestimonialCarousel.jsx`** — Carousel de témoignages vidéo format story (9:16), cartes statiques (poster only), lecture uniquement en modale plein écran. Desktop : glissement par flèches + auto-avance (4500ms) ; mobile : scroll-snap + `IntersectionObserver`. Même mécanisme de watchdog Drive que `CoursePreviewModal`.
- **`SiteNavbar.jsx`** — Nav publique partagée par toutes les pages publiques (remplace 5 copies dupliquées). Scroll-spy par `IntersectionObserver` sur la Landing, navigation par route ailleurs. Bascule hamburger basée sur la largeur réellement mesurée (`useAdaptiveNav`), pas un breakpoint fixe.
- **`CeremonySection.jsx`** — Section promo "Cérémonie" de la Landing (badge, titre animé mot par mot, 3 étapes, CTA, QR code `qrcode.react` pointant vers `/ceremonie`, tilt 3D au survol géré par manipulation DOM directe hors React state).
- **`CookieBanner.jsx`** — Bannière cookies **purement informative** : Accepter/Refuser ferment tous deux le bandeau et mémorisent en `localStorage`, **aucun des deux ne conditionne réellement GA4 ou Google Sign-In** (limitation documentée en commentaire dans le code).
- **`TestimonialsScreenshotCarousel.jsx`** — Bandeau de captures (4:5) en scroll infini (même mécanique que `TechMarquee`), clic → lightbox plein écran. Retombe sur `SCREENSHOT_FEEDBACKS` (`constants/screenshotTestimonials.js`) si `items` non fourni.

#### `components/layout/`

**`DashboardLayout.jsx`** — Shell des dashboards (Sidebar + Topbar + contenu). Sidebar persistée en `localStorage`, polling des notifications **30s** (`notificationsService.getAll()`), drawer off-canvas + overlay sombre sur mobile, force la fermeture du drawer si la fenêtre repasse sous le breakpoint mobile en live.

**`NotificationPanel.jsx`** — Dropdown de notifications (icône colorée par type, horodatage relatif, marquer lu/tout lu/supprimer), entièrement contrôlé par props (état géré par le parent).

**`Sidebar.jsx`** — Navigation latérale par rôle (menus `MENUS` distincts étudiant/admin), actions rapides, bloc profil + déconnexion. Repliable (268px/70px), drawer plein écran mobile (≤900px).

**`Topbar.jsx`** — Bandeau sticky : titre, hamburger mobile, `LangFlags`, bascule thème, cloche notifications (ouvre `NotificationPanel`), menu utilisateur.

#### `components/profile/`

**`ProfileView.jsx`** — Vue lecture seule du profil étudiant : hero+avatar+anneau de complétion (`CompletionRing`), infos contact, 2 colonnes (infos/compétences/langues/formation/expérience/CV ; donut "force du profil" `StrengthDonut`, checklist, liens sociaux). Dérivé entièrement de la prop `profile` (recalcul à chaque rendu via `computeCompletion`). **Pas de CSS propre dans ce dossier** — ses classes `sf-pv-*` sont définies dans `src/pages/dashboard/Profile.css` (page consommatrice).

**`ProfileEditor.jsx`** — Formulaire complet d'édition/inscription du profil (identité, formation, expériences/compétences/langues en listes dynamiques `useFieldArray`, upload CV en mode inscription, liens sociaux). Validation `yup` complète (`studentProfileSchema`), messages d'erreur en clés i18n. `react-hook-form` + `yupResolver`. `handleCVUpload` génère un aperçu local (`URL.createObjectURL`) ; le fichier n'est envoyé qu'à la soumission globale.

**⚠️ Points notables (components/)** :
- `ProfileView.jsx`, `GoogleAuthButton.jsx`, `FacebookAuthButton.jsx` n'ont pas de CSS propre dans leur dossier — leurs classes sont définies dans des fichiers externes (`Profile.css`, CSS des pages Login/Register).
- Aucun `.css` orphelin : les 23 fichiers CSS correspondent tous à un `.jsx` homonyme.

### 2.3 context/ — contextes React globaux (3 fichiers)

**`context/AuthContext.jsx`** *(pivot du flux d'authentification, détail en §4.1)* — State : `user`, `loading`. Fonctions (`useAuth()`) : `login(email,password,rememberMe=false)`, `loginWithToken(token,userData,rememberMe=true)` (connexion directe depuis un token déjà obtenu — vérif email, OAuth), `register(formData)`, `logout()`, `refreshUser()`. Persistance déléguée à `utils/tokenStorage.js`. Au montage, si un token existe, `authService.getMe()` le valide ; seul un 401 explicite déclenche `clearToken()` (une panne réseau ne déconnecte pas l'utilisateur).

**`context/LangContext.jsx`** — State : `lang` (fr/en/ar, défaut fr, persisté `localStorage["lang"]`). `useLang().changeLang(l)`. Effet de bord : `document.documentElement.dir = rtl|ltr` + `i18n.changeLanguage(lang)`.

**`context/ThemeContext.jsx`** — State : `theme` (light/dark, persisté `localStorage["theme"]`). `useTheme().toggleTheme()`. Effet de bord : `document.documentElement.setAttribute("data-theme", theme)` (consommé par les variables CSS de `index.css`).

### 2.4 services/ — appels Axios vers le backend (18 fichiers)

> Toutes les fonctions listées sont regroupées dans un objet exporté par défaut par fichier (ex. `adminService`, `offersService`...). Toutes utilisent l'instance axios partagée `api.js`, sauf `profile.service.js` qui l'importe sans extension (`"./api"` au lieu de `"./api.js"` — seule incohérence de style d'import relevée sur les 18 fichiers).

**`services/api.js`** — Instance axios centrale (`baseURL = VITE_API_URL` ou `http://localhost:5000/api`). Intercepteur requête : injecte `Authorization: Bearer <token>` (`tokenStorage.getToken()`). Intercepteur réponse : sur 401, si la route n'est pas `/auth/login`/`/auth/register`, appelle `clearToken()` et redirige vers `/login` (`window.location.href`) ; sur login/register, le 401 est laissé au composant appelant (« identifiants invalides »).

| Service | Domaine backend | Fonctions exportées |
|---|---|---|
| `admin.service.js` | `/api/admin/*` | `getDashboardStats`, `getAdvancedStats`, `getOnlineCount`, `getTopOffers`, `getTopFormations`, `getTopPages`, `getVisitsByDay`, `createUser`, `getUsers`, `getUserById`, `updateUserStatus`, `updateUserRole`, `deleteUser` |
| `ai.service.js` *(SAGE, détail §4.2)* | `/api/ai/*` | `chat(messages,temperature)`, `getUserContext()`, `recommendations(limit)` — seulement 3 fonctions, pas de reset d'historique (géré côté client uniquement) |
| `applications.service.js` | `/api/applications/*` | `create`, `getAll`, `getById`, `updateStatus` |
| `auth.service.js` *(détail §4.1)* | `/api/auth/*` | `register`, `login`, `getMe`, `logout` — **seulement 4 fonctions** ; verifyEmail/resendCode/forgotPassword/resetPassword/googleAuth/facebookAuth sont appelés en `api.post(...)` direct depuis les pages, pas via ce service |
| `ceremony.service.js` *(détail §4.3)* | `/api/ceremony/*` | `getProjects`, `getProject`, `getMyProjects`, `createProject`, `vote`, `getLeaderboard`, `getSettings`, `getArchives`, `getArchiveEdition`, `getAdminProjects`, `acceptProject`, `rejectProject`, `updateSettings`, `closeAndAnnounce`, `resetVotes` |
| `enrollmentRequests.service.js` | `/api/enrollment-requests/*` | `create`, `getAll`, `getAllAdmin`, `accept`, `reject` |
| `enrollments.service.js` | `/api/enrollments/*` | `getAll`, `getOne`, `enroll`, `updateWeekStatus`, `getAllAdmin`, `cancel` |
| `favorites.service.js` | `/api/favorites/*` | `getAll`, `toggle` |
| `feedbacks.service.js` | `/api/formations/:id/reviews`, `/api/settings/testimonials`, `/api/testimonial-screenshots` | `addReview`/`updateReview`/`deleteReview`, `addTestimonialVideo`/`updateTestimonialVideo`/`deleteTestimonialVideo`, `getScreenshots`/`addScreenshot`/`updateScreenshot`/`deleteScreenshot` |
| `formations.service.js` | `/api/formations/*` | `getAll`, `getOne`, `getBySlug`, `getTechMap`, `createFormation`, `updateFormation`, `deleteFormation`, `updateTrailer`, `updateVideos`, `updateWeeks`, `updateSupervision`, `uploadVideoThumbnail` |
| `interviews.service.js` | `/api/interviews/*` | `getAll`, `propose`, `updateStatus` |
| `messages.service.js` | `/api/conversations/*`, `/api/messages/*` | `getConversations`, `getConversationMessages`, `getStudents`, `getAll`, `getConversation` (legacy), `send`, `uploadFile` |
| `news.service.js` | `/api/news/*` | `getAll`, `getOne`, `createNews`, `updateNews`, `deleteNews` |
| `notifications.service.js` | `/api/notifications/*` | `getAll`, `markAsRead`, `markAllRead`, `delete` |
| `offers.service.js` | `/api/offers/*` | `getAll`, `getOne`, `create`, `update`, `delete`, `getDomains`, `getAllAdmin`, `updateStatus` |
| `profile.service.js` | `/api/auth/*` | `getMyProfile`, `updateProfile`, `uploadCV`, `changePassword`, `updateSettings`, `deleteAccount` |
| `settings.service.js` | `/api/settings/*` | `get`, `update` |

### 2.5 constants/ (6 fichiers)

- **`breakpoints.js`** — `BREAKPOINTS` (`{xs:400,sm:480,md:640,lg:768,xl:900,xxl:1024,xxxl:1100}`, miroir manuel de `index.css`), `DASHBOARD_MOBILE_BREAKPOINT` (=`xl`).
- **`formationCategories.js`** — `FORMATION_CATEGORIES` (5 catégories : development/data/systeme/iot/marketing, mapping manuel par slug car le modèle `Formation` n'a pas de champ catégorie), `getCategoryForSlug(slug)`.
- **`screenshotTestimonials.js`** — `SCREENSHOT_FEEDBACKS` (29 captures réelles `public/images/feedback-thumbs/img{1..29}.jpg`).
- **`techLogos.js`** — `TECH_LOGOS` (~30 entrées slug→icône `react-icons/si`/couleur/label), `LANDING_MARQUEE_SLUGS`, `getTechLogo(slug)`. Documente en commentaire les logos volontairement absents (Adobe, Microsoft, Power BI, SonarQube, VS Code — pas d'icône fiable disponible).
- **`testimonials.js`** — `TESTIMONIAL_COMPANY`, `TESTIMONIALS` (10 summer-camp + 8 pfe + 10 formation), `getFeaturedSummerCampTestimonials/PfeTestimonials/FormationTestimonials`, `getAllFormationTestimonials`.
- **`videoUrls.js`** — Fichier généré (mapping chemins locaux → URLs Cloudinary/Drive), `VIDEO_URLS`, `resolveVideoUrl`, `extractDriveFileId`, `isGoogleDriveUrl`, `resolveDriveUrl`, `resolveDriveThumbnailProxyUrl` (proxy backend anti-hotlinking), `autoResolveDriveUrl`.

### 2.6 hooks/ (6 fichiers)

- **`useAdaptiveNav(containerRef, probeRef, deps=[])`** → `collapsed`. Compare la largeur réelle d'un clone invisible (`probeRef`) à la largeur disponible, via `ResizeObserver` — bascule la nav publique en hamburger sans breakpoint CSS fixe (robuste aux traductions longues/RTL/zoom).
- **`useCeremonySelection()`** *(détail §4.3)* → `{selected, toggleSelect, clearSelection, MAX_SELECTION=3}`, persisté en `sessionStorage["ceremony_selection"]`.
- **`useCeremonyVoteGate()`** *(détail §4.3)* → `reason` (`null`=ouvert, sinon `"closed"|"notStarted"|"ended"`), déduit de `ceremonyService.getSettings()`.
- **`useCeremonyVoteSubmit(clearSelection)`** *(détail §4.3)* → `{submitting, error, success, confirmVote, clearError}` ; `confirmVote` redirige vers `/login` si non connecté, sinon `ceremonyService.vote()`.
- **`useDocumentMeta({title, description})`** — met à jour `document.title` + meta description/OG sans lib externe (pas de react-helmet) ; exporte aussi `truncateForSEO(text, max=155)`.
- **`useFormationsTechMap()`** → `formations` (liste allégée slug/title/technologies via `formationsService.getTechMap()`), pour lier les compétences d'une offre à une formation.

### 2.7 i18n/ (4 fichiers)

**`i18n/index.js`** — Initialise `i18next` (`initReactI18next`), langue initiale = `localStorage["lang"] || "fr"`, `fallbackLng:"fr"`, `escapeValue:false` (React échappe déjà). Importé une fois dans `main.jsx`.

**`locales/fr.json`, `en.json`, `ar.json`** — Dictionnaires structurellement identiques (55 clés racine, mêmes numéros de ligne dans les 3 fichiers) : `notFound`, `nav`, `formationDetail`, `formations`, `common`, `sidebar`, `topbar`, `dashboard` (`student`/`admin`), `offers`, `apply`, `applications`, `interviews`, `messages`, `notifications`, `profile`, `status`, `landing`, `settings`, `dashboardFormations`, `dfd`, `mesDemandes`, `coursePreview`, `register`, `login`, `adminFormations`, `adminOffers`, `adminNews`, `adminFeedbacks`, `adminUsers`, `adminCandidatures`, `adminDemandes`, `adminCeremony`, `adminInscriptions`, `adminStats`, `adminProfile`, `adminSettings`, `testimonials`, `aiAssistant`, `profileEditor`, `verifyEmail`, `forgotPassword`, `resetPassword`, `fileUpload`, `notificationPanel`, `tarifs`, `guides`, `aide`, `legal`, `mentionsLegales`, `cgu`, `confidentialite`, `cookieBanner`, `ceremony`, `myCeremonyProjects`. `ar.json` en arabe (RTL). Interpolation (`{{var}}`) et pluriels (`_one`/`_other`) utilisés (ex. `ceremony.voteCount_one`/`_other`).

### 2.8 utils/ (11 fichiers)

- **`analytics.js`** — `initGA()` (GA4, prod uniquement, idempotent), `trackPageView(path)` (GA4), `trackPageVisit(path)` (`POST /track/page-visit`, dev+prod, échec silencieux). Utilisé par `App.jsx` à chaque changement de route.
- **`exportTable.js`** — `csvEscape`, `pdfSafe` (remplace les flèches Unicode incompatibles avec l'encodage jsPDF), `downloadCSV`, `writePdfHeader`, `writePdfTable`, `exportSingleTablePDF`.
- **`facebookSdk.js`** — `loadFacebookSdk(appId)` : charge le SDK Facebook une fois (promesse en cache), `FB.init({appId, cookie:true, xfbml:false, version:"v21.0"})`.
- **`imageCompression.js`** — `compressImageToBase64(file, {maxWidth=800, quality=0.8})` : pipeline FileReader→Image→canvas→JPEG base64 (fond blanc anti-transparence), remplace l'upload disque (non persistant en production).
- **`phoneDisplay.jsx`** — `PHONE_NUMBER` (`+216 58 840 064`), `withIsolatedPhone(text)` (isole le numéro en LTR dans un texte RTL via `<span dir="ltr">`).
- **`profileUtils.js`** — `computeCompletion(user)` : 7 critères (bio, skills, cv, education.institution, experience, socialLinks.linkedin, phone) → pourcentage.
- **`scrollToSection.js`** — `scrollToSection(id)` (`scrollIntoView` smooth).
- **`techMatch.js`** — `buildSkillFormationMatcher(formations)` → fonction de matching compétence texte libre → formation (dictionnaire d'alias + regex mot entier ; cas particulier "React Native" ≠ slug "react").
- **`thumbUtils.js`** — `DEFAULT_THUMB`, `getFormationThumb(formation)`, `getWeekThumb(week, formation)` (cascade : thumbnail explicite → miniature YouTube auto → détection par titre → défaut).
- **`tokenStorage.js`** — `getToken()`, `setToken(token, persist)`, `clearToken()` : source de vérité unique du JWT, jamais dans `localStorage` et `sessionStorage` en même temps.
- **`whatsapp.js`** — `buildWhatsAppLink(message)` → `https://wa.me/21658840064?text=...`.

### 2.9 Fichiers de configuration et racine de `src/`

#### `src/App.jsx` — table de routing complète

Déclare `ProtectedRoute({children, role})` : `Loader` pendant `loading`, redirige `/login` si non connecté, redirige `/` si le `role` exigé ne correspond pas. Monte globalement `ScrollToTop`, `CustomCursor`, `CookieBanner` ; déclenche `initGA()` au montage et `trackPageView`/`trackPageVisit` à chaque changement de route.

| Chemin | Composant | Protection |
|---|---|---|
| `/` | `LandingPage` | Publique |
| `/login`, `/register`, `/forgot-password`, `/reset-password/:token`, `/verify-email`, `/verify-email/:email` | `Login`, `Register`, `ForgotPassword`, `ResetPassword`, `VerifyEmail` | Publique |
| `/dashboard/student` | `StudentDashboard` | Protégée |
| `/dashboard/student/offers`, `/offers/:id`, `/offers/:id/apply` | `OffersList`, `OfferDetail`, `ApplyOffer` | Protégée |
| `/dashboard/student/applications` | `MyApplications` | Protégée |
| `/dashboard/student/interviews` | `Interviews` | Protégée |
| `/dashboard/student/profile` | `Profile` | Protégée |
| `/dashboard/student/ai-assistant` | `AIAssistant` | Protégée |
| `/dashboard/student/notifications` | `NotificationsPage` | Protégée |
| `/dashboard/student/messages` | `MessagingPage` | Protégée |
| `/dashboard/student/settings` | `Settings` | Protégée |
| `/dashboard/student/formations`, `/formations/:slug` | `DashboardFormations`, `DashboardFormationDetail` | Protégée |
| `/dashboard/student/demandes` | `MesDemandes` | Protégée |
| `/dashboard/student/ceremonie` | `MyCeremonyProjects` | Protégée |
| `/dashboard/admin` | `AdminDashboard` | Admin (`role="admin"`) |
| `/dashboard/admin/users` | `AdminUsers` | Admin |
| `/dashboard/admin/formations` | `AdminFormations` | Admin |
| `/dashboard/admin/offers` | `AdminOffers` | Admin |
| `/dashboard/admin/news` | `AdminNews` | Admin |
| `/dashboard/admin/ceremonie` | `AdminCeremony` | Admin |
| `/dashboard/admin/feedbacks` | `AdminFeedbacks` | Admin |
| `/dashboard/admin/messages` | `MessagingPage` | Admin (composant partagé avec la route étudiant) |
| `/dashboard/admin/notifications` | `NotificationsPage` | Admin (composant partagé) |
| `/dashboard/admin/candidatures` | `AdminApplications` | Admin |
| `/dashboard/admin/demandes` | `AdminEnrollmentRequests` | Admin |
| `/dashboard/admin/inscriptions` | `AdminEnrollments` | Admin |
| `/dashboard/admin/stats` | `AdminStatistics` | Admin |
| `/dashboard/admin/settings` | `AdminSettings` | Admin |
| `/dashboard/admin/profile` | `AdminProfile` | Admin |
| `/formations` | `FormationsPage` | Publique |
| `/formations/:slug` | `FormationDetail` | Publique |
| `/offers` | `OffersPage` | Publique |
| `/offers/:id` | `PublicOfferDetail` | Publique |
| `/ceremonie` | `CeremonyPage` | Publique |
| `/ceremonie/archives` | `CeremonyArchives` | Publique |
| `/ceremonie/archives/:edition` | `CeremonyArchiveDetail` | Publique |
| `/ceremonie/:id` | `CeremonyProjectDetail` | Publique |
| `/blog` | `BlogPage` | Publique |
| `/tarifs` | `PricingPage` | Publique |
| `/guides` | `GuidesPage` | Publique |
| `/aide` | `HelpPage` | Publique |
| `/mentions-legales` | `LegalNotice` | Publique |
| `/confidentialite` | `PrivacyPolicy` | Publique |
| `/cgu`, `/conditions` | `TermsOfUse` (alias, même composant) | Publique |
| `/faq` | `Navigate to="/"` | Publique — route retirée, le lien footer pointe vers un post Instagram externe |
| `*` | `NotFound` | Publique (catch-all) |

*Remarque* : `/ceremonie/:id` est déclarée après `/ceremonie/archives` et `/ceremonie/archives/:edition` — ordre nécessaire pour que React Router ne capture pas `archives` avec le paramètre `:id`.

#### Autres fichiers racine

- **`src/main.jsx`** — Monte l'arbre React (`BrowserRouter` → `ThemeProvider` → `LangProvider` → `AuthProvider` → `App`), importe `./i18n/index.js` et `./index.css`. Enveloppe dans `GoogleOAuthProvider` uniquement si `VITE_GOOGLE_CLIENT_ID` est défini. `StrictMode` actif.
- **`src/index.css`** (396 lignes) — Design tokens : variables `:root` (mode clair) et `[data-theme="dark"]` (couleurs, fonds, bordures, ombres, rayons), reset CSS, classes utilitaires (`.card`, `.btn*`, `.badge*`, `.input`, `.label`), layout dashboard (`.app-layout`, `.main-content` avec offset sidebar 260px), animations (`fadeIn`, `slideIn`, `pulse`), support RTL, tailles de police via `[data-font-size]`. Documente en commentaire l'échelle de breakpoints (miroir de `constants/breakpoints.js`) et l'échelle de z-index globale du projet.
- **`index.html`** — Template Vite. `theme-color` `#2563EB`, meta PWA Apple, lien manifest `/manifest.webmanifest`, favicon + apple-touch-icon. **Note** : `<html lang="en">` figé, ne reflète pas la langue active (seul `dir` est mis à jour dynamiquement par `LangContext.jsx`).
- **`vite.config.js`** — Plugins : `@vitejs/plugin-react` ; `vite-plugin-pwa` (`registerType:'autoUpdate'`, manifest complet, `workbox` avec `maximumFileSizeToCacheInBytes: 3 Mo`, stratégies `NetworkFirst` pour `/api/*` (cache 24h) et `CacheFirst` pour les images (cache 30j)). Aucun alias de chemin configuré.
- **`eslint.config.js`** — Flat config : `globalIgnores(['dist'])`, étend `js.configs.recommended` + `reactHooks.configs.flat.recommended` + `reactRefresh.configs.vite` (d'où les `eslint-disable-next-line react-refresh/only-export-components` dans `AuthContext.jsx`/`ThemeContext.jsx`).
- **`package.json`** — voir §1.2 (stack technique) pour les dépendances ; scripts `dev`/`build`/`lint`/`preview`.
- **`.env.example`** — voir §1.2 ; variables `VITE_API_URL`, `VITE_GOOGLE_CLIENT_ID`, `VITE_FACEBOOK_APP_ID`, plus des identifiants Cloudinary historiques (`CLOUDINARY_*`, hérités de la migration vers Google Drive pour les vidéos).
- **`scripts/generate-pwa-icons.js`** — Script Node (`node scripts/generate-pwa-icons.js`) générant `public/pwa-192x192.png`/`pwa-512x512.png` depuis `public/favicon.png` via `sharp` (resize `fit:"cover"`, centré). Sort en erreur si le favicon est introuvable.

**⚠️ Points notables (services/context/hooks/constants/i18n/utils/config)** :
- `auth.service.js` n'expose que 4 fonctions ; les flux verifyEmail/resendCode/forgotPassword/resetPassword/OAuth passent par des appels `api.post` directs dans les pages/composants concernés (voir §4.1).
- `profile.service.js` importe `api` sans extension (`"./api"`), seule incohérence parmi les 18 services.
- `index.html` a `lang="en"` figé alors que la langue réelle est pilotée dynamiquement (fr par défaut).
- Les routes admin `/messages` et `/notifications` réutilisent les composants étudiant (`MessagingPage`, `NotificationsPage`) sans wrapper dédié visible dans `App.jsx`.

### 2.10 public/ (174 fichiers — binaires/vidéo, non détaillés individuellement)

Dossier servi tel quel par Vite (copié à la racine du build). Contenu, hors `robots.txt` (seul fichier texte) :
- `favicon.png`, `hero-girl.png`, `icons.svg`, `pwa-192x192.png`, `pwa-512x512.png` — assets graphiques du site et de la PWA (les 2 icônes PWA sont générées par `scripts/generate-pwa-icons.js`).
- `images/avatars/` — 2 avatars par défaut (homme/femme), assignés automatiquement à l'inscription (`users.model.js`, `avatarUrl`).
- `images/course-placeholders/` — 12 icônes de langages/frameworks utilisées en repli quand une formation n'a pas d'image dédiée.
- `images/{ai,angu-spring,bi,cyber,dev,flutter,iot,mern}-thumbs/` — miniatures des vidéos de semaines de cours/encadrement par formation (référencées historiquement par les JSON de `formations/`, en grande partie remplacées depuis par des URLs Google Drive normalisées).
- `images/feedback-thumbs/` — 29 captures d'écran de témoignages (`img1.jpg`…`img29.jpg`), correspondant exactement à `constants/screenshotTestimonials.js` et à la migration effectuée par `scripts/migrateScreenshotTestimonials.js`.
- `images/news-thumbs/` — images des 3 actualités publiées.
- `videos/hero-background.mp4` — vidéo de fond du hero de la Landing Page.
- `robots.txt` — `Disallow: /dashboard/` (zones authentifiées non indexées), `Sitemap: https://stage-flow-api.onrender.com/sitemap.xml` (généré dynamiquement par le backend, voir §1.4/§3.0).

### 2.11 dist/ — build généré (184 fichiers, exclu de l'analyse détaillée)

`dist/` est le dossier de sortie de `vite build` (bundles JS/CSS minifiés + copie de `public/`), régénéré à chaque déploiement et jamais versionné (`.gitignore` racine : `thebridgeflow-front/dist/`). Il ne contient aucun code source propre : ses fichiers `.js`/`.css` sont la version compilée/minifiée de `src/`, déjà documentée ci-dessus, et ses assets sont une copie exacte de `public/`. Conformément à la consigne d'exclusion des fichiers binaires/générés, ce dossier n'est pas détaillé fichier par fichier (voir §6 pour le décompte exact justifiant cette exclusion).

---

## 3. Backend (thebridgeflow-back/)

### 3.0 Fichiers à la racine de `thebridgeflow-back/`

| Fichier | Rôle |
|---|---|
| `server.js` | Point d'entrée de l'API Express. Charge les variables d'environnement (`dotenv`), configure `helmet`, CORS (liste blanche d'origines), les 3 rate limiters (`authLimiter`, `apiLimiter`, `thumbnailLimiter`), les parseurs (`express.json` limite 10 Mo, `urlencoded`, `cookie-parser`), la sanitisation NoSQL maison, et sert `/uploads` en statique avec un en-tête CORP assoupli. Définit un endpoint racine `GET /` (healthcheck JSON) et `GET /sitemap.xml` (généré dynamiquement à partir des collections `Formation` et `Offer`). Monte les 19 routers applicatifs sous `/api/*` (voir tableau ci-dessous), chacun derrière `authLimiter` ou `apiLimiter`/`thumbnailLimiter`. Branche les middlewares globaux `notFound` et `errorHandler` en fin de pipeline. Se connecte à MongoDB via `connectDB()` avant de démarrer `app.listen`, puis appelle `verifyEmailConfig()` (diagnostic SMTP non bloquant). Gère aussi `process.on("unhandledRejection")` en forçant l'arrêt du process. |
| `package.json` | Manifeste npm backend (`type: module`, ESM). Scripts : `dev` (nodemon), `start` (node). Dépendances listées en §1.2. |
| `package-lock.json` | Lockfile npm auto-généré — verrouille les versions exactes de l'arbre de dépendances, non maintenu manuellement. |
| `.env` | Variables d'environnement réelles (secrets) — non versionné (`.gitignore`), non lu pour cette documentation par précaution de sécurité. |
| `.env.example` | Gabarit documentant les variables attendues : `MONGO_URI`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `PORT`, `CLIENT_URL`, `GEMINI_API_KEY`, `GEMINI_MODEL` (optionnel, fallback `gemini-2.5-flash-lite` codé dans `gemini.service.js`), `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM`, `GOOGLE_CLIENT_ID`, `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET`. Note : ne mentionne pas `GROQ_API_KEY` alors que `groq.service.js` en dépend visiblement — à vérifier/compléter. |
| `.gitignore` | Ignore `.env` uniquement (les autres exclusions — credentials Drive, uploads, backups — sont centralisées dans le `.gitignore` racine). |
| `credentials-drive1.json` | Fichier d'identifiants OAuth "Desktop app" Google Cloud (Client ID/secret) nécessaire à l'authentification des scripts `scripts/drive/*.js` auprès de l'API Google Drive. **Contenu non lu/reproduit ici** (secret sensible) ; non versionné (`.gitignore` racine : `thebridgeflow-back/credentials-drive*.json`). À régénérer depuis Google Cloud Console si perdu (voir `DEPLOYMENT.md` §4). |
| `token-drive1.json` | Jeton OAuth généré après une première authentification réussie (`node scripts/drive/authenticate.js drive1`), permet les authentifications suivantes sans repasser par le navigateur. **Contenu non lu/reproduit ici** (secret sensible) ; non versionné. |

### 3.1 config/

#### `config/db.js`
**Rôle** : Établit la connexion Mongoose à MongoDB au démarrage du serveur, avec logique de nouvelle tentative automatique en cas d'échec initial.

**Fonctions/exports** :
- `connectDB(attempt = 1)` (export par défaut) — appelle `mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000, connectTimeoutMS: 15000 })`. En cas de succès, logue l'hôte connecté. En cas d'échec : si `attempt < MAX_RETRIES` (5), attend `RETRY_DELAY` (5000 ms) puis se rappelle récursivement ; au-delà de 5 tentatives, logue une erreur fatale et appelle `process.exit(1)`.

**Dépend de** : `mongoose` ; `MONGO_URI`. **Utilisé par** : `server.js` (`connectDB().then(...)` avant `app.listen`).

### 3.2 models/

> 19 fichiers Mongoose, tous lus intégralement.

#### `models/offers.model.js`
**Rôle** : Offre de stage/PFE/alternance/formation publiée par une entreprise (ou un admin).

| Champ | Type | Contraintes | Réf | Description |
|---|---|---|---|---|
| title | String | required, trim | — | Titre de l'offre |
| description | String | default "" | — | Description détaillée |
| companyName | String | default "" | — | Nom de l'entreprise (texte libre, dénormalisé) |
| companyId | ObjectId | index | User | Compte propriétaire de l'offre |
| domain | String | default "", index | — | Domaine/secteur |
| location | String | default "" | — | Localisation |
| duration | String | default "" | — | Durée |
| type | String | enum [stage,PFE,alternance,formation,vidéo], default stage, index | — | Nature de l'offre |
| skills | [String] | — | — | Compétences requises |
| salary | Number | default 0 | — | Rémunération |
| deadline | Date | — | — | Date limite de candidature |
| isActive | Boolean | default true, index | — | Offre active |
| views | Number | default 0 | — | Compteur de vues |
| nbrInterns | String | default "" | — | Nombre de stagiaires recherchés (texte) |

`timestamps: true`. Index simples sur `companyId`, `domain`, `type`, `isActive`, plus un index texte (`$text`) sur `title`/`description`/`companyName`/`skills` pour la recherche full-text. Aucune méthode/hook/virtual.

#### `models/notification.model.js`
**Rôle** : Notification in-app adressée à un utilisateur.

| Champ | Type | Contraintes | Réf | Description |
|---|---|---|---|---|
| userId | ObjectId | required | User | Destinataire |
| title | String | required | — | Titre court |
| message | String | required | — | Corps du message |
| type | String | enum [info,success,warning,error], default info | — | Catégorie visuelle |
| isRead | Boolean | default false | — | Statut de lecture |
| link | String | default "" | — | Lien de redirection |

`timestamps: true`. Index `{userId:1, createdAt:-1}` et `{userId:1, isRead:1}`.

#### `models/applications.model.js`
**Rôle** : Candidature d'un étudiant à une offre.

| Champ | Type | Contraintes | Réf | Description |
|---|---|---|---|---|
| offerId | ObjectId | required | Offer | Offre visée |
| studentId | ObjectId | required | User | Candidat |
| status | String | enum [en attente,acceptée,refusée,en cours], default en attente | — | État de traitement |
| coverLetter | String | default "" | — | Lettre de motivation |
| cvUrl | String | default "" | — | Lien vers le CV joint |
| note | String | default "" | — | Note interne |

`timestamps: true`. Index unique `{offerId:1, studentId:1}` (empêche la double candidature), plus `{studentId:1, createdAt:-1}`, `{offerId:1, createdAt:-1}`, `{status:1}`.

#### `models/interview.model.js`
**Rôle** : Entretien planifié entre un étudiant et une entreprise/admin dans le cadre d'une candidature.

| Champ | Type | Contraintes | Réf | Description |
|---|---|---|---|---|
| applicationId | ObjectId | required | Application | Candidature liée |
| studentId | ObjectId | required | User | Étudiant convoqué |
| companyId | ObjectId | required | User | Organisateur |
| scheduledAt | Date | required | — | Date/heure |
| mode | String | enum [présentiel,en ligne], default en ligne | — | Modalité |
| location | String | default "" | — | Lieu ou lien |
| status | String | enum [proposé,confirmé,annulé,terminé], default proposé | — | Statut |
| notes | String | default "" | — | Notes complémentaires |

`timestamps: true`. Index `{studentId:1, scheduledAt:1}`, `{companyId:1, scheduledAt:1}`, `{status:1}`. Transition auto vers `"terminé"` gérée hors modèle (`utils/interviewStatus.js`).

#### `models/conversation.model.js`
**Rôle** : Fil de conversation entre exactement deux utilisateurs.

| Champ | Type | Contraintes | Réf | Description |
|---|---|---|---|---|
| participants | [ObjectId] | required par élément | User | Les deux participants |
| lastMessage | ObjectId | default null | Message | Dernier message |
| lastMessageAt | Date | default Date.now | — | Horodatage pour tri |
| unreadCounts | Mixed | default {} | — | `{ "userId": count }` |

`timestamps: true`. Index `{participants:1, lastMessageAt:-1}` et `{participants:1}`.

#### `models/enrollment.model.js`
**Rôle** : Inscription effective (validée) d'un étudiant à une formation, avec suivi de progression.

| Champ | Type | Contraintes | Réf | Description |
|---|---|---|---|---|
| student | ObjectId | required | User | Étudiant inscrit |
| formation | ObjectId | required | Formation | Formation suivie |
| weekProgress | [weekProgressSchema] | — | — | Progression détaillée par semaine |
| overallStatus | String | enum [not_started,in_progress,completed], default in_progress | — | Statut global |

Sous-document `weekProgressSchema` (`_id:false`) : `weekNumber` (Number, required), `status` (String, enum [not_started,in_progress,done], default not_started), `completedAt` (Date).

`timestamps: true`. Index unique `{student:1, formation:1}`. Initialisation de `weekProgress` faite hors modèle (`utils/enrollmentProgress.js`).

#### `models/enrollmentRequest.model.js`
**Rôle** : Demande d'inscription en attente de validation admin (distincte de l'inscription effective).

| Champ | Type | Contraintes | Réf | Description |
|---|---|---|---|---|
| student | ObjectId | required | User | Demandeur |
| formation | ObjectId | required | Formation | Formation demandée |
| mode | String | enum [Présentiel,En ligne], required | — | Modalité souhaitée |
| message | String | default "" | — | Message libre |
| status | String | enum [en_attente,acceptée,refusée], default en_attente | — | État |

`timestamps: true`. Index unique `{student:1, formation:1}`.

#### `models/messages.model.js`
**Rôle** : Message individuel entre deux utilisateurs, rattaché (ou non, rétro-compatibilité) à une `Conversation`.

| Champ | Type | Contraintes | Réf | Description |
|---|---|---|---|---|
| conversationId | ObjectId | default null | Conversation | `null` pour messages pré-existants avant le modèle `Conversation` |
| senderId | ObjectId | required | User | Expéditeur |
| receiverId | ObjectId | required | User | Destinataire |
| content | String | maxlength 1000, default "" | — | Texte |
| fileUrl / fileName / fileType | String | default null | — | Pièce jointe |
| fileSize | Number | default null | — | Taille du fichier |
| isRead | Boolean | default false | — | Statut de lecture |

`timestamps: true`. Index `{conversationId:1, createdAt:1}` + index legacy `{senderId:1, receiverId:1, createdAt:1}`, `{senderId:1, createdAt:-1}`, `{receiverId:1, createdAt:-1}`.

#### `models/news.model.js`
**Rôle** : Article d'actualité publié sur le site (monolingue par choix produit).

| Champ | Type | Contraintes | Réf | Description |
|---|---|---|---|---|
| title | String | required, trim | — | Titre |
| excerpt | String | required, trim | — | Résumé court |
| content | String | default "" | — | Contenu complet |
| category | String | required, trim | — | Catégorie éditoriale |
| image | String | required | — | URL ou base64 |
| author | String | default "admin" | — | Auteur affiché |
| publishedAt | Date | default Date.now | — | Date de publication |

`timestamps: true`. Index `{publishedAt:-1}`.

#### `models/loginHistory.model.js`
**Rôle** : Historique des connexions (méthode, localisation approximative).

| Champ | Type | Contraintes | Réf | Description |
|---|---|---|---|---|
| userId | ObjectId | required | User | Utilisateur concerné |
| timestamp | Date | default Date.now | — | Date de connexion (champ manuel) |
| method | String | enum [email,google,facebook], required | — | Méthode d'authentification |
| location.country/city/timezone | String | — | — | Localisation déduite par géolocalisation IP |

`timestamps: true` **en plus** du champ manuel `timestamp` — redondance de deux dates très proches sémantiquement (probable oubli lors de l'ajout de `timestamps`). Index `{userId:1, timestamp:-1}`.

#### `models/users.model.js`
**Rôle** : Modèle central de l'application — compte utilisateur (étudiant/admin), auth locale ou OAuth, profil étudiant complet, préférences.

| Champ | Type | Contraintes | Réf | Description |
|---|---|---|---|---|
| name | String | required, trim | — | Nom complet |
| email | String | required, unique, lowercase, trim | — | Identifiant de connexion |
| password | String | required si ni googleId ni facebookId, minlength 6, select:false | — | Hash bcrypt |
| role | String | enum [étudiant,admin], default étudiant | — | RBAC |
| gender | String | enum [homme,femme] | — | Détermine l'avatar par défaut |
| avatarUrl | String | default "" | — | Avatar auto-assigné selon `gender` |
| googleId / facebookId | String | unique, sparse, select:false | — | Identifiants OAuth |
| phone / university / specialty | String | default "" | — | Profil |
| supervisorId | ObjectId | default null | User | Encadrant assigné |
| supervisorName | String | default "" | — | Nom encadrant (dénormalisé) |
| isActive | Boolean | default true | — | Compte actif (vérifié dans `auth.middleware.js`) |
| favorites | [ObjectId] | — | Offer | Offres favorites |
| isVerified | Boolean | default false | — | Email vérifié |
| verifyCode / verifyCodeExpires | String/Date | select:false | — | Code de vérification email |
| resetPasswordToken / resetPasswordExpires | String/Date | select:false | — | Hash SHA-256 du token reset (jamais en clair) |
| bio | String | default "" | — | Biographie |
| cv.fileName / cv.fileUrl | String | default "" | — | CV |
| education.{institution,degree,fieldOfStudy,startDate,endDate,current,grade,courses} | mixte | default "" / false | — | Formation |
| experience | [experienceSchema] | — | — | Expériences pro |
| skills | [skillSchema] | — | — | Compétences |
| languages | [languageSchema] | — | — | Langues |
| socialLinks.{linkedin,github,portfolio} | String | default "" | — | Liens sociaux |
| lastLoginAt / lastActiveAt | Date | — | — | Dernière connexion / activité (polling notifications) |
| settings.notifications.{newOffers,newApplications,interviews,messages,formations,emails} | Boolean | default true | — | Préférences notif |
| settings.privacy.profileVisibility | String | enum [public,private,connections], default public | — | Visibilité profil |
| settings.privacy.{cvVisibility,allowCompanyView} | Boolean | default true | — | Visibilité CV / accès entreprise |
| settings.ai.enableRecommendations | Boolean | default true | — | Recommandations IA |
| settings.internshipPreferences.{locations,type,technologies,duration} | mixte | — | — | Préférences de stage |

Sous-documents (`_id:false`) : `experienceSchema` (company, position, location, startDate, endDate, current, description, technologies[]) ; `skillSchema` (name, level enum [Débutant,Intermédiaire,Avancé,Expert], category) ; `languageSchema` (name, level enum [Débutant,Intermédiaire,Courant,Natif]).

`timestamps: true`. **Hook** `pre("save")` : rehash bcrypt (`genSalt(10)`) si `password` modifié. **Méthode** `comparePassword(candidatePassword)` (bcrypt.compare). **Méthode** `toJSON()` surchargée : retire `password`, `verifyCode`, `verifyCodeExpires`, `resetPasswordToken`, `resetPasswordExpires` de la sérialisation (double protection en plus de `select:false`).

#### `models/pageVisit.model.js`
**Rôle** : Enregistre chaque visite de page (analytics interne).

| Champ | Type | Contraintes | Réf | Description |
|---|---|---|---|---|
| userId | ObjectId | required:false | User | Visiteur (optionnel, anonyme possible) |
| path | String | required | — | Page visitée |
| timestamp | Date | default Date.now | — | Horodatage |

Pas de `{timestamps:true}` (champ manuel `timestamp` seulement). Index `{path:1}`.

#### `models/videoView.model.js`
**Rôle** : Enregistre chaque visionnage de vidéo (analytics interne).

| Champ | Type | Contraintes | Réf | Description |
|---|---|---|---|---|
| userId | ObjectId | required:false | User | Spectateur (optionnel) |
| videoIdentifier | String | required | — | Identifiant technique |
| videoLabel | String | required | — | Libellé lisible |
| timestamp | Date | default Date.now | — | Horodatage |

Pas de `{timestamps:true}`. Index `{videoIdentifier:1}`.

#### `models/siteSettings.model.js`
**Rôle** : Document singleton — réglages globaux vitrine (vidéo d'action, témoignages vidéo, avatars communauté).

| Champ | Type | Contraintes | Réf | Description |
|---|---|---|---|---|
| actionVideo | mediaSchema | default `{}` | — | Vidéo d'action landing page |
| testimonialVideos | [testimonialVideoSchema] | default [] | — | Témoignages vidéo (carrousels) |
| communityAvatars | [communityAvatarSchema] | default [] | — | Avatars génériques (pas des personnes réelles) |

Sous-documents : `mediaSchema` (`_id:false`: url, provider enum [cloudinary,google_drive] default google_drive, driveUrl, thumbnail) ; `testimonialVideoSchema` (avec `_id` : mêmes champs + `category` enum [summer-camp,pfe,formation,unknown] default unknown) ; `communityAvatarSchema` (`_id:false`: name, url).

`timestamps: true`. "Get or create" du singleton géré dans le controller (`getOrCreateSettings`), pas dans le modèle.

#### `models/testimonialScreenshot.model.js`
**Rôle** : Capture d'écran de témoignage affichée sur le site.

| Champ | Type | Contraintes | Réf | Description |
|---|---|---|---|---|
| imageUrl | String | required | — | URL de l'image |
| name | String | default "" | — | Nom associé |
| order | Number | default 0 | — | Ordre d'affichage |
| createdAt | Date | default Date.now | — | Champ manuel (pas de `updatedAt`) |

Pas de `{timestamps:true}`.

#### `models/formation.model.js`
**Rôle** : Formation proposée par la plateforme — programme hebdomadaire, vidéos, avis, FAQ, stats, tarifs.

| Champ | Type | Contraintes | Réf | Description |
|---|---|---|---|---|
| title | String | required, unique | — | Titre |
| slug | String | required, unique | — | Identifiant URL |
| duration | String | required | — | Durée globale |
| price.onsite / price.online | String | required | — | Tarifs présentiel/en ligne |
| price.recordings | String | required:false, default "" | — | Tarif enregistrements seuls |
| level | String | default "Intermédiaire" | — | Niveau |
| description | String | default "" | — | Description |
| weeks | [weekSchema] | — | — | Programme semaine par semaine |
| supervision | [weekSchema] | — | — | Encadrement (réutilise le même sous-schéma que `weeks`) |
| mode | String | enum [Présentiel,En ligne,Hybride], default Hybride | — | Modalité |
| certificate | Boolean | default false | — | Certificat délivré |
| image | String | default "" | — | Image de couverture |
| features | [String] | default [] | — | Points forts |
| technologies | [String] | default [] | — | Slugs techs (mappés via `techLogos.js` côté front) |
| videos | [videoSchema] | — | — | Vidéos de présentation |
| reviews | [reviewSchema] | — | — | Avis étudiants |
| stats.{students,successRate,insertionRate,satisfaction} | Number | default 0 | — | Statistiques |
| faq | [faqSchema] | — | — | Questions fréquentes |
| trailerVideoUrl / trailerThumbnail | String | default "" | — | Bande-annonce normalisée |
| trailerProvider | String | enum [cloudinary,google_drive], default google_drive | — | Fournisseur bande-annonce |
| trailerDriveUrl | String | default "" | — | Lien Drive brut (référence) |
| views | Number | default 0 | — | Compteur de vues |

Sous-documents : `weekSchema` (`_id:false`: week Number required, phase, content required, videoUrl, videoTitle, thumbnail, provider enum, driveUrl, duree, gratuit Boolean) ; `videoSchema` (`_id:false`: url, title, description, thumbnail, provider, driveUrl) ; `reviewSchema` (avec `_id`: name required, avatar, rating Number min1 max5 default5, comment, date default Date.now) ; `faqSchema` (`_id:false`: question required, answer required).

`timestamps: true`. Index uniques implicites sur `title`/`slug`.

#### `models/ceremonyVote.model.js`
**Rôle** : Vote d'un étudiant à la cérémonie (1 à 3 projets), un seul vote par étudiant.

| Champ | Type | Contraintes | Réf | Description |
|---|---|---|---|---|
| studentId | ObjectId | required, **unique** | User | Un seul document de vote par étudiant (contrainte DB, anti-race condition) |
| projectIds | [ObjectId] | validateur custom 1 à 3 éléments | CeremonyProject | Projets sélectionnés |

`timestamps: true`.

#### `models/ceremonySettings.model.js`
**Rôle** : Singleton — configuration de la cérémonie en cours.

| Champ | Type | Contraintes | Réf | Description |
|---|---|---|---|---|
| voteStartDate / voteEndDate | Date | default null | — | Fenêtre de vote |
| isVoteClosed | Boolean | default false | — | Clôture manuelle (indépendante de `voteEndDate`) |
| winnerProjectId | ObjectId | default null | CeremonyProject | Gagnant désigné |
| edition | Number | required, default 2026 | — | Édition/année active |

`timestamps: true`. **Piège documenté dans le code** : `default: 2026` ne s'applique qu'aux nouveaux documents (Mongoose n'applique ses défauts qu'à l'hydratation normale, jamais aux lectures `.lean()`) — le document existant a dû être rétro-rempli via `scripts/backfillCeremonyEdition.js`.

#### `models/ceremonyProject.model.js`
**Rôle** : Projet étudiant soumis à la cérémonie, avec modération et votes.

| Champ | Type | Contraintes | Réf | Description |
|---|---|---|---|---|
| studentId | ObjectId | required | User | Porteur du projet |
| title | String | required, trim | — | Titre |
| description | String | default "" | — | Description |
| technologies | [String] | — | — | Technologies utilisées |
| coverImage | String | default "" | — | Image en base64 (pas d'upload disque — filesystem Render non persistant) |
| driveAppUrl / driveVideoUrl | String | default "" | — | Liens Drive app/vidéo démo |
| githubUrl | String | default "" | — | Dépôt GitHub |
| teamMembers | [String] | — | — | Membres de l'équipe |
| voteCount | Number | default 0 | — | Compteur dénormalisé, incrémenté par `$inc` au vote |
| isSeedData | Boolean | default false | — | Marque les projets de démo (`scripts/seedCeremonyProjects.js --clean`) |
| status | String | enum [en_attente,approuvé,refusé], default approuvé | — | Statut de modération |
| edition | Number | required, default 2026 | — | Édition d'appartenance |

`timestamps: true`. Index `{edition:1, voteCount:-1}`, `{edition:1, status:1}`, `{studentId:1}`. **Deux pièges documentés dans le code** (même cause que `ceremonySettings` : défauts non appliqués aux lectures `.lean()`) : (1) `default:"approuvé"` sert à garder visibles les documents pré-existants, les nouvelles soumissions écrasant explicitement ce défaut par `"en_attente"` (véritable portail de modération) ; (2) `default: 2026` sur `edition`, rétro-rempli par script pour les documents existants.

### 3.3 controllers/

> 19 fichiers, tous lus intégralement.

#### `controllers/admin.controller.js`
**Rôle général** : Fournit les statistiques du tableau de bord/analytics admin et la gestion CRUD des comptes utilisateurs (création, listing, activation/désactivation, changement de rôle, suppression).

**Fonctions exportées** :
- `getDashboardStats` — GET `/api/admin/dashboard-stats`. Exécute en parallèle : comptage des étudiants (`User`), du nombre total de formations (`Formation`), des demandes d'inscription en attente (`EnrollmentRequest`), des inscriptions actives (`Enrollment`, statut `in_progress`), une agrégation Mongo des inscriptions groupées par mois (`$dateToString` sur `createdAt`), et une agrégation des formations groupées par `level` (utilisé comme proxy de catégorie, faute de champ `domain`). Retourne 200 avec tous ces agrégats en JSON.
- `getAdvancedStats` — GET `/api/admin/stats`. Calcule des statistiques avancées : agrégations mensuelles séparées des `Enrollment` et `EnrollmentRequest` (fusionnées en mémoire dans une `Map` par mois pour produire `pipelineByMonth`), top 10 des formations par nombre d'inscriptions (via `$lookup`), répartition des demandes par statut, taux de conversion global (`acceptée / total`), et une tendance hebdomadaire (comparaison 7 derniers jours vs 7 jours précédents, `pct: null` si semaine précédente à 0). Retourne 200.
- `getTopOffers` — GET `/api/admin/top-offers`. Les 10 `Offer` les plus vues (tri `views` décroissant). 200.
- `getTopFormations` — GET `/api/admin/top-formations`. Les 10 `Formation` les plus vues. 200.
- `getVisitsByDay` — GET `/api/admin/visits-by-day`. Agrège les `PageVisit` des 30 derniers jours groupés par jour. 200.
- `getTopVideos` — GET `/api/admin/top-videos`. Agrège les `VideoView` par `videoIdentifier`, comptage + dernier `videoLabel` connu, limité à 15. 200.
- `getTopPages` — GET `/api/admin/top-pages`. Agrège les `PageVisit` par `path`, limité à 15. 200.
- `getOnlineCount` — GET `/api/admin/online-count`. Compte les `User` dont `lastActiveAt` est dans les 2 dernières minutes. 200 avec `{ online }`.
- `createUser` — POST `/api/admin/users`, admin. Valide `name`/`email` requis, rôle limité à `ASSIGNABLE_ROLES = ["étudiant", "admin"]` (400 sinon), mot de passe ≥ 6 si fourni (400 sinon), unicité email (409 sinon). Si aucun mot de passe fourni, génère un mot de passe temporaire lisible (`crypto.randomFillSync`, évite 0/O/1/l). Crée le `User` avec `isVerified: true`. Envoie `sendAccountCreatedByAdmin` (non bloquant). Retourne 201.
- `getUsers` — GET `/api/admin/users`. Liste tous les `User` (sans pagination), tri `createdAt` décroissant, champs sensibles exclus. 200.
- `getUserById` — GET `/api/admin/users/:id`. 404 si introuvable.
- `updateUserStatus` — PATCH `/api/admin/users/:id/status`. Valide `isActive` booléen (400). Empêche l'auto-désactivation (400). 404 si introuvable.
- `updateUserRole` — PATCH `/api/admin/users/:id/role`. Valide le rôle (400). Empêche de se retirer soi-même le rôle admin (400). 404 si introuvable.
- `deleteUser` — DELETE `/api/admin/users/:id`. Empêche l'auto-suppression (400). Vérifie l'absence de données liées (`Application`, `Interview`, `Conversation`) — 409 avec liste des entités bloquantes si au moins une existe. Sinon supprime. 200.

**Dépendances internes** : modèles `User`, `Offer`, `Formation`, `Enrollment`, `EnrollmentRequest`, `Application`, `Interview`, `Conversation`, `PageVisit`, `VideoView` ; `asyncHandler` ; `emailService.sendAccountCreatedByAdmin`.

---

#### `controllers/ai.controller.js`
**Rôle général** : Contrôleur de l'assistant IA « SAGE » — construit un contexte utilisateur personnalisé depuis MongoDB, génère un prompt système strict (identité immuable, anti-jailbreak, périmètre limité à TheBridgeFlow) et relaie la conversation à un fournisseur LLM externe (Groq). *(Détail complet du flux dans la section [4.2 SAGE](#42-sage--assistant-ia).)*

**Fonctions exportées** : `chat` (POST `/api/ai/chat`), `getUserContext` (GET `/api/ai/user-context`), `recommendations` (POST `/api/ai/recommendations`).

**Dépendances internes** : `groqService`, modèles `User`, `Application`, `Interview`, `Notification`, `Conversation`, `Formation`, `Offer` ; `asyncHandler`, `autoCompletePastInterviews`, `isPersonaJailbreakAttempt` + `SAGE_IDENTITY_REFUSAL`.

---

#### `controllers/applications.controller.js`
**Rôle général** : Gère le cycle de vie des candidatures des étudiants aux offres (création, consultation, changement de statut par l'admin).

**Fonctions exportées** :
- `createApplication` — POST `/api/applications`, étudiant uniquement (403 sinon). Valide `offerId` (400). Vérifie l'absence de candidature préexistante (409) et l'existence de l'offre (404). Récupère un CV uploadé éventuel (`req.file`). Crée l'`Application`. Envoie `sendApplicationSent` à l'étudiant et `sendApplicationReceived` + notification in-app à tous les admins actifs (fire-and-forget). Retourne 201.
- `getApplications` — GET `/api/applications`. Étudiant : ses propres candidatures uniquement ; admin : toutes. Offre et étudiant peuplés. 200.
- `getApplication` — GET `/api/applications/:id`. 404 si introuvable. Autorise le propriétaire ou un admin (403 sinon). 200.
- `updateStatus` — PUT `/api/applications/:id/status`, admin. Valide le statut (400). **Règle métier clé** : une décision finale (`acceptée`/`refusée`) n'est autorisée que si la candidature est déjà `"en cours"` (409 sinon, imposant qu'un entretien soit d'abord proposé). Notification in-app adaptée au statut + email `sendApplicationStatus` (sauf pour `"en attente"`). 200.

**Dépendances internes** : modèles `Application`, `Offer`, `User`, `Notification` ; `asyncHandler` ; `emailService`.

---

#### `controllers/auth.controller.js`
**Rôle général** : Contrôleur central de l'authentification — inscription/vérification email par code, connexion classique, OAuth Google/Facebook, réinitialisation de mot de passe, gestion du profil et des paramètres de compte. *(Détail complet du flux dans la section [4.1 Authentification](#41-authentification-jwt--oauth-googlefacebook).)*

**Fonctions exportées** : `register`, `verifyEmail`, `resendCode`, `login`, `googleAuth`, `facebookAuth`, `forgotPassword`, `resetPassword`, `getMe`, `updateProfile`, `uploadProfileCV`, `logout`, `changePassword`, `updateSettings`, `deleteAccount`. Plus une fonction interne partagée `findOrCreateOAuthUser`.

**Dépendances internes** : modèles `User`, `LoginHistory` ; `asyncHandler`, `signToken` ; `emailService` (`sendWelcome`, `sendNewUserAdmin`, `sendVerifyCode`, `sendResetPassword`) ; `crypto`, `google-auth-library`, `geoip-lite`, API Graph Facebook via `fetch`.

---

#### `controllers/ceremony.controller.js`
**Rôle général** : Gère la « Cérémonie » — un concours de projets étudiants par édition, avec soumission, modération admin, vote étudiant limité, clôture avec désignation du gagnant, et archives des éditions passées. *(Détail complet du flux dans la section [4.3 Cérémonie](#43-cérémonie-de-projets).)*

**Concepts clés** : **Édition courante** portée par un singleton `CeremonySettings` (créé à la volée) ; **archivage implicite** dès qu'une édition strictement supérieure existe (pas de champ « clôturé » explicite par édition).

**Fonctions exportées** : `createProject`, `getProjects`, `getProject`, `getMyProjects`, `getLeaderboard`, `getCeremonySettings`, `vote`, `getAdminProjects`, `acceptProject`/`rejectProject`, `updateCeremonySettings`, `closeAndAnnounce`, `resetVotes`, `getCeremonyArchives`, `getCeremonyArchiveEdition`.

**Dépendances internes** : modèles `CeremonyProject`, `CeremonyVote`, `CeremonySettings`, `User`, `Notification` ; `asyncHandler` ; `emailService` (`sendVoteConfirmation`, `sendWinnerCongrats`, `sendCeremonyResults`) ; `mongoose`.

---

#### `controllers/conversations.controller.js`
**Rôle général** : Gère la messagerie instantanée basée sur des `Conversation` (paires de participants) et leurs `Message` associés, avec support d'upload de fichiers.

**Fonctions exportées** :
- `getConversations` — GET `/api/conversations`. Conversations de l'utilisateur, participants + dernier message peuplés, tri `lastMessageAt` décroissant, calcule `otherUser` et `unreadCount`.
- `getConversationMessages` — GET `/api/conversations/:conversationId/messages?page=&limit=`. Pagination (limit max 100). Vérifie l'appartenance (404 sinon). Marque comme lus les messages reçus non lus + remet à 0 `unreadCounts`. 200.
- `uploadFileMessage` — POST `/api/conversations/upload`. Valide fichier + `receiverId`/`conversationId` (400, avec nettoyage du fichier via `fs.unlink` en cas d'erreur). Trouve/crée la conversation, crée le `Message` avec métadonnées fichier. 201.
- `getStudents` — GET `/api/conversations/students`. Liste des étudiants actifs (hors soi-même) pour démarrer une conversation.

**Dépendances internes** : modèles `Conversation`, `Message`, `User` ; `asyncHandler` ; `fs`.

---

#### `controllers/driveProxy.controller.js`
**Rôle général** : Fournit un proxy serveur pour contourner les restrictions anti-hotlinking de Google Drive sur les vignettes affichées dans le frontend.

**Fonctions exportées** :
- `getDriveThumbnail` — GET `/api/drive-thumbnail/:fileId`, public. Valide le format de `fileId` (regex, 400 sinon). Requête serveur-à-serveur vers `drive.google.com/thumbnail?id=<fileId>&sz=w1000` avec `User-Agent` personnalisé (le navigateur ne peut pas suivre directement la redirection Google en cross-site à cause des en-têtes `Sec-Fetch-*`). 404 si échec. Réesert l'image en `Buffer` avec `Content-Type` déduit, `Cache-Control` 24h et `Cross-Origin-Resource-Policy: cross-origin` (contourne le `same-origin` par défaut de `helmet()`).

**Dépendances internes** : `asyncHandler` ; `fetch` natif. Aucun modèle Mongoose.

---

#### `controllers/enrollment.controller.js`
**Rôle général** : Gère les inscriptions effectives des étudiants aux formations (`Enrollment`), incluant le suivi de progression semaine par semaine.

**Fonctions exportées** :
- `getMyEnrollments` — GET `/api/enrollments`. Inscriptions de l'étudiant connecté, formation peuplée.
- `getMyEnrollment` — GET `/api/enrollments/:formationId`. 404 si introuvable.
- `getAllEnrollments` — GET `/api/enrollments/admin?status=`, admin. Filtre optionnel sur `overallStatus`.
- `cancelEnrollment` — DELETE `/api/enrollments/admin/:id`, admin. Supprime l'inscription + notification `warning` à l'étudiant.
- `enroll` — POST `/api/enrollments`. Vérifie formation existante (404) et absence de doublon (409). Construit la progression initiale (`buildInitialWeekProgress`). 201.
- `updateWeekStatus` — PATCH `/api/enrollments/:formationId/weeks/:weekNum`. Valide le statut (400). Met à jour la semaine, **débloque automatiquement la semaine suivante** si `"done"`, recalcule `overallStatus` global. 200.

**Dépendances internes** : modèles `Enrollment`, `Formation`, `Notification` ; `asyncHandler`, `buildInitialWeekProgress` ; `mongoose`.

---

#### `controllers/enrollmentRequest.controller.js`
**Rôle général** : Gère les demandes d'inscription à une formation soumises par les étudiants, en amont de la création effective de l'`Enrollment` (workflow de validation admin).

**Fonctions exportées** :
- `createRequest` — POST `/api/enrollment-requests`. Valide `formationId` + `mode` (400). Vérifie existence formation (404) et absence de doublon (409). 201.
- `getMyRequests` — GET `/api/enrollment-requests`. Demandes de l'étudiant connecté.
- `getAllRequests` — GET `/api/enrollment-requests/admin?status=`, admin.
- `acceptRequest` — PATCH `/api/enrollment-requests/:id/accept`, admin. Exige statut `"en_attente"` (409 sinon). **Crée automatiquement l'`Enrollment`** correspondant. Notification `success`. 200.
- `rejectRequest` — PATCH `/api/enrollment-requests/:id/reject`, admin. Même garde-fou. Notification `warning`. 200.

**Dépendances internes** : modèles `EnrollmentRequest`, `Formation`, `Enrollment`, `Notification` ; `asyncHandler`, `buildInitialWeekProgress` ; `mongoose`.

---

#### `controllers/favorites.controller.js`
**Rôle général** : Gère la liste d'offres favorites d'un étudiant, stockée directement comme un tableau de références sur le document `User`.

**Fonctions exportées** :
- `getFavorites` — GET `/api/favorites`. Utilisateur connecté avec `favorites` peuplé.
- `toggleFavorite` — POST `/api/favorites/:offerId`. Bascule ajout/retrait dans `user.favorites`. 200 avec `{ isFavorite, favoritesCount }`.

**Dépendances internes** : modèle `User` ; `asyncHandler`.

---

#### `controllers/formation.controller.js`
**Rôle général** : CRUD complet des formations (contenu de base, trailer vidéo, vidéos, semaines de programme, encadrement/supervision, avis) avec gestion de slugs uniques et normalisation d'URLs Google Drive.

**Fonctions exportées** :
- `getAllFormations` — GET `/api/formations`, public. Toutes les formations, `__v` exclu.
- `getFormationsTechMap` — GET `/api/formations/tech-map`. Version allégée (`slug`, `title`, `technologies`) pour faire correspondre les compétences d'une offre à une formation.
- `getFormationBySlug` / `getFormationById` — GET publics, 404 sinon, incrémente `views` à chaque lecture.
- `createFormation` — POST, admin. Valide champs requis (400), unicité titre (409). Génère un slug kebab-case sans accents (`slugify` + `ACCENT_MAP`), garantit son unicité (`generateUniqueSlug`, suffixes `-2`, `-3`...). Normalise les URLs Drive. 201.
- `updateFormationInfo` — PATCH, admin. Reslugifie si `slug`/`title` change (unicité revérifiée hors document courant).
- `deleteFormation` — DELETE, admin. Vérifie l'absence d'`Enrollment`/`EnrollmentRequest` liés (409 sinon, pas de cascade silencieuse).
- `patchFormationTrailer` / `patchFormationVideos` / `patchFormationWeeks` / `patchFormationSupervision` — PATCH, admin. Normalisation Drive systématique (préserve les images base64 sans les passer par `normalizeDriveUrl`), remplacement intégral des tableaux concernés.
- `uploadFormationVideoThumbnail` — POST, admin. Upload disque (multer), retourne juste l'URL.
- `addReview` / `updateReview` / `deleteReview` — CRUD des avis en sous-documents (`.id()` pour localiser), admin.

**Dépendances internes** : modèles `Formation`, `Enrollment`, `EnrollmentRequest` ; `asyncHandler`, `normalizeDriveUrl` + `isBase64Image`.

---

#### `controllers/interviews.controller.js`
**Rôle général** : Gère la proposition, la consultation et la mise à jour de statut des entretiens liés aux candidatures.

**Fonctions exportées** :
- `proposeInterview` — POST `/api/interviews`, admin. Valide `applicationId`+`scheduledAt` (400). **Règle métier** : n'est possible que si la candidature est `"en attente"` (409 sinon). Crée l'`Interview`, fait passer la candidature à `"en cours"`. Notification + email `sendInterviewProposed` à l'étudiant. 201.
- `getInterviews` — GET `/api/interviews`. Filtré par étudiant sauf admin (tous). Appelle `autoCompletePastInterviews` avant lecture. Peuplé candidature+offre+étudiant+company.
- `updateInterviewStatus` — PUT `/api/interviews/:id/status`. Valide statut (400). Autorise l'étudiant concerné ou un admin (403 sinon). Email `sendInterviewStatus` à l'étudiant systématiquement ; au « company » **uniquement si `"confirmé"`** (asymétrie volontaire).

**Dépendances internes** : modèles `Interview`, `Application`, `Notification`, `User` ; `asyncHandler`, `autoCompletePastInterviews` ; `emailService`.

---

#### `controllers/messages.controller.js`
**Rôle général** : Ancien contrôleur de messagerie point-à-point (deux fonctions marquées « conservées pour rétro-compatibilité »), coexistant avec le système de `Conversation` plus riche de `conversations.controller.js`.

**Fonctions exportées** :
- `sendMessage` — POST `/api/messages`. Trouve/crée la conversation, crée le `Message`, notification in-app + email `sendNewMessage` (aperçu tronqué à 140 caractères).
- `getConversation` — GET `/api/messages/:userId`. Messages échangés avec un utilisateur, marqués lus.
- `getConversations` — GET `/api/messages`. Liste brute des messages (pas de regroupement par conversation, contrairement à l'homonyme de `conversations.controller.js`).

**Dépendances internes** : modèles `Message`, `Conversation`, `User`, `Notification` ; `asyncHandler` ; `emailService.sendNewMessage`.

---

#### `controllers/news.controller.js`
**Rôle général** : CRUD des actualités/articles publiés sur la plateforme, avec normalisation d'image (lien Google Drive ou base64).

**Fonctions exportées** : `getAllNews` (public, `limit` optionnel), `getNewsById` (public — 404 renvoyé directement via `res.status(404).json(...)` plutôt que par le mécanisme `throw`+middleware utilisé ailleurs, incohérence stylistique mineure), `createNews`/`updateNews`/`deleteNews` (admin).

**Dépendances internes** : modèle `News` ; `asyncHandler`, `normalizeDriveUrl` + `isBase64Image`.

---

#### `controllers/notifications.controller.js`
**Rôle général** : Gère les notifications in-app de l'utilisateur connecté (lecture paginée, marquage comme lu, suppression).

**Fonctions exportées** :
- `getNotifications` — GET `/api/notifications?page=&limit=`. Met à jour `lastActiveAt` à chaque appel (heartbeat de présence, polling frontend ~30s, utilisé aussi par `getOnlineCount`). Pagination (max 100, défaut 50).
- `markAsRead` / `markAllAsRead` / `deleteNotification` — filtrés par `userId` (empêche d'agir sur les notifications d'autrui).

**Dépendances internes** : modèles `User`, `Notification` ; `asyncHandler`.

---

#### `controllers/offers.controller.js`
**Rôle général** : CRUD des offres de stage/PFE/alternance avec recherche, filtrage, pagination et statistiques de vues, incluant une couche de normalisation des payloads pour tolérer plusieurs conventions de nommage de champs.

**Fonctions exportées** :
- `getOffers` — GET public. Filtre actives par défaut, `domain`/`type`/`location`/`search` (regex multi-champs). Pagination (max 50, défaut 9).
- `getOffer` — GET public, incrémente `views`.
- `createOffer` / `updateOffer` — admin. Normalisation via fonctions internes `normalizePayload` (alias de champs : `desc`→`description`, `company`→`companyName`, `specialite`→`domain`, `skillsRequired`/`motsCles`→`skills`) et `normalizeType` (`"stage pfe"`/`"pfe"`→`"PFE"`, etc.).
- `deleteOffer` — admin. **Aucun garde-fou sur les candidatures liées**, contrairement à `deleteFormation`/`deleteUser` (incohérence relevée).
- `getDomains` — public, valeurs distinctes de `domain`.
- `getOffersAdmin` — admin, toutes offres + `applicationsCount` agrégé.
- `updateOfferStatus` — PATCH, admin, active/désactive sans formulaire complet.

**Dépendances internes** : modèles `Offer`, `Application` ; `asyncHandler`.

---

#### `controllers/siteSettings.controller.js`
**Rôle général** : Gère un document singleton de configuration globale du site (vidéo d'action de la landing page, témoignages vidéo).

**Fonctions exportées** : `getSettings` (public, `getOrCreateSettings`), `updateSettings` (admin, normalisation Drive de `actionVideo`), `addTestimonialVideo`/`updateTestimonialVideo`/`deleteTestimonialVideo` (admin, sous-documents `testimonialVideos`, catégories `summer-camp`/`pfe`/`formation`/`unknown`).

**Dépendances internes** : modèle `SiteSettings` ; `asyncHandler`, `normalizeDriveUrl` + `isBase64Image`.

---

#### `controllers/stats.controller.js`
**Rôle général** : Expose des statistiques publiques agrégées pour la landing page (aucune authentification requise).

**Fonctions exportées** :
- `getPublicStats` — GET `/api/stats`, public. Nombre de formations, d'étudiants, d'offres actives, plus un `satisfactionRate` **codé en dur à 100** (commenté explicitement dans le code : aucune donnée d'enquête réelle en base — donnée à considérer comme non représentative).

**Dépendances internes** : modèles `User`, `Formation`, `Offer` ; `asyncHandler`.

---

#### `controllers/testimonialScreenshot.controller.js`
**Rôle général** : CRUD des captures d'écran de témoignages affichées sur la landing page (distinct des témoignages vidéo gérés par `siteSettings.controller.js`).

**Fonctions exportées** : `getAllTestimonialScreenshots` (public, tri `order`), `addTestimonialScreenshot`/`updateTestimonialScreenshot`/`deleteTestimonialScreenshot` (admin, normalisation d'image via `normalizeImage` interne).

**Dépendances internes** : modèle `TestimonialScreenshot` ; `asyncHandler`, `normalizeDriveUrl` + `isBase64Image`.

---

**⚠️ Incohérences relevées dans les controllers (à noter pour le rapport)** :
1. `stats.controller.js` : `satisfactionRate` codé en dur à 100 (pas de données réelles d'enquête en base).
2. `offers.controller.js` : `deleteOffer` ne vérifie pas l'existence de candidatures liées avant suppression, contrairement à `deleteFormation`/`deleteUser` qui bloquent avec 409.
3. `news.controller.js` : `getNewsById` retourne un 404 via `res.status(404).json(...)` direct au lieu du mécanisme `throw`+`errorHandler` utilisé partout ailleurs (fonctionnellement équivalent, stylistiquement incohérent).
4. `interviews.controller.js` : l'email de changement de statut n'est envoyé à l'admin (« company ») que pour le statut `"confirmé"`, jamais pour `"annulé"`/`"terminé"` (asymétrie volontaire, à documenter).
5. `messages.controller.js` coexiste avec `conversations.controller.js` (deux systèmes de messagerie qui se chevauchent partiellement), le premier étant explicitement marqué « conservé pour rétro-compatibilité ».

### 3.4 routes/

> 20 fichiers. Tous montés sous `/api/...` dans `server.js`, chacun derrière `authLimiter` (auth) ou `apiLimiter`/`thumbnailLimiter` (reste). Middlewares référencés : `protect` (JWT), `authorize(...roles)` (RBAC), `validateObjectId()` (validation d'ObjectId), `uploadCV`/`uploadMessageFile`/`uploadNewsImage`/`uploadVideoThumbnail` (Multer).

#### `routes/auth.routes.js` — `/api/auth`
| Méthode | Chemin | Controller | Middleware |
|---|---|---|---|
| POST | `/register` | `register` | — |
| POST | `/login` | `login` | — |
| POST | `/google` | `googleAuth` | — |
| POST | `/facebook` | `facebookAuth` | — |
| POST | `/verify-email` | `verifyEmail` | — |
| POST | `/resend-code` | `resendCode` | — |
| POST | `/forgot-password` | `forgotPassword` | — |
| POST | `/reset-password/:token` | `resetPassword` | — |
| GET | `/me` | `getMe` | `protect` |
| PUT | `/profile` | `updateProfile` | `protect` |
| POST | `/profile/cv` | `uploadProfileCV` | `protect`, `uploadCV` |
| POST | `/logout` | `logout` | `protect` |
| PUT | `/password` | `changePassword` | `protect` |
| PUT | `/settings` | `updateSettings` | `protect` |
| DELETE | `/account` | `deleteAccount` | `protect` |

#### `routes/offers.routes.js` — `/api/offers`
| Méthode | Chemin | Controller | Middleware |
|---|---|---|---|
| GET | `/meta/domains` | `getDomains` | — |
| GET | `/admin` | `getOffersAdmin` | `protect`, `authorize("admin")` |
| GET | `/` | `getOffers` | — |
| GET | `/:id` | `getOffer` | `validateObjectId` |
| POST | `/` | `createOffer` | `protect`, `authorize("admin")` |
| PUT | `/:id` | `updateOffer` | `protect`, `validateObjectId`, `authorize("admin")` |
| PATCH | `/:id/status` | `updateOfferStatus` | `protect`, `validateObjectId`, `authorize("admin")` |
| DELETE | `/:id` | `deleteOffer` | `protect`, `validateObjectId`, `authorize("admin")` |

#### `routes/applications.routes.js` — `/api/applications`
| Méthode | Chemin | Controller | Middleware |
|---|---|---|---|
| POST | `/` | `createApplication` | `protect`, `uploadCV` |
| GET | `/` | `getApplications` | `protect` |
| GET | `/:id` | `getApplication` | `protect` |
| PUT | `/:id/status` | `updateStatus` | `protect` |

#### `routes/interviews.routes.js` — `/api/interviews`
| Méthode | Chemin | Controller | Middleware |
|---|---|---|---|
| POST | `/` | `proposeInterview` | `protect` |
| GET | `/` | `getInterviews` | `protect` |
| PUT | `/:id/status` | `updateInterviewStatus` | `protect` |

#### `routes/messages.routes.js` — `/api/messages` (rétro-compatibilité)
| Méthode | Chemin | Controller | Middleware |
|---|---|---|---|
| POST | `/` | `sendMessage` | `protect` |
| GET | `/` | `getConversations` | `protect` |
| GET | `/:userId` | `getConversation` | `protect` |

#### `routes/conversations.routes.js` — `/api/conversations`
| Méthode | Chemin | Controller | Middleware |
|---|---|---|---|
| GET | `/` | `getConversations` | `protect` |
| GET | `/students` | `getStudents` | `protect` |
| GET | `/:conversationId/messages` | `getConversationMessages` | `protect` |
| POST | `/upload` | `uploadFileMessage` | `protect`, `uploadMessageFile` appelé manuellement (pas branché comme middleware Express direct, afin d'intercepter ses erreurs Multer et les convertir en 413/400 avant `next()`) |

#### `routes/notifications.routes.js` — `/api/notifications`
| Méthode | Chemin | Controller | Middleware |
|---|---|---|---|
| GET | `/` | `getNotifications` | `protect` |
| PUT | `/read-all` | `markAllAsRead` | `protect` |
| PUT | `/:id/read` | `markAsRead` | `protect` |
| DELETE | `/:id` | `deleteNotification` | `protect` |

#### `routes/favorites.routes.js` — `/api/favorites`
| Méthode | Chemin | Controller | Middleware |
|---|---|---|---|
| GET | `/` | `getFavorites` | `protect` |
| POST | `/:offerId` | `toggleFavorite` | `protect` |

#### `routes/formation.routes.js` — `/api/formations`
| Méthode | Chemin | Controller | Middleware |
|---|---|---|---|
| GET | `/` | `getAllFormations` | — |
| GET | `/tech-map` | `getFormationsTechMap` | — |
| GET | `/slug/:slug` | `getFormationBySlug` | — |
| POST | `/` | `createFormation` | `protect`, `authorize("admin")` |
| PATCH | `/slug/:slug/weeks` | `patchFormationWeeks` | `protect`, `authorize("admin")` |
| PATCH | `/slug/:slug/supervision` | `patchFormationSupervision` | `protect`, `authorize("admin")` |
| PATCH | `/slug/:slug/videos` | `patchFormationVideos` | `protect`, `authorize("admin")` |
| POST | `/upload-thumbnail` | `uploadFormationVideoThumbnail` | `protect`, `authorize("admin")`, `uploadVideoThumbnail` |
| PATCH | `/:id/trailer` | `patchFormationTrailer` | `protect`, `authorize("admin")` |
| PATCH | `/:id` | `updateFormationInfo` | `protect`, `authorize("admin")` |
| DELETE | `/:id` | `deleteFormation` | `protect`, `authorize("admin")` |
| POST | `/:formationId/reviews` | `addReview` | `protect`, `authorize("admin")` |
| PATCH | `/:formationId/reviews/:reviewId` | `updateReview` | `protect`, `authorize("admin")` |
| DELETE | `/:formationId/reviews/:reviewId` | `deleteReview` | `protect`, `authorize("admin")` |
| GET | `/:id` | `getFormationById` | — |

*Remarque* : `GET /:id` est déclarée en dernier (après `/tech-map`, `/slug/:slug`, `/:formationId/reviews`...) pour éviter qu'Express capture ces chemins avec le paramètre générique `:id`.

#### `routes/enrollment.routes.js` — `/api/enrollments`
| Méthode | Chemin | Controller | Middleware |
|---|---|---|---|
| GET | `/admin` | `getAllEnrollments` | `protect`, `authorize("admin")` |
| DELETE | `/admin/:id` | `cancelEnrollment` | `protect`, `authorize("admin")`, `validateObjectId` |
| GET | `/` | `getMyEnrollments` | `protect`, `authorize("étudiant")` |
| GET | `/:formationId` | `getMyEnrollment` | `protect`, `authorize("étudiant")` |
| POST | `/` | `enroll` | `protect`, `authorize("étudiant")` |
| PATCH | `/:formationId/weeks/:weekNum` | `updateWeekStatus` | `protect`, `authorize("étudiant")` |

#### `routes/enrollmentRequest.routes.js` — `/api/enrollment-requests`
| Méthode | Chemin | Controller | Middleware |
|---|---|---|---|
| GET | `/admin` | `getAllRequests` | `protect`, `authorize("admin")` |
| PATCH | `/:id/accept` | `acceptRequest` | `protect`, `authorize("admin")`, `validateObjectId` |
| PATCH | `/:id/reject` | `rejectRequest` | `protect`, `authorize("admin")`, `validateObjectId` |
| GET | `/` | `getMyRequests` | `protect`, `authorize("étudiant")` |
| POST | `/` | `createRequest` | `protect`, `authorize("étudiant")` |

#### `routes/admin.routes.js` — `/api/admin` (protégé globalement par `router.use(protect)` + `router.use(authorize("admin"))`)
| Méthode | Chemin | Controller |
|---|---|---|
| GET | `/dashboard-stats` | `getDashboardStats` |
| GET | `/stats` | `getAdvancedStats` |
| GET | `/top-offers` | `getTopOffers` |
| GET | `/top-formations` | `getTopFormations` |
| GET | `/top-pages` | `getTopPages` |
| GET | `/visits-by-day` | `getVisitsByDay` |
| GET | `/top-videos` | `getTopVideos` |
| GET | `/online-count` | `getOnlineCount` |
| POST | `/users` | `createUser` |
| GET | `/users` | `getUsers` |
| GET | `/users/:id` | `getUserById` (+ `validateObjectId`) |
| PATCH | `/users/:id/status` | `updateUserStatus` (+ `validateObjectId`) |
| PATCH | `/users/:id/role` | `updateUserRole` (+ `validateObjectId`) |
| DELETE | `/users/:id` | `deleteUser` (+ `validateObjectId`) |

#### `routes/stats.routes.js` — `/api/stats`
| Méthode | Chemin | Controller | Middleware |
|---|---|---|---|
| GET | `/` | `getPublicStats` | — (public) |

#### `routes/news.routes.js` — `/api/news`
| Méthode | Chemin | Controller | Middleware |
|---|---|---|---|
| GET | `/` | `getAllNews` | — |
| GET | `/:id` | `getNewsById` | — |
| POST | `/` | `createNews` | `protect`, `authorize("admin")` |
| PUT | `/:id` | `updateNews` | `protect`, `authorize("admin")` |
| DELETE | `/:id` | `deleteNews` | `protect`, `authorize("admin")` |

*Remarque du code* : `uploadNewsImage` n'est plus utilisée sur ces routes (image transmise en JSON — lien Drive ou base64) mais reste définie dans le middleware.

#### `routes/track.routes.js` — `/api/track` (⚠️ pas de controller dédié, logique inline)
| Méthode | Chemin | Middleware | Rôle |
|---|---|---|---|
| POST | `/page-visit` | `asyncHandler(handler inline)` | Enregistre une visite de page ; identifie l'utilisateur si JWT Bearer valide présent, sinon anonyme |
| POST | `/video-view` | `asyncHandler(handler inline)` | Enregistre une vue vidéo ; même logique d'identification optionnelle |

#### `routes/settings.routes.js` — `/api/settings`
| Méthode | Chemin | Controller | Middleware |
|---|---|---|---|
| GET | `/` | `getSettings` | — (public) |
| PATCH | `/` | `updateSettings` | `protect`, `authorize("admin")` |
| POST | `/testimonials` | `addTestimonialVideo` | `protect`, `authorize("admin")` |
| PATCH | `/testimonials/:id` | `updateTestimonialVideo` | `protect`, `authorize("admin")` |
| DELETE | `/testimonials/:id` | `deleteTestimonialVideo` | `protect`, `authorize("admin")` |

#### `routes/testimonialScreenshot.routes.js` — `/api/testimonial-screenshots`
| Méthode | Chemin | Controller | Middleware |
|---|---|---|---|
| GET | `/` | `getAllTestimonialScreenshots` | — |
| POST | `/` | `addTestimonialScreenshot` | `protect`, `authorize("admin")` |
| PATCH | `/:id` | `updateTestimonialScreenshot` | `protect`, `authorize("admin")` |
| DELETE | `/:id` | `deleteTestimonialScreenshot` | `protect`, `authorize("admin")` |

#### `routes/driveProxy.routes.js` — `/api/drive-thumbnail` (rate-limiter dédié `thumbnailLimiter`)
| Méthode | Chemin | Controller | Middleware |
|---|---|---|---|
| GET | `/:fileId` | `getDriveThumbnail` | — (public) |

#### `routes/ai.routes.js` — `/api/ai`
| Méthode | Chemin | Controller | Middleware |
|---|---|---|---|
| GET | `/user-context` | `getUserContext` | `protect` |
| POST | `/chat` | `chat` | `protect` |
| POST | `/recommendations` | `recommendations` | `protect` |

#### `routes/ceremony.routes.js` — `/api/ceremony`
| Méthode | Chemin | Controller | Middleware |
|---|---|---|---|
| GET | `/leaderboard` | `getLeaderboard` | — |
| GET | `/settings` | `getCeremonySettings` | — |
| GET | `/projects` | `getProjects` | — |
| GET | `/projects/:id` | `getProject` | `validateObjectId` |
| GET | `/archives` | `getCeremonyArchives` | — |
| GET | `/archives/:edition` | `getCeremonyArchiveEdition` | — |
| GET | `/my-projects` | `getMyProjects` | `protect` |
| POST | `/projects` | `createProject` | `protect` |
| POST | `/vote` | `vote` | `protect` |
| GET | `/admin/projects` | `getAdminProjects` | `protect`, `authorize("admin")` |
| PATCH | `/admin/projects/:id/accept` | `acceptProject` | `protect`, `authorize("admin")`, `validateObjectId` |
| PATCH | `/admin/projects/:id/reject` | `rejectProject` | `protect`, `authorize("admin")`, `validateObjectId` |
| PATCH | `/admin/settings` | `updateCeremonySettings` | `protect`, `authorize("admin")` |
| POST | `/admin/close-and-announce` | `closeAndAnnounce` | `protect`, `authorize("admin")` |
| POST | `/admin/reset-votes` | `resetVotes` | `protect`, `authorize("admin")` |

### 3.5 middleware/

#### `middleware/sanitize.middleware.js`
**Rôle** : Protection contre les injections NoSQL (opérateurs Mongo `$...` ou clés à points) dans `req.body`/`req.params`.
- `sanitizeValue(obj)` (interne) — parcourt récursivement et retire toute clé commençant par `$` ou contenant un point.
- `mongoSanitize(req, res, next)` — applique `sanitizeValue` sur `req.body` et `req.params` uniquement (**pas** `req.query`, en lecture seule sous Express 5), puis `next()`.

**Utilisé par** : `server.js` (middleware global).

#### `middleware/auth.middleware.js`
**Rôle** : Authentification JWT et RBAC, plus validation générique d'`ObjectId`.
- `validateObjectId(paramName = "id")` — factory de middleware : vérifie `mongoose.Types.ObjectId.isValid()`, 400 sinon.
- `protect` — extrait `Authorization: Bearer <token>` (401 si absent), décode via `verifyToken` (401 si invalide/expiré), charge `User.findById(decoded.id).lean()` (401 si introuvable). Vérifie `user.isActive !== false` : un compte désactivé après émission du token perd l'accès immédiatement (403), même si le JWT reste valide — correctif de sécurité documenté explicitement dans le code. Attache `req.user`.
- `authorize(...allowedRoles)` — factory RBAC : exige `req.user` (401) et `req.user.role` dans `allowedRoles` (403 sinon).

**Utilisé par** : 17 des 20 fichiers de `routes/`, pour protéger les endpoints privés et restreindre par rôle.

#### `middleware/error.middleware.js`
**Rôle** : Gestion centralisée des erreurs — 404 et formatage uniforme.
- `notFound(req, res, next)` — erreur "Not Found - {url}", `statusCode 404`, transmise à `next`.
- `errorHandler(err, req, res, next)` — détermine `statusCode`/`message`. Cas spécial Multer (`err.name === "MulterError"`, forcé 400, message dédié pour `LIMIT_FILE_SIZE` → "dépasse 5MB"). Ajoute `code` au payload si `err.code` est une chaîne (permet au frontend de distinguer un cas métier, ex. `AI_CONVERSATION_LIMIT_REACHED`). En développement, ajoute `err.stack`.

**Utilisé par** : `server.js`, en toute fin de chaîne.

#### `middleware/upload.middleware.js`
**Rôle** : Quatre pipelines Multer distincts.
- `uploadCV` (`.single("cv")`) — `uploads/`, nom `cv-{timestamp}-{random}{ext}`, extensions `.pdf/.doc/.docx`, 5 Mo max.
- `uploadMessageFile` (`.single("file")`) — nom `msg-...`, extensions `.pdf/.doc/.docx/.png/.jpg/.jpeg`, 10 Mo max.
- `uploadNewsImage` (`.single("image")`) — nom `news-...`, extensions image, 5 Mo max ; n'échoue pas si aucun fichier n'est fourni (permet de conserver l'image existante sur une route de mise à jour).
- `uploadVideoThumbnail` (`.single("thumbnail")`) — nom `video-thumb-...`, mêmes règles que `uploadNewsImage`.

**Utilisé par** : `routes/formation.routes.js`, `routes/news.routes.js`, `routes/auth.routes.js`, `routes/conversations.routes.js`, `routes/applications.routes.js`.

### 3.6 services/

#### `services/groq.service.js` — fournisseur IA **actif**
**Rôle** : Client Groq (SDK `groq-sdk`, API style OpenAI) — fournisseur IA actuellement actif pour SAGE, l'analyse de CV, la lettre de motivation et les recommandations de stage.
- `getClient()` — singleton `Groq(process.env.GROQ_API_KEY)` ; **lève une exception immédiate** si la clé est absente (contrairement à Gemini).
- `chat(messages, options)` — modèle codé en dur `"openai/gpt-oss-20b"` (commentaire : `llama-3.1-8b-instant` retiré par Groq le 17/06/2026). Filtre les rôles supportés (system/assistant/user). `temperature` défaut 0.7, `max_tokens` défaut 1024. Log explicite de `err.status`/`err.message` en cas d'erreur (ajouté après une panne Groq restée invisible dans les logs).
- `recommendInternships(studentId, limit=5)` — tokenise profil étudiant + offres actives, score par tokens communs, prompt de recommandation en français.
- `analyzeCV({text})` — prompt d'analyse de CV en JSON strict (`summary, skills, experiences, education, recommendations`), `temperature 0.0`, extraction du premier bloc `{...}` par regex + `JSON.parse` (tolérant à l'échec de parsing, retourne `{text, parsed:null}` si échec).
- `generateMotivationLetter(studentId, offerId, {tone, length})` — prompt de lettre de motivation, `temperature 0.4`.

**Dépend de** : `groq-sdk`, `Offer`, `User` ; `GROQ_API_KEY`. **Utilisé par** : `controllers/ai.controller.js` (seul consommateur).

#### `services/gemini.service.js` — fournisseur IA **prêt mais inactif**
**Rôle** : Client Google Gemini (`@google/genai`), prévu comme fournisseur alternatif pour SAGE, **non importé par aucun controller** actuellement.
- `getModel()` — `GEMINI_MODEL` ou fallback `"gemini-2.5-flash-lite"` (filet temporaire, pas une recommandation figée selon le commentaire du code).
- `getClient()` — singleton, retourne `null` si `GEMINI_API_KEY` absente (pas d'exception, contrairement à Groq).
- `chat(messages, options)` — si client indisponible : erreur contrôlée `statusCode 503`, `code "AI_UNAVAILABLE"`. Sinon extrait le message `role:"system"` en `systemInstruction` séparé (l'API Gemini n'a pas de rôle système dans son tableau de tours), traduit `assistant`→`model`. `temperature` défaut 0.7, `maxOutputTokens` défaut 1024.
- `recommendInternships(studentId, limit=5)` — logique de scoring identique à `groq.service.js`.

**Note** : `ai.controller.js` documente explicitement que la bascule Groq→Gemini se ferait en remplaçant les deux appels `groqService` par `geminiService`, en attendant l'achat d'une clé API par l'encadrant.

**Dépend de** : `@google/genai`, `Offer`, `User` ; `GEMINI_API_KEY`, `GEMINI_MODEL`.

#### `services/email.service.js`
**Rôle** : Service centralisé d'envoi d'emails transactionnels via **Gmail SMTP** (`smtp.gmail.com:465`, SMTPS) au moyen de **Nodemailer**, avec un compte Gmail + mot de passe d'application. *(Remplace une intégration Brevo antérieure — voir historique Git et note en §1.2 : le `README.md` racine n'a pas été mis à jour en conséquence.)*

**Détails techniques notables** :
- Transporter Nodemailer singleton (`getTransporter`), créé une seule fois puis réutilisé.
- `family: 4` forcé explicitement (IPv4) — commentaire du code : "le réseau sortant de Render ne supporte pas l'IPv6 (ENETUNREACH sur l'IP AAAA de Gmail)".
- Timeouts explicites (`connectionTimeout` 10s, `greetingTimeout` 10s, `socketTimeout` 15s).
- `verifyEmailConfig()` : vérifie au démarrage du serveur (`server.js`) que `SMTP_USER`/`SMTP_PASS`/`EMAIL_FROM` sont définis et que la connexion SMTP est valide (`transporter.verify()`) — ne bloque jamais le démarrage, juste un diagnostic loggé.
- Chaque email envoyé inclut désormais une version **texte brut** générée automatiquement depuis le HTML (`htmlToPlainText`, régler regex de nettoyage des balises), ainsi qu'un en-tête `Reply-To` = `EMAIL_FROM` — améliorations de délivrabilité anti-spam (commit récent : "texte brut, emojis en fin de sujet, Reply-To").
- Layout HTML commun (`layout()`) partagé par tous les templates (en-tête TheBridgeFlow, pied de page avec adresse `contact@9antra.tn`), plus des composants réutilisables `badge()`, `button()`, `infoRow()`.

**Fonctions exportées (objet `emailService` par défaut)**, une par type de notification métier :
| Fonction | Déclenchée par | Contenu |
|---|---|---|
| `sendWelcome(to, {name, role})` | Inscription classique, OAuth, création par admin | Email de bienvenue avec liste des fonctionnalités selon le rôle |
| `sendApplicationSent(to, {studentName, offerTitle, companyName})` | Candidature créée | Confirmation à l'étudiant |
| `sendApplicationReceived(to, {companyName, studentName, studentEmail, offerTitle})` | Candidature créée | Alerte à chaque admin actif |
| `sendApplicationStatus(to, {studentName, offerTitle, companyName, status})` | Changement de statut de candidature | Template différent selon `acceptée`/`refusée`/`en cours` |
| `sendInterviewProposed(to, {studentName, companyName, offerTitle, scheduledAt, mode, location})` | Entretien proposé | Date/heure formatées en français, mode présentiel/en ligne |
| `sendInterviewStatus(to, {recipientName, status, offerTitle, scheduledAt})` | Changement de statut d'entretien | `confirmé`/`annulé`/`terminé` |
| `sendNewMessage(to, {recipientName, senderName, preview, link})` | Nouveau message | Aperçu tronqué à 200 caractères |
| `sendNewUserAdmin(to, {userName, userEmail, userRole})` | Nouvelle inscription | Notification à l'admin |
| `sendAccountCreatedByAdmin(to, {name, email, password, role})` | Création de compte par un admin | Contient le mot de passe temporaire en clair (à usage unique, à changer) |
| `sendVerifyCode(to, {name, code})` | Inscription / renvoi de code | Code à 6 chiffres, expiration 15 min affichée |
| `sendResetPassword(to, {name, resetUrl})` | Mot de passe oublié | Lien à usage unique, expiration 1h affichée |
| `sendVoteConfirmation(to, {studentName, projectTitles})` | Vote cérémonie enregistré | Liste des projets votés |
| `sendWinnerCongrats(to, {studentName, projectTitle, edition})` | Clôture cérémonie | Félicitations au gagnant |
| `sendCeremonyResults(to, {studentName, winnerTitle, winnerStudentName, edition})` | Clôture cérémonie | Annonce du résultat aux autres participants |

Toutes ces fonctions délèguent à la fonction interne `sendEmail({to, subject, html})`, qui logue succès/échec (avec code d'erreur SMTP, durée) et retourne `{success, messageId}` ou `{success:false, error, code}` — jamais d'exception levée, l'échec d'envoi d'email n'interrompt jamais le flux HTTP appelant (cohérent avec l'usage "fire-and-forget" observé dans la plupart des controllers).

**Dépendances internes** : `nodemailer` ; variables d'env `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM`, `CLIENT_URL`.

### 3.7 formations/

> 9 fichiers JSON, chacun un document `Formation` prêt à insérer en base (format d'export Mongo, `_id: {$oid}`).

**Structure commune** : `_id`, `title`, `slug`, `duration`, `price.{onsite,online}` (**aucun fichier n'a `price.recordings`**, ajouté a posteriori en base par `scripts/fillFormationRecordingsPrice.js`), `schedule`, `level`, `description`, `mode`, `certificate` (toujours `false`), `image` (toujours `""`), `features` (toujours `[]`), `trailerVideoUrl`/`trailerThumbnail`, `weeks[]`, `supervision[]`, `stats` (toujours à 0), `videos[]`/`reviews[]`/`faq[]` (toujours vides — alimentés ensuite via l'admin). Élément de `weeks[]`/`supervision[]` : `{week, phase, content, videoUrl, thumbnail, duree, gratuit, videoTitle?}`.

| Fichier | Formation | Particularités |
|---|---|---|
| `fullstack-spring-angular.json` | Full Stack (Spring Boot + Angular) | 8+8 semaines (Frontend/Backend). Pas de `videoTitle`. Toutes les `videoUrl` de `weeks` pointent vers le même placeholder YouTube. |
| `devops.json` | DevOps | 8+8 semaines (Level 1/2). Même structure placeholder que ci-dessus. |
| `cyber-security.json` | Cyber Security | 8+8 semaines (Month 1/2). Idem placeholder. |
| `digital-marketing.json` | Marketing Digital | 8+8 semaines (Month 1/2). Idem placeholder. |
| `mern-stack.json` | MERN Stack (React + Node) | 8+8 (Frontend/Backend). **Différence majeure** : `videoTitle` sur toutes les entrées, vrais chemins locaux (`/videos-MERN/...`), trailer renseigné. Anomalie : `weeks[3]` a `duree:""`. |
| `bi.json` | Business Intelligence | 8+8 (Level 1/2), vrais chemins (`/videos-BI/...`). Incohérence interne : `videoTitle` présent seulement sur les semaines 1-4. |
| `mobile-flutter.json` | Mobile (Flutter + Node/Spring) | **Seulement 4 entrées `weeks[]`** contre 8 `supervision[]` (4 Mobile + 4 Backend Mobile). `videoTitle` partout, chemins réels `/videos-FLUTTER/...`. |
| `ai.json` | IA / Chatbot | 8+8 (Month 1/2, chatbots en Month 2). `videoTitle` partout. Anomalie : `trailerVideoUrl` = `/video-AI.mp4` (convention différente des autres `/videos-AI/...`). |
| `iot.json` | IoT | **Seulement 4 entrées `weeks[]`** contre 8 `supervision[]` (4 IoT + 4 Framework), comme Flutter. `duration` composite unique. Ordre des champs JSON différent (sans incidence). |

### 3.8 scripts/

> 16 fichiers (7 à la racine + 9 dans `scripts/drive/`). La plupart supportent un mode dry-run par défaut et n'écrivent réellement qu'avec le flag `--confirm` (`process.argv.includes("--confirm")`).

#### `scripts/createAdmin.js`
Crée le tout premier compte admin (`admin@thebridgeflow.local` / `Admin123!`, à changer après création). Idempotent (ne recrée pas s'il existe déjà). `node scripts/createAdmin.js`.

#### `scripts/migrateScreenshotTestimonials.js`
Migration one-off : importe en base (`TestimonialScreenshot`) les 29 captures jusque-là codées en dur côté frontend (`screenshotTestimonials.js`). Idempotent (`countDocuments()` avant insertion).

#### `scripts/clearFormationTrailerPlaceholders.js`
Vide `trailerVideoUrl`/`trailerThumbnail`/`trailerDriveUrl` sur toutes les formations (placeholders de test). Dry-run par défaut, `--confirm` pour écrire. Irréversible sans backup préalable (`backup.js`).

#### `scripts/fillFormationRecordingsPrice.js`
Backfill : renseigne `price.recordings = "150 DT/Mois"` sur les 9 formations. Dry-run/`--confirm`, avec vérification finale ✅/❌ après écriture. Écrase toute valeur déjà personnalisée par un admin.

#### `scripts/exportDatabase.js`
Exporte les 19 collections MongoDB (dont 3 sans modèle Mongoose) via le driver natif dans un fichier JSON local (`~/Downloads/`, jamais dans le repo). Rédige 7 champs sensibles de `users` en `"[REDACTED]"`. Lecture seule sur Mongo mais produit un fichier local sensible à ne jamais committer.

#### `scripts/seedCeremonyProjects.js`
Crée 6 `CeremonyProject` fictifs (`isSeedData:true`, `status:"approuvé"`) liés à 6 comptes étudiants réels existants (résolus par email, échec si un email est introuvable). Modes : création (dry-run/`--confirm`) et nettoyage (`--clean`/`--clean --confirm`, scopé strictement à `isSeedData:true`).

#### `scripts/backfillCeremonyEdition.js`
Backfill du champ `edition` sur `CeremonySettings` et les `CeremonyProject` qui ne l'ont pas encore (piège Mongoose : `default` non appliqué aux lectures `.lean()`). Dry-run/`--confirm`, `--edition=N` personnalisable. Non destructif.

#### `scripts/drive/oauthClient.js`
Module **partagé** (jamais exécuté seul) : client OAuth2 Google + gestion des tokens pour 2 comptes (`drive1`, `drive2`). Définit `REDIRECT_URI`, `SCOPES`, `ACCOUNTS` ; expose `createOAuthClient`, `loadSavedToken`, `saveToken`, `getAuthorizedClient`. `drive2` reste configuré bien que plus utilisé (résidu non nettoyé).

#### `scripts/drive/authenticate.js`
Flux OAuth2 interactif (`node authenticate.js <drive1|drive2>`) : ouvre le navigateur, serveur HTTP local temporaire pour intercepter le code, échange contre un token, sauvegarde dans `token-<compte>.json`. Inexécutable en environnement headless/CI.

#### `scripts/drive/backup.js`
Backup lecture seule : exporte tous les documents `Formation` complets en JSON horodaté dans `scripts/drive/backups/` (non versionné), avant toute écriture par `migrate.js --confirm`.

#### `scripts/drive/inventory.js`
Inventaire dry-run des vidéos de cours/encadrement sur Drive (9 dossiers fixes), avec correspondance automatique aux formations Mongo (mapping manuel puis score de similarité de tokens). Génère `drive-migration-report.json`/`.md`, source de données pour `migrate.js`.

#### `scripts/drive/inventory-landing.js`
Inventaire dry-run des médias Landing Page (vidéo promo, témoignages, Img-Feedbacks, avatars). Catégorise les témoignages par préfixe de nom. Génère `landing-migration-report.json`/`.md`, source pour `migrate-landing.js`.

#### `scripts/drive/migrate.js`
Écrit en base (`--confirm`) les nouveaux ID Drive sur `Formation.weeks[]`/`supervision[]`, matché par nom de fichier exact via `drive-migration-report.json` + `original-filenames.json`. Irréversible sans `backup.js` préalable.

#### `scripts/drive/migrate-landing.js`
Écrit en base (`--confirm`) `SiteSettings.actionVideo` et remplace intégralement `testimonialVideos[]` à partir de `landing-migration-report.json`. Remplacement total (non-merge) — destructif si des entrées manuelles non couvertes existaient.

#### `scripts/drive/generate-testimonial-thumbnails.js`
Extrait une frame vidéo via `ffmpeg` pour les 28 témoignages (dry-run), puis (`--confirm`) upload sur Drive + écriture dans `SiteSettings.testimonialVideos[].thumbnail`. Nécessite `ffmpeg`/`ffprobe` locaux ; rend les miniatures publiques.

#### `scripts/drive/bulk-download-youtube-migration.js`
Télécharge en local (streaming, reprise idempotente) les 33 vidéos landing (5 trailers + 28 témoignages) hébergées sur Drive, en vue d'une migration future (ex. YouTube). Hors scope : les ~120 vidéos hebdomadaires.

**⚠️ Points notables (routes/scripts/formations)** :
- `track.routes.js` est le seul fichier de routes sans controller dédié (logique inline).
- `price.recordings` absent des 9 JSON de seed mais présent en base (ajouté par script) — les fichiers `formations/*.json` ne reflètent pas l'état actuel du schéma.
- `mobile-flutter.json`/`iot.json` : 4 semaines de cours filmées contre 8 semaines d'encadrement (à confirmer si volontaire).
- `oauthClient.js` conserve une configuration `drive2` résiduelle, non utilisée en pratique (tout est consolidé sur `drive1`).

### 3.9 uploads/ et utils/

`uploads/` : dossier de stockage disque des fichiers uploadés par les utilisateurs (CV au format PDF via `createApplication`/`uploadProfileCV`, images de news, vignettes de vidéos de témoignages), servi statiquement par `server.js` sous `/uploads`. Non versionné (`.gitignore` : `thebridgeflow-back/uploads/*`, seul `.gitkeep` est suivi pour préserver le dossier vide dans le dépôt). Contenu binaire, non détaillé fichier par fichier (13 fichiers présents au moment de l'analyse : 5 CV `.pdf`, 2 images `news-*.jpg`, 5 vignettes `video-thumb-*.jpg`, `.gitkeep`).

`utils/` (6 fichiers) :

#### `utils/asyncHandler.js`
**Rôle** : Wrapper générique évitant la répétition de `try/catch` dans les contrôleurs async.
- `asyncHandler(fn)` (défaut) — retourne `(req,res,next)` qui exécute `fn`, enveloppe dans `Promise.resolve` et `.catch(next)`.

**Utilisé par** : la quasi-totalité des 19 fichiers de `controllers/` (136 usages détectés) — patron d'écriture standard du projet ; aussi utilisé dans `auth.middleware.js`.

#### `utils/jwt.js`
**Rôle** : Signature/vérification des tokens JWT.
- `signToken(payload, {expiresIn}={})` — signe avec `JWT_SECRET` ; durée = argument, sinon `JWT_EXPIRES_IN`, sinon `"7d"`.
- `verifyToken(token)` — vérifie/décode avec `JWT_SECRET` (lève si invalide/expiré).

**Utilisé par** : `auth.controller.js`, `auth.middleware.js` (`protect`), `track.routes.js`.

#### `utils/enrollmentProgress.js`
**Rôle** : Construit la structure initiale de progression hebdomadaire d'une `Enrollment`.
- `buildInitialWeekProgress(weeks=[])` — trie par numéro croissant, la 1ère semaine reçoit `"in_progress"` (déverrouillée), les autres `"not_started"`. **Correctif de bug documenté** : extrait pour être partagé entre les deux chemins de création d'un `Enrollment` (auto-inscription et acceptation de demande) — avant cette factorisation, seul le premier chemin initialisait `weekProgress`, laissant les inscriptions créées via acceptation de demande à "0/0".

**Utilisé par** : `enrollment.controller.js`, `enrollmentRequest.controller.js`.

#### `utils/interviewStatus.js`
**Rôle** : Transition automatique des entretiens dépassés vers `"terminé"`.
- `autoCompletePastInterviews(filter={})` (async) — `Interview.updateMany()` ciblant `scheduledAt < now` ET statut `"proposé"`/`"confirmé"` → `"terminé"` (jamais un `"annulé"` déjà décidé). `filter` restreint la portée.

**Utilisé par** : `ai.controller.js`, `interviews.controller.js`, appelé avant toute lecture pour refléter l'état réel.

#### `utils/driveHelper.js`
**Rôle** : Normalisation des liens Google Drive et détection d'images base64.
- `extractDriveFileId(url)` — extrait l'ID depuis 3 formats d'URL Drive (regex).
- `isGoogleDriveUrl(url)` — vrai si domaine Drive + ID extractible.
- `normalizeDriveUrl(url, type="video")` — non-Drive → inchangé ; `type="image"` → URL de vignette (`/thumbnail?id=...&sz=w1000`) ; sinon → URL de prévisualisation iframe (`/file/d/{id}/preview`).
- `isBase64Image(value)` — vrai si `data:image/` — garde-fou pour éviter de lancer les regex Drive sur de longues chaînes base64 produites par `imageCompression.js` côté front.
- `autoNormalizeDriveUrl(url)` — détecte automatiquement image vs vidéo et applique `normalizeDriveUrl`.

**Utilisé par** : `formation.controller.js`, `testimonialScreenshot.controller.js`, `siteSettings.controller.js`, `news.controller.js`.

#### `utils/jailbreakDetection.js`
**Rôle** : Garde-fou déterministe (regex) exécuté avant tout appel LLM pour bloquer les tentatives de contournement de la persona SAGE.
- `isPersonaJailbreakAttempt(text)` — teste contre `JAILBREAK_PATTERNS` (FR/EN, insensible à la casse : "tu es maintenant...", "mode développeur", "sans restrictions", "jailbreak"...).
- `SAGE_IDENTITY_REFUSAL` — message de refus fixe : *"Je suis SAGE, l'assistant unique de TheBridgeFlow, et je ne joue pas d'autres personnages."*

**Détail notable** : commentaire du code explique le choix d'un filtre en code plutôt qu'une règle de prompt seule — le modèle Groq utilisé (`openai/gpt-oss-20b`) ne suit pas fiablement des règles complexes en long system prompt (exemple cité : une instruction "réponds en tant que SAGE ET Rebel" a fait dériver le modèle vers une réponse à deux voix). Ce filtre code agit en défense en profondeur, complémentaire au prompt système.

**Utilisé par** : `ai.controller.js`.

**⚠️ Points notables signalés par l'analyse (backend, config/middleware/utils/services/models)** :
- `gemini.service.js` est du code fonctionnel mais **inactif en production** (prêt, non branché — pas un bug).
- Modèle Groq codé en dur (`"openai/gpt-oss-20b"`), sans variable d'env dédiée (contrairement à `GEMINI_MODEL`) — incohérence de conception entre les deux services IA.
- `pageVisit.model.js`, `videoView.model.js`, `testimonialScreenshot.model.js` n'utilisent pas `{timestamps:true}` (contrairement à presque tous les autres modèles) — légère incohérence de convention, sans impact fonctionnel.
- `loginHistory.model.js` cumule un champ manuel `timestamp` ET l'option `{timestamps:true}` — redondance probablement non intentionnelle.

---

## 4. Flux de données clés

### 4.1 Authentification (JWT + OAuth Google/Facebook)

**Fichiers impliqués** : Frontend — `pages/auth/{Login,Register,VerifyEmail,ForgotPassword,ResetPassword}.jsx`, `components/common/{GoogleAuthButton,FacebookAuthButton}.jsx`, `context/AuthContext.jsx`, `services/{auth.service.js,api.js}`, `utils/tokenStorage.js`. Backend — `routes/auth.routes.js`, `controllers/auth.controller.js`, `middleware/auth.middleware.js`, `utils/jwt.js`, `models/users.model.js`, `models/loginHistory.model.js`, `services/email.service.js`.

**Inscription classique** :
1. `Register.jsx` (wizard 5 étapes) → `api.post("/auth/register", payload)` (appel direct, pas via `authService`).
2. `auth.controller.js::register` valide les champs, force `role:"étudiant"`, génère un code à 6 chiffres (expiration 15 min), crée le `User` (`isVerified:false`), envoie `sendWelcome` + `sendNewUserAdmin` (fire-and-forget) puis `sendVerifyCode` (attendu). Retourne 201 `{needsVerify:true, email}`.
3. Frontend → `navigate("/verify-email", {state:{email}})`.
4. `VerifyEmail.jsx` → `api.post("/auth/verify-email", {email, code})` → `auth.controller.js::verifyEmail` vérifie le code/expiration, passe `isVerified:true`, **génère le JWT** (`signToken`) → 200 `{token, user}`.
5. Frontend → `AuthContext.loginWithToken(token, user)` (persistant par défaut) → `utils/tokenStorage.js::setToken` → redirection selon rôle.

**Connexion classique** : `Login.jsx` → `api.post("/auth/login", {email, password, rememberMe})` → `auth.controller.js::login` (vérifie mot de passe via `user.comparePassword` (bcrypt), bloque si `isActive:false`, régénère un code et renvoie 403 `needsVerify:true` si `!isVerified`, sinon crée un `LoginHistory` géolocalisé et signe un JWT — 30 jours si `rememberMe`) → `loginWithToken`/`login` selon le cas → redirection `ROUTES = {étudiant:"/dashboard/student", admin:"/dashboard/admin"}`.

**OAuth Google/Facebook** : `GoogleAuthButton.jsx`/`FacebookAuthButton.jsx` obtiennent un `credential`/`accessToken` via la popup (`@react-oauth/google` ou SDK Meta chargé à la volée par `utils/facebookSdk.js`) → `api.post("/auth/google"|"/auth/facebook", {...})` → `auth.controller.js::googleAuth`/`facebookAuth` (vérifie le jeton — `google-auth-library` pour Google, appel `debug_token`+`graph/me` serveur-à-serveur pour Facebook — puis `findOrCreateOAuthUser` lie/crée le compte, `isVerified:true` d'office) → JWT signé → `loginWithToken` → redirection par rôle.

**Reset de mot de passe** : `ForgotPassword.jsx` → `api.post("/auth/forgot-password")` → `forgotPassword` (réponse générique anti-énumération, token brut envoyé par email, seul son hash SHA-256 stocké, expiration 1h) → `ResetPassword.jsx` (`/reset-password/:token`) → `api.post("/auth/reset-password/:token", {password})` → `resetPassword` (hash le token reçu, vérifie expiration, réaffecte le mot de passe rehashé par le hook `pre("save")` du modèle `User`).

**Protection des routes** : chaque requête authentifiée porte `Authorization: Bearer <token>` (injecté par l'intercepteur `services/api.js`) ; côté backend, `middleware/auth.middleware.js::protect` décode le JWT, charge `req.user`, et **revérifie `isActive`** à chaque requête (un compte désactivé après émission du token perd l'accès immédiatement) ; `authorize(...roles)` applique le RBAC étudiant/admin. Sur un 401 générique (hors login/register), `services/api.js` nettoie le token et force une redirection `/login`.

### 4.2 SAGE (assistant IA)

**Fichiers impliqués** : Frontend — `pages/ai/AIAssistant.jsx`, `pages/dashboard/StudentDashboard.jsx` (widget flottant), `services/ai.service.js`. Backend — `routes/ai.routes.js`, `controllers/ai.controller.js`, `services/groq.service.js` (actif) / `services/gemini.service.js` (prêt, inactif), `utils/jailbreakDetection.js`, `utils/interviewStatus.js`, modèles `User`/`Application`/`Interview`/`Notification`/`Conversation`/`Formation`/`Offer`.

1. Au montage, `AIAssistant.jsx` appelle `aiService.getUserContext()` (`GET /api/ai/user-context`, `protect`) → `ai.controller.js::getUserContext` reconstruit le contexte (profil, 10 dernières candidatures, 5 prochains entretiens, notifications non lues, favoris, formations disponibles, % de complétion de profil) via la fonction interne `buildUserContext`, affiché dans la sidebar (carte profil, insights contextuels).
2. À l'envoi d'un message (saisie libre ou carte d'action rapide), le frontend accumule l'historique local `messages` (non persisté serveur) et appelle `aiService.chat(messages)` (`POST /api/ai/chat`). Limite front `MAX_USER_MESSAGES=40` doit rester synchronisée avec la constante backend `MAX_USER_MESSAGES_PER_CONVERSATION`.
3. `ai.controller.js::chat` : valide `messages` (400 si vide/absent), vérifie la limite de 40 messages utilisateur (429 `AI_CONVERSATION_LIMIT_REACHED`), applique `isPersonaJailbreakAttempt` (`utils/jailbreakDetection.js`) sur le dernier message — si détecté, renvoie directement `SAGE_IDENTITY_REFUSAL` **sans appeler le LLM**. Sinon reconstruit le contexte (`buildUserContext`, appelle d'abord `autoCompletePastInterviews`), génère le prompt système (`buildSystemPrompt` — identité immuable, périmètre exclusif TheBridgeFlow, contexte utilisateur interpolé), préfixe les messages, et appelle `groqService.chat(allMessages, {temperature})`.
4. `groq.service.js::chat` appelle l'API Groq (modèle `openai/gpt-oss-20b`) ; une erreur 404 `model_not_found` est traduite en 503 `AI_MODEL_ERROR` côté controller. `gemini.service.js` implémente la même interface mais n'est jamais importé (bascule prévue : remplacer `groqService` par `geminiService` dans `ai.controller.js` une fois une clé Gemini disponible).
5. La réponse `{result}` est ajoutée à l'historique local et rendue via un parseur markdown minimal (gras/listes, sans `innerHTML`).
6. `aiService.recommendations(limit)` (`POST /api/ai/recommendations`) déclenche `groqService.recommendInternships` (scoring par tokens communs profil/offres + prompt de recommandation).

### 4.3 Cérémonie de projets

**Fichiers impliqués** : Frontend — `pages/CeremonyPage.jsx`, `pages/CeremonyProjectDetail.jsx`, `pages/CeremonyArchives.jsx`, `pages/CeremonyArchiveDetail.jsx`, `pages/dashboard/MyCeremonyProjects.jsx`, `pages/dashboard/AdminCeremony.jsx`, `components/ceremony/CeremonyLeaderboard.jsx`, `components/common/CeremonySection.jsx` (promo Landing), `hooks/useCeremonySelection.js`, `useCeremonyVoteGate.js`, `useCeremonyVoteSubmit.js`, `services/ceremony.service.js`. Backend — `routes/ceremony.routes.js`, `controllers/ceremony.controller.js`, `models/{ceremonyProject,ceremonyVote,ceremonySettings}.model.js`, `services/email.service.js`, `scripts/{seedCeremonyProjects,backfillCeremonyEdition}.js`.

**Cycle de vie complet** :
1. **Soumission (étudiant)** — `MyCeremonyProjects.jsx` : formulaire (titre requis, description, technologies, couverture compressée en base64 via `utils/imageCompression.js`, liens Drive app/vidéo, GitHub, membres d'équipe) → `ceremonyService.createProject()` → `POST /ceremony/projects` → `ceremony.controller.js::createProject` force le statut à `"en_attente"` et l'édition courante, quel que soit le défaut du schéma. Le projet apparaît immédiatement dans « Mes projets » avec un QR code de partage (`qrcode.react`) vers `/ceremonie/:id`, **sans badge de statut visible côté étudiant** (point relevé comme lacune UX).
2. **Modération (admin)** — `AdminCeremony.jsx` liste tous les projets de l'édition courante (`ceremonyService.getAdminProjects()` → `GET /ceremony/admin/projects`) avec badge de statut ; Accepter/Rejeter → `PATCH /ceremony/admin/projects/:id/accept|reject` (`controller::acceptProject/rejectProject`, aucune notification envoyée à ce stade).
3. **Vote (public, édition en cours)** — Un projet `"approuvé"` devient visible sur `CeremonyPage.jsx` (`getProjects()`) et sur `CeremonyLeaderboard.jsx` (podium + liste, polling 30s sur `getLeaderboard()`). L'étudiant sélectionne 1 à 3 projets via `useCeremonySelection()` (persisté en `sessionStorage`, survit à un aller-retour `/login`), la fenêtre de vote est vérifiée côté UI par `useCeremonyVoteGate()` (`getSettings()` → `isVoteClosed`/`voteStartDate`/`voteEndDate`) puis soumise par `useCeremonyVoteSubmit()::confirmVote` → `ceremonyService.vote(projectIds)` → `POST /ceremony/vote` → `ceremony.controller.js::vote` revérifie tout côté serveur (fenêtre, 1-3 projets distincts, projets valides/approuvés/édition courante) et **bloque tout second vote** via l'index unique `{studentId:1}` du modèle `CeremonyVote` (409 si déjà voté). Incrémente `voteCount` (`$inc`) sur chaque projet voté, envoie `sendVoteConfirmation` (fire-and-forget).
4. **Fenêtre de vote (admin)** — `AdminCeremony.jsx` définit `voteStartDate`/`voteEndDate`/`edition` → `PATCH /ceremony/admin/settings`, lu publiquement via `GET /ceremony/settings`.
5. **Clôture et désignation du gagnant (admin)** — Bouton « Clôturer et annoncer » (modale de confirmation) → `POST /ceremony/admin/close-and-announce` → `controller::closeAndAnnounce` détermine le gagnant (projet approuvé avec le plus de votes, départage par ancienneté), fixe `settings.isVoteClosed=true`/`winnerProjectId`, crée une notification in-app + envoie `sendWinnerCongrats` au gagnant, puis notifie/envoie `sendCeremonyResults` à tous les autres participants (votants et/ou soumetteurs, union dédupliquée). Un bandeau permanent apparaît ensuite côté admin ; **le vote proprement dit et le classement ne sont jamais appelés depuis `AdminCeremony.jsx`/`MyCeremonyProjects.jsx`** — ils vivent entièrement dans les pages publiques.
6. **Réouverture** — « Rouvrir le vote » → `PATCH /ceremony/admin/settings {isVoteClosed:false}` (le `winnerProjectId` précédent n'est pas explicitement effacé côté frontend).
7. **Réinitialisation des votes** — action distructive à double confirmation → `POST /ceremony/admin/reset-votes` → `controller::resetVotes` remet `voteCount` à 0 sur les projets de l'édition courante et supprime tous les `CeremonyVote`.
8. **Nouvelle édition / archives** — augmenter `edition` via `updateSettings` démarre un nouveau cycle ; l'édition précédente devient automatiquement une « archive » (toute édition `< editionCourante`), consultable en lecture seule via `getArchives()`/`getArchiveEdition()` (`CeremonyArchives.jsx`/`CeremonyArchiveDetail.jsx`, sans vote ni QR code).

**Points d'attention documentés dans le code** : les valeurs `default` (`status:"approuvé"`, `edition:2026`) des schémas `CeremonyProject`/`CeremonySettings` ne s'appliquent qu'aux nouveaux documents (jamais aux lectures `.lean()`), d'où la nécessité du script `scripts/backfillCeremonyEdition.js` pour les documents pré-existants.

---

## 5. Tableau récapitulatif final

> 311 lignes = 1 ligne par fichier texte/source réellement documenté (voir §6 pour la réconciliation complète avec les 681 fichiers du dépôt, incluant les 370 fichiers binaires/générés délibérément exclus : `uploads/*` (13), `public/images|videos/*` (173), `thebridgeflow-front/dist/*` (184)).

### Racine du dépôt

| Fichier | Dossier | Rôle en une phrase |
|---|---|---|
| `README.md` | / | Présentation du projet, stack, fonctionnalités, installation locale (mentionne encore Brevo, obsolète). |
| `DEPLOYMENT.md` | / | Guide de déploiement/reprise de zéro (services externes, env vars, Google Drive, Render, admin). |
| `.gitignore` | / | Ignore `.env` à la racine du dépôt. |
| `push-all.sh` | / | Synchronise le dépôt vers `origin` puis vers 2 dépôts miroirs (`git subtree split`). |
| `CLAUDE.md` | / | Mémoire de projet pour l'assistant Claude Code (conventions de travail). |
| `settings.local.json` | .claude/ | Configuration locale des permissions de l'outil Claude Code. |
| `scheduled_tasks.lock` | .claude/ | Verrou de tâches planifiées de l'outil Claude Code. |

### Backend — thebridgeflow-back/

| Fichier | Dossier | Rôle en une phrase |
|---|---|---|
| `server.js` | / | Point d'entrée Express : middlewares globaux, montage des 19 routers `/api/*`, connexion Mongo, sitemap dynamique. |
| `package.json` | / | Manifeste npm backend (ESM), scripts `dev`/`start`, dépendances (Express 5, Mongoose, JWT, Groq, Gemini, Nodemailer...). |
| `package-lock.json` | / | Lockfile npm auto-généré. |
| `.env` | / | Variables d'environnement réelles (secrets) — non lu par précaution de sécurité. |
| `.env.example` | / | Gabarit des variables attendues (Mongo, JWT, Gemini, SMTP, OAuth). |
| `.gitignore` | / | Ignore `.env` (backend). |
| `credentials-drive1.json` | / | Identifiants OAuth Desktop Google Cloud pour les scripts Drive — contenu non lu (secret). |
| `token-drive1.json` | / | Jeton OAuth Google Drive généré après authentification — contenu non lu (secret). |
| `db.js` | config | Connexion Mongoose à MongoDB avec retries automatiques (max 5) et arrêt du process si échec définitif. |
| `sanitize.middleware.js` | middleware | Retire les clés `$...`/à points de `req.body`/`req.params` (anti-injection NoSQL). |
| `auth.middleware.js` | middleware | JWT (`protect`), RBAC (`authorize`), validation d'ObjectId (`validateObjectId`). |
| `error.middleware.js` | middleware | Gestion centralisée des erreurs (404 + formatage JSON uniforme, cas Multer). |
| `upload.middleware.js` | middleware | 4 pipelines Multer (CV, fichier message, image news, miniature vidéo). |
| `asyncHandler.js` | utils | Enveloppe les contrôleurs async pour transmettre les erreurs à `next()`. |
| `jwt.js` | utils | Signature/vérification des tokens JWT. |
| `enrollmentProgress.js` | utils | Construit la progression hebdomadaire initiale d'une inscription. |
| `interviewStatus.js` | utils | Fait passer automatiquement les entretiens dépassés au statut "terminé". |
| `driveHelper.js` | utils | Normalise les liens Google Drive et détecte les images base64. |
| `jailbreakDetection.js` | utils | Détecte par regex les tentatives de contournement de la persona SAGE. |
| `email.service.js` | services | Envoi de 14 types d'emails transactionnels via Nodemailer/Gmail SMTP. |
| `gemini.service.js` | services | Client Google Gemini pour l'IA — prêt mais inactif, non importé. |
| `groq.service.js` | services | Client Groq (fournisseur IA actif) : chat SAGE, analyse CV, lettre de motivation, recommandations. |
| `offers.model.js` | models | Offre de stage/PFE/alternance/formation. |
| `notification.model.js` | models | Notification in-app. |
| `applications.model.js` | models | Candidature d'un étudiant à une offre. |
| `interview.model.js` | models | Entretien planifié. |
| `conversation.model.js` | models | Fil de conversation entre deux utilisateurs. |
| `enrollment.model.js` | models | Inscription validée avec suivi hebdomadaire. |
| `enrollmentRequest.model.js` | models | Demande d'inscription en attente de validation admin. |
| `messages.model.js` | models | Message individuel entre deux utilisateurs. |
| `news.model.js` | models | Article d'actualité. |
| `loginHistory.model.js` | models | Historique des connexions (méthode, localisation). |
| `users.model.js` | models | Compte utilisateur central (auth locale/OAuth, profil étudiant). |
| `pageVisit.model.js` | models | Visite de page (analytics interne). |
| `videoView.model.js` | models | Visionnage de vidéo (analytics interne). |
| `siteSettings.model.js` | models | Réglages globaux vitrine (singleton). |
| `testimonialScreenshot.model.js` | models | Capture d'écran de témoignage. |
| `formation.model.js` | models | Formation (programme, vidéos, avis, tarifs, FAQ). |
| `ceremonyVote.model.js` | models | Vote d'un étudiant à la cérémonie. |
| `ceremonySettings.model.js` | models | Configuration de la cérémonie en cours (singleton). |
| `ceremonyProject.model.js` | models | Projet étudiant soumis à la cérémonie. |
| `admin.controller.js` | controllers | Stats dashboard admin + gestion CRUD des comptes. |
| `ai.controller.js` | controllers | Assistant SAGE : contexte, anti-jailbreak, relais LLM. |
| `applications.controller.js` | controllers | Cycle de vie des candidatures. |
| `auth.controller.js` | controllers | Authentification complète (register/login/OAuth/reset/profil). |
| `ceremony.controller.js` | controllers | Cérémonie : soumission, modération, vote, clôture, archives. |
| `conversations.controller.js` | controllers | Messagerie instantanée par conversations + upload de fichiers. |
| `driveProxy.controller.js` | controllers | Proxy des vignettes Google Drive (anti-hotlinking). |
| `enrollment.controller.js` | controllers | Inscriptions actives et progression hebdomadaire. |
| `enrollmentRequest.controller.js` | controllers | Demandes d'inscription en attente de validation. |
| `favorites.controller.js` | controllers | Ajout/retrait d'offres favorites. |
| `formation.controller.js` | controllers | CRUD complet des formations. |
| `interviews.controller.js` | controllers | Proposition/consultation/statut des entretiens. |
| `messages.controller.js` | controllers | Ancien système de messagerie point-à-point (rétro-compatibilité). |
| `news.controller.js` | controllers | CRUD des actualités. |
| `notifications.controller.js` | controllers | Lecture/marquage/suppression des notifications. |
| `offers.controller.js` | controllers | CRUD des offres avec recherche/filtrage/pagination. |
| `siteSettings.controller.js` | controllers | Configuration globale du site (singleton). |
| `stats.controller.js` | controllers | Statistiques publiques pour la landing page. |
| `testimonialScreenshot.controller.js` | controllers | CRUD des captures d'écran de témoignages. |
| `admin.routes.js` | routes | Endpoints du tableau de bord admin et gestion des utilisateurs. |
| `ai.routes.js` | routes | Endpoints de l'assistant IA. |
| `applications.routes.js` | routes | Endpoints de candidature à une offre. |
| `auth.routes.js` | routes | Endpoints d'authentification et de compte. |
| `ceremony.routes.js` | routes | Endpoints de la cérémonie de projets. |
| `conversations.routes.js` | routes | Endpoints de messagerie (conversations). |
| `driveProxy.routes.js` | routes | Endpoint proxy public des vignettes Drive. |
| `enrollment.routes.js` | routes | Endpoints des inscriptions actives. |
| `enrollmentRequest.routes.js` | routes | Endpoints des demandes d'inscription. |
| `favorites.routes.js` | routes | Endpoints des offres favorites. |
| `formation.routes.js` | routes | Endpoints CRUD des formations. |
| `interviews.routes.js` | routes | Endpoints des entretiens. |
| `messages.routes.js` | routes | Endpoints de messagerie (rétro-compatibilité). |
| `news.routes.js` | routes | Endpoints CRUD des actualités. |
| `notifications.routes.js` | routes | Endpoints des notifications. |
| `offers.routes.js` | routes | Endpoints CRUD des offres. |
| `settings.routes.js` | routes | Endpoints des paramètres globaux du site. |
| `stats.routes.js` | routes | Endpoint public des statistiques globales. |
| `testimonialScreenshot.routes.js` | routes | Endpoints CRUD des captures d'écran de témoignages. |
| `track.routes.js` | routes | Endpoints de tracking analytique (sans controller dédié). |
| `createAdmin.js` | scripts | Crée le tout premier compte administrateur. |
| `migrateScreenshotTestimonials.js` | scripts | Importe en base les 29 captures de témoignages. |
| `clearFormationTrailerPlaceholders.js` | scripts | Vide les champs trailer placeholder des formations. |
| `fillFormationRecordingsPrice.js` | scripts | Renseigne le tarif "recordings" manquant. |
| `exportDatabase.js` | scripts | Exporte toute la base MongoDB en JSON local (champs sensibles rédigés). |
| `seedCeremonyProjects.js` | scripts | Crée/supprime des projets de démonstration pour la cérémonie. |
| `backfillCeremonyEdition.js` | scripts | Ajoute le champ "edition" manquant sur les documents existants. |
| `oauthClient.js` | scripts/drive | Module partagé : client OAuth2 Google et gestion des tokens. |
| `authenticate.js` | scripts/drive | Flux OAuth2 interactif et sauvegarde du token d'un compte Drive. |
| `backup.js` | scripts/drive | Exporte en JSON local tous les documents Formation (lecture seule). |
| `inventory.js` | scripts/drive | Rapport dry-run des vidéos de cours/encadrement sur Drive. |
| `inventory-landing.js` | scripts/drive | Rapport dry-run des médias Landing Page sur Drive. |
| `migrate.js` | scripts/drive | Écrit en base les nouveaux ID Drive des vidéos de formation. |
| `migrate-landing.js` | scripts/drive | Écrit en base la vidéo promo et les témoignages Landing. |
| `generate-testimonial-thumbnails.js` | scripts/drive | Extrait des miniatures vidéo (ffmpeg), upload Drive, écrit en base. |
| `bulk-download-youtube-migration.js` | scripts/drive | Télécharge en local les vidéos Landing hébergées sur Drive. |
| `fullstack-spring-angular.json` | formations | Seed formation Full Stack Spring Boot + Angular. |
| `devops.json` | formations | Seed formation DevOps. |
| `cyber-security.json` | formations | Seed formation Cyber Security. |
| `digital-marketing.json` | formations | Seed formation Marketing Digital. |
| `mern-stack.json` | formations | Seed formation MERN Stack (React + Node). |
| `bi.json` | formations | Seed formation Business Intelligence. |
| `mobile-flutter.json` | formations | Seed formation Mobile Flutter. |
| `ai.json` | formations | Seed formation Intelligence Artificielle / Chatbot. |
| `iot.json` | formations | Seed formation IoT. |

*(uploads/ — 13 fichiers binaires (5 CV PDF, 2 images news, 5 vignettes vidéo, 1 `.gitkeep`) — exclus individuellement, décrits collectivement en §3.9.)*

### Frontend — thebridgeflow-front/

| Fichier | Dossier | Rôle en une phrase |
|---|---|---|
| `package.json` | / | Manifeste npm frontend, scripts `dev`/`build`/`lint`/`preview`, dépendances React 19/Vite/Router/Axios... |
| `package-lock.json` | / | Lockfile npm auto-généré. |
| `.env` | / | Variables d'environnement réelles — non lu par précaution de sécurité. |
| `.env.example` | / | Gabarit des variables attendues (VITE_API_URL, OAuth, Cloudinary historique). |
| `.env.local` | / | Surcharge locale des variables d'environnement (non versionné). |
| `.gitignore` | / | Ignore `.env`, `dist`, les dossiers de vidéos sources historiques. |
| `README.md` | / | Boilerplate par défaut du template Vite React (non personnalisé pour ce projet). |
| `App.jsx` | src | Déclare toutes les routes de l'application et le composant `ProtectedRoute`. |
| `main.jsx` | src | Point d'entrée React : monte les providers globaux et l'application. |
| `index.css` | src | Styles globaux, variables de thème clair/sombre, classes utilitaires. |
| `index.html` | / | Template HTML Vite, meta PWA/SEO, point de montage `#root`. |
| `vite.config.js` | / | Configuration Vite : plugin React + PWA (manifest, cache offline). |
| `eslint.config.js` | / | Configuration ESLint flat config (règles JS + hooks React + Fast Refresh). |
| `generate-pwa-icons.js` | scripts | Génère les icônes PWA 192×192/512×512 depuis le favicon. |
| `robots.txt` | public | Directives d'indexation SEO + référence au sitemap dynamique. |
| `AuthOrbit.jsx` | src/components/auth | Fond animé décoratif (ripples + icônes technos en orbite). |
| `AuthOrbit.css` | src/components/auth | Styles des anneaux ripple et des orbites d'icônes. |
| `BoxReveal.jsx` | src/components/auth | Wrapper d'animation d'entrée (fade/slide + bande colorée). |
| `CeremonyLeaderboard.jsx` | src/components/ceremony | Classement (podium + liste) des projets de la Cérémonie. |
| `CeremonyLeaderboard.css` | src/components/ceremony | Styles du podium, de la liste et des skeletons. |
| `AnimatedNavBar.jsx` | src/components/common | Barre de navigation en pilule avec glow animé sur l'onglet actif. |
| `AnimatedNavBar.css` | src/components/common | Styles de la pilule flottante et du glow pulsant. |
| `CeremonySection.jsx` | src/components/common | Section promotionnelle Cérémonie de la Landing (QR code, tilt 3D). |
| `CeremonySection.css` | src/components/common | Styles du glow de fond et de la carte QR à tilt. |
| `CookieBanner.jsx` | src/components/common | Bannière de consentement cookies (informative, non bloquante). |
| `CookieBanner.css` | src/components/common | Style du bandeau flottant en bas d'écran. |
| `CoursePreviewModal.jsx` | src/components/common | Modale de lecture vidéo multi-source (YouTube/Drive/direct). |
| `CoursePreviewModal.css` | src/components/common | Mise en page de la modale vidéo et de la liste des semaines. |
| `CustomCursor.jsx` | src/components/common | Curseur personnalisé desktop (point + anneau traînant). |
| `CustomCursor.css` | src/components/common | Masquage du curseur natif et rendu du curseur custom. |
| `ExportMenu.jsx` | src/components/common | Menu déroulant d'export PDF/CSV pour les tableaux admin. |
| `FacebookAuthButton.jsx` | src/components/common | Bouton de connexion OAuth Facebook. |
| `FileUpload.jsx` | src/components/common | Champ de sélection de fichier générique avec aperçu. |
| `FileUpload.css` | src/components/common | Style de la zone de dépôt et de l'aperçu de fichier. |
| `FormationCategories.jsx` | src/components/common | Rangée de catégories de formations en cercles-icônes. |
| `FormationCategories.css` | src/components/common | Style des cercles-icônes et de la barre de progression. |
| `GoogleAuthButton.jsx` | src/components/common | Bouton de connexion OAuth Google. |
| `LangFlags.jsx` | src/components/common | Sélecteur de langue à 3 drapeaux (fr/en/ar). |
| `LangFlags.css` | src/components/common | Style des boutons drapeaux. |
| `Loader.jsx` | src/components/common | Indicateur de chargement animé "signal WiFi". |
| `Loader.css` | src/components/common | Animations des arcs et du point central du loader. |
| `Modal.jsx` | src/components/common | Modale générique réutilisable. |
| `Modal.css` | src/components/common | Style de l'overlay et de la carte modale. |
| `NewsSection.jsx` | src/components/common | Grille d'articles "Actualités" branchée sur l'API. |
| `NewsSection.css` | src/components/common | Grille responsive des cartes d'articles. |
| `ScrollToTop.jsx` | src/components/common | Remet le scroll en haut à chaque changement de route. |
| `SectionCard.jsx` | src/components/common | Conteneur générique de section avec titre/icône. |
| `SectionCard.css` | src/components/common | Style de carte avec ombre et padding responsive. |
| `SiteNavbar.jsx` | src/components/common | Barre de navigation publique partagée. |
| `SiteNavbar.css` | src/components/common | Style de la navbar publique fixe. |
| `TechMarquee.jsx` | src/components/common | Bandeau de logos technos en défilement infini. |
| `TechMarquee.css` | src/components/common | Boucle CSS du marquee et masque de fondu. |
| `TestimonialsScreenshotCarousel.jsx` | src/components/common | Bandeau de captures de témoignages avec lightbox. |
| `TestimonialsScreenshotCarousel.css` | src/components/common | Boucle CSS et style de la lightbox. |
| `VideoTestimonialCarousel.jsx` | src/components/common | Carousel de témoignages vidéo format story (9:16). |
| `VideoTestimonialCarousel.css` | src/components/common | Style des cartes story et de la modale plein écran. |
| `DashboardLayout.jsx` | src/components/layout | Shell principal des dashboards (Sidebar + Topbar + contenu). |
| `DashboardLayout.css` | src/components/layout | Mise en page flex du shell et overlay mobile. |
| `NotificationPanel.jsx` | src/components/layout | Dropdown de notifications avec marquage lu/supprimer. |
| `NotificationPanel.css` | src/components/layout | Style du dropdown de notifications. |
| `Sidebar.jsx` | src/components/layout | Barre latérale de navigation par rôle, repliable. |
| `Sidebar.css` | src/components/layout | Style de la sidebar et de ses tooltips. |
| `Topbar.jsx` | src/components/layout | Bandeau supérieur (titre, langue, thème, notifications). |
| `Topbar.css` | src/components/layout | Style du bandeau supérieur sticky. |
| `ProfileView.jsx` | src/components/profile | Vue de consultation complète du profil étudiant. |
| `ProfileEditor.jsx` | src/components/profile | Formulaire complet d'édition/création du profil étudiant. |
| `ProfileEditor.css` | src/components/profile | Styles génériques de formulaire. |
| `BlogPage.jsx` | src/pages | Page "Actualités" publique. |
| `CeremonyArchiveDetail.jsx` | src/pages | Détail lecture seule d'une édition archivée de la Cérémonie. |
| `CeremonyArchives.jsx` | src/pages | Liste des éditions passées de la Cérémonie. |
| `CeremonyArchives.css` | src/pages | Styles des cartes d'édition archivée. |
| `CeremonyPage.jsx` | src/pages | Page publique principale de la Cérémonie (édition en cours). |
| `CeremonyPage.css` | src/pages | Styles des cartes de projet avec tilt 3D et barre de vote. |
| `CeremonyProjectDetail.jsx` | src/pages | Détail d'un projet de la Cérémonie avec vote et QR code. |
| `CeremonyProjectDetail.css` | src/pages | Styles de la carte détail projet et du bloc QR code. |
| `FormationDetail.jsx` | src/pages | Page détail publique d'une formation. |
| `FormationDetail.css` | src/pages | Styles du hero, timeline de programme, stats, FAQ. |
| `FormationsPage.jsx` | src/pages | Liste publique de toutes les formations. |
| `FormationsPage.css` | src/pages | Styles de la grille de cartes formations. |
| `LandingPage.jsx` | src/pages | Page d'accueil marketing complète. |
| `LandingPage.css` | src/pages | Styles complets de la page d'accueil. |
| `NotFound.jsx` | src/pages | Page 404 générique. |
| `OffersPage.jsx` | src/pages | Liste publique des offres avec recherche/filtres/pagination. |
| `OffersPage.css` | src/pages | Styles de la page liste des offres. |
| `PricingPage.jsx` | src/pages | Page tarifs publique (3 formules statiques). |
| `PricingPage.css` | src/pages | Styles des 3 cartes de formules tarifaires. |
| `PublicOfferDetail.jsx` | src/pages | Détail public d'une offre avec compétences liées aux formations. |
| `PublicOfferDetail.css` | src/pages | Styles du détail d'offre (layout 2 colonnes). |
| `AIAssistant.jsx` | src/pages/ai | Assistant conversationnel IA pour l'étudiant. |
| `AIAssistant.css` | src/pages/ai | Styles de l'assistant IA (hero animé, chat, sidebar). |
| `Applications.css` | src/pages/applications | Styles de liste de candidatures — fichier orphelin non importé. |
| `MyApplications.jsx` | src/pages/applications | Liste des candidatures de l'étudiant avec filtres/tri/stats. |
| `MyApplications.css` | src/pages/applications | Styles de la page candidatures. |
| `Auth.css` | src/pages/auth | Styles partagés Login/Register. |
| `ForgotPassword.jsx` | src/pages/auth | Formulaire de demande de réinitialisation de mot de passe. |
| `Login.jsx` | src/pages/auth | Formulaire de connexion (email/mot de passe + OAuth). |
| `Register.jsx` | src/pages/auth | Formulaire d'inscription étudiant en 5 étapes. |
| `ResetPassword.jsx` | src/pages/auth | Formulaire de définition d'un nouveau mot de passe. |
| `VerifyEmail.css` | src/pages/auth | Styles des pages de vérification/reset. |
| `VerifyEmail.jsx` | src/pages/auth | Saisie du code de vérification email en 6 chiffres. |
| `Interviews.css` | src/pages/interviews | Styles de la page entretiens. |
| `Interviews.jsx` | src/pages/interviews | Liste des entretiens de l'étudiant par période. |
| `GuidesPage.jsx` | src/pages/legal | Page de guides/tutoriels statiques. |
| `HelpPage.jsx` | src/pages/legal | Page d'aide avec FAQ et contact. |
| `LegalNotice.jsx` | src/pages/legal | Mentions légales statiques. |
| `LegalPage.css` | src/pages/legal | Styles partagés des pages légales/guides/aide. |
| `PrivacyPolicy.jsx` | src/pages/legal | Politique de confidentialité statique. |
| `TermsOfUse.jsx` | src/pages/legal | Conditions générales d'utilisation statiques. |
| `AdminApplications.jsx` | src/pages/dashboard | Admin : liste/traite les candidatures et propose des entretiens. |
| `AdminCeremony.jsx` | src/pages/dashboard | Admin : modère les projets de cérémonie, configure et clôture le vote. |
| `AdminDashboard.jsx` | src/pages/dashboard | Admin : tableau de bord d'accueil avec KPIs et graphiques. |
| `AdminEnrollmentRequests.jsx` | src/pages/dashboard | Admin : accepte/rejette les demandes d'inscription. |
| `AdminEnrollments.jsx` | src/pages/dashboard | Admin : supervise et annule les inscriptions actives. |
| `AdminFeedbacks.jsx` | src/pages/dashboard | Admin : gère témoignages vidéo et captures d'écran. |
| `AdminFeedbacks.css` | src/pages/dashboard | Styles des onglets et de la grille de cartes Feedbacks. |
| `AdminFormations.jsx` | src/pages/dashboard | Admin : CRUD complet des formations. |
| `AdminFormations.css` | src/pages/dashboard | Feuille de style "socle" des pages tableaux admin. |
| `AdminNews.jsx` | src/pages/dashboard | Admin : CRUD des articles d'actualité. |
| `AdminNews.css` | src/pages/dashboard | Styles de la vignette et de l'upload d'image des actualités. |
| `AdminOffers.jsx` | src/pages/dashboard | Admin : CRUD des offres et activation/désactivation. |
| `AdminOffers.css` | src/pages/dashboard | Ajustement de la barre de recherche pour la page Offres. |
| `AdminProfile.jsx` | src/pages/dashboard | Profil du compte admin : infos + changement de mot de passe. |
| `AdminSettings.jsx` | src/pages/dashboard | Préférences d'apparence admin, 100% local. |
| `AdminStatistics.jsx` | src/pages/dashboard | Admin : statistiques avancées avec export PDF. |
| `AdminStatistics.css` | src/pages/dashboard | Restyle SaaS des cartes KPI et grilles "top X". |
| `AdminUsers.jsx` | src/pages/dashboard | Admin : gestion des comptes utilisateurs. |
| `AdminUsers.css` | src/pages/dashboard | Styles de la cellule utilisateur et de la modale détail. |
| `DashboardFormationDetail.jsx` | src/pages/dashboard | Étudiant : détail d'une formation + demande d'inscription. |
| `DashboardFormationDetail.css` | src/pages/dashboard | Overrides dashboard + modale d'inscription + toast. |
| `DashboardFormations.jsx` | src/pages/dashboard | Étudiant : catalogue des formations disponibles. |
| `DashboardFormations.css` | src/pages/dashboard | Grille de cartes et skeleton du catalogue. |
| `MesDemandes.jsx` | src/pages/dashboard | Étudiant : suivi de ses demandes d'inscription. |
| `MesDemandes.css` | src/pages/dashboard | Cartes de liste et badges de statut. |
| `MyCeremonyProjects.jsx` | src/pages/dashboard | Étudiant : soumet et gère ses projets de cérémonie + QR code. |
| `MyCeremonyProjects.css` | src/pages/dashboard | Cartes projet, upload de couverture, modale QR code. |
| `Profile.jsx` | src/pages/dashboard | Étudiant : consultation/édition du profil complet + CV. |
| `Profile.css` | src/pages/dashboard | Hero, layout 2 colonnes, timeline, CV, complétion. |
| `StudentDashboard.jsx` | src/pages/dashboard | Étudiant : tableau de bord d'accueil + assistant IA flottant. |
| `StudentDashboard.css` | src/pages/dashboard | Hero, stats, donut, offres, activité, objectifs, chatbot IA. |
| `MessagingPage.jsx` | src/pages/messages | Messagerie interne texte + fichiers admin/étudiants. |
| `MessagingPage.css` | src/pages/messages | Shell 3 colonnes, bulles de message, zone de saisie. |
| `NotificationsPage.jsx` | src/pages/notifications | Centre de notifications paginé et filtrable. |
| `NotificationsPage.css` | src/pages/notifications | Stats, groupes par période, carte de notification. |
| `OffersList.jsx` | src/pages/offers | Étudiant : catalogue d'offres avec favoris/recommandations/filtres. |
| `Offers.css` | src/pages/offers | Stats, layout filtres/liste, item d'offre, pagination. |
| `ApplyOffer.jsx` | src/pages/offers | Étudiant : formulaire de candidature (lettre + CV). |
| `ApplyOffer.css` | src/pages/offers | Layout 2 colonnes, cartes offre/profil/CV/lettre. |
| `OfferDetail.jsx` | src/pages/offers | Étudiant : fiche détaillée d'une offre avec onglets. |
| `OfferDetail.css` | src/pages/offers | En-tête, onglets, infos, carte Postuler, offres similaires. |
| `Settings.jsx` | src/pages/settings | Étudiant : centre de paramètres à 8 sections. |
| `Settings.css` | src/pages/settings | Nav latérale, cartes de section, toggles, RTL. |
| `admin.service.js` | src/services | Appels API pour statistiques et gestion des utilisateurs admin. |
| `ai.service.js` | src/services | Appels API vers le backend IA (SAGE). |
| `api.js` | src/services | Instance axios centrale : injection du token, gestion des 401. |
| `applications.service.js` | src/services | Appels API CRUD pour les candidatures. |
| `auth.service.js` | src/services | Appels API d'authentification de base. |
| `ceremony.service.js` | src/services | Appels API pour projets et votes de la Cérémonie. |
| `enrollmentRequests.service.js` | src/services | Appels API pour les demandes d'inscription. |
| `enrollments.service.js` | src/services | Appels API pour les inscriptions actives. |
| `favorites.service.js` | src/services | Appels API pour les offres favorites. |
| `feedbacks.service.js` | src/services | Appels API pour avis, témoignages vidéo, captures d'écran. |
| `formations.service.js` | src/services | Appels API pour le catalogue de formations. |
| `interviews.service.js` | src/services | Appels API pour les entretiens. |
| `messages.service.js` | src/services | Appels API pour la messagerie interne. |
| `news.service.js` | src/services | Appels API pour les actualités/blog. |
| `notifications.service.js` | src/services | Appels API pour le centre de notifications. |
| `offers.service.js` | src/services | Appels API pour les offres de stage/PFE. |
| `profile.service.js` | src/services | Appels API pour le profil, CV, mot de passe, paramètres. |
| `settings.service.js` | src/services | Appels API pour les paramètres globaux du site. |
| `AuthContext.jsx` | src/context | Contexte global d'authentification. |
| `LangContext.jsx` | src/context | Contexte global de langue active (fr/en/ar). |
| `ThemeContext.jsx` | src/context | Contexte global de thème clair/sombre. |
| `useAdaptiveNav.js` | src/hooks | Détecte si la nav publique doit basculer en hamburger. |
| `useCeremonySelection.js` | src/hooks | Gère la sélection (max 3) des projets à voter. |
| `useCeremonyVoteGate.js` | src/hooks | Détermine si la période de vote est ouverte. |
| `useCeremonyVoteSubmit.js` | src/hooks | Logique de soumission du vote de la Cérémonie. |
| `useDocumentMeta.js` | src/hooks | Met à jour le titre de page et les meta Open Graph. |
| `useFormationsTechMap.js` | src/hooks | Charge la liste allégée des formations pour le matching techno. |
| `breakpoints.js` | src/constants | Source de vérité JS pour l'échelle de breakpoints. |
| `formationCategories.js` | src/constants | Mapping slug de formation → catégorie d'affichage. |
| `screenshotTestimonials.js` | src/constants | Liste des 29 captures d'écran de témoignages. |
| `techLogos.js` | src/constants | Dictionnaire slug technologie → logo/icône/couleur. |
| `testimonials.js` | src/constants | Liste des témoignages vidéo catégorisés. |
| `videoUrls.js` | src/constants | Mapping chemins locaux → URLs Cloudinary + helpers Drive. |
| `index.js` | src/i18n | Initialisation d'i18next (fr/en/ar). |
| `fr.json` | src/i18n/locales | Dictionnaire de traduction français. |
| `en.json` | src/i18n/locales | Dictionnaire de traduction anglais. |
| `ar.json` | src/i18n/locales | Dictionnaire de traduction arabe (RTL). |
| `analytics.js` | src/utils | Intégration Google Analytics 4 + tracking de visite serveur. |
| `exportTable.js` | src/utils | Génération d'exports CSV et PDF pour les tableaux admin. |
| `facebookSdk.js` | src/utils | Chargement paresseux du SDK JavaScript Facebook. |
| `imageCompression.js` | src/utils | Compression d'image côté client en JPEG base64. |
| `phoneDisplay.jsx` | src/utils | Isole le numéro de téléphone en LTR dans un texte RTL. |
| `profileUtils.js` | src/utils | Calcule le pourcentage de complétion du profil. |
| `scrollToSection.js` | src/utils | Scroll fluide vers un élément par son id. |
| `techMatch.js` | src/utils | Fait correspondre un tag de compétence à une formation. |
| `thumbUtils.js` | src/utils | Détermine la miniature d'une formation/semaine. |
| `tokenStorage.js` | src/utils | Gestion centralisée du stockage du token JWT. |
| `whatsapp.js` | src/utils | Construit les liens WhatsApp partagés. |

*(public/ — 173 fichiers image/vidéo binaires exclus individuellement, décrits collectivement en §2.10 ; dist/ — 184 fichiers de build généré exclus, voir §2.11.)*

## 6. Vérification d'exhaustivité

**Décompte réel du dépôt** (hors `node_modules/` et `.git/`, obtenu par parcours récursif du système de fichiers) : **681 fichiers**.

| Zone | Total réel | Documentés individuellement | Exclus (et pourquoi) |
|---|---|---|---|
| Racine du dépôt (hors les 2 sous-projets) | 7 | 7 | 0 |
| `thebridgeflow-back/` (tout compris) | 118 | 105 | 13 — `uploads/*` (5 CV PDF, 2 images news, 5 vignettes vidéo, 1 `.gitkeep`) : fichiers utilisateurs binaires, exclusion explicite de la consigne |
| `thebridgeflow-front/src/` | 187 | 187 | 0 |
| `thebridgeflow-front/` racine (hors `src/`, `public/`, `dist/`) | 10 | 10 | 0 |
| `thebridgeflow-front/scripts/` | 1 | 1 | 0 |
| `thebridgeflow-front/public/` | 174 | 1 (`robots.txt`) | 173 — images (`avatars/`, `course-placeholders/`, `*-thumbs/`, `feedback-thumbs/`, `news-thumbs/`), icônes PWA, favicon, vidéo hero : binaires/vidéo, exclusion explicite de la consigne |
| `thebridgeflow-front/dist/` | 184 | 0 | 184 — build généré par `vite build` (bundles JS/CSS minifiés + copie de `public/`), jamais versionné, ne contient aucun code source propre (déjà documenté via `src/`) |
| **Total** | **681** | **311** | **370** |

**Vérification arithmétique** : 311 (documentés) + 370 (exclus, justifiés) = **681** — aucun écart, aucun fichier omis par inadvertance.

**Méthode de vérification** : chaque sous-dossier a été recompté indépendamment via `find`/`Glob` par les 7 agents ayant produit les sections détaillées (chacun a confirmé son périmètre exact avant lecture), puis re-vérifié manuellement dossier par dossier via des commandes `find`/`wc -l` dédiées pour cette section. Les trois catégories d'exclusion (`uploads/*`, `public/images|videos/*`, `thebridgeflow-front/dist/`) correspondent explicitement aux règles d'exclusion demandées (fichiers binaires, vidéos, et — par analogie avec `node_modules/`, extension raisonnable de la consigne — le build généré `dist/`, qui duplique `public/` et le code déjà compilé de `src/` sans rien ajouter à la compréhension du code source).

