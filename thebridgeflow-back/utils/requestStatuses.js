// Statuts de suivi communs aux demandes reçues : messages du site
// (EventParticipationRequest) et Pack PFE (PfePackRegistration).
// Mêmes valeurs côté frontend : src/components/common/RequestStatus.jsx.
export const REQUEST_STATUSES = ["new", "contacted", "confirmed"];

export const isRequestStatus = (value) => typeof value === "string" && REQUEST_STATUSES.includes(value);
