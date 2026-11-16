import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { FileText, Eye, Download, ExternalLink, FileX2, LoaderCircle, FolderOpen } from "lucide-react";
import Modal from "../../../../components/common/Modal.jsx";
import { ICON_STROKE, toneClass } from "../candidatesConfig.js";
import EmptyState from "../shared/EmptyState.jsx";

const GROUPS = [
  { key: "profile", match: (doc) => doc.source === "profile" },
  { key: "applicationCv", match: (doc) => doc.source === "application" && doc.kind === "cv" },
  { key: "coverLetters", match: (doc) => doc.kind === "coverLetter" },
];

export function DocumentRow({ doc, busy, onPreview, onDownload, compact = false }) {
  const { t } = useTranslation();
  const tdoc = (key, options) => t(`adminCandidates.dossier.documents.${key}`, options);
  const extension = (doc.extension || "").toUpperCase();
  const previewing = busy === `${doc.key}:preview`;
  const downloading = busy === `${doc.key}:download`;
  return (
    <div className={`cnd-dos-doc ${compact ? "cnd-dos-doc--compact" : ""} ${!doc.available && !doc.externalUrl ? "cnd-dos-doc--missing" : ""}`}>
      <span className={`cnd-dos-doc__icon ${toneClass(doc.available ? (doc.extension === "pdf" ? "rose" : "blue") : "slate")}`} aria-hidden="true">
        {doc.available || doc.externalUrl ? <FileText size={18} strokeWidth={ICON_STROKE} /> : <FileX2 size={18} strokeWidth={ICON_STROKE} />}
        {extension && <span className="cnd-dos-doc__ext">{extension}</span>}
      </span>
      <span className="cnd-dos-doc__text">
        <strong title={doc.fileName}>{doc.fileName}</strong>
        <small>
          {doc.offerTitle ? tdoc("forOffer", { offer: doc.offerTitle }) : tdoc(`source.${doc.source}`)}
          {!doc.available && (doc.externalUrl ? ` · ${tdoc("externalFile")}` : ` · ${tdoc("missingFile")}`)}
        </small>
      </span>
      <span className="cnd-dos-doc__actions">
        {doc.available ? (
          <>
            <button type="button" className="cnd-btn cnd-btn--secondary cnd-btn--sm" onClick={() => onPreview(doc)} disabled={Boolean(busy)} aria-label={tdoc("previewAria", { name: doc.fileName })}>
              {previewing ? <LoaderCircle className="cnd-spin" size={14} strokeWidth={ICON_STROKE} aria-hidden="true" /> : <Eye size={14} strokeWidth={ICON_STROKE} aria-hidden="true" />}
              {!compact && <span>{tdoc("preview")}</span>}
            </button>
            <button type="button" className="cnd-btn cnd-btn--ghost cnd-btn--sm cnd-btn--icon" onClick={() => onDownload(doc)} disabled={Boolean(busy)} aria-label={tdoc("downloadAria", { name: doc.fileName })} title={tdoc("download")}>
              {downloading ? <LoaderCircle className="cnd-spin" size={14} strokeWidth={ICON_STROKE} aria-hidden="true" /> : <Download size={14} strokeWidth={ICON_STROKE} aria-hidden="true" />}
            </button>
          </>
        ) : doc.externalUrl ? (
          <a className="cnd-btn cnd-btn--secondary cnd-btn--sm" href={doc.externalUrl} target="_blank" rel="noopener noreferrer">
            <ExternalLink size={14} strokeWidth={ICON_STROKE} aria-hidden="true" />
            {!compact && <span>{tdoc("openLink")}</span>}
          </a>
        ) : null}
      </span>
    </div>
  );
}

export default function DocumentsPanel({ documents, busy, onPreview, onDownload }) {
  const { t } = useTranslation();
  const tdoc = (key, options) => t(`adminCandidates.dossier.documents.${key}`, options);
  if (!documents.length) {
    return <EmptyState icon={FolderOpen} title={tdoc("emptyTitle")} description={tdoc("emptyText")} />;
  }
  return (
    <div className="cnd-dos-docs">
      {GROUPS.map(({ key, match }, index) => {
        const items = documents.filter(match);
        if (!items.length) return null;
        return (
          <motion.section
            key={key}
            className="cnd-card cnd-dos-docs__group"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.24, delay: index * 0.05 }}
          >
            <h3>{tdoc(`group.${key}`)} <span className="cnd-num">{items.length}</span></h3>
            <div className="cnd-dos-docs__list">
              {items.map((doc) => <DocumentRow key={doc.key} doc={doc} busy={busy} onPreview={onPreview} onDownload={onDownload} />)}
            </div>
          </motion.section>
        );
      })}
    </div>
  );
}

export function DocumentPreviewModal({ preview, busy, onClose, onDownload }) {
  const { t } = useTranslation();
  const tdoc = (key, options) => t(`adminCandidates.dossier.documents.${key}`, options);
  const { doc, url, unsupported } = preview;
  return (
    <Modal
      title={doc.fileName}
      titleIcon={<FileText size={18} strokeWidth={ICON_STROKE} className="cnd-dos-modal-icon" aria-hidden="true" />}
      onClose={onClose}
      maxWidth={unsupported ? 520 : 980}
      className="cnd-scope cnd-dos-preview-modal"
      footer={(
        <>
          {url && (
            <a className="cnd-btn cnd-btn--ghost" href={url} target="_blank" rel="noopener noreferrer">
              <ExternalLink size={15} strokeWidth={ICON_STROKE} aria-hidden="true" />
              {tdoc("openTab")}
            </a>
          )}
          <button type="button" className="cnd-btn cnd-btn--primary" onClick={() => onDownload(doc)} disabled={Boolean(busy)}>
            {busy === `${doc.key}:download` ? <LoaderCircle className="cnd-spin" size={15} strokeWidth={ICON_STROKE} aria-hidden="true" /> : <Download size={15} strokeWidth={ICON_STROKE} aria-hidden="true" />}
            {tdoc("download")}
          </button>
        </>
      )}
    >
      {unsupported ? (
        <EmptyState icon={FileText} title={tdoc("noPreviewTitle")} description={tdoc("noPreviewText", { ext: (doc.extension || "").toUpperCase() })} />
      ) : (
        <iframe className="cnd-dos-preview-frame" src={url} title={tdoc("previewFrame", { name: doc.fileName })} />
      )}
    </Modal>
  );
}
