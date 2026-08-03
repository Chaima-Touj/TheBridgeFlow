import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  FiPlus, FiBriefcase, FiAlertTriangle,
  FiMoreVertical, FiChevronUp, FiChevronDown, FiChevronLeft, FiChevronRight,
} from "react-icons/fi";
import DashboardLayout from "../../components/layout/DashboardLayout.jsx";
import Modal from "../../components/common/Modal.jsx";
import { offersService } from "../../services/offers.service.js";
import "./StudentDashboard.css";
import "./AdminFormations.css";
import "./AdminOffers.css";

const TYPES = ["stage", "PFE", "alternance", "formation", "vidéo"];

/* Les valeurs TYPES restent en français (valeur DB/enum) ; seul l'affichage est traduit */
const TYPE_LABEL_KEY = {
  "stage":      "adminOffers.typeStage",
  "PFE":        "adminOffers.typePFE",
  "alternance": "adminOffers.typeAlternance",
  "formation":  "adminOffers.typeFormation",
  "vidéo":      "adminOffers.typeVideo",
};

const TYPE_BADGE = {
  "stage":      "badge-primary",
  "PFE":        "badge-purple",
  "alternance": "badge-warning",
  "formation":  "badge-success",
  "vidéo":      "badge-danger",
};

const AVATAR_COLORS = ["#4F46E5", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#0EA5E9", "#EC4899"];
function avatarColor(name = "") {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

const PAGE_SIZES = [6, 10, 25, 50];

const EMPTY_FORM = {
  title: "",
  description: "",
  companyName: "",
  domain: "",
  location: "",
  duration: "",
  type: "stage",
  skills: "",
  salary: "",
  deadline: "",
};

function offerToForm(offer) {
  return {
    title:       offer.title || "",
    description: offer.description || "",
    companyName: offer.companyName || "",
    domain:      offer.domain || "",
    location:    offer.location || "",
    duration:    offer.duration || "",
    type:        offer.type || "stage",
    skills:      Array.isArray(offer.skills) ? offer.skills.join(", ") : "",
    salary:      offer.salary ? String(offer.salary) : "",
    deadline:    offer.deadline ? String(offer.deadline).slice(0, 10) : "",
  };
}

function extractErrorMessage(err, fallback) {
  return err?.response?.data?.message || fallback;
}

function formatDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("fr-FR");
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

/* ─── Icône de tri ────────────────────────────────────────────────────────── */
function SortIcon({ active, dir }) {
  return (
    <span className="af-sort-ico" aria-hidden="true">
      <FiChevronUp size={10} className={active && dir === "asc" ? "af-sort-ico--active" : ""} />
      <FiChevronDown size={10} className={active && dir === "desc" ? "af-sort-ico--active" : ""} />
    </span>
  );
}

/* ─── Menu d'actions par ligne ("•••" → Modifier / Activer-Désactiver / Supprimer) ─ */
function RowActionsMenu({ isActive, statusUpdating, onEdit, onToggleStatus, onDelete }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="af-row-menu" ref={ref}>
      <button type="button" className="af-icon-btn" onClick={() => setOpen((v) => !v)} aria-label={t("adminFormations.actionsAriaLabel")}>
        <FiMoreVertical size={16} />
      </button>
      {open && (
        <div className="af-row-menu-dropdown" role="menu">
          <button type="button" role="menuitem" onClick={() => { setOpen(false); onEdit(); }}>
            {t("adminFormations.editAction")}
          </button>
          <button type="button" role="menuitem" disabled={statusUpdating} onClick={() => { setOpen(false); onToggleStatus(); }}>
            {isActive ? t("adminUsers.deactivateAction") : t("adminUsers.activateAction")}
          </button>
          <button type="button" role="menuitem" className="af-row-menu-danger" onClick={() => { setOpen(false); onDelete(); }}>
            {t("notifications.deleteLabel")}
          </button>
        </div>
      )}
    </div>
  );
}

/* ─── Formulaire (création + édition) ────────────────────────────────────── */
function OfferForm({ initial, isEdit, submitting, formError, domainOptions, onSubmit, onCancel }) {
  const { t } = useTranslation();
  const [form, setForm] = useState(initial);
  const [fieldErrors, setFieldErrors] = useState({});

  const set = (key) => (e) => {
    setForm((f) => ({ ...f, [key]: e.target.value }));
  };

  const validate = () => {
    const errors = {};
    if (!form.title.trim())       errors.title       = t("adminOffers.errors.titleRequired");
    if (!form.description.trim()) errors.description = t("adminOffers.errors.descriptionRequired");
    if (!form.companyName.trim()) errors.companyName = t("adminOffers.errors.companyNameRequired");
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;
    onSubmit({
      title:       form.title.trim(),
      description: form.description.trim(),
      companyName: form.companyName.trim(),
      domain:      form.domain.trim(),
      location:    form.location.trim(),
      duration:    form.duration.trim(),
      type:        form.type,
      skills:      form.skills.split(",").map((s) => s.trim()).filter(Boolean),
      salary:      form.salary ? Number(form.salary) : 0,
      deadline:    form.deadline || undefined,
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
        <label className="label" htmlFor="ao-title">{t("adminOffers.titleLabel")}</label>
        <input id="ao-title" className="input" value={form.title} onChange={set("title")} />
        {fieldErrors.title && <span className="af-field-error">{fieldErrors.title}</span>}
      </div>

      <div className="af-form-row">
        <label className="label" htmlFor="ao-description">{t("adminOffers.descriptionLabel")}</label>
        <textarea id="ao-description" className="input" rows={3} value={form.description} onChange={set("description")} />
        {fieldErrors.description && <span className="af-field-error">{fieldErrors.description}</span>}
      </div>

      <div className="af-form-grid">
        <div className="af-form-row">
          <label className="label" htmlFor="ao-companyName">{t("adminOffers.companyNameLabel")}</label>
          <input id="ao-companyName" className="input" placeholder={t("adminOffers.companyNamePlaceholder")} value={form.companyName} onChange={set("companyName")} />
          {fieldErrors.companyName && <span className="af-field-error">{fieldErrors.companyName}</span>}
        </div>
        <div className="af-form-row">
          <label className="label" htmlFor="ao-domain">{t("adminOffers.domainLabel")}</label>
          <input id="ao-domain" className="input" list="ao-domain-options" placeholder={t("adminOffers.domainPlaceholder")} value={form.domain} onChange={set("domain")} />
          <datalist id="ao-domain-options">
            {domainOptions.map((d) => <option key={d} value={d} />)}
          </datalist>
        </div>
      </div>

      <div className="af-form-grid">
        <div className="af-form-row">
          <label className="label" htmlFor="ao-location">{t("adminOffers.locationLabel")}</label>
          <input id="ao-location" className="input" value={form.location} onChange={set("location")} />
        </div>
        <div className="af-form-row">
          <label className="label" htmlFor="ao-duration">{t("adminOffers.durationLabel")}</label>
          <input id="ao-duration" className="input" placeholder={t("adminOffers.durationPlaceholder")} value={form.duration} onChange={set("duration")} />
        </div>
      </div>

      <div className="af-form-grid">
        <div className="af-form-row">
          <label className="label" htmlFor="ao-type">{t("adminOffers.typeLabel")}</label>
          <select id="ao-type" className="input" value={form.type} onChange={set("type")}>
            {TYPES.map((tpe) => <option key={tpe} value={tpe}>{t(TYPE_LABEL_KEY[tpe])}</option>)}
          </select>
        </div>
        <div className="af-form-row">
          <label className="label" htmlFor="ao-salary">{t("adminOffers.salaryLabel")}</label>
          <input id="ao-salary" type="number" min="0" className="input" value={form.salary} onChange={set("salary")} />
        </div>
      </div>

      <div className="af-form-grid">
        <div className="af-form-row">
          <label className="label" htmlFor="ao-skills">{t("adminOffers.skillsLabel")}</label>
          <input id="ao-skills" className="input" placeholder={t("adminOffers.skillsPlaceholder")} value={form.skills} onChange={set("skills")} />
        </div>
        <div className="af-form-row">
          <label className="label" htmlFor="ao-deadline">{t("adminOffers.deadlineLabel")}</label>
          <input id="ao-deadline" type="date" className="input" value={form.deadline} onChange={set("deadline")} />
        </div>
      </div>

      <div className="modal-footer" style={{ padding: "16px 0 0", borderTop: "none" }}>
        <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={submitting}>
          {t("common.cancel")}
        </button>
        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting ? t("adminFormations.inProgress") : isEdit ? t("common.save") : t("adminOffers.create")}
        </button>
      </div>
    </form>
  );
}

/* ─── Page ────────────────────────────────────────────────────────────────── */
export default function AdminOffers() {
  const { t } = useTranslation();
  const [offers,  setOffers]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(false);

  // Filtres
  const [search,       setSearch]       = useState("");
  const [domainFilter, setDomainFilter] = useState("all");
  const [typeFilter,   setTypeFilter]   = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  // Tri
  const [sortKey, setSortKey] = useState(null); // "title" | "domain" | "type" | "deadline" | "status" | null
  const [sortDir, setSortDir] = useState("asc");

  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(6);

  const [formModal,  setFormModal]  = useState(null); // null | "create" | offer object
  const [submitting, setSubmitting] = useState(false);
  const [formError,  setFormError]  = useState("");

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting,     setDeleting]     = useState(false);
  const [deleteError,  setDeleteError]  = useState("");

  // Action inline (activer/désactiver)
  const [statusActionId, setStatusActionId] = useState(null);
  const [rowActionError, setRowActionError] = useState("");

  const loadOffers = useCallback(() => {
    offersService.getAllAdmin()
      .then(({ data }) => { setOffers(data.offers || []); setError(false); })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadOffers(); }, [loadOffers]);

  const domainOptions = useMemo(
    () => [...new Set(offers.map((o) => o.domain).filter(Boolean))].sort((a, b) => a.localeCompare(b, "fr")),
    [offers]
  );

  const toggleSort = (key) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
    setPage(1);
  };

  const sortValue = (o, key) => {
    if (key === "title")    return o.title || "";
    if (key === "domain")   return o.domain || "";
    if (key === "type")     return o.type || "";
    if (key === "deadline") return o.deadline || "";
    if (key === "status")   return o.isActive === false ? 0 : 1;
    return "";
  };

  const filteredSorted = useMemo(() => {
    let rows = offers;

    const q = search.trim().toLowerCase();
    if (q) {
      rows = rows.filter((o) =>
        (o.title || "").toLowerCase().includes(q) ||
        (o.companyName || "").toLowerCase().includes(q) ||
        (o.domain || "").toLowerCase().includes(q)
      );
    }
    if (domainFilter !== "all") rows = rows.filter((o) => o.domain === domainFilter);
    if (typeFilter !== "all")   rows = rows.filter((o) => o.type === typeFilter);
    if (statusFilter !== "all") {
      rows = rows.filter((o) => (statusFilter === "active" ? o.isActive !== false : o.isActive === false));
    }

    if (sortKey) {
      rows = [...rows].sort((a, b) => {
        const va = sortValue(a, sortKey);
        const vb = sortValue(b, sortKey);
        const cmp = typeof va === "number" && typeof vb === "number"
          ? va - vb
          : String(va).localeCompare(String(vb), "fr", { sensitivity: "base" });
        return sortDir === "asc" ? cmp : -cmp;
      });
    }
    return rows;
  }, [offers, search, domainFilter, typeFilter, statusFilter, sortKey, sortDir]);

  const totalPages  = Math.max(1, Math.ceil(filteredSorted.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageItems   = filteredSorted.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const openCreate = () => { setFormError(""); setFormModal("create"); };
  const openEdit   = (offer) => { setFormError(""); setFormModal(offer); };
  const closeForm  = () => { if (!submitting) { setFormModal(null); setFormError(""); } };

  const handleFormSubmit = async (payload) => {
    setSubmitting(true);
    setFormError("");
    try {
      if (formModal === "create") {
        const { data } = await offersService.create(payload);
        setOffers((prev) => [{ ...data.offer, applicationsCount: 0 }, ...prev]);
      } else {
        const { data } = await offersService.update(formModal._id, payload);
        setOffers((prev) => prev.map((o) => (o._id === formModal._id ? { ...o, ...data.offer } : o)));
      }
      setFormModal(null);
    } catch (err) {
      setFormError(extractErrorMessage(err, t("adminOffers.errors.generic")));
    } finally {
      setSubmitting(false);
    }
  };

  const openDelete  = (offer) => { setDeleteError(""); setDeleteTarget(offer); };
  const closeDelete = () => { if (!deleting) { setDeleteTarget(null); setDeleteError(""); } };

  const confirmDelete = async () => {
    setDeleting(true);
    setDeleteError("");
    try {
      await offersService.delete(deleteTarget._id);
      setOffers((prev) => prev.filter((o) => o._id !== deleteTarget._id));
      setDeleteTarget(null);
    } catch (err) {
      setDeleteError(extractErrorMessage(err, t("adminOffers.errors.deleteFailed")));
    } finally {
      setDeleting(false);
    }
  };

  /* ── Activer / désactiver (action directe, sans confirmation) ───────────── */
  const handleToggleStatus = async (offer) => {
    setRowActionError("");
    setStatusActionId(offer._id);
    try {
      const { data } = await offersService.updateStatus(offer._id, offer.isActive === false);
      setOffers((prev) => prev.map((o) => (o._id === offer._id ? { ...o, ...data.offer } : o)));
    } catch (err) {
      setRowActionError(extractErrorMessage(err, t("adminOffers.errors.statusUpdateFailed")));
    } finally {
      setStatusActionId(null);
    }
  };

  return (
    <DashboardLayout title={t("sidebar.admin.offers")} subtitle={t("adminOffers.pageSubtitle")}>
      <div className="sd-root">

        <div className="af-card">

          {/* ── Barre d'outils ─────────────────────────────────────────── */}
          <div className="af-toolbar ao-toolbar">
            <h1 className="af-toolbar-title">{t("sidebar.admin.offers")}</h1>
            <div className="af-toolbar-actions">
              <input
                type="search"
                className="input ao-search"
                placeholder={t("adminOffers.searchPlaceholder")}
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              />

              <select
                className="af-select"
                value={domainFilter}
                onChange={(e) => { setDomainFilter(e.target.value); setPage(1); }}
                aria-label={t("adminOffers.filterDomainAll")}
              >
                <option value="all">{t("adminOffers.filterDomainAll")}</option>
                {domainOptions.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>

              <select
                className="af-select"
                value={typeFilter}
                onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
                aria-label={t("adminOffers.filterTypeAll")}
              >
                <option value="all">{t("adminOffers.filterTypeAll")}</option>
                {TYPES.map((tpe) => <option key={tpe} value={tpe}>{t(TYPE_LABEL_KEY[tpe])}</option>)}
              </select>

              <select
                className="af-select"
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                aria-label={t("adminOffers.filterStatusAll")}
              >
                <option value="all">{t("adminOffers.filterStatusAll")}</option>
                <option value="active">{t("adminUsers.statusActive")}</option>
                <option value="inactive">{t("adminUsers.statusInactive")}</option>
              </select>

              <div className="af-select-wrap">
                <label htmlFor="ao-page-size">{t("adminFormations.display")}</label>
                <select
                  id="ao-page-size"
                  className="af-select"
                  value={pageSize}
                  onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
                >
                  {PAGE_SIZES.map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>

              <button type="button" className="btn btn-primary" onClick={openCreate}>
                <FiPlus size={15} /> {t("adminOffers.newOffer")}
              </button>
            </div>
          </div>

          {rowActionError && (
            <div className="af-form-error" style={{ margin: "0 20px 16px" }}>
              <FiAlertTriangle size={15} />
              <span>{rowActionError}</span>
            </div>
          )}

          {/* ── Tableau ────────────────────────────────────────────────── */}
          {loading ? (
            <div className="sd-skeleton" style={{ height: 240, margin: "0 20px 20px" }} />
          ) : error ? (
            <div className="sd-empty-box">
              <p>{t("adminOffers.errors.loadFailed")}</p>
            </div>
          ) : filteredSorted.length === 0 ? (
            <div className="sd-empty-box">
              <FiBriefcase size={28} style={{ opacity: .3 }} />
              <p>{t("adminOffers.emptyState")}</p>
              <button type="button" className="btn btn-primary" onClick={openCreate}>
                <FiPlus size={15} /> {t("adminOffers.createFirst")}
              </button>
            </div>
          ) : (
            <>
              <div className="af-table-wrap">
                <table className="af-table">
                  <thead>
                    <tr>
                      <th className="af-th-sortable" onClick={() => toggleSort("title")}>
                        {t("adminOffers.colOffer")} <SortIcon active={sortKey === "title"} dir={sortDir} />
                      </th>
                      <th className="af-th-sortable" onClick={() => toggleSort("domain")}>
                        {t("adminOffers.colDomain")} <SortIcon active={sortKey === "domain"} dir={sortDir} />
                      </th>
                      <th className="af-th-sortable" onClick={() => toggleSort("type")}>
                        {t("adminOffers.colType")} <SortIcon active={sortKey === "type"} dir={sortDir} />
                      </th>
                      <th>{t("adminOffers.colLocation")}</th>
                      <th className="af-th-sortable" onClick={() => toggleSort("deadline")}>
                        {t("adminOffers.colDeadline")} <SortIcon active={sortKey === "deadline"} dir={sortDir} />
                      </th>
                      <th className="af-th-sortable" onClick={() => toggleSort("status")}>
                        {t("adminOffers.colStatus")} <SortIcon active={sortKey === "status"} dir={sortDir} />
                      </th>
                      <th>{t("adminOffers.colApplications")}</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageItems.map((o) => (
                      <tr key={o._id}>
                        <td className="af-cell-title">
                          <div className="af-formation-cell">
                            <div className="af-avatar af-avatar--placeholder" style={{ background: avatarColor(o.companyName || o.title) }}>
                              {o.title?.[0]?.toUpperCase() || "?"}
                            </div>
                            <div className="au-user-cell">
                              <span className="af-formation-title-text">{o.title}</span>
                              <span className="au-user-email">{o.companyName || "—"}</span>
                            </div>
                          </div>
                        </td>
                        <td>{o.domain || "—"}</td>
                        <td>
                          <span className={`badge ${TYPE_BADGE[o.type] || "badge-primary"}`}>
                            {t(TYPE_LABEL_KEY[o.type] || o.type)}
                          </span>
                        </td>
                        <td>{o.location || "—"}</td>
                        <td>{formatDate(o.deadline)}</td>
                        <td>
                          <span className={`badge ${o.isActive === false ? "badge-danger" : "badge-success"}`}>
                            {o.isActive === false ? t("adminUsers.statusInactive") : t("adminUsers.statusActive")}
                          </span>
                        </td>
                        <td>{o.applicationsCount ?? 0}</td>
                        <td>
                          <RowActionsMenu
                            isActive={o.isActive !== false}
                            statusUpdating={statusActionId === o._id}
                            onEdit={() => openEdit(o)}
                            onToggleStatus={() => handleToggleStatus(o)}
                            onDelete={() => openDelete(o)}
                          />
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
          title={formModal === "create" ? t("adminOffers.newOffer") : t("adminOffers.editOfferTitle", { title: formModal.title })}
          onClose={closeForm}
          maxWidth={640}
        >
          <OfferForm
            initial={formModal === "create" ? EMPTY_FORM : offerToForm(formModal)}
            isEdit={formModal !== "create"}
            submitting={submitting}
            formError={formError}
            domainOptions={domainOptions}
            onSubmit={handleFormSubmit}
            onCancel={closeForm}
          />
        </Modal>
      )}

      {deleteTarget && (
        <Modal
          title={t("adminOffers.deleteOfferTitle")}
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
            {t("adminOffers.confirmDeleteQuestion")} <strong>{deleteTarget.title}</strong> ?
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
