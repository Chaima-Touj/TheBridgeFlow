import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { FiCalendar, FiPlus, FiUsers } from "react-icons/fi";
import DashboardLayout from "../../components/layout/DashboardLayout.jsx";
import Modal from "../../components/common/Modal.jsx";
import { eventsService } from "../../services/events.service.js";
import "./StudentDashboard.css";
import "./AdminFormations.css";
import "../Events.css";

const emptyForm = {
  title: "", description: "", image: "", category: "", startsAt: "", endsAt: "",
  timezone: "Africa/Tunis", mode: "onsite", location: "", meetingUrl: "",
  capacity: "", registrationRequired: true, status: "draft",
};

function localDateValue(value) {
  if (!value) return "";
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function formatDate(value, language, timezone) {
  return value ? new Intl.DateTimeFormat(language, { dateStyle: "medium", timeStyle: "short", timeZone: timezone || "Africa/Tunis" }).format(new Date(value)) : "—";
}

export default function AdminEvents() {
  const { t, i18n } = useTranslation();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [participants, setParticipants] = useState(null);

  const load = useCallback(() => {
    eventsService.getAdmin()
      .then(({ data }) => { setEvents(data.events || []); setError(""); })
      .catch((err) => setError(err.response?.data?.message || t("events.loadError")))
      .finally(() => setLoading(false));
  }, [t]);
  useEffect(() => { load(); }, [load]);

  const openForm = (event) => {
    setError("");
    setForm(event ? {
      ...emptyForm,
      ...event,
      startsAt: localDateValue(event.startsAt),
      endsAt: localDateValue(event.endsAt),
      capacity: event.capacity ?? "",
    } : emptyForm);
    setModal(event || "create");
  };

  const updateField = (key) => (e) => {
    const value = e.target.type === "checkbox" ? e.target.checked : e.target.value;
    setForm((previous) => ({
      ...previous,
      [key]: value,
      ...(key === "mode" && value === "onsite" ? { meetingUrl: "" } : {}),
      ...(key === "mode" && value === "online" ? { location: "" } : {}),
    }));
  };

  const submit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    const payload = {
      ...form,
      startsAt: new Date(form.startsAt).toISOString(),
      endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : null,
      capacity: form.capacity === "" ? null : Number(form.capacity),
    };
    try {
      if (modal === "create") await eventsService.create(payload);
      else await eventsService.update(modal._id, payload);
      setModal(null);
      load();
    } catch (err) {
      setError(err.response?.data?.message || t("events.actionError"));
    } finally {
      setSubmitting(false);
    }
  };

  const setStatus = async (event, status) => {
    setError("");
    try {
      await eventsService.update(event._id, { status });
      load();
    } catch (err) {
      setError(err.response?.data?.message || t("events.actionError"));
    }
  };

  const showParticipants = async (event) => {
    setError("");
    try {
      const { data } = await eventsService.getRegistrations(event._id);
      setParticipants({ event, rows: data.registrations || [] });
    } catch (err) {
      setError(err.response?.data?.message || t("events.loadError"));
    }
  };

  return (
    <DashboardLayout title={t("events.adminTitle")} subtitle={t("events.adminSubtitle")}>
      <div className="sd-root">
        <div className="af-card">
          <div className="af-toolbar">
            <h1 className="af-toolbar-title">{t("events.adminTitle")}</h1>
            <button className="btn btn-primary" type="button" onClick={() => openForm(null)}><FiPlus size={16} />{t("events.create")}</button>
          </div>
          {error && <p className="ev-form-error" role="alert">{error}</p>}
          {loading ? <div className="sd-skeleton" style={{ height: 220 }} />
            : events.length === 0 ? <div className="sd-empty-box"><FiCalendar size={28} /><p>{t("events.adminEmpty")}</p></div>
              : <div className="af-table-wrap"><table className="af-table">
                <thead><tr><th>{t("events.titleField")}</th><th>{t("events.date")}</th><th>{t("events.status")}</th><th>{t("events.participants")}</th><th /></tr></thead>
                <tbody>{events.map((event) => (
                  <tr key={event._id}>
                    <td className="af-cell-title">{event.title}<small className="ev-admin-category">{event.category}</small></td>
                    <td>{formatDate(event.startsAt, i18n.language, event.timezone)}</td>
                    <td><span className={`badge ${event.status === "published" ? "badge-success" : event.status === "cancelled" ? "badge-danger" : "badge-warning"}`}>{t(`events.statuses.${event.status}`)}</span></td>
                    <td>{t("events.participantsCount", { count: event.registrationCount })}{event.capacity !== null ? ` / ${event.capacity}` : ""}</td>
                    <td><div className="ev-admin-actions">
                      <button className="btn btn-ghost" type="button" onClick={() => openForm(event)}>{t("events.edit")}</button>
                      <button className="btn btn-ghost" type="button" onClick={() => showParticipants(event)} aria-label={t("events.viewParticipants")}><FiUsers size={16} /></button>
                      {event.status === "draft" && <button className="btn btn-primary" type="button" onClick={() => setStatus(event, "published")}>{t("events.publish")}</button>}
                      {event.status === "published" && <button className="btn btn-ghost" type="button" onClick={() => setStatus(event, "cancelled")}>{t("events.cancelEvent")}</button>}
                      {event.status !== "archived" && (event.status !== "published" || new Date(event.startsAt) <= new Date()) && <button className="btn btn-ghost" type="button" onClick={() => setStatus(event, "archived")}>{t("events.archive")}</button>}
                    </div></td>
                  </tr>
                ))}</tbody>
              </table></div>}
        </div>
      </div>

      {modal && <Modal title={modal === "create" ? t("events.create") : t("events.edit")} onClose={() => !submitting && setModal(null)} maxWidth={700}>
        <form className="ev-form" onSubmit={submit}>
          <label>{t("events.titleField")}<input required maxLength={160} value={form.title} onChange={updateField("title")} /></label>
          <label>{t("events.descriptionField")}<textarea required maxLength={10000} rows={4} value={form.description} onChange={updateField("description")} /></label>
          <label>{t("events.category")}<input required maxLength={80} value={form.category} onChange={updateField("category")} /></label>
          <label>{t("events.imageUrl")}<input type="url" value={form.image} onChange={updateField("image")} placeholder="https://" /></label>
          <div className="ev-form-grid">
            <label>{t("events.startDate")}<input type="datetime-local" required value={form.startsAt} onChange={updateField("startsAt")} /></label>
            <label>{t("events.endDate")}<input type="datetime-local" value={form.endsAt} onChange={updateField("endsAt")} /></label>
          </div>
          <div className="ev-form-grid">
            <label>{t("events.mode")}<select value={form.mode} onChange={updateField("mode")}><option value="onsite">{t("events.modes.onsite")}</option><option value="online">{t("events.modes.online")}</option><option value="hybrid">{t("events.modes.hybrid")}</option></select></label>
            <label>{t("events.timezone")}<input required readOnly value={form.timezone} onChange={updateField("timezone")} /></label>
          </div>
          {form.mode !== "online" && <label>{t("events.location")}<input required value={form.location} onChange={updateField("location")} /></label>}
          {form.mode !== "onsite" && <label>{t("events.meetingUrl")}<input required type="url" value={form.meetingUrl} onChange={updateField("meetingUrl")} placeholder="https://" /></label>}
          <div className="ev-form-grid">
            <label>{t("events.capacity")}<input type="number" min="1" value={form.capacity} onChange={updateField("capacity")} placeholder={t("events.unlimited")} /></label>
            <label>{t("events.status")}<select value={form.status} onChange={updateField("status")}>{(modal === "create" || modal.status !== "published") && <option value="draft">{t("events.statuses.draft")}</option>}<option value="published">{t("events.statuses.published")}</option><option value="cancelled">{t("events.statuses.cancelled")}</option><option value="archived">{t("events.statuses.archived")}</option></select></label>
          </div>
          <label className="ev-checkbox"><input type="checkbox" checked={form.registrationRequired} onChange={updateField("registrationRequired")} />{t("events.registrationRequired")}</label>
          {error && <p className="ev-form-error" role="alert">{error}</p>}
          <div className="modal-footer"><button type="button" className="btn btn-ghost" onClick={() => setModal(null)} disabled={submitting}>{t("common.cancel")}</button><button type="submit" className="btn btn-primary" disabled={submitting}>{submitting ? t("events.working") : t("common.save")}</button></div>
        </form>
      </Modal>}

      {participants && <Modal title={t("events.participantsFor", { title: participants.event.title, count: participants.rows.length })} onClose={() => setParticipants(null)} maxWidth={620}>
        {participants.rows.length === 0 ? <p>{t("events.noParticipants")}</p> : <div className="ev-participants">{participants.rows.map(({ _id, student, createdAt, status }) => <div key={_id}><strong>{student?.name}</strong><span>{student?.email}</span><small>{t("events.participantDate")}: {formatDate(createdAt, i18n.language, participants.event.timezone)}</small><small>{t("events.participantStatus")}: {t(`events.registrationStatuses.${status}`)}</small></div>)}</div>}
      </Modal>}
    </DashboardLayout>
  );
}
