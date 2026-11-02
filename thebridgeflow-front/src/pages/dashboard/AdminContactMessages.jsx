import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { FiMail, FiRefreshCw } from "react-icons/fi";
import DashboardLayout from "../../components/layout/DashboardLayout.jsx";
import { contactMessagesService } from "../../services/contactMessages.service.js";
import "./AdminContactMessages.css";

export default function AdminContactMessages() {
  const { t, i18n } = useTranslation();
  const [items, setItems] = useState([]);
  const [activeId, setActiveId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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
  const dateLocale = i18n.language === "ar" ? "ar-TN" : i18n.language === "en" ? "en-GB" : "fr-FR";

  return (
    <DashboardLayout title={t("adminContactMessages.title")} subtitle={t("adminContactMessages.subtitle")}>
      <div className="acm-page">
        <div className="acm-toolbar">
          <span>{t("adminContactMessages.count", { count: items.length })}</span>
          <button type="button" className="btn btn-ghost" onClick={loadMessages} disabled={loading}>
            <FiRefreshCw aria-hidden="true" /> {t("adminContactMessages.refresh")}
          </button>
        </div>
        {error && <p className="acm-error" role="alert">{error}</p>}
        {loading ? <p className="acm-empty">{t("adminContactMessages.loading")}</p>
          : items.length === 0 ? <p className="acm-empty">{t("adminContactMessages.empty")}</p>
            : (
              <div className="acm-layout">
                <div className="acm-list" aria-label={t("adminContactMessages.title")}>
                  {items.map((message) => (
                    <button key={message._id} type="button" className={`acm-item${message._id === activeId ? " is-active" : ""}${message.isRead ? "" : " is-unread"}`} onClick={() => openMessage(message)}>
                      <span className="acm-item__top"><strong>{message.name}</strong><time>{new Date(message.createdAt).toLocaleDateString(dateLocale)}</time></span>
                      <span className="acm-item__subject">{message.subject}</span>
                      <span className="acm-item__preview">{message.message}</span>
                    </button>
                  ))}
                </div>
                {active && (
                  <article className="acm-detail">
                    <div className="acm-detail__heading">
                      <div><span className="acm-detail__eyebrow">{t("adminContactMessages.from")}</span><h2>{active.subject}</h2></div>
                      <FiMail size={22} aria-hidden="true" />
                    </div>
                    <div className="acm-detail__meta">
                      <strong>{active.name}</strong>
                      <a href={`mailto:${active.email}`}>{active.email}</a>
                      <time>{new Date(active.createdAt).toLocaleString(dateLocale)}</time>
                    </div>
                    <p className="acm-detail__body">{active.message}</p>
                  </article>
                )}
              </div>
            )}
      </div>
    </DashboardLayout>
  );
}
