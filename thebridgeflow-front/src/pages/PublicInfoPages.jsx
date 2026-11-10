import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  FiArrowUpRight, FiFacebook, FiInstagram, FiLinkedin, FiMail, FiMapPin, FiPhone, FiSend,
} from "react-icons/fi";
import SiteNavbar from "../components/common/SiteNavbar.jsx";
import AboutSection from "../components/common/AboutSection.jsx";
import VideoTestimonialCarousel from "../components/common/VideoTestimonialCarousel.jsx";
import TestimonialsScreenshotCarousel from "../components/common/TestimonialsScreenshotCarousel.jsx";
import { settingsService } from "../services/settings.service.js";
import { feedbacksService } from "../services/feedbacks.service.js";
import { contactMessagesService } from "../services/contactMessages.service.js";
import { PHONE_NUMBER } from "../utils/phoneDisplay.jsx";
import { useDocumentMeta } from "../hooks/useDocumentMeta.js";
import { useRecaptchaCheckbox } from "../hooks/useRecaptchaCheckbox.jsx";
import "./PublicInfoPages.css";

export default function PublicInfoPage({ type }) {
  const { t } = useTranslation();
  const [videos, setVideos] = useState([]);
  const [screenshots, setScreenshots] = useState([]);
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const captcha = useRecaptchaCheckbox();
  const title = type === "about" ? t("landing.aboutTitle") : type === "testimonials" ? t("nav.testimonials") : t("landing.contactTitle");
  useDocumentMeta({ title: `${title} — TheBridgeFlow`, description: title });

  useEffect(() => {
    if (type !== "testimonials") return;
    settingsService.get().then(({ data }) => setVideos(data.testimonialVideos || [])).catch(() => setVideos([]));
    feedbacksService.getScreenshots().then(({ data }) => setScreenshots(data.map((item) => ({ id: item._id, src: item.imageUrl })))).catch(() => setScreenshots([]));
  }, [type]);

  const handleContact = async (event) => {
    event.preventDefault();
    if (captcha.missing) {
      setError(t("captcha.required"));
      return;
    }
    setSending(true); setError("");
    try {
      await contactMessagesService.submit(form, captcha.requestConfig);
      setSent(true);
      setForm({ name: "", email: "", subject: "", message: "" });
    } catch (submitError) {
      setError(submitError.response?.data?.message || t("landing.contactError"));
    } finally {
      setSending(false);
      captcha.reset();
    }
  };

  return <div className="public-info-page">
    <SiteNavbar />
    {type === "about" ? <AboutSection id="about-page" /> : <>
      <header className={`public-info-hero${type === "contact" ? " public-info-hero--contact" : ""}${type === "testimonials" ? " public-info-hero--testimonials" : ""}`}>
        <span>{type === "testimonials" ? title : t("landing.contactBadge")}</span>
        <h1>{title}</h1>
        {type === "contact" && <p>{t("landing.contactSub")}</p>}
      </header>
      <main className={`public-info-content${type === "testimonials" ? " public-info-content--testimonials" : ""}`}>
        {type === "testimonials" && <section className="pi-testimonials">
          {[["formation", t("landing.testiFormationTitle"), t("landing.testiFormationSub")], ["summer-camp", t("landing.testiSummerCampTitle"), t("landing.testiSummerCampSub")], ["pfe", t("landing.testiPfeTitle"), t("landing.testiPfeSub")]].map(([category, sectionTitle, subtitle]) => <VideoTestimonialCarousel key={category} sectionId={`public-testimonials-${category}`} items={videos.filter((item) => item.category === category).map((item) => ({ id: item._id, videoUrl: item.url, posterUrl: item.thumbnail, category }))} title={sectionTitle} subtitle={subtitle} ctaLabel={t("testimonials.ctaDefault")} ctaHref="/formations" />)}
          <TestimonialsScreenshotCarousel title={t("landing.screenshotTestiTitle")} subtitle={t("landing.screenshotTestiSub")} items={screenshots} />
        </section>}
        {type === "contact" && <section className="pi-contact">
          <aside className="pi-contact__details">
            <span className="pi-contact__eyebrow">{t("landing.contactBadge")}</span>
            <h2>TheBridgeFlow</h2>
            <p>{t("landing.contactSub")}</p>
            <div className="pi-contact__methods">
              <a href={`mailto:contact@9antra.tn`}><span><FiMail aria-hidden="true" /></span><span><strong>{t("profile.email")}</strong><small>contact@9antra.tn</small></span><FiArrowUpRight className="pi-contact__external" aria-hidden="true" /></a>
              <a href={`tel:${PHONE_NUMBER.replace(/\s/g, "")}`}><span><FiPhone aria-hidden="true" /></span><span><strong>{t("landing.contactPhone")}</strong><small dir="ltr">{PHONE_NUMBER}</small></span><FiArrowUpRight className="pi-contact__external" aria-hidden="true" /></a>
            </div>
            <div className="pi-contact__locations">
              <h3><FiMapPin aria-hidden="true" /> {t("landing.mapTitle")}</h3>
              {[
                { label: "FIQR Coworking Space", address: "24 Rue Mendes France, Ariana 2036", href: "https://maps.app.goo.gl/R4JBunHzfqFemjNX9" },
                { label: "Lac 1, Tunis", address: "Level 1", href: "https://maps.app.goo.gl/fapcW6wn8dZgZaFX9" },
                { label: "Sahloul, Sousse", address: "Rockets", href: "https://maps.app.goo.gl/YJY6vKBw1RJJ9XEo7" },
              ].map((location) => <a key={location.label} href={location.href} target="_blank" rel="noopener noreferrer">
                <span>{location.label}<small>{location.address}</small></span><FiArrowUpRight aria-hidden="true" />
              </a>)}
            </div>
            <div className="pi-contact__socials" aria-label="Social media">
              <a href="https://www.facebook.com/9antra.tn" target="_blank" rel="noopener noreferrer" aria-label="Facebook"><FiFacebook /></a>
              <a href="https://www.linkedin.com/company/9antra-tn-the-bridge/" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn"><FiLinkedin /></a>
              <a href="https://www.instagram.com/9antra.tn_the_bridge/" target="_blank" rel="noopener noreferrer" aria-label="Instagram"><FiInstagram /></a>
            </div>
          </aside>
          <div className="pi-contact__form-panel">
            <div className="pi-contact__form-heading">
              <span>{t("landing.contactBadge")}</span>
              <h2>{t("landing.contactSend")}</h2>
            </div>
            <form onSubmit={handleContact}>
              <div className="pi-form-row">
                <label>{t("landing.contactName")}<input required autoComplete="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={t("landing.contactName")} /></label>
                <label>{t("landing.contactEmail")}<input required type="email" autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder={t("landing.contactEmail")} /></label>
              </div>
              <label>{t("landing.contactSubject")}<input required value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder={t("landing.contactSubject")} /></label>
              <label>{t("landing.contactMessage")}<textarea required rows={6} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder={t("landing.contactMessage")} /></label>
              {sent && <p className="pi-contact__notice pi-contact__notice--success" role="status">{t("landing.contactSuccess")}</p>}
              {error && <p className="pi-contact__notice pi-contact__notice--error" role="alert">{error}</p>}
              {captcha.widget}
              <button className="btn btn-primary" type="submit" disabled={sending}>
                {sending ? t("landing.contactSending") : t("landing.contactSend")} <FiSend aria-hidden="true" />
              </button>
            </form>
          </div>
        </section>}
      </main>
    </>}
  </div>;
}
