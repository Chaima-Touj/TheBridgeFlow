import { useId } from "react";
import { useTranslation } from "react-i18next";
import { CircleCheck, CircleDashed, LoaderCircle, PhoneCall } from "lucide-react";
import { REQUEST_STATUSES, normalizeRequestStatus } from "../../utils/requestStatuses.js";
import "./RequestStatus.css";

/* Suivi des demandes reçues (Messages du site, Pack PFE) : badge, filtre et
   sélecteur de statut partagés (ce fichier n'exporte que des composants).
   Valeurs et normalisation : utils/requestStatuses.js. Libellés : requestStatus.*. */
const REQUEST_STATUS_META = {
  new: { Icon: CircleDashed, tone: "blue" },
  contacted: { Icon: PhoneCall, tone: "amber" },
  confirmed: { Icon: CircleCheck, tone: "emerald" },
};

export function RequestStatusBadge({ status, className = "" }) {
  const { t } = useTranslation();
  const key = normalizeRequestStatus(status);
  const { Icon, tone } = REQUEST_STATUS_META[key];
  return (
    <span className={`rqs-badge rqs-tone--${tone} ${className}`.trim()}>
      <Icon size={13} strokeWidth={2} aria-hidden="true" />
      {t(`requestStatus.${key}`)}
    </span>
  );
}

// Filtre « Toutes / Nouveau / Contacté / Confirmé » avec le nombre de demandes de chaque statut.
export function RequestStatusFilter({ value, counts = {}, onChange, className = "" }) {
  const { t } = useTranslation();
  return (
    <div className={`rqs-filter ${className}`.trim()} role="group" aria-label={t("requestStatus.filterLabel")}>
      {["all", ...REQUEST_STATUSES].map((key) => (
        <button
          key={key}
          type="button"
          className={`rqs-chip ${key === "all" ? "" : `rqs-tone--${REQUEST_STATUS_META[key].tone}`}`.trim()}
          aria-pressed={value === key}
          onClick={() => onChange(key)}
        >
          {t(`requestStatus.${key}`)}
          <span className="rqs-chip__count">{counts[key] ?? 0}</span>
        </button>
      ))}
    </div>
  );
}

/* Choix du statut d'une demande. busyStatus = statut en cours d'enregistrement
   (indicateur de chargement, boutons désactivés). meta = ligne d'information
   facultative (ex. t("requestStatus.updatedBy", { name, date })). */
export function RequestStatusPicker({ value, busyStatus = "", onChange, meta = null, className = "" }) {
  const { t } = useTranslation();
  const labelId = useId();
  const current = normalizeRequestStatus(value);
  return (
    <div className={`rqs-picker ${className}`.trim()}>
      <span className="rqs-picker__label" id={labelId}>{t("requestStatus.pickerLabel")}</span>
      <div className="rqs-picker__options" role="group" aria-labelledby={labelId}>
        {REQUEST_STATUSES.map((key) => {
          const { Icon, tone } = REQUEST_STATUS_META[key];
          return (
            <button
              key={key}
              type="button"
              className={`rqs-option rqs-tone--${tone}`}
              aria-pressed={current === key}
              disabled={Boolean(busyStatus)}
              onClick={() => { if (key !== current) onChange(key); }}
            >
              {busyStatus === key
                ? <LoaderCircle className="rqs-spin" size={15} aria-hidden="true" />
                : <Icon size={15} aria-hidden="true" />}
              {t(`requestStatus.${key}`)}
            </button>
          );
        })}
      </div>
      {meta && <small className="rqs-picker__meta">{meta}</small>}
    </div>
  );
}
