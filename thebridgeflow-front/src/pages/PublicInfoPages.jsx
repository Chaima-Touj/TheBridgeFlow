import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import SiteNavbar from "../components/common/SiteNavbar.jsx";
import VideoTestimonialCarousel from "../components/common/VideoTestimonialCarousel.jsx";
import TestimonialsScreenshotCarousel from "../components/common/TestimonialsScreenshotCarousel.jsx";
import { settingsService } from "../services/settings.service.js";
import { feedbacksService } from "../services/feedbacks.service.js";
import { contactMessagesService } from "../services/contactMessages.service.js";
import { useDocumentMeta } from "../hooks/useDocumentMeta.js";
import "./PublicInfoPages.css";

export default function PublicInfoPage({ type }) {
  const { t } = useTranslation();
  const [videos, setVideos] = useState([]);
  const [screenshots, setScreenshots] = useState([]);
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const title = type === "about" ? t("landing.aboutTitle") : type === "testimonials" ? t("nav.testimonials") : t("landing.contactTitle");
  useDocumentMeta({ title: `${title} — TheBridgeFlow`, description: title });

  useEffect(() => {
    if (type !== "testimonials") return;
    settingsService.get().then(({ data }) => setVideos(data.testimonialVideos || [])).catch(() => setVideos([]));
    feedbacksService.getScreenshots().then(({ data }) => setScreenshots(data.map((item) => ({ id: item._id, src: item.imageUrl })))).catch(() => setScreenshots([]));
  }, [type]);

  const handleContact = async (event) => {
    event.preventDefault();
    setSending(true); setError("");
    try {
      await contactMessagesService.submit(form);
      setSent(true);
      setForm({ name: "", email: "", subject: "", message: "" });
    } catch (submitError) {
      setError(submitError.response?.data?.message || t("landing.contactError"));
    } finally { setSending(false); }
  };

  return <div className="public-info-page"><SiteNavbar />
    <header className="public-info-hero"><span>{type === "about" ? t("landing.aboutBadge") : title}</span><h1>{title}</h1></header>
    <main className="public-info-content">
      {type === "about" && <section className="pi-about">
        <div><p>{t("landing.aboutSub")}</p><Link className="btn btn-primary" to="/formations">{t("landing.viewAllFormations")}</Link></div>
        <div className="pi-about-grid">{[1, 2, 3, 4].map((n) => <article key={n}><h2>{t(`landing.aboutCard${n}Title`)}</h2><p>{t(`landing.aboutCard${n}Desc`)}</p></article>)}</div>
        <div className="pi-pillar-grid"><article><h2>{t("landing.missionLabel")}</h2><p>{t("landing.missionText")}</p></article><article><h2>{t("landing.visionLabel")}</h2><p>{t("landing.visionText")}</p></article></div>
      </section>}
      {type === "testimonials" && <section className="pi-testimonials">
        {[["formation", t("landing.testiFormationTitle"), t("landing.testiFormationSub")], ["summer-camp", t("landing.testiSummerCampTitle"), t("landing.testiSummerCampSub")], ["pfe", t("landing.testiPfeTitle"), t("landing.testiPfeSub")]].map(([category, sectionTitle, subtitle]) => <VideoTestimonialCarousel key={category} sectionId={`public-testimonials-${category}`} items={videos.filter((item) => item.category === category).map((item) => ({ id: item._id, videoUrl: item.url, posterUrl: item.thumbnail, category }))} title={sectionTitle} subtitle={subtitle} ctaLabel={t("testimonials.ctaDefault")} ctaHref="/formations" />)}
        <TestimonialsScreenshotCarousel title={t("landing.screenshotTestiTitle")} subtitle={t("landing.screenshotTestiSub")} items={screenshots} />
      </section>}
      {type === "contact" && <section className="pi-contact">
        <div><span className="pi-eyebrow">{t("landing.contactBadge")}</span><h2>{t("landing.contactTitle")}</h2><p>{t("landing.contactSub")}</p></div>
        <form onSubmit={handleContact}>
          <div className="pi-form-row"><input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={t("landing.contactName")} /><input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder={t("landing.contactEmail")} /></div>
          <input required value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder={t("landing.contactSubject")} />
          <textarea required rows={6} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder={t("landing.contactMessage")} />
          {sent && <p role="status">{t("landing.contactSuccess")}</p>}{error && <p role="alert">{error}</p>}
          <button className="btn btn-primary" type="submit" disabled={sending}>{sending ? t("landing.contactSending") : t("landing.contactSend")}</button>
        </form>
      </section>}
  </main>
  </div>;
}
