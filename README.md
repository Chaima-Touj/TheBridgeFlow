# TheBridgeFlow

**Plateforme de gestion des stages, PFE et formations professionnelles**

TheBridgeFlow est une plateforme web full-stack (MERN) qui centralise la gestion des offres de stage/PFE, le suivi des candidatures et des entretiens, un catalogue de formations avec suivi de progression, un assistant IA contextualisé, une messagerie interne et une cérémonie de vote de projets — le tout piloté depuis un tableau de bord administrateur avec des statistiques réelles.

Projet réalisé par **Chaima Touj**, étudiante en BTS Informatique de Gestion à l'IMSET, dans le cadre de son PFE (Projet de Fin de Formation), au sein de **Bee Coders** (El Ghazela, Ariana).

---

## ✨ Fonctionnalités principales

- **Authentification sécurisée** — JWT, connexion Google et Facebook (OAuth), vérification par email, réinitialisation de mot de passe
- **Offres & candidatures** — publication d'offres de stage/PFE, candidature avec CV, proposition et suivi d'entretiens
- **Formations** — catalogue multi-semaines avec contenu vidéo, suivi de progression, demandes d'inscription
- **Assistant IA SAGE** — assistant conversationnel contextualisé au profil de l'étudiant (candidatures, entretiens, formations), avec protection anti-jailbreak
- **Cérémonie de projets** — soumission de projets, vote de la communauté (1 à 3 projets), classement en direct, clôture et annonce du gagnant
- **Messagerie interne** — échanges directs entre étudiants et administrateurs
- **Notifications** — suivi des événements clés de la plateforme
- **Tableau de bord administrateur** — gestion des offres, formations, utilisateurs, actualités, et statistiques réelles d'utilisation

## 👥 Acteurs

- **Visiteur** — consultation des offres et formations, création de compte
- **Étudiant** — candidatures, formations, messagerie, assistant SAGE, Cérémonie de projets
- **Administrateur** — gestion complète de la plateforme et statistiques

## 🛠️ Stack technique

**Frontend**
- React 19 + Vite
- React Router, Axios
- Framer Motion (animations)
- react-i18next (interface multilingue FR/EN/AR)
- CSS classique (un fichier par composant — pas de Tailwind)

**Backend**
- Node.js + Express 5
- MongoDB Atlas + Mongoose
- JWT + bcryptjs
- Helmet, CORS, rate-limiting

**Services externes**
- Groq API (modèle `openai/gpt-oss-20b`) — assistant SAGE
- Google OAuth & Facebook OAuth
- Google Drive API (hébergement des vidéos de formation)
- Brevo (envoi d'emails transactionnels en production)

**Déploiement**
- Render (frontend + backend), intégration continue sur push vers `main`

## 🏗️ Architecture

Architecture 3-tiers classique :

```
Client (React/Vite) ⇄ Serveur applicatif (Node/Express, API REST) ⇄ Base de données (MongoDB Atlas)
                                    ⇅
                        Services externes (Groq, OAuth, Google Drive, Brevo)
```

## 📁 Structure du dépôt

```
TheBridgeFlow/
├── thebridgeflow-front/     # Application React (Vite)
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── context/
│   │   ├── services/
│   │   ├── hooks/
│   │   ├── i18n/
│   │   └── constants/
│   └── public/
├── thebridgeflow-back/      # API Express
│   ├── config/
│   ├── models/
│   ├── controllers/
│   ├── routes/
│   ├── middleware/
│   ├── services/
│   └── scripts/
└── push-all.sh              # Synchronisation vers les dépôts miroirs
```

## 🚀 Démarrage local

```bash
# Backend
cd thebridgeflow-back
npm install
cp .env.example .env   # renseigner les variables (MongoDB, JWT, OAuth, Groq, Brevo...)
npm run dev

# Frontend (dans un autre terminal)
cd thebridgeflow-front
npm install
cp .env.example .env
npm run dev
```

## 📄 Documentation

Le rapport de PFE complet (contexte, méthodologie Scrum, spécification des besoins, réalisation sprint par sprint, déploiement) est disponible séparément (LaTeX/PDF).

---

*Méthodologie Scrum — 6 sprints (Sprint 0 à Sprint 5) — Product Owner : M. Ahmed Naffeti · Scrum Master : M. Aziz Ben Ismail · Développement : Chaima Touj*
