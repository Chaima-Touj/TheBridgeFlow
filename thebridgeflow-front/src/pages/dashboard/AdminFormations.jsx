import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  FiPlus, FiBookOpen, FiAlertTriangle, FiImage, FiTrash2, FiEdit2,
  FiChevronUp, FiChevronDown, FiChevronLeft, FiChevronRight,
} from "react-icons/fi";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import DashboardLayout from "../../components/layout/DashboardLayout.jsx";
import Modal from "../../components/common/Modal.jsx";
import ExportMenu from "../../components/common/ExportMenu.jsx";
import { formationsService } from "../../services/formations.service.js";
import { compressImageToBase64 } from "../../utils/imageCompression.js";
import { isGoogleDriveUrl, resolveDriveUrl } from "../../constants/videoUrls.js";
import "./StudentDashboard.css";
import "./AdminFormations.css";

const MODES = ["Présentiel", "En ligne", "Hybride"];

/* Les valeurs MODES restent en français (valeur DB/enum) ; seul l'affichage est traduit */
const MODE_LABEL_KEY = {
  "Présentiel": "formationDetail.modeOnsite",
  "En ligne":   "formationDetail.modeOnline",
  "Hybride":    "formationDetail.modeHybrid",
};

const MODE_BADGE = {
  "Présentiel": "badge-warning",
  "En ligne":   "badge-primary",
  "Hybride":    "badge-purple",
};

const LEVEL_BADGE = {
  "Débutant":                  "badge-success",
  "Débutant à Intermédiaire":  "badge-primary",
  "Intermédiaire":             "badge-warning",
  "Intermédiaire à Avancé":    "badge-purple",
};

function levelBadgeClass(level = "") {
  if (LEVEL_BADGE[level]) return LEVEL_BADGE[level];
  const l = level.toLowerCase();
  if (l.includes("avancé"))        return "badge-purple";
  if (l.includes("débutant"))      return "badge-success";
  if (l.includes("intermédiaire")) return "badge-warning";
  return "badge-primary";
}

const AVATAR_COLORS = ["#4F46E5", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#0EA5E9", "#EC4899"];
function avatarColor(name = "") {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

const PAGE_SIZES = [6, 10, 25, 50];

const WEEK_TYPES = ["cours", "encadrement"];

// "duree"/"gratuit" ne sont pas édités par cette carte (non demandés dans la
// section Vidéos), mais doivent être conservés tels quels au round-trip —
// sinon chaque sauvegarde via updateWeeks/updateSupervision (qui remplace le
// tableau entier) les écraserait silencieusement pour toutes les semaines
// existantes de la formation.
const EMPTY_WEEK = {
  type: "cours",
  phase: "",
  week: "",
  videoTitle: "",
  content: "",
  thumbnail: "",
  // "drive" (lien texte, normalisé côté serveur) ou "upload" (compression
  // locale FileReader+canvas → base64, voir imageCompression.js). Purement
  // un état d'UI — jamais envoyé au backend (voir toWeekPayload).
  thumbnailMode: "drive",
  driveUrl: "",
  duree: "",
  gratuit: false,
};

function weekToCard(w, type) {
  const thumbnail = w.thumbnail || "";
  return {
    type,
    phase:      w.phase || "",
    week:       w.week ?? "",
    videoTitle: w.videoTitle || "",
    content:    w.content || "",
    thumbnail,
    thumbnailMode: thumbnail.startsWith("data:image/") ? "upload" : "drive",
    driveUrl:   w.videoUrl || w.driveUrl || "",
    duree:      w.duree || "",
    gratuit:    !!w.gratuit,
  };
}

const EMPTY_FORM = {
  title: "",
  duration: "",
  onsite: "",
  online: "",
  level: "",
  description: "",
  mode: "Hybride",
  certificate: false,
  weeks: [],
  trailerVideoUrl: "",
  trailerThumbnail: "",
};

function formationToForm(formation) {
  return {
    title:       formation.title || "",
    duration:    formation.duration || "",
    onsite:      formation.price?.onsite || "",
    online:      formation.price?.online || "",
    level:       formation.level || "",
    description: formation.description || "",
    mode:        formation.mode || "Hybride",
    certificate: !!formation.certificate,
    weeks: [
      ...(formation.weeks || []).map((w) => weekToCard(w, "cours")),
      ...(formation.supervision || []).map((w) => weekToCard(w, "encadrement")),
    ],
    trailerVideoUrl:  formation.trailerVideoUrl  || "",
    trailerThumbnail: formation.trailerThumbnail || "",
  };
}

function extractErrorMessage(err, fallback) {
  return err?.response?.data?.message || fallback;
}

function csvEscape(value) {
  const s = String(value ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function exportFormationsCSV(rows, t) {
  const headers = [
    t("adminFormations.colFormation"), t("formationDetail.level"), t("formationDetail.mode"),
    t("adminFormations.csvOnsitePrice"), t("adminFormations.csvOnlinePrice"),
    t("formationDetail.duration"), t("adminFormations.colWeeks"),
  ];
  const lines = rows.map((f) => [
    f.title, f.level, f.mode, f.price?.onsite, f.price?.online, f.duration, f.weeks?.length ?? 0,
  ].map(csvEscape).join(","));
  const csv = [headers.join(","), ...lines].join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `formations-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function exportFormationsPDF(rows, t) {
  const head = [
    t("adminFormations.colFormation"), t("formationDetail.level"), t("formationDetail.mode"),
    t("adminFormations.colPrice"), t("formationDetail.duration"), t("adminFormations.colWeeks"),
  ];
  // 6 colonnes plutôt verbeuses (tarif, durée) : le paysage donne assez de
  // largeur pour rester lisible sans tronquer ; le portrait suffirait pour
  // un tableau à peu de colonnes.
  const orientation = head.length > 4 ? "landscape" : "portrait";
  const doc = new jsPDF({ orientation, unit: "mm", format: "a4" });

  const dateStr = new Date().toLocaleDateString("fr-FR"); // JJ/MM/AAAA

  doc.setFontSize(16);
  doc.setTextColor(15, 23, 42); // --text
  doc.text(t("adminFormations.pdfTitle"), 14, 15);
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139); // --text-secondary
  doc.text(t("adminFormations.pdfExportedOn", { date: dateStr }), 14, 21);

  const body = rows.map((f) => [
    f.title || "",
    f.level || "—",
    f.mode || "—",
    `${f.price?.onsite || "—"} / ${f.price?.online || "—"}`,
    f.duration || "—",
    String(f.weeks?.length ?? 0),
  ]);

  autoTable(doc, {
    head: [head],
    body,
    startY: 27,
    theme: "striped",
    styles: { fontSize: 9, cellPadding: 3.5, textColor: [15, 23, 42] },
    headStyles: { fillColor: [226, 232, 240], textColor: [15, 23, 42], fontStyle: "bold" },
    alternateRowStyles: { fillColor: [248, 250, 252] },
  });

  const fileDate = new Date().toISOString().slice(0, 10);
  doc.save(`formations-stageflow-${fileDate}.pdf`);
}

function getPageNumbers(current, total) {
  const delta = 1;
  const range = [];
  for (let i = Math.max(1, current - delta); i <= Math.min(total, current + delta); i++) range.push(i);
  if (range[0] > 1) {
    if (range[0] > 2) range.unshift("…");
    range.unshift(1);
  }
  if (range[range.length - 1] < total) {
    if (range[range.length - 1] < total - 1) range.push("…");
    range.push(total);
  }
  return range;
}

/* ─── Icône de tri (double chevron, colore quand la colonne est active) ──── */
function SortIcon({ active, dir }) {
  return (
    <span className="af-sort-ico" aria-hidden="true">
      <FiChevronUp size={10} className={active && dir === "asc" ? "af-sort-ico--active" : ""} />
      <FiChevronDown size={10} className={active && dir === "desc" ? "af-sort-ico--active" : ""} />
    </span>
  );
}

/* ─── Actions par ligne (Modifier / Supprimer, toujours visibles) ────────── */
function RowActionsMenu({ onEdit, onDelete }) {
  const { t } = useTranslation();

  return (
    <div className="af-row-actions">
      <button
        type="button"
        className="af-action-btn af-action-btn--edit"
        onClick={onEdit}
        title={t("adminFormations.editAction")}
        aria-label={t("adminFormations.editAction")}
      >
        <FiEdit2 size={15} />
      </button>
      <button
        type="button"
        className="af-action-btn af-action-btn--delete"
        onClick={onDelete}
        title={t("notifications.deleteLabel")}
        aria-label={t("notifications.deleteLabel")}
      >
        <FiTrash2 size={15} />
      </button>
    </div>
  );
}

/* ─── Champ image réutilisable — bascule lien Google Drive / upload local
     (base64, compression client canvas 800px, voir imageCompression.js).
     Même pattern que la miniature des témoignages (AdminFeedbacks.jsx). ──── */
function DriveOrUploadField({ value, onChange, label }) {
  const { t } = useTranslation();
  const [mode, setMode] = useState(value?.startsWith("data:image/") ? "upload" : "drive");
  const [compressing, setCompressing] = useState(false);
  const [error, setError] = useState("");

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCompressing(true);
    setError("");
    try {
      const base64 = await compressImageToBase64(file, { maxWidth: 800, quality: 0.8 });
      onChange(base64);
    } catch (err) {
      setError(err.message || t("adminFormations.errors.thumbnailUploadFailed"));
    } finally {
      setCompressing(false);
      e.target.value = "";
    }
  };

  return (
    <div className="af-form-row">
      {label && <label className="label">{label}</label>}
      <div className="af-thumb-mode-toggle">
        <button type="button" className={`af-thumb-mode-btn${mode === "drive" ? " af-thumb-mode-btn--active" : ""}`} onClick={() => setMode("drive")}>
          {t("adminFormations.thumbnailModeDrive")}
        </button>
        <button type="button" className={`af-thumb-mode-btn${mode === "upload" ? " af-thumb-mode-btn--active" : ""}`} onClick={() => setMode("upload")}>
          {t("adminFormations.thumbnailModeUpload")}
        </button>
      </div>

      {mode === "upload" ? (
        <>
          <label className="an-image-upload">
            {value ? (
              <img src={value} alt="" className="an-image-preview" />
            ) : (
              <div className="an-image-placeholder">
                <FiImage size={20} />
                <span>{t("adminFormations.videoThumbnailChoose")}</span>
              </div>
            )}
            {compressing && <div className="af-video-thumb-uploading">{t("adminFormations.inProgress")}</div>}
          </label>
          <input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleFileChange} hidden />
        </>
      ) : (
        <>
          <input
            className="input"
            placeholder="https://drive.google.com/file/d/..."
            value={value}
            onChange={(e) => onChange(e.target.value)}
          />
          {value && isGoogleDriveUrl(value) && (
            <div className="af-video-thumb-drive-preview">
              <img
                src={resolveDriveUrl(value, "image")}
                alt=""
                className="af-video-thumb-preview"
                onError={(e) => { e.target.style.display = "none"; }}
              />
            </div>
          )}
        </>
      )}
      {error && <span className="af-field-error">{error}</span>}
    </div>
  );
}

/* ─── Formulaire (création + édition) ────────────────────────────────────── */
function FormationForm({ initial, isEdit, submitting, formError, onSubmit, onCancel }) {
  const { t } = useTranslation();
  const [form, setForm] = useState(initial);
  const [fieldErrors, setFieldErrors] = useState({});
  const [compressingIdx, setCompressingIdx] = useState(null);
  const [thumbErrors, setThumbErrors] = useState({});

  const set = (key) => (e) => {
    const value = e.target.type === "checkbox" ? e.target.checked : e.target.value;
    setForm((f) => ({ ...f, [key]: value }));
  };

  const addWeek = () => setForm((f) => ({ ...f, weeks: [...f.weeks, { ...EMPTY_WEEK }] }));
  const removeWeek = (idx) => setForm((f) => ({ ...f, weeks: f.weeks.filter((_, i) => i !== idx) }));
  const updateWeek = (idx, key) => (e) => {
    const value = e.target.value;
    setForm((f) => ({ ...f, weeks: f.weeks.map((w, i) => (i === idx ? { ...w, [key]: value } : w)) }));
  };
  const setThumbnailMode = (idx, mode) =>
    setForm((f) => ({ ...f, weeks: f.weeks.map((w, i) => (i === idx ? { ...w, thumbnailMode: mode } : w)) }));

  // Compression 100% locale (FileReader + canvas, voir imageCompression.js) —
  // plus d'appel réseau vers l'ancienne route upload-thumbnail (stockage
  // disque, non persistant en production). await avant setForm : le state
  // ne reçoit la chaîne base64 qu'une fois toute la conversion terminée.
  const handleThumbnailFileChange = (idx) => async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCompressingIdx(idx);
    setThumbErrors((prev) => ({ ...prev, [idx]: undefined }));
    try {
      const base64 = await compressImageToBase64(file, { maxWidth: 800, quality: 0.8 });
      setForm((f) => ({ ...f, weeks: f.weeks.map((w, i) => (i === idx ? { ...w, thumbnail: base64 } : w)) }));
    } catch (err) {
      setThumbErrors((prev) => ({ ...prev, [idx]: err.message || t("adminFormations.errors.thumbnailUploadFailed") }));
    } finally {
      setCompressingIdx(null);
      e.target.value = "";
    }
  };

  const validate = () => {
    const errors = {};
    if (!form.title.trim())    errors.title    = t("adminFormations.errors.titleRequired");
    if (!form.duration.trim()) errors.duration = t("adminFormations.errors.durationRequired");
    if (!form.onsite.trim())   errors.onsite   = t("adminFormations.errors.onsiteRequired");
    if (!form.online.trim())   errors.online   = t("adminFormations.errors.onlineRequired");
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;
    // videoUrl (pas driveUrl) : patchFormationWeeks/patchFormationSupervision
    // normalisent ce champ précis (normalizeDriveUrl) — driveUrl sur weekSchema
    // n'est lu par aucune route, y écrire laisserait la vidéo injouable.
    const toWeekPayload = (w) => ({
      week:       Number(w.week) || 0,
      phase:      w.phase.trim(),
      content:    w.content.trim(),
      videoTitle: w.videoTitle.trim(),
      thumbnail:  w.thumbnail,
      videoUrl:   w.driveUrl.trim(),
      duree:      w.duree,
      gratuit:    w.gratuit,
    });
    onSubmit({
      title:       form.title.trim(),
      duration:    form.duration.trim(),
      price:       { onsite: form.onsite.trim(), online: form.online.trim() },
      level:       form.level.trim(),
      description: form.description.trim(),
      mode:        form.mode,
      certificate: form.certificate,
      weeksData:       form.weeks.filter((w) => w.type === "cours").map(toWeekPayload),
      supervisionData: form.weeks.filter((w) => w.type === "encadrement").map(toWeekPayload),
      trailerVideoUrl:  form.trailerVideoUrl.trim(),
      trailerThumbnail: form.trailerThumbnail,
    });
  };

  return (
    <form onSubmit={handleSubmit} noValidate>
      {formError && (
        <div className="af-form-error">
          <FiAlertTriangle size={15} />
          <span>{formError}</span>
        </div>
      )}

      <div className="af-form-row">
        <label className="label" htmlFor="af-title">{t("adminFormations.titleLabel")}</label>
        <input id="af-title" className="input" value={form.title} onChange={set("title")} />
        {fieldErrors.title && <span className="af-field-error">{fieldErrors.title}</span>}
      </div>

      <div className="af-form-grid">
        <div className="af-form-row">
          <label className="label" htmlFor="af-duration">{t("adminFormations.durationLabel")}</label>
          <input id="af-duration" className="input" placeholder={t("adminFormations.durationPlaceholder")} value={form.duration} onChange={set("duration")} />
          {fieldErrors.duration && <span className="af-field-error">{fieldErrors.duration}</span>}
        </div>
        <div className="af-form-row">
          <label className="label" htmlFor="af-level">{t("formationDetail.level")}</label>
          <input id="af-level" className="input" placeholder={t("adminFormations.levelPlaceholder")} value={form.level} onChange={set("level")} />
        </div>
      </div>

      <div className="af-form-grid">
        <div className="af-form-row">
          <label className="label" htmlFor="af-onsite">{t("adminFormations.onsiteLabel")}</label>
          <input id="af-onsite" className="input" placeholder={t("adminFormations.onsitePlaceholder")} value={form.onsite} onChange={set("onsite")} />
          {fieldErrors.onsite && <span className="af-field-error">{fieldErrors.onsite}</span>}
        </div>
        <div className="af-form-row">
          <label className="label" htmlFor="af-online">{t("adminFormations.onlineLabel")}</label>
          <input id="af-online" className="input" placeholder={t("adminFormations.onlinePlaceholder")} value={form.online} onChange={set("online")} />
          {fieldErrors.online && <span className="af-field-error">{fieldErrors.online}</span>}
        </div>
      </div>

      <div className="af-form-grid">
        <div className="af-form-row">
          <label className="label" htmlFor="af-mode">{t("formationDetail.mode")}</label>
          <select id="af-mode" className="input" value={form.mode} onChange={set("mode")}>
            {MODES.map((m) => <option key={m} value={m}>{t(MODE_LABEL_KEY[m])}</option>)}
          </select>
        </div>
        <div className="af-form-row af-form-row--checkbox">
          <label className="af-checkbox-label" htmlFor="af-certificate">
            <input id="af-certificate" type="checkbox" checked={form.certificate} onChange={set("certificate")} />
            {t("adminFormations.certificateIssued")}
          </label>
        </div>
      </div>

      {/* ── Vidéo résumé (trailer global, distinct des vidéos par semaine) ──
          Uniquement en édition : la mise à jour passe par PATCH
          /api/formations/:id/trailer, qui a besoin d'un _id existant — pas
          disponible tant que la formation n'a pas été créée. */}
      {isEdit && (
        <fieldset className="af-video-fieldset">
          <legend className="af-video-legend">{t("adminFormations.trailerSection")}</legend>

          <div className="af-form-row">
            <label className="label" htmlFor="af-trailer-drive">{t("adminFormations.trailerDriveUrlLabel")}</label>
            <input
              id="af-trailer-drive"
              className="input"
              placeholder="https://drive.google.com/file/d/..."
              value={form.trailerVideoUrl}
              onChange={set("trailerVideoUrl")}
            />
          </div>

          <DriveOrUploadField
            label={t("adminFormations.trailerThumbnailLabel")}
            value={form.trailerThumbnail}
            onChange={(trailerThumbnail) => setForm((f) => ({ ...f, trailerThumbnail }))}
          />
        </fieldset>
      )}

      {/* ── Semaines (cours + encadrement, vidéos Google Drive) ──────────── */}
      <fieldset className="af-video-fieldset">
        <legend className="af-video-legend">{t("adminFormations.videosSection")}</legend>

        {form.weeks.length === 0 && (
          <p className="af-video-empty">{t("adminFormations.videosEmpty")}</p>
        )}

        <div className="af-video-list">
          {form.weeks.map((week, idx) => (
            <div className="af-video-card" key={idx}>
              <div className="af-video-card-header">
                <span className="af-video-card-title">{t("adminFormations.videoCardTitle", { n: idx + 1 })}</span>
                <button type="button" className="af-video-remove-btn" onClick={() => removeWeek(idx)}>
                  <FiTrash2 size={13} /> {t("adminFormations.removeVideo")}
                </button>
              </div>

              <div className="af-form-grid">
                <div className="af-form-row">
                  <label className="label" htmlFor={`af-week-type-${idx}`}>{t("adminFormations.weekTypeLabel")}</label>
                  <select id={`af-week-type-${idx}`} className="input" value={week.type} onChange={updateWeek(idx, "type")}>
                    {WEEK_TYPES.map((wt) => (
                      <option key={wt} value={wt}>{t(`adminFormations.weekType.${wt}`)}</option>
                    ))}
                  </select>
                </div>
                <div className="af-form-row">
                  <label className="label" htmlFor={`af-week-number-${idx}`}>{t("adminFormations.weekNumberLabel")}</label>
                  <input
                    id={`af-week-number-${idx}`}
                    type="number"
                    min="1"
                    className="input"
                    value={week.week}
                    onChange={updateWeek(idx, "week")}
                  />
                </div>
              </div>

              <div className="af-form-row">
                <label className="label" htmlFor={`af-week-phase-${idx}`}>{t("adminFormations.weekPhaseLabel")}</label>
                <input
                  id={`af-week-phase-${idx}`}
                  className="input"
                  placeholder={t("adminFormations.weekPhasePlaceholder")}
                  value={week.phase}
                  onChange={updateWeek(idx, "phase")}
                />
              </div>

              <div className="af-form-row">
                <label className="label" htmlFor={`af-week-title-${idx}`}>{t("adminFormations.videoTitleLabel")}</label>
                <input
                  id={`af-week-title-${idx}`}
                  className="input"
                  value={week.videoTitle}
                  onChange={updateWeek(idx, "videoTitle")}
                />
              </div>

              <div className="af-form-row">
                <label className="label" htmlFor={`af-week-content-${idx}`}>{t("adminFormations.videoDescLabel")}</label>
                <textarea
                  id={`af-week-content-${idx}`}
                  className="input"
                  rows={2}
                  value={week.content}
                  onChange={updateWeek(idx, "content")}
                />
              </div>

              <div className="af-form-row">
                <label className="label">{t("adminFormations.videoThumbnailLabel")}</label>
                <div className="af-thumb-mode-toggle">
                  <button
                    type="button"
                    className={`af-thumb-mode-btn${week.thumbnailMode === "drive" ? " af-thumb-mode-btn--active" : ""}`}
                    onClick={() => setThumbnailMode(idx, "drive")}
                  >
                    {t("adminFormations.thumbnailModeDrive")}
                  </button>
                  <button
                    type="button"
                    className={`af-thumb-mode-btn${week.thumbnailMode === "upload" ? " af-thumb-mode-btn--active" : ""}`}
                    onClick={() => setThumbnailMode(idx, "upload")}
                  >
                    {t("adminFormations.thumbnailModeUpload")}
                  </button>
                </div>

                {week.thumbnailMode === "upload" ? (
                  <>
                    <label className="af-video-thumb-upload" htmlFor={`af-week-thumb-${idx}`}>
                      {week.thumbnail ? (
                        <img src={week.thumbnail} alt="" className="af-video-thumb-preview" />
                      ) : (
                        <div className="af-video-thumb-placeholder">
                          <FiImage size={20} />
                          <span>{t("adminFormations.videoThumbnailChoose")}</span>
                        </div>
                      )}
                      {compressingIdx === idx && (
                        <div className="af-video-thumb-uploading">{t("adminFormations.inProgress")}</div>
                      )}
                    </label>
                    <input
                      id={`af-week-thumb-${idx}`}
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={handleThumbnailFileChange(idx)}
                      hidden
                    />
                  </>
                ) : (
                  <>
                    <input
                      className="input"
                      placeholder="https://drive.google.com/file/d/..."
                      value={week.thumbnail}
                      onChange={updateWeek(idx, "thumbnail")}
                    />
                    {/* Aperçu live côté client — normalisé en type "image" (format
                        /thumbnail?id=..., adapté à <img>), jamais "video" (/preview,
                        fait pour les iframes). Le champ garde le lien brut collé par
                        l'admin ; seule cette prévisualisation est normalisée — la
                        normalisation définitive et persistée se fait côté serveur au
                        submit (patchFormationWeeks/Supervision), avec la même logique. */}
                    {week.thumbnail && isGoogleDriveUrl(week.thumbnail) && (
                      <div className="af-video-thumb-drive-preview">
                        <img
                          src={resolveDriveUrl(week.thumbnail, "image")}
                          alt=""
                          className="af-video-thumb-preview"
                          onError={(e) => { e.target.style.display = "none"; }}
                        />
                      </div>
                    )}
                  </>
                )}
                {thumbErrors[idx] && <span className="af-field-error">{thumbErrors[idx]}</span>}
              </div>

              <div className="af-form-row" style={{ marginBottom: 0 }}>
                <label className="label" htmlFor={`af-week-drive-${idx}`}>{t("adminFormations.videoDriveLabel")}</label>
                <input
                  id={`af-week-drive-${idx}`}
                  className="input"
                  placeholder="https://drive.google.com/file/d/..."
                  value={week.driveUrl}
                  onChange={updateWeek(idx, "driveUrl")}
                />
              </div>
            </div>
          ))}
        </div>

        <button type="button" className="af-video-add-btn" onClick={addWeek}>
          <FiPlus size={14} /> {t("adminFormations.addVideo")}
        </button>
      </fieldset>

      <div className="af-form-row">
        <label className="label" htmlFor="af-description">{t("profileEditor.description")}</label>
        <textarea id="af-description" className="input" rows={3} value={form.description} onChange={set("description")} />
      </div>

      <div className="modal-footer" style={{ padding: "16px 0 0", borderTop: "none" }}>
        <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={submitting}>
          {t("common.cancel")}
        </button>
        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting ? t("adminFormations.inProgress") : isEdit ? t("common.save") : t("adminFormations.create")}
        </button>
      </div>
    </form>
  );
}

/* ─── Page ────────────────────────────────────────────────────────────────── */
export default function AdminFormations() {
  const { t } = useTranslation();
  const [formations, setFormations] = useState([]);
  const [loading,     setLoading]   = useState(true);
  const [error,       setError]     = useState(false);

  const [formModal,  setFormModal]  = useState(null); // null | "create" | formation object
  const [submitting, setSubmitting] = useState(false);
  const [formError,  setFormError]  = useState("");

  const [deleteTarget, setDeleteTarget] = useState(null); // null | formation object
  const [deleting,     setDeleting]     = useState(false);
  const [deleteError,  setDeleteError]  = useState("");

  // Tri
  const [sortKey, setSortKey] = useState(null); // "title" | "level" | "price" | "duration" | null
  const [sortDir, setSortDir] = useState("asc");

  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(6);

  const loadFormations = useCallback(() => {
    formationsService.getAll()
      .then(({ data }) => { setFormations(data); setError(false); })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadFormations(); }, [loadFormations]);

  const toggleSort = (key) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
    setPage(1);
  };

  const sortValue = (f, key) => {
    if (key === "title")    return f.title || "";
    if (key === "level")    return f.level || "";
    if (key === "price")    return f.price?.onsite || "";
    if (key === "duration") return f.duration || "";
    return "";
  };

  const filteredSorted = useMemo(() => {
    let rows = formations;
    if (sortKey) {
      rows = [...rows].sort((a, b) => {
        const cmp = sortValue(a, sortKey).localeCompare(sortValue(b, sortKey), "fr", { sensitivity: "base" });
        return sortDir === "asc" ? cmp : -cmp;
      });
    }
    return rows;
  }, [formations, sortKey, sortDir]);

  const totalPages  = Math.max(1, Math.ceil(filteredSorted.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageItems   = filteredSorted.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const openCreate = () => { setFormError(""); setFormModal("create"); };
  const openEdit   = (formation) => { setFormError(""); setFormModal(formation); };
  const closeForm  = () => { if (!submitting) { setFormModal(null); setFormError(""); } };

  const handleFormSubmit = async (payload) => {
    setSubmitting(true);
    setFormError("");
    try {
      const { weeksData, supervisionData, trailerVideoUrl, trailerThumbnail, ...baseFields } = payload;
      let slug;
      if (formModal === "create") {
        const { data } = await formationsService.createFormation(baseFields);
        slug = data.slug;
      } else {
        await formationsService.updateFormation(formModal._id, baseFields);
        slug = formModal.slug;
        // Route dédiée (PATCH /:id/trailer) — updateFormation ne gère pas ces
        // champs. Non applicable à la création : pas encore de _id.
        await formationsService.updateTrailer(formModal._id, { trailerVideoUrl, trailerThumbnail });
      }
      await formationsService.updateWeeks(slug, weeksData);
      await formationsService.updateSupervision(slug, supervisionData);
      setFormModal(null);
      loadFormations();
    } catch (err) {
      setFormError(extractErrorMessage(err, t("adminFormations.errors.generic")));
    } finally {
      setSubmitting(false);
    }
  };

  const openDelete  = (formation) => { setDeleteError(""); setDeleteTarget(formation); };
  const closeDelete = () => { if (!deleting) { setDeleteTarget(null); setDeleteError(""); } };

  const confirmDelete = async () => {
    setDeleting(true);
    setDeleteError("");
    try {
      await formationsService.deleteFormation(deleteTarget._id);
      setDeleteTarget(null);
      loadFormations();
    } catch (err) {
      setDeleteError(extractErrorMessage(err, t("adminFormations.errors.deleteFailed")));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <DashboardLayout title={t("sidebar.admin.formations")} subtitle={t("adminFormations.pageSubtitle")}>
      <div className="sd-root">

        <div className="af-card">

          {/* ── Barre d'outils ─────────────────────────────────────────── */}
          <div className="af-toolbar">
            <h1 className="af-toolbar-title">{t("sidebar.admin.formations")}</h1>
            <div className="af-toolbar-actions">
              <div className="af-select-wrap">
                <label htmlFor="af-page-size">{t("adminFormations.display")}</label>
                <select
                  id="af-page-size"
                  className="af-select"
                  value={pageSize}
                  onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
                >
                  {PAGE_SIZES.map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>

              <ExportMenu
                onExportPDF={() => exportFormationsPDF(filteredSorted, t)}
                onExportCSV={() => exportFormationsCSV(filteredSorted, t)}
              />

              <button type="button" className="btn btn-primary" onClick={openCreate}>
                <FiPlus size={15} /> {t("adminFormations.newFormation")}
              </button>
            </div>
          </div>

          {/* ── Tableau ────────────────────────────────────────────────── */}
          {loading ? (
            <div className="sd-skeleton" style={{ height: 240, margin: "0 20px 20px" }} />
          ) : error ? (
            <div className="sd-empty-box">
              <p>{t("dashboardFormations.error")}</p>
            </div>
          ) : formations.length === 0 ? (
            <div className="sd-empty-box">
              <FiBookOpen size={28} style={{ opacity: .3 }} />
              <p>{t("adminFormations.emptyState")}</p>
              <button type="button" className="btn btn-primary" onClick={openCreate}>
                <FiPlus size={15} /> {t("adminFormations.createFirst")}
              </button>
            </div>
          ) : (
            <>
              <div className="af-table-wrap">
                <table className="af-table">
                  <thead>
                    <tr>
                      <th className="af-th-sortable" onClick={() => toggleSort("title")}>
                        {t("adminFormations.colFormation")} <SortIcon active={sortKey === "title"} dir={sortDir} />
                      </th>
                      <th className="af-th-sortable" onClick={() => toggleSort("level")}>
                        {t("formationDetail.level")} <SortIcon active={sortKey === "level"} dir={sortDir} />
                      </th>
                      <th>{t("formationDetail.mode")}</th>
                      <th className="af-th-sortable" onClick={() => toggleSort("price")}>
                        {t("adminFormations.colPrice")} <SortIcon active={sortKey === "price"} dir={sortDir} />
                      </th>
                      <th className="af-th-sortable" onClick={() => toggleSort("duration")}>
                        {t("formationDetail.duration")} <SortIcon active={sortKey === "duration"} dir={sortDir} />
                      </th>
                      <th>{t("adminFormations.colWeeks")}</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageItems.map((f) => (
                      <tr key={f._id}>
                        <td className="af-cell-title">
                          <div className="af-formation-cell">
                            {f.image
                              ? <img src={f.image} alt="" className="af-avatar" />
                              : (
                                <div className="af-avatar af-avatar--placeholder" style={{ background: avatarColor(f.title) }}>
                                  {f.title?.[0]?.toUpperCase() || "?"}
                                </div>
                              )}
                            <span className="af-formation-title-text">{f.title}</span>
                          </div>
                        </td>
                        <td>
                          {f.level
                            ? <span className={`badge ${levelBadgeClass(f.level)}`}>{f.level}</span>
                            : "—"}
                        </td>
                        <td>
                          <span className={`badge ${MODE_BADGE[f.mode] || "badge-primary"}`}>{MODE_LABEL_KEY[f.mode] ? t(MODE_LABEL_KEY[f.mode]) : f.mode}</span>
                        </td>
                        <td>{f.price?.onsite || "—"} / {f.price?.online || "—"}</td>
                        <td className="af-cell-duration" title={f.duration || ""}>{f.duration || "—"}</td>
                        <td>{f.weeks?.length ?? 0}</td>
                        <td>
                          <RowActionsMenu onEdit={() => openEdit(f)} onDelete={() => openDelete(f)} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* ── Pagination ─────────────────────────────────────────── */}
              <div className="af-pagination">
                <button
                  type="button"
                  className="af-page-nav"
                  disabled={currentPage === 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <FiChevronLeft size={14} /> {t("offers.previous")}
                </button>

                <div className="af-page-numbers">
                  {getPageNumbers(currentPage, totalPages).map((n, i) =>
                    n === "…"
                      ? <span key={`e${i}`} className="af-page-ellipsis">…</span>
                      : (
                        <button
                          key={n}
                          type="button"
                          className={`af-page-btn ${n === currentPage ? "af-page-btn--active" : ""}`}
                          onClick={() => setPage(n)}
                        >
                          {String(n).padStart(2, "0")}
                        </button>
                      )
                  )}
                </div>

                <button
                  type="button"
                  className="af-page-nav"
                  disabled={currentPage === totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  {t("offers.next")} <FiChevronRight size={14} />
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {formModal && (
        <Modal
          title={formModal === "create" ? t("adminFormations.newFormation") : t("adminFormations.editFormationTitle", { title: formModal.title })}
          onClose={closeForm}
          maxWidth={640}
        >
          <FormationForm
            initial={formModal === "create" ? EMPTY_FORM : formationToForm(formModal)}
            isEdit={formModal !== "create"}
            submitting={submitting}
            formError={formError}
            onSubmit={handleFormSubmit}
            onCancel={closeForm}
          />
        </Modal>
      )}

      {deleteTarget && (
        <Modal
          title={t("adminFormations.deleteFormationTitle")}
          onClose={closeDelete}
          maxWidth={460}
          footer={
            <>
              <button type="button" className="btn btn-ghost" onClick={closeDelete} disabled={deleting}>
                {t("common.cancel")}
              </button>
              <button type="button" className="btn btn-primary" style={{ background: "#EF4444" }} onClick={confirmDelete} disabled={deleting}>
                {deleting ? t("settings.danger.modal.confirming") : t("settings.danger.modal.confirm")}
              </button>
            </>
          }
        >
          <p>
            {t("adminFormations.confirmDeleteQuestion")} <strong>{deleteTarget.title}</strong> ?
            {" "}{t("adminFormations.irreversibleNotice")}
          </p>
          {deleteError && (
            <div className="af-form-error" style={{ marginTop: 14 }}>
              <FiAlertTriangle size={15} />
              <span>{deleteError}</span>
            </div>
          )}
        </Modal>
      )}
    </DashboardLayout>
  );
}
