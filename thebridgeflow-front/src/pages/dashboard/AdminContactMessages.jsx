import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { FiArrowUpRight, FiInbox, FiMail, FiRefreshCw, FiSearch, FiUser } from "react-icons/fi";
import DashboardLayout from "../../components/layout/DashboardLayout.jsx";
import { contactMessagesService } from "../../services/contactMessages.service.js";
import "./AdminContactMessages.css";

export default function AdminContactMessages() {
  const { t, i18n } = useTranslation();
  const [items, setItems] = useState([]);
  const [activeId, setActiveId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const loadMessages = useCallback(() => {
    setLoading(true);
    contactMessagesService.getAll()
      .then(({ data }) => {
        const messages = data.submissions || [];
        setItems(messages);
        setActiveId((current) => messages.some((message) => message._id === current) ? current : messages[0]?._id || "");
        setError("");
      })
      .catch((requestError) => setError(requestError.response?.data?.message || t("adminContactMessages.loadError")))
      .finally(() => setLoading(false));
  }, [t]);

  useEffect(() => { loadMessages(); }, [loadMessages]);

  const openMessage = async (message) => {
    setActiveId(message._id);
    if (message.isRead) return;
    setItems((current) => current.map((item) => item._id === message._id ? { ...item, isRead: true } : item));
    try {
      await contactMessagesService.markRead(message._id);
    } catch {
      setItems((current) => current.map((item) => item._id === message._id ? { ...item, isRead: false } : item));
    }
  };

  const active = items.find((message) => message._id === activeId);
  const filteredItems = items.filter((message) => [message.name, message.email, message.subject, message.message]
    .some((value) => String(value || "").toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())));
  const unreadCount = items.filter((message) => !message.isRead).length;
  const dateLocale = i18n.language === "ar" ? "ar-TN" : i18n.language === "en" ? "en-GB" : "fr-FR";

  return (
    <DashboardLayout title={t("adminContactMessages.title")} subtitle={t("adminContactMessages.subtitle")}>
      <div className="acm-page">
        <div className="acm-toolbar">
          <div className="acm-summary">
            <span className="acm-summary__icon"><FiInbox aria-hidden="true" /></span>
            <div><strong>{t("adminContactMessages.count", { count: items.length })}</strong><span>{t("adminContactMessages.unread", { count: unreadCount })}</span></div>
          </div>
          <button type="button" className="btn btn-ghost" onClick={loadMessages} disabled={loading}>
            <FiRefreshCw aria-hidden="true" /> {t("adminContactMessages.refresh")}
          </button>
        </div>
        {error && <p className="acm-error" role="alert">{error}</p>}
        {loading ? <p className="acm-empty">{t("adminContactMessages.loading")}</p>
          : items.length === 0 ? <p className="acm-empty">{t("adminContactMessages.empty")}</p>
            : (
              <div className="acm-layout">
                <aside className="acm-sidebar">
                  <label className="acm-search"><FiSearch aria-hidden="true" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("adminContactMessages.search")} /></label>
                  <div className="acm-list" aria-label={t("adminContactMessages.title")}>
                    {filteredItems.length ? filteredItems.map((message) => (
                      <button key={message._id} type="button" className={`acm-item${message._id === activeId ? " is-active" : ""}${message.isRead ? "" : " is-unread"}`} onClick={() => openMessage(message)}>
                        <span className="acm-item__avatar">{(message.name || message.email || "?").trim().charAt(0).toUpperCase()}</span>
                        <span className="acm-item__content">
                          <span className="acm-item__top"><strong>{message.name || t("adminContactMessages.unknownSender")}</strong><time>{new Date(message.createdAt).toLocaleDateString(dateLocale)}</time></span>
                          <span className="acm-item__subject">{message.subject || t("adminContactMessages.noSubject")}</span>
                          <span className="acm-item__preview">{message.message}</span>
                        </span>
                      </button>
                    )) : <p className="acm-list__empty">{t("adminContactMessages.noResults")}</p>}
                  </div>
                </aside>
                {active && (
                  <article className="acm-detail">
                    <div className="acm-detail__heading">
                      <div><span className="acm-detail__eyebrow">{t("adminContactMessages.messageDetails")}</span><h2>{active.subject || t("adminContactMessages.noSubject")}</h2></div>
                      <span className="acm-detail__icon"><FiMail aria-hidden="true" /></span>
                    </div>
                    <div className="acm-detail__meta">
                      <span className="acm-detail__sender-avatar">{(active.name || active.email || "?").trim().charAt(0).toUpperCase()}</span>
                      <div className="acm-detail__sender"><strong><FiUser aria-hidden="true" /> {active.name || t("adminContactMessages.unknownSender")}</strong><a href={`mailto:${active.email}`}>{active.email}</a></div>
                      <time>{new Date(active.createdAt).toLocaleString(dateLocale)}</time>
                    </div>
                    <div className="acm-detail__body-wrap"><span>{t("adminContactMessages.messageLabel")}</span><p className="acm-detail__body">{active.message}</p></div>
                    <a className="acm-reply" href={`mailto:${active.email}?subject=${encodeURIComponent(`${t("adminContactMessages.replyPrefix")} ${active.subject || ""}`)}`}><FiArrowUpRight aria-hidden="true" /> {t("adminContactMessages.reply")}</a>
                  </article>
                )}
              </div>
            )}
      </div>
    </DashboardLayout>
  );
}
