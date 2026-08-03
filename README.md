<div align="center">

# 🌉 TheBridgeFlow

### Plateforme intelligente de gestion des stages, PFE et formations

[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)](https://react.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-Express_5-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-47A248?logo=mongodb&logoColor=white)](https://www.mongodb.com/)
[![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Render](https://img.shields.io/badge/Deployed_on-Render-46E3B7?logo=render&logoColor=white)](https://render.com/)
![License](https://img.shields.io/badge/License-Academic_Project-lightgrey)

[Démo Live](https://the-bridge-flow.onrender.com) · [Signaler un bug](https://github.com/Chaima-Touj/TheBridgeFlow/issues)

</div>

---

## 📖 À propos

**TheBridgeFlow** est une plateforme web centralisée conçue pour simplifier la gestion des **stages**, des **projets de fin d'études (PFE)** et des **formations complémentaires** au sein d'un institut de formation.

Développée dans le cadre d'un **Projet de Fin de Formation (PFF)** — BTS Informatique de Gestion à l'IMSET, en partenariat avec **Bee Coders** — la plateforme remplace les processus manuels dispersés (emails, fichiers Excel) par un écosystème unique, réactif et intelligent.

### 🎯 Le problème résolu

Dans la majorité des instituts, le suivi des candidatures, la planification des entretiens et l'accompagnement pédagogique manquent cruellement de centralisation. TheBridgeFlow réunit l'ensemble de ce parcours au sein d'une seule interface, avec un assistant IA pour guider l'étudiant à chaque étape.

---

## ✨ Fonctionnalités clés

| Module | Description |
|---|---|
| 🔐 **Authentification** | Email/mot de passe, Google OAuth, Facebook, vérification par code, reset password sécurisé |
| 💼 **Offres & Candidatures** | Publication d'offres (stage/PFE/alternance), candidature en un clic, suivi de statut en temps réel |
| 🎤 **Entretiens** | Planification, confirmation et gestion complète du cycle d'entretien |
| 🎓 **Formations** | Catalogue de formations organisées par semaines, avec vidéos et supervision |
| 💬 **Messagerie & Notifications** | Communication interne fluide entre étudiants et administration |
| 🤖 **Assistant IA — SAGE** | Assistant conversationnel contextuel (profil, candidatures, formations) propulsé par Groq/Llama 3.1 |
| 📊 **Statistiques Admin** | Tableau de bord temps réel : utilisateurs connectés, taux de conversion, contenus les plus consultés |
| 📱 **PWA** | Application installable sur mobile et desktop |
| 🌍 **Multilingue** | Français / Anglais / Arabe (avec support RTL) |

---

## 🏗️ Architecture

```text
┌─────────────────────┐          ┌──────────────────────┐          ┌─────────────────┐
│  thebridgeflow-      │   REST   │  thebridgeflow-       │ Mongoose │                  │
│  front               │◄────────►│  back                 │◄────────►│  MongoDB Atlas   │
│  React 19 + Vite     │  Axios   │  Node.js + Express 5  │          │                  │
└─────────────────────┘          └──────────────────────┘          └─────────────────┘
                                              │
                          ┌───────────────────┼───────────────────┐
                          ▼                   ▼                   ▼
                    Groq (SAGE)         Google Drive         Brevo (Emails)
```

Architecture **monorepo** à deux dépôts indépendants, déployés séparément sur **Render**.

---

## 🛠️ Stack technique

**Frontend** — `thebridgeflow-front/`
- React 19 · Vite · React Router · Axios
- Framer Motion · react-i18next · Recharts
- PWA (vite-plugin-pwa)

**Backend** — `thebridgeflow-back/`
- Node.js · Express 5 · Mongoose
- JWT · bcryptjs · Helmet · express-rate-limit
- Google OAuth · Facebook Graph API

**Base de données & Services externes**
- MongoDB Atlas
- Groq API (Llama 3.1 8B) — Assistant SAGE
- Google Drive API — Hébergement vidéos
- Brevo — Emails transactionnels
- Google Analytics 4 · geoip-lite

**Déploiement**
- Render (Frontend + Backend)

---

## 🚀 Installation locale

### Prérequis
- Node.js ≥ 18
- Compte MongoDB Atlas
- Clés API (Google OAuth, Facebook, Groq, Brevo, Cloudinary)

### 1. Cloner le dépôt
```bash
git clone https://github.com/Chaima-Touj/TheBridgeFlow.git
cd TheBridgeFlow
```

### 2. Backend
```bash
cd thebridgeflow-back
npm install
npm start
```
Créez un fichier `.env` à la racine de `thebridgeflow-back/` avec les variables suivantes :
```
MONGO_URI=
JWT_SECRET=
JWT_EXPIRES_IN=
PORT=
CLIENT_URL=
GROQ_API_KEY=
BREVO_API_KEY=
EMAIL_FROM=
GOOGLE_CLIENT_ID=
FACEBOOK_APP_ID=
FACEBOOK_APP_SECRET=
```

### 3. Frontend
```bash
cd thebridgeflow-front
npm install
npm run dev
```
Créez un fichier `.env` à la racine de `thebridgeflow-front/` avec les variables suivantes :
```
VITE_API_URL=
VITE_GOOGLE_CLIENT_ID=
VITE_FACEBOOK_APP_ID=
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
```

L'application est accessible sur `http://localhost:5173`, l'API sur `http://localhost:5000`.

---

## 📁 Structure du projet

```text
TheBridgeFlow/
├── thebridgeflow-front/     # Application React (client)
│   ├── src/
│   │   ├── components/      # Composants réutilisables
│   │   ├── pages/            # Pages par route
│   │   ├── context/          # État global (Auth, Lang, Theme)
│   │   └── services/         # Appels API
│   └── ...
├── thebridgeflow-back/       # API REST (serveur)
│   ├── models/                # Schémas Mongoose
│   ├── controllers/           # Logique métier
│   ├── routes/                # Endpoints Express
│   ├── middleware/            # Auth, sanitize, upload
│   └── services/               # Groq, email...
└── README.md
```

---

## 👥 Équipe & Encadrement

| Rôle | Nom |
|---|---|
| 👩‍💻 Développeuse | **Chaima Touj** |
| 🧭 Encadrant professionnel (Bee Coders) | M. Ahmed Naffeti |
| 🎓 Encadrant académique (IMSET) | M. Faycel Bouslahi |

---

## 📄 Contexte académique

Projet réalisé dans le cadre du **Projet de Fin de Formation (PFF)** — BTS Informatique de Gestion, IMSET (Institut Maghrébin des Sciences Économiques et de Technologie), en partenariat avec **Bee Coders**.

Méthodologie de développement : **Scrum agile**, 5 sprints itératifs.

---

<div align="center">

**⭐ N'hésitez pas à mettre une étoile si ce projet vous a plu !**

</div>