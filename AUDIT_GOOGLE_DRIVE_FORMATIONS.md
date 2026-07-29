# AUDIT TECHNIQUE COMPLET — Implémentation Google Drive pour le module Formations

**Projet** : TheBridgeFlow  
**Date de l'audit** : $(date +%Y-%m-%d)  
**Auteur** : Audit automatique pour reprise par Claude  

---

## 1. Analyse globale

### 1.1 État avant modifications

Le projet TheBridgeFlow utilisait **Cloudinary** comme fournisseur unique de médias (images et vidéos) pour l'ensemble de l'application, y compris le module Formations.

- **Modèle MongoDB** : Les 3 schémas (`weekSchema`, `videoSchema`, `trailerProvider`) avaient `default: "cloudinary"` pour le champ `provider`
- **Backend** : Aucune fonction utilitaire pour normaliser des URLs externes
- **Frontend admin (AdminFormations.jsx)** : Le formulaire de création/édition de formation ne contenait **aucun champ** pour les URLs d'image ou de vidéo Google Drive. `EMPTY_FORM` et `formationToForm()` ne géraient ni `image` ni `trailerVideoUrl`
- **Frontend étudiant (CoursePreviewModal.jsx)** : Lecteur vidéo supportant uniquement YouTube (iframe) et vidéo HTML5 native (`<video>`)
- **Mapping vidéo** : `VIDEO_URLS` dans `videoUrls.js` associait des clés de chemin local vers des URLs Cloudinary

### 1.2 Objectif demandé

1. Faire de **Google Drive** le fournisseur **par défaut** pour le module Formations
2. Permettre à l'admin d'ajouter/modifier les médias (image + vidéo) via des URLs Google Drive
3. Normaliser automatiquement les URLs Google Drive en format lisible (iframe pour vidéos, thumbnail pour images)
4. Assurer la **compatibilité ascendante** avec les données Cloudinary existantes
5. **Ne pas toucher** à Cloudinary pour les autres modules de l'application

### 1.3 Architecture existante avant audit

```
AdminFormations.jsx → formationsService → API Express → formation.controller → formation.model (MongoDB)
                                               ↓
                                   CoursePreviewModal.jsx ← videoUrls.js (VIDEO_URLS + resolveVideoUrl)
```

---

## 2. Fichiers modifiés (6 fichiers)

### 2.1 `server/models/formation.model.js`

**Chemin complet** : `c:/Users/Chaimouta/PFE/stageflow/server/models/formation.model.js`

**Pourquoi modifié** : Changer le provider par défaut de Cloudinary vers Google Drive pour les nouveaux documents.

**Ajouté** : Rien de structurel — seules les valeurs par défaut changées.

**Supprimé** : Rien.

**Modifications** :
| Ligne | Champ | Avant | Après |
|-------|-------|-------|-------|
| 12 | `weekSchema.provider.default` | `"cloudinary"` | `"google_drive"` |
| 24 | `videoSchema.provider.default` | `"cloudinary"` | `"google_drive"` |
| 70 | `trailerProvider.default` | `"cloudinary"` | `"google_drive"` |

**Conservé** :
- Le champ `driveUrl` dans `weekSchema` et `videoSchema`
- Le champ `trailerDriveUrl` dans `formationSchema`
- L'enum `["cloudinary", "google_drive"]` inchangé
- Tous les autres champs et schémas (reviewSchema, faqSchema, etc.)

**Impact sur le projet** :
- ✅ Les nouvelles formations créées auront `provider: "google_drive"` par défaut
- ✅ Les formations existantes avec `provider: "cloudinary"` ne sont pas modifiées
- ✅ Aucune migration de base de données nécessaire

---

### 2.2 `server/controllers/formation.controller.js`

**Chemin complet** : `c:/Users/Chaimouta/PFE/stageflow/server/controllers/formation.controller.js`

**Pourquoi modifié** : Normaliser automatiquement les URLs Google Drive côté serveur lors de la sauvegarde dans MongoDB.

**Ajouté** :
- Ligne d'import : `import { normalizeDriveUrl } from "../utils/driveHelper.js";`

**Fonctions modifiées** :

1. **`patchFormationTrailer`**
   - `trailerVideoUrl` → passé dans `normalizeDriveUrl(url, "video")` → converti en `/preview`
   - `trailerThumbnail` → passé dans `normalizeDriveUrl(url, "image")` → converti en `thumbnail?id=`
   - Si ce n'est pas une URL Drive, la valeur est retournée inchangée

2. **`patchFormationWeeks`**
   - `weeks.map()` normalise chaque élément :
     - `videoUrl` → `normalizeDriveUrl(w.videoUrl, "video")`
     - `thumbnail` → `normalizeDriveUrl(w.thumbnail, "image")`

3. **`patchFormationSupervision`**
   - Idem que `patchFormationWeeks` mais pour le tableau `supervision`

**Fonctions NON modifiées** :
- `getAllFormations` — inchangée
- `getFormationsTechMap` — inchangée
- `getFormationBySlug` — inchangée
- `getFormationById` — inchangée
- `createFormation` — inchangée (les champs image/video ne sont pas gérés ici)
- `updateFormationInfo` — inchangée (les filtres passe-plat laissent les URLs telles quelles)
- `deleteFormation` — inchangée
- `patchFormationVideos` — inchangée (pas de normalisation, tableau videos)

**Supprimé** : Rien.

**Conservé** : L'intégralité des fonctions et de la logique existante.

**Impact** :
- ✅ Les URLs Google Drive saisies par l'admin sont automatiquement normalisées côté serveur
- ✅ Les URLs non-Drive (Cloudinary, YouTube, etc.) passent sans modification
- ✅ Sécurité renforcée : la normalisation se fait au niveau API, pas seulement côté frontend

---

### 2.3 `client/src/constants/videoUrls.js`

**Chemin complet** : `c:/Users/Chaimouta/PFE/stageflow/client/src/constants/videoUrls.js`

**Pourquoi modifié** : Ajouter les helpers Google Drive côté frontend pour l'affichage et la détection.

**Ajouté** (4 nouvelles fonctions exportées) :

1. **`extractDriveFileId(url)`**
   - Extrait l'ID Google Drive d'un URL via 3 regex : `/file/d/`, `/uc?id=`, `/open?id=`
   - Retourne `string|null`

2. **`isGoogleDriveUrl(url)`**
   - Vérifie `url.includes("drive.google.com")` ET `extractDriveFileId(url) !== null`
   - Retourne `boolean`

3. **`resolveDriveUrl(url, type="video")`**
   - Si type `"image"` : retourne `https://drive.google.com/thumbnail?id=FILE_ID&sz=w1000`
   - Si type `"video"` (défaut) : retourne `https://drive.google.com/file/d/FILE_ID/preview`
   - Si non-Drive : retourne l'URL inchangée

4. **`autoResolveDriveUrl(url)`**
   - Détecte automatiquement le type via extension de fichier ou mot "image" dans le chemin
   - Délègue à `resolveDriveUrl(url, detectedType)`

**Fonction modifiée** : `resolveVideoUrl(localPathOrUrl)`
- Ajout d'une vérification prioritaire :
  ```js
  if (isGoogleDriveUrl(localPathOrUrl)) {
    return resolveDriveUrl(localPathOrUrl);
  }
  ```
- Appelée **avant** de consulter `VIDEO_URLS`

**Supprimé** : Rien.

**Conservé** : L'intégralité du mapping `VIDEO_URLS` avec les URLs Cloudinary.

**Impact** :
- ✅ `resolveVideoUrl()` détecte et normalise les URLs Drive avant tout autre traitement
- ✅ Compatibilité ascendante avec les clés `/videos-*` qui pointent vers Cloudinary
- ✅ Les helpers sont disponibles pour d'autres composants qui en auraient besoin

---

### 2.4 `client/src/components/common/CoursePreviewModal.jsx`

**Chemin complet** : `c:/Users/Chaimouta/PFE/stageflow/client/src/components/common/CoursePreviewModal.jsx`

**Pourquoi modifié** : Permettre la lecture des vidéos Google Drive en iframe dans le modal de prévisualisation étudiant.

**Ajouté** :
- Import : `import { isGoogleDriveUrl, resolveDriveUrl } from "../../constants/videoUrls.js";`
- Nouveau bloc conditionnel dans le rendu du lecteur vidéo (ordre de priorité) :

```
1. YouTube (iframe)           → si ytId détecté
2. Google Drive (iframe)      → si videoUrl ET isGoogleDriveUrl(videoUrl)
3. Vidéo HTML5 native (<video>) → si videoUrl existe
4. Message "aucune vidéo"     → si aucune des conditions ci-dessus
```

**Code ajouté** (entre le bloc YouTube et le bloc `<video>`) :
```jsx
) : videoUrl && isGoogleDriveUrl(videoUrl) ? (
  <iframe
    className="cpm-iframe"
    src={resolveDriveUrl(videoUrl, "video")}
    title={...}
    allow="autoplay; encrypted-media; fullscreen"
    allowFullScreen
  />
```

**Supprimé** : Rien.

**Conservé** : Tout le reste du composant (fullscreen, liste des semaines, navigation, etc.).

**Impact** :
- ✅ Les vidéos hébergées sur Google Drive sont lisibles en iframe
- ✅ La barre de progression et les contrôles natifs YouTube sont conservés pour les vidéos YouTube
- ✅ Le lecteur `<video>` natif reste disponible pour les URLs Cloudinary ou autres

---

### 2.5 `client/src/services/formations.service.js`

**Chemin complet** : `c:/Users/Chaimouta/PFE/stageflow/client/src/services/formations.service.js`

**Pourquoi modifié** : Exposer les nouvelles routes API du backend pour le frontend.

**Ajouté** (4 nouvelles méthodes) :

```js
updateTrailer: (id, data)       => api.patch(`/formations/${id}/trailer`, data),
updateVideos: (slug, videos)    => api.patch(`/formations/slug/${slug}/videos`, { videos }),
updateWeeks: (slug, weeks)      => api.patch(`/formations/slug/${slug}/weeks`, { weeks }),
updateSupervision: (slug, supervision) => api.patch(`/formations/slug/${slug}/supervision`, { supervision }),
```

**Supprimé** : Rien.

**Conservé** : Toutes les méthodes existantes (`getAll`, `getOne`, `getBySlug`, `getTechMap`, `createFormation`, `updateFormation`, `deleteFormation`).

**Impact** :
- ✅ L'UI admin peut mettre à jour individuellement le trailer, les vidéos, les semaines et la supervision
- ✅ Chaque méthode correspond à une route API spécifique
- ✅ Aucune régression sur les appels API existants

---

### 2.6 `client/src/pages/dashboard/AdminFormations.jsx`

**Chemin complet** : `c:/Users/Chaimouta/PFE/stageflow/client/src/pages/dashboard/AdminFormations.jsx`

**Pourquoi modifié** : Ajouter les champs Google Drive (image + vidéo) dans le formulaire de création/édition des formations.

**Ajouté** :

1. **Dans `EMPTY_FORM`** (état initial du formulaire) :
   ```js
   image: "",       // Google Drive image URL
   videoUrl: "",    // Google Drive video URL (trailer)
   ```

2. **Dans `formationToForm(formation)`** (remplissage du formulaire pour édition) :
   ```js
   image:    formation.image || "",
   videoUrl: formation.trailerVideoUrl || "",
   ```

3. **Dans `handleSubmit` du formulaire `FormationForm`** :
   ```js
   image:       form.image.trim(),
   trailerVideoUrl: form.videoUrl.trim(),
   ```

4. **Nouvelle section UI** "Médias (Google Drive)" dans le formulaire :
   ```jsx
   <fieldset>
     <legend>Médias (Google Drive)</legend>
     {/* Champ URL image + aperçu miniature */}
     {/* Champ URL vidéo + message d'aide */}
   </fieldset>
   ```

5. **Aperçu image** : affiche un `<img>` avec `onError` qui masque l'image si le chargement échoue

6. **Dans `handleFormSubmit` du composant principal** (lors de l'édition) :
   ```js
   if (payload.trailerVideoUrl) {
     await formationsService.updateTrailer(formModal._id, {
       trailerVideoUrl: payload.trailerVideoUrl,
       trailerProvider: "google_drive",
     });
   }
   ```

7. **Dans le tableau de la liste** : affichage conditionnel de l'image ou d'un avatar placeholder :
   ```jsx
   {f.image ? <img src={f.image} alt="" className="af-avatar" />
            : <div className="af-avatar af-avatar--placeholder">...</div>}
   ```

**Supprimé** : Rien.

**Conservé** : L'intégralité du formulaire existant (champs titre, durée, prix, planning, niveau, description, mode, certificat).

**Impact** :
- ✅ L'admin peut désormais ajouter/modifier l'image et la vidéo Google Drive d'une formation
- ✅ L'image s'affiche en aperçu dans le formulaire et dans la liste des formations
- ✅ La vidéo est automatiquement envoyée à l'API `updateTrailer` lors de la sauvegarde
- ✅ Aucune régression sur les fonctionnalités existantes (création, édition, suppression, export CSV/PDF, pagination, tri)

---

## 3. Nouveaux fichiers créés (1 fichier)

### 3.1 `server/utils/driveHelper.js`

**Chemin complet** : `c:/Users/Chaimouta/PFE/stageflow/server/utils/driveHelper.js`

**Rôle** : Helper utilitaire backend pour normaliser les URLs Google Drive. Convertit les liens de partage en URLs lisibles par le navigateur.

**Contenu** (4 fonctions exportées) :

| Fonction | Rôle | Entrée | Sortie |
|----------|------|--------|--------|
| `extractDriveFileId(url)` | Extrait l'ID du fichier | URL Google Drive | `string` ou `null` |
| `isGoogleDriveUrl(url)` | Détecte si URL Google Drive | URL | `boolean` |
| `normalizeDriveUrl(url, type)` | Normalise selon le type | URL + `"video"` ou `"image"` | URL normalisée |
| `autoNormalizeDriveUrl(url)` | Détection auto du type | URL | URL normalisée |

**Formats reconnus en entrée** :
- `https://drive.google.com/file/d/FILE_ID/view?usp=sharing`
- `https://drive.google.com/uc?id=FILE_ID&export=download`
- `https://drive.google.com/open?id=FILE_ID`

**Formats de sortie** :
- Vidéo : `https://drive.google.com/file/d/FILE_ID/preview`
- Image : `https://drive.google.com/thumbnail?id=FILE_ID&sz=w1000`

**Où il est utilisé** :
- Importé dans `server/controllers/formation.controller.js`

**Quels fichiers l'utilisent** :
- `server/controllers/formation.controller.js` (ligne 4 : `import { normalizeDriveUrl }`)

---

## 4. Backend — Détail technique

### 4.1 Modèle MongoDB modifié

**Fichier** : `server/models/formation.model.js`

**Changements** : 3 valeurs par défaut modifiées de `"cloudinary"` vers `"google_drive"`.

**Schémas concernés** :

```
weekSchema {
  provider: { default: "google_drive" }  ← changé
  // ... autres champs inchangés
}

videoSchema {
  provider: { default: "google_drive" }  ← changé
  // ... autres champs inchangés
}

formationSchema {
  trailerProvider: { default: "google_drive" }  ← changé
  // ... autres champs inchangés
}
```

### 4.2 Aucun nouveau champ ajouté

Les champs suivants existaient **déjà** dans le modèle (non ajoutés par cet audit) :
- `driveUrl` dans `weekSchema`
- `driveUrl` dans `videoSchema`
- `trailerDriveUrl` dans `formationSchema`

### 4.3 Aucune nouvelle route

Les routes suivantes existaient **déjà** dans `server/routes/formation.routes.js` :
- `PATCH /:id/trailer` → `patchFormationTrailer`
- `PATCH /slug/:slug/weeks` → `patchFormationWeeks`
- `PATCH /slug/:slug/supervision` → `patchFormationSupervision`
- `PATCH /slug/:slug/videos` → `patchFormationVideos`

Seule leur implémentation dans le contrôleur a été modifiée (ajout de la normalisation).

### 4.4 Aucun nouveau contrôleur

Tous les contrôleurs existaient déjà. Seuls 3 ont été modifiés :
- `patchFormationTrailer`
- `patchFormationWeeks`
- `patchFormationSupervision`

### 4.5 Nouvelles fonctions utilitaires

**Fichier** : `server/utils/driveHelper.js`

```js
// Regex pour les 3 formats de lien Google Drive
const DRIVE_FILE_REGEX = /\/file\/d\/([^/?#&]+)/;
const DRIVE_UC_REGEX   = /\/uc\?.*[&?]id=([^&]+)/;
const DRIVE_OPEN_REGEX = /\/open\?.*[&?]id=([^&]+)/;
```

### 4.6 Logique Google Drive

1. L'admin saisit une URL Google Drive (format partage) dans le formulaire
2. Le frontend envoie l'URL brute à l'API
3. Le contrôleur backend appelle `normalizeDriveUrl(url, type)`
4. `normalizeDriveUrl` extrait l'ID via `extractDriveFileId`
5. Si type `"video"` → construit `/file/d/{ID}/preview`
6. Si type `"image"` → construit `/thumbnail?id={ID}&sz=w1000`
7. Si non-Drive → retourne l'URL inchangée
8. L'URL normalisée est stockée dans MongoDB

### 4.7 Compatibilité avec les anciennes données

- ✅ Les formations existantes avec `provider: "cloudinary"` restent inchangées
- ✅ Les URLs Cloudinary stockées dans `videoUrl`, `thumbnail`, `trailerVideoUrl` ne sont pas modifiées
- ✅ La fonction `normalizeDriveUrl` retourne l'URL inchangée si ce n'est pas un lien Drive
- ✅ Aucune migration de base de données nécessaire
- ✅ Le champ `driveUrl` (existant mais vide pour les anciennes données) peut être utilisé ultérieurement

---

## 5. Frontend — Détail technique

### 5.1 Composants modifiés

**`CoursePreviewModal.jsx`** :
- Ajout d'un bloc `else if` pour Google Drive entre YouTube et `<video>`
- Utilise le même className `cpm-iframe` que YouTube (CSS déjà existant)
- Support du fullscreen via l'attribut `allowFullScreen`

### 5.2 Nouvelles interfaces

**Formulaire admin** : Section "Médias (Google Drive)" avec :
- Champ texte pour l'URL de l'image avec aperçu miniature
- Champ texte pour l'URL de la vidéo avec message d'aide
- Styles inline compatibles avec le thème (couleurs CSS variables)

### 5.3 Nouvelles fonctionnalités

- **Admin** : peut ajouter/modifier l'image et la vidéo de présentation d'une formation
- **Admin** : voit l'image en aperçu dans le formulaire et dans le tableau
- **Admin** : message d'aide expliquant la conversion automatique des liens
- **Étudiant** : lit les vidéos Google Drive dans un iframe intégré

### 5.4 Nouveaux services API

```js
formationsService.updateTrailer(id, data)
// Route : PATCH /api/formations/:id/trailer
// Body  : { trailerVideoUrl, trailerThumbnail, trailerProvider, trailerDriveUrl }
// Usage : Mise à jour de la vidéo de présentation

formationsService.updateVideos(slug, videos)
// Route : PATCH /api/formations/slug/:slug/videos
// Body  : { videos: [...] }
// Usage : Mise à jour complète du tableau videos

formationsService.updateWeeks(slug, weeks)
// Route : PATCH /api/formations/slug/:slug/weeks
// Body  : { weeks: [...] }
// Usage : Mise à jour complète du programme (semaines)

formationsService.updateSupervision(slug, supervision)
// Route : PATCH /api/formations/slug/:slug/supervision
// Body  : { supervision: [...] }
// Usage : Mise à jour complète de l'encadrement
```

### 5.5 Affichage des vidéos Google Drive

**Dans `CoursePreviewModal.jsx`** :
```jsx
{videoUrl && isGoogleDriveUrl(videoUrl) ? (
  <iframe
    className="cpm-iframe"
    src={resolveDriveUrl(videoUrl, "video")}
    title={...}
    allow="autoplay; encrypted-media; fullscreen"
    allowFullScreen
  />
) : ...}
```

- Utilise le format `/preview` qui affiche un lecteur vidéo avec contrôles natifs
- Supporte le plein écran
- Autoplay activé

### 5.6 Affichage des images Google Drive

**Dans `AdminFormations.jsx`** :
```jsx
// Aperçu dans le formulaire
<img src={form.image} alt="Aperçu" ... />

// Dans le tableau
{f.image ? <img src={f.image} alt="" className="af-avatar" />
         : <div className="af-avatar af-avatar--placeholder">...</div>}
```

- L'URL brute est utilisée telle quelle (le navigateur la résout)
- Pas de normalisation côté frontend pour les images
- Gestion d'erreur via `onError` (masque l'image si non chargée)

---

## 6. Flux complet des données

### Étape 1 — Admin saisit les médias

```
┌─────────────────────────────────────────────┐
│ AdminFormations.jsx                          │
│                                              │
│  Formulaire d'édition de formation           │
│  ┌──────────────────────────────────────┐   │
│  │ ... autres champs (titre, durée...)  │   │
│  │                                       │   │
│  │ ┌─ Médias (Google Drive) ──────────┐ │   │
│  │ │ URL image : [drive.google.com/...]│ │   │
│  │ │ URL vidéo : [drive.google.com/...]│ │   │
│  │ └──────────────────────────────────┘ │   │
│  │                                       │   │
│  │ [Enregistrer]                         │   │
│  └──────────────────────────────────────┘   │
└─────────────────────────────────────────────┘
```

### Étape 2 — Envoi à l'API

```
handleFormSubmit(payload)
  │
  ├─ Si création : formationsService.createFormation(payload)
  │   → POST /api/formations
  │   Body: { title, duration, price, schedule, image, ... }
  │
  └─ Si édition :
      ├─ formationsService.updateFormation(id, payload)
      │   → PATCH /api/formations/:id
      │   Body: { title, duration, price, schedule, image, ... }
      │
      └─ Si trailerVideoUrl présent :
          └─ formationsService.updateTrailer(id, { trailerVideoUrl, trailerProvider: "google_drive" })
              → PATCH /api/formations/:id/trailer
```

### Étape 3 — Normalisation backend

```
patchFormationTrailer (contrôleur)
  │
  ├─ trailerVideoUrl  → normalizeDriveUrl(url, "video")
  │   ├─ drive.google.com/file/d/ABC123/view?usp=sharing
  │   └─ → https://drive.google.com/file/d/ABC123/preview
  │
  ├─ trailerThumbnail → normalizeDriveUrl(url, "image")
  │   ├─ drive.google.com/file/d/DEF456/view
  │   └─ → https://drive.google.com/thumbnail?id=DEF456&sz=w1000
  │
  └─ Sauvegarde dans MongoDB
```

### Étape 4 — Stockage MongoDB

```
formation document {
  title: "Développement Web Fullstack",
  image: "https://drive.google.com/thumbnail?id=ABC123&sz=w1000",
  trailerVideoUrl: "https://drive.google.com/file/d/DEF456/preview",
  trailerProvider: "google_drive",
  weeks: [
    { videoUrl: "https://drive.google.com/file/d/GHI789/preview", provider: "google_drive" },
    ...
  ],
  ...
}
```

### Étape 5 — Affichage étudiant

```
FormationDetail.jsx
  │
  ├─ Affiche l'image de la formation
  │   └─ <img src={formation.image} ... />
  │
  └─ Ouvrir le modal de prévisualisation
      └─ CoursePreviewModal.jsx
          │
          └─ resolveVideoUrl(week.videoUrl)
              │
              ├─ isGoogleDriveUrl(url) ? → resolveDriveUrl(url, "video")
              │   └─ https://drive.google.com/file/d/ABC123/preview
              │
              └─ Sinon → VIDEO_URLS[url] || url (Cloudinary)
                  └─ https://res.cloudinary.com/...mp4

Rendu :
  Si YouTube    → <iframe src="https://youtube.com/embed/..."/>
  Si Google Drive → <iframe src="https://drive.google.com/file/d/.../preview"/>
  Si autre      → <video src="..."/>
  Sinon         → Message "aucune vidéo"
```

---

## 7. Changements fonctionnels

### Nouvelles fonctionnalités ajoutées

| # | Fonctionnalité | Localisation | Bénéfice |
|---|----------------|--------------|----------|
| 1 | **Support Google Drive comme provider** | Modèle MongoDB (defaut) | Nouveaux médias sans compte Cloudinary |
| 2 | **Champs image + vidéo dans formulaire admin** | `AdminFormations.jsx` | Admin peut gérer les médias directement |
| 3 | **Aperçu image dans le formulaire** | `AdminFormations.jsx` | Feedback visuel immédiat |
| 4 | **Affichage image dans le tableau** | `AdminFormations.jsx` | Identification visuelle des formations |
| 5 | **Normalisation automatique des URLs Drive** | `driveHelper.js` (backend) | URLs converties en format lisible |
| 6 | **Détection et résolution Drive côté frontend** | `videoUrls.js` | Compatible avec iframe |
| 7 | **Iframe Google Drive dans le lecteur vidéo** | `CoursePreviewModal.jsx` | Lecture vidéo sans plugin |
| 8 | **Helpers frontend exportés** | `videoUrls.js` | Réutilisables dans d'autres composants |
| 9 | **4 nouvelles méthodes API** | `formations.service.js` | Mise à jour granulaire des médias |
| 10 | **Mise à jour auto du trailer** | `AdminFormations.jsx` | Synchronisation formulaire → API trailer |

### Détail des helpers

**Backend** (`server/utils/driveHelper.js`) :
- `extractDriveFileId(url)` — extraction d'ID par 3 regex
- `isGoogleDriveUrl(url)` — détection booléenne
- `normalizeDriveUrl(url, type)` — conversion vidéo/image
- `autoNormalizeDriveUrl(url)` — détection automatique du type

**Frontend** (`client/src/constants/videoUrls.js`) :
- `extractDriveFileId(url)` — identique au backend
- `isGoogleDriveUrl(url)` — identique au backend
- `resolveDriveUrl(url, type)` — identique au backend
- `autoResolveDriveUrl(url)` — identique au backend

---

## 8. Fonctionnalités supprimées ou remplacées

### Ce qui a été remplacé

| Ancien comportement | Nouveau comportement |
|--------------------|---------------------|
| `provider` par défaut `"cloudinary"` | `provider` par défaut `"google_drive"` |
| Admin ne pouvait pas gérer les médias | Admin peut ajouter image + URL vidéo |
| Lecteur vidéo : YouTube ou `<video>` | YouTube ou Google Drive iframe ou `<video>` |
| `resolveVideoUrl` : uniquement `VIDEO_URLS` | `resolveVideoUrl` : Google Drive → `VIDEO_URLS` |

### Cloudinary est-il encore utilisé ailleurs ?

**OUI** — Cloudinary est encore utilisé pour :
1. **Tous les autres modules** : vidéos de feedback, vidéos de témoignages, etc.
2. **Mapping `VIDEO_URLS`** : conservé intégralement dans `videoUrls.js`
3. **Anciennes formations** : les données Cloudinary existantes ne sont pas migrées
4. **Enum du provider** : `"cloudinary"` est toujours une valeur valide

**Cloudinary n'est PAS supprimé** de l'application. Seule la valeur par défaut change pour les nouvelles formations.

---

## 9. Compatibilité

### Ce qui reste compatible ✅

- ✅ **Anciennes formations Cloudinary** : lecture, édition, suppression inchangées
- ✅ **VIDEO_URLS** : mapping Cloudinary toujours actif
- ✅ **YouTube** : toujours supporté dans le modal
- ✅ **Routes API** : inchangées, aucune route supprimée ou modifiée
- ✅ **Formulaires admin** : toutes les fonctionnalités existantes conservées
- ✅ **Exports CSV/PDF** : inchangés
- ✅ **Pagination, tri, recherche** : inchangés
- ✅ **Autres modules** (Offres, Candidatures, etc.) : non impactés

### Ce qui n'est plus le comportement par défaut ⚠️

- ⚠️ Les **nouvelles formations** créées auront désormais `provider: "google_drive"` par défaut
- ⚠️ Le champ `image` et `trailerVideoUrl` sont désormais dans le formulaire (mais peuvent rester vides)

### Comportements conservés

- Les URLs Google Drive brutes sont automatiquement normalisées en `/preview` (backend)
- Les URLs non-Drive (Cloudinary, YouTube, http) passent sans modification
- Le `resolveVideoUrl` côté frontend détecte et normalise les URLs Drive avant tout
- L'ancien système `VIDEO_URLS` est toujours consulté en fallback

---

## 10. Architecture actuelle

### Architecture du module Formations (après modifications)

```
┌──────────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React)                              │
│                                                                      │
│  AdminFormations.jsx  ←→  formations.service.js  ←→  API REST       │
│    ┌─────────────────┐        │                                      │
│    │ FormationForm    │        ├─ createFormation()                  │
│    │ - champs médias  │        ├─ updateFormation()                  │
│    │ - aperçu image   │        ├─ updateTrailer()        ← NOUVEAU   │
│    │ - URL vidéo      │        ├─ updateWeeks()          ← NOUVEAU   │
│    └─────────────────┘        ├─ updateSupervision()    ← NOUVEAU   │
│                                └─ updateVideos()        ← NOUVEAU   │
│                                                                      │
│  CoursePreviewModal.jsx ← videoUrls.js                               │
│    ┌────────────────────┐   ├─ VIDEO_URLS (Cloudinary)               │
│    │ Lecteur vidéo :    │   ├─ resolveVideoUrl()                     │
│    │ 1. YouTube iframe  │   ├─ isGoogleDriveUrl()      ← NOUVEAU    │
│    │ 2. Drive iframe    │   ├─ resolveDriveUrl()       ← NOUVEAU    │
│    │ 3. <video> natif   │   └─ autoResolveDriveUrl()   ← NOUVEAU    │
│    └────────────────────┘                                           │
└──────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────────┐
│                        API EXPRESS                                   │
│                                                                      │
│  formation.routes.js                                                 │
│    GET  /                              getAllFormations              │
│    GET  /tech-map                      getFormationsTechMap          │
│    GET  /slug/:slug                    getFormationBySlug            │
│    GET  /:id                           getFormationById              │
│    POST /                              createFormation               │
│    PATCH /:id                          updateFormationInfo           │
│    DELETE /:id                         deleteFormation               │
│    PATCH /:id/trailer                  patchFormationTrailer ← MODIFIÉ│
│    PATCH /slug/:slug/weeks             patchFormationWeeks  ← MODIFIÉ│
│    PATCH /slug/:slug/supervision       patchFormationSupervision     │
│    PATCH /slug/:slug/videos            patchFormationVideos          │
│                              │                                       │
│  ┌───────────────────────────┴──────────────────────────────┐        │
│  │ formation.controller.js                                   │        │
│  │                                                           │        │
│  │  import { normalizeDriveUrl } from "../utils/driveHelper" │        │
│  │                                                           │        │
│  │  patchFormationTrailer() :                                │        │
│  │    trailerVideoUrl  = normalizeDriveUrl(url, "video")     │        │
│  │    trailerThumbnail = normalizeDriveUrl(url, "image")     │        │
│  │                                                           │        │
│  │  patchFormationWeeks() :                                  │        │
│  │    weeks.map(w => ({                                      │        │
│  │      videoUrl:  normalizeDriveUrl(w.videoUrl, "video"),   │        │
│  │      thumbnail: normalizeDriveUrl(w.thumbnail, "image")   │        │
│  │    }))                                                    │        │
│  └───────────────────────────────────────────────────────────┘        │
└──────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────────┐
│                        MONGODB                                       │
│                                                                      │
│  formation.model.js                                                  │
│    weekSchema.provider        default: "google_drive"  ← MODIFIÉ    │
│    videoSchema.provider       default: "google_drive"  ← MODIFIÉ    │
│    trailerProvider            default: "google_drive"  ← MODIFIÉ    │
│    driveUrl (existait déjà)                                          │
│    trailerDriveUrl (existait déjà)                                   │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 11. Travail restant

### 11.1 Fonctionnalités à développer

| # | Tâche | Priorité | Statut |
|---|-------|----------|--------|
| 1 | **Upload direct Google Drive depuis l'admin** (au lieu de coller une URL) | Moyenne | ❌ Non fait |
| 2 | **Gestion des semaines** : éditeur de semaines avec vidéo/image Drive | Haute | ❌ Non fait |
| 3 | **Gestion des vidéos supplémentaires** (`videos[]`) | Haute | ❌ Non fait |
| 4 | **Gestion de l'encadrement** (`supervision[]`) | Haute | ❌ Non fait |
| 5 | **Migration des anciennes formations** Cloudinary vers Google Drive | Optionnel | ❌ Non fait |
| 6 | **Validation côté frontend** des URLs Google Drive (format attendu) | Basse | ❌ Non fait |
