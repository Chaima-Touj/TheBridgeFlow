/* Statuts de suivi des demandes reçues (Messages du site, Pack PFE).
   Module .js (importable par node --test) ; composants d'affichage dans
   components/common/RequestStatus.jsx. Mêmes valeurs que le backend
   (thebridgeflow-back/utils/requestStatuses.js). */
export const REQUEST_STATUSES = ["new", "contacted", "confirmed"];

// Une demande sans statut (enregistrée avant l'ajout du suivi) est « Nouveau ».
export const normalizeRequestStatus = (status) => (REQUEST_STATUSES.includes(status) ? status : "new");
