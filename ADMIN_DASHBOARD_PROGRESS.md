# Progression — Dashboard Admin

> Suivi de l'avancement des sections du Dashboard Admin (structure validée dans `ANALYSE_DASHBOARD_ADMIN.md`, backend correspondant dans `BACKEND_ADMIN_RECAP.md`).

## Sections (sidebar `MENUS.admin`)

- [x] **Tableau de bord** — page réelle et connectée
- [ ] Utilisateurs — placeholder ("Section à venir")
- [x] **Formations** — page réelle et connectée (liste + création + modification + suppression)
- [ ] Demandes d'inscription — placeholder ("Section à venir")
- [ ] Inscriptions — placeholder ("Section à venir")
- [ ] Statistiques — placeholder ("Section à venir")
- [ ] Paramètres — placeholder ("Section à venir")

## Notes

- **Tableau de bord** : données **réelles**, pas mockées. La page (`thebridgeflow-front/src/pages/dashboard/AdminDashboard.jsx`) appelle `GET /api/admin/dashboard-stats` (`thebridgeflow-front/src/services/admin.service.js`) au montage, via l'instance `api` partagée du projet (token admin injecté automatiquement par l'intercepteur axios existant). Affiche : total étudiants, total formations, demandes en attente, inscriptions actives (4 stat-cards), l'évolution des inscriptions par mois (line chart Recharts) et la répartition des formations par niveau (donut chart Recharts). Réutilise intégralement les classes CSS et le thème déjà utilisés dans `StudentDashboard.jsx` (`sd-stat-card`, `sd-card`, `sd-empty-box`, `sd-skeleton`, variables `--primary`/`--bg-card`/`--border`), aucune nouvelle dépendance ajoutée.
- Toutes les routes `/dashboard/admin/*` sont protégées côté frontend par `ProtectedRoute` avec vérification du rôle (`role="admin"`) en plus de l'authentification, en cohérence avec la protection `authorize("admin")` déjà en place côté backend.
- **Formations** : page réelle et connectée (`thebridgeflow-front/src/pages/dashboard/AdminFormations.jsx`) — liste (`GET /api/formations`, public), création (`POST`), modification des champs de base (`PATCH /:id`) et suppression (`DELETE /:id`, bloquée avec le message d'erreur exact de l'API si des `Enrollment`/`EnrollmentRequest` sont liés). **Les tableaux `weeks`/`supervision` restent gérés séparément** (routes `PATCH /slug/:slug/weeks` et `/supervision` déjà existantes, hors scope de ce formulaire — pas de page dédiée pour l'instant). Nouveau composant réutilisable `Modal.jsx` (`components/common/`), généralisé à partir du pattern de modal déjà existant dans `MyApplications.jsx`. Réutilise les classes globales `.btn`/`.input`/`.label`/`.badge` déjà définies dans `index.css` ainsi que `sd-card`/`sd-empty-box`/`sd-skeleton`. Testé de bout en bout dans un vrai navigateur (Playwright) : création, modification, suppression avec confirmation — aucune erreur console, aucune trace de test laissée en base après vérification.
- Les 5 autres sections restantes (Utilisateurs, Demandes d'inscription, Inscriptions, Statistiques, Paramètres) ne sont que des coquilles de navigation (route + `DashboardLayout` + message "Section à venir") — aucune logique métier n'y a encore été développée.
