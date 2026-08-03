# Analyse — Dashboard Admin

> Analyse réalisée avant tout développement du Dashboard Admin, sur la base d'une lecture réelle du code existant (frontend student dashboard + modèles/routes backend). Objectif : définir une structure de sidebar Admin alignée avec ce qui existe vraiment dans l'application, et non une structure générique.

---

## Étape 1 — Analyse du Dashboard Student existant

### Routes (depuis `thebridgeflow-front/src/App.jsx`)

| Route | Composant | Fonctionnalités réelles |
|---|---|---|
| `/dashboard/student` | `StudentDashboard.jsx` | Vue d'ensemble : hero profil, % complétion profil, alerte entretien imminent, 4 stat-cards (candidatures/en attente/entretiens/acceptées), donut candidatures (Recharts), liste entretiens à venir, offres recommandées, activité récente, notifications récentes, mes demandes de formation, barres d'objectifs (profil/taux de succès/taux de réponse). Chatbot IA flottant intégré. |
| `/dashboard/student/offers`, `/offers/:id`, `/offers/:id/apply` | `OffersList` / `OfferDetail` / `ApplyOffer` | Parcours et candidature à des offres de stage/PFE/alternance |
| `/dashboard/student/applications` | `MyApplications` | Suivi des candidatures envoyées et de leur statut |
| `/dashboard/student/interviews` | `Interviews` | Liste des entretiens (à venir/passés), mode présentiel/en ligne |
| `/dashboard/student/formations`, `/formations/:slug` | `DashboardFormations` / `DashboardFormationDetail` | Catalogue des formations inscrites/disponibles + détail semaine par semaine (vidéos, miniatures) avec preview modal |
| `/dashboard/student/demandes` | `MesDemandes` | Historique des demandes d'inscription à une formation ("Faire une demande"), avec statut (en_attente/acceptée/refusée) |
| `/dashboard/student/ai-assistant` | `AIAssistant` | Chat IA (recommandations, conseils CV/lettre/entretien) avec mascotte animée |
| `/dashboard/student/messages` | `MessagingPage` | Messagerie 1-to-1 (conversations, pièces jointes, emoji) |
| `/dashboard/student/notifications` | `NotificationsPage` | Liste des notifications, groupées par jour/semaine/plus ancien, marquage lu/tout lire/suppression |
| `/dashboard/student/profile` | `Profile.jsx` | Vue + édition du profil (CV, formation, expériences, compétences, langues, réseaux) |
| `/dashboard/student/settings` | `Settings.jsx` | Thème, langue, notifications, confidentialité, préférences de stage |

### Composants réutilisables identifiés

- **`DashboardLayout`** : coquille commune (Sidebar + Topbar + zone contenu), gère l'état ouvert/fermé de la sidebar (persisté en `localStorage`) et le polling des notifications (30s). **C'est le composant que le Dashboard Admin doit réutiliser tel quel.**
- **`Sidebar`** : déjà construite en config **multi-rôles** (`MENUS.étudiant/entreprise/encadrant/admin`). La config `admin` **existe déjà dans le fichier** (Dashboard, Utilisateurs, Entreprises, Offres, Candidatures, Statistiques, Paramètres) mais **aucune route ni page ne lui correspond** dans `App.jsx`. C'est un squelette mort, pas une fonctionnalité livrée.
- **`Topbar`** : titre/sous-titre de page, toggle thème clair/sombre, sélecteur de langue (`LangFlags`, fr/en/ar avec RTL), cloche de notifications (`NotificationPanel`), menu utilisateur.
- Pattern **stat-card** (`sd-stat-card`) et **carte générique** (`sd-card`) très réutilisés pour tout dashboard basé sur des KPIs.
- Pattern **empty-state** (`sd-empty-box`) + **skeleton loaders** cohérents partout.
- Pattern **badge de statut coloré** via objets `{ status: { label, color } }` — répété dans `StudentDashboard`, `MesDemandes`, etc.
- `SectionCard`, `FileUpload`, `CoursePreviewModal`, `ProfileView`/`ProfileEditor` : composants communs réutilisables.
- Système de thème : `ThemeContext` + attribut `data-theme` + variables CSS (`--primary`, `--bg-card`, `--border`, `--text-secondary`, `--danger`, `--warning`…) définies en light/dark. **Le Dashboard Admin doit consommer ces mêmes variables, pas en inventer de nouvelles.**
- i18n via `react-i18next` (fr/en/ar).
- ⚠️ Point mineur : la map `ICON_MAP` (icônes par slug de formation) est dupliquée à l'identique dans 3 fichiers (`StudentDashboard`, `MesDemandes`, `DashboardFormations`). Pas bloquant, mais à ne pas reproduire une 4ᵉ fois pour l'admin.

### Bibliothèque de graphiques

**Recharts** — utilisée uniquement pour le donut de suivi des candidatures dans `StudentDashboard.jsx`. Aucun autre type de graphique (barres, lignes) n'est encore utilisé ailleurs, mais Recharts les supporte nativement → **pas besoin d'une nouvelle dépendance pour les statistiques admin**.

---

## Étape 2 — Analyse du modèle de données (backend)

### Modèles Mongoose (`thebridgeflow-back/models/`)

| Modèle | Champs clés | Rôle |
|---|---|---|
| **User** | `role` (enum: étudiant/entreprise/encadrant/admin), profil étudiant complet (bio, cv, education, experience[], skills[], languages[], socialLinks), `settings` (notifications/privacy/ai/préférences stage), `isActive`, `favorites[]` | Compte utilisateur unique pour tous les rôles |
| **Formation** | `title/slug/price/schedule/level`, `weeks[]` (Formation) et `supervision[]` (Encadrement) — chacun avec `phase/content/videoUrl/videoTitle/thumbnail/duree/gratuit`, `stats`, `reviews[]`, `faq[]` | Cœur du catalogue (formations MERN/BI/Flutter/AI etc., déjà manipulées directement en base) |
| **Enrollment** | `student`, `formation`, `weekProgress[]` (statut par semaine), `overallStatus` | Suivi de progression réel d'un étudiant inscrit |
| **EnrollmentRequest** | `student`, `formation`, `mode`, `message`, `status` (en_attente/acceptée/refusée) | La demande "Faire une demande" vue dans le dashboard student |
| **Offer** | `title/description/companyName/companyId/domain/type(stage/PFE/alternance/formation/vidéo)/skills/salary/deadline/isActive/views` | Offres de stage/PFE |
| **Application** | `offerId/studentId/status(en attente/acceptée/refusée/en cours)/coverLetter/cvUrl` | Candidatures à une offre |
| **Interview** | `applicationId/studentId/companyId/scheduledAt/mode/status` | Entretiens liés à une candidature |
| **Notification** | `userId/title/message/type/isRead/link` | Notifications in-app |
| **Message** / **Conversation** | contenu, pièce jointe, `participants[]`, `unreadCounts` | Messagerie 1-to-1 |
| **Document** | `title/type(convention/attestation/rapport/...)/studentId/status(en_attente/validé/refusé)/feedback` | Documents de stage avec validation (pensé pour un rôle "encadrant") |

### Routes/contrôleurs admin existants : aucun

Recherche explicite (`admin`, `authorize`, RBAC) dans tout `thebridgeflow-back/` :

- Le middleware `authorize(...roles)` (`thebridgeflow-back/middleware/auth.middleware.js`) est **générique et déjà prêt** — utilisé aujourd'hui pour `"étudiant"` et `"entreprise"`. Il suffit d'appeler `authorize("admin")` sur de nouvelles routes ; aucune infrastructure à créer.
- **Zéro route n'utilise `authorize("admin")` aujourd'hui.** Il n'existe donc **aucun CRUD utilisateurs, aucune gestion de formations protégée, aucun traitement des demandes** côté admin. Tout est à construire.

### Trois découvertes concrètes qui doivent orienter la structure

1. **`formation.routes.js` n'a aucun middleware d'auth.** `PATCH /api/formations/slug/:slug/weeks` et `/supervision` sont appelables par n'importe qui, sans compte. C'est exactement ce qui a été utilisé (via script Node direct) pour peupler les formations MERN/BI/Flutter/AI. Une vraie page "Formations" admin devrait a minima protéger ces routes.
2. **"Faire une demande" est un cul-de-sac backend.** `enrollmentRequest.controller.js` ne contient que `createRequest` et `getMyRequests` — **aucune route n'existe pour accepter/refuser** une demande, alors que le schéma le prévoit (`status: en_attente/acceptée/refusée`). C'est le gap le plus concret et le plus directement lié à la question initiale.
3. **Offer/Application/Interview sont câblés sur le rôle `"entreprise"`**, qui existe dans le schéma `User` et dans `Register.jsx` (l'inscription "Entreprise" existe et redirige vers `/dashboard/company`)... **mais cette route n'existe pas dans `App.jsx`**. Une entreprise qui s'inscrit atterrit donc sur une page qui n'existe pas, et personne ne peut créer d'offre, accepter une candidature ou proposer un entretien via l'UI aujourd'hui. Question ouverte à trancher : on laisse ce pan de côté, ou l'admin doit-il reprendre ce rôle "entreprise" à sa charge ?

---

## Étape 3 — Recommandation de structure Sidebar Admin

### Sections indispensables (données/besoins réels déjà présents)

| Section | Pourquoi |
|---|---|
| **Dashboard / Vue d'ensemble** | Agrégation simple des collections existantes (nb étudiants, nb formations, demandes en attente, inscriptions actives) — aucune nouvelle donnée à créer, juste des `count()`/`aggregate()`. |
| **Utilisateurs** | Le modèle `User` existe déjà avec `isActive` (jamais exploité) ; c'est aussi le seul moyen de créer un compte admin puisque l'inscription publique n'autorise que étudiant/entreprise. |
| **Formations** | Le modèle `Formation` est le plus riche et le plus manipulé du projet (weeks/supervision) ; les routes PATCH existent déjà mais sont non protégées — urgent de les gérer via une vraie UI plutôt qu'à la main. |
| **Demandes d'inscription** | Gap confirmé : `EnrollmentRequest` a un statut à trois états mais aucune route pour le faire évoluer. C'est la fonctionnalité manquante la plus directement citée dans la demande initiale. |
| **Inscriptions / Suivi progression** | Le modèle `Enrollment` (weekProgress par étudiant) existe déjà et n'a aucune vue de supervision — nécessaire pour que l'admin voie qui progresse réellement dans quelle formation. |

### Sections "nice to have", non urgentes (peu/pas de données réelles actives aujourd'hui)

| Section | Pourquoi ce n'est pas urgent |
|---|---|
| **Offres de stage** | Modèle riche, mais tout le flux est verrouillé sur un rôle "entreprise" qui n'a pas de dashboard fonctionnel → à trancher avant de construire (admin reprend le rôle, ou on laisse tomber). |
| **Candidatures / Entretiens** | Même dépendance au rôle entreprise orphelin ; peu ou pas de données réelles tant que les offres ne sont pas gérées. |
| **Avis (reviews) formations** | Le schéma existe dans `Formation.reviews` mais aucune route ne permet à un étudiant d'en soumettre un — actuellement seulement des données seedées à la main. Modération prématurée. |
| **Documents (conventions/rapports)** | Modèle avec workflow de validation pensé pour un "encadrant" qui n'existe pas comme rôle actif dans l'app. |
| **Messagerie (vue support admin)** | Techniquement possible (modèles Message/Conversation solides) mais pas de besoin identifié pour l'instant. |
| **Statistiques avancées / Paramètres plateforme** | Utile plus tard quand il y aura assez de volume réel ; Recharts est déjà en place, aucune dépendance à ajouter le moment venu. |

---

## Question ouverte avant validation

Que fait-on du rôle **"entreprise"** (offres/candidatures/entretiens) ? On le laisse de côté pour l'instant, ou l'admin doit-il pouvoir gérer les offres à la place d'une entreprise ? Ça change la priorité de 2 des sections "nice to have" ci-dessus.
