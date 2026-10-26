import { useCallback, useEffect, useState } from "react";
import { FiChevronLeft, FiChevronRight, FiDownload, FiSearch, FiUsers } from "react-icons/fi";
import { useTranslation } from "react-i18next";
import DashboardLayout from "../../components/layout/DashboardLayout.jsx";
import { newsletterService } from "../../services/newsletter.service.js";
import { buildNewsletterSubscribersPdf } from "../../utils/exportNewsletterSubscribersPdf.js";
import "./StudentDashboard.css";
import "./AdminFormations.css";
import "./AdminNewsletter.css";

const PAGE_SIZE = 25;

export default function AdminNewsletter() {
  const { t, i18n } = useTranslation();
  const [subscribers, setSubscribers] = useState([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");

  const loadSubscribers = useCallback(() => {
    let active = true;
    newsletterService.getSubscribers({ page, limit: PAGE_SIZE, search })
      .then(({ data }) => {
        if (!active) return;
        setSubscribers(data.subscribers || []);
        setPages(data.pages || 1);
        setTotal(data.total || 0);
        setError("");
      })
      .catch((requestError) => {
        if (active) setError(requestError.response?.data?.message || t("adminNewsletter.loadError"));
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [page, search, t]);

  useEffect(() => loadSubscribers(), [loadSubscribers]);

  const exportPdf = async () => {
    if (exporting) return;
    setExporting(true);
    setError("");
    try {
      const all = [];
      let cursor = "";
      do {
        const { data } = await newsletterService.getSubscribers({
          limit: 250,
          cursor: cursor || "start",
        });
        all.push(...(data.subscribers || []));
        cursor = data.nextCursor || "";
      } while (cursor);
      buildNewsletterSubscribersPdf(all, t, i18n.language)
        .save("abonnes-newsletter-thebridgeflow.pdf");
    } catch (requestError) {
      setError(requestError.response?.data?.message || t("adminNewsletter.exportError"));
    } finally {
      setExporting(false);
    }
  };

  return (
    <DashboardLayout title={t("adminNewsletter.title")} subtitle={t("adminNewsletter.subtitle")}>
      <div className="sd-root">
        <div className="af-card">
          <div className="af-toolbar admin-newsletter__toolbar">
            <div>
              <h1 className="af-toolbar-title">{t("adminNewsletter.title")}</h1>
              <p>{t("adminNewsletter.total", { count: total })}</p>
            </div>
            <button className="btn btn-primary" type="button" onClick={exportPdf} disabled={exporting || loading}>
              <FiDownload size={16} />
              {exporting ? t("adminNewsletter.exporting") : t("adminNewsletter.export")}
            </button>
          </div>
          <div className="admin-newsletter__search">
            <FiSearch aria-hidden="true" />
            <input
              type="search"
              value={search}
              onChange={(event) => { setLoading(true); setSearch(event.target.value); setPage(1); }}
              placeholder={t("adminNewsletter.search")}
              aria-label={t("adminNewsletter.search")}
            />
          </div>
          {error && <p className="admin-newsletter__error" role="alert">{error}</p>}
          {loading ? <div className="sd-skeleton" style={{ height: 220 }} />
            : subscribers.length === 0
              ? <div className="sd-empty-box"><FiUsers size={28} /><p>{t("adminNewsletter.empty")}</p></div>
              : (
                <div className="af-table-wrap">
                  <table className="af-table">
                    <thead><tr><th>{t("adminNewsletter.email")}</th><th>{t("adminNewsletter.subscribedAt")}</th></tr></thead>
                    <tbody>{subscribers.map((subscriber) => (
                      <tr key={subscriber._id}>
                        <td>{subscriber.email}</td>
                        <td>{subscriber.subscribedAt ? new Date(subscriber.subscribedAt).toLocaleDateString(i18n.language) : "—"}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              )}
          <div className="admin-newsletter__pagination">
            <button type="button" className="btn btn-ghost" onClick={() => { setLoading(true); setPage((value) => Math.max(1, value - 1)); }} disabled={page <= 1 || loading}>
            <FiChevronLeft /> {t("adminNewsletter.previous")}
            </button>
            <span>{t("adminNewsletter.page", { page, pages })}</span>
            <button type="button" className="btn btn-ghost" onClick={() => { setLoading(true); setPage((value) => Math.min(pages, value + 1)); }} disabled={page >= pages || loading}>
              {t("adminNewsletter.next")} <FiChevronRight />
            </button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
