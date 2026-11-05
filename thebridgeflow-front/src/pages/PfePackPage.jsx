import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowRight, BookOpen, CheckCircle2, Code2, FileText, Lightbulb, Mail, Phone, Trophy } from "lucide-react";
import Modal from "../components/common/Modal.jsx";
import SiteNavbar from "../components/common/SiteNavbar.jsx";
import VideoTestimonialCarousel from "../components/common/VideoTestimonialCarousel.jsx";
import { getFeaturedPfeTestimonials } from "../constants/testimonials.js";
import { getFormationImage } from "../constants/formationImages.js";
import { buildWhatsAppLink } from "../utils/whatsapp.js";
import { TbBrandWhatsapp } from "react-icons/tb";
import { formationsService } from "../services/formations.service.js";
import { pfePackService } from "../services/pfePack.service.js";
import "./PfePackPage.css";

const STEPS = [
  { key: "stepOne", Icon: Lightbulb },
  { key: "stepTwo", Icon: Code2 },
  { key: "stepThree", Icon: CheckCircle2 },
];

export default function PfePackPage() {
  const { t } = useTranslation();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    technologies: "",
    subject: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [formations, setFormations] = useState([]);
  const [formationsError, setFormationsError] = useState(false);

  useEffect(() => {
    let active = true;
    formationsService.getAll()
      .then(({ data }) => {
        if (active) setFormations(Array.isArray(data) ? data : []);
      })
      .catch((error) => {
        console.error("Failed to load trainings for the Pack PFE page", error);
        if (active) setFormationsError(true);
      });
    return () => { active = false; };
  }, []);

  const openForm = () => {
    setFormError("");
    setSubmitted(false);
    setIsFormOpen(true);
  };

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((current) => ({ ...current, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setFormError("");
    const technologies = formData.technologies.split(/[,;\n]/).map((technology) => technology.trim()).filter(Boolean);
    try {
      await pfePackService.register({ ...formData, technologies });
      setSubmitted(true);
      setFormData({ firstName: "", lastName: "", phone: "", email: "", technologies: "", subject: "" });
    } catch (error) {
      setFormError(error.response?.data?.message || t("pfePack.formError"));
    } finally {
      setSubmitting(false);
    }
  };

  const testimonials = getFeaturedPfeTestimonials();

  return (
    <main className="pfe-page">
      <SiteNavbar />
      <section className="pfe-hero">
        <div className="pfe-container pfe-hero__grid">
          <div className="pfe-hero__content">
            <span className="pfe-eyebrow"><Code2 size={16} aria-hidden="true" /> {t("pfePack.eyebrow")}</span>
            <h1>{t("pfePack.heroTitle")}</h1>
            <p>{t("pfePack.heroDescription")}</p>
            <div className="pfe-hero__actions">
              <button type="button" className="pfe-button pfe-button--primary" onClick={openForm}>
                {t("pfePack.register")} <ArrowRight size={18} aria-hidden="true" />
              </button>
              <a className="pfe-button pfe-button--secondary" href="#pfe-testimonials">
                {t("pfePack.watchTestimonials")}
              </a>
            </div>
            <p className="pfe-hero__notice"><CheckCircle2 size={17} aria-hidden="true" /> {t("pfePack.independentNotice")}</p>
          </div>
          <div className="pfe-hero__visual" aria-hidden="true">
            <div className="pfe-code-card">
              <div className="pfe-code-card__header">
                <div className="pfe-code-card__dots"><i /><i /><i /></div>
                <div className="pfe-code-card__tab"><span>JS</span> PFE.js</div>
              </div>
              <div className="pfe-code-card__code">
                <p><span className="pfe-code-card__number">01</span><span className="pfe-code-card__comment">// THEBRIDGEFLOW / PACK PFE</span></p>
                <p><span className="pfe-code-card__number">02</span></p>
                <p><span className="pfe-code-card__number">03</span><span className="pfe-code-card__line"><b>if</b> (hasSujetPFE) &#123;</span></p>
                <p><span className="pfe-code-card__number">04</span><span className="pfe-code-card__line pfe-code-card__line--indent">console.log(<em><FileText /> {t("pfePack.codeSuccess")}</em>);</span></p>
                <p><span className="pfe-code-card__number">05</span><span className="pfe-code-card__line pfe-code-card__line--indent">console.log(<strong><Trophy /> {t("pfePack.codeExcellent")}</strong>);</span></p>
                <p><span className="pfe-code-card__number">06</span><span className="pfe-code-card__line">&#125; <b>else</b> <i>// {t("pfePack.codeNoTopic")}</i></span></p>
                <p><span className="pfe-code-card__number">07</span><span className="pfe-code-card__line pfe-code-card__line--indent">console.log(<em><FileText /> {t("pfePack.codeSuccess")}</em>);</span></p>
                <p><span className="pfe-code-card__number">08</span><span className="pfe-code-card__line pfe-code-card__line--indent">console.log(<strong><Trophy /> {t("pfePack.codeExcellent")}</strong>);</span></p>
                <p><span className="pfe-code-card__number">09</span><span className="pfe-code-card__line">&#125;</span></p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="pfe-section pfe-about">
        <div className="pfe-container">
          <div className="pfe-section__heading">
            <span className="pfe-eyebrow">{t("pfePack.aboutEyebrow")}</span>
            <h2>{t("pfePack.aboutTitle")}</h2>
            <p>{t("pfePack.aboutDescription")}</p>
          </div>
          <div className="pfe-steps">
            {STEPS.map(({ key, Icon }, index) => (
              <article className="pfe-step" key={key}>
                <span className="pfe-step__number">0{index + 1}</span>
                <span className="pfe-step__icon"><Icon size={22} aria-hidden="true" /></span>
                <h3>{t(`pfePack.${key}Title`)}</h3>
                <p>{t(`pfePack.${key}Description`)}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="pfe-section pfe-testimonials" id="pfe-testimonials">
        <div className="pfe-container">
          <div className="pfe-section__heading">
            <span className="pfe-eyebrow">{t("pfePack.testimonialsEyebrow")}</span>
            <h2>{t("pfePack.testimonialsTitle")}</h2>
            <p>{t("pfePack.testimonialsDescription")}</p>
          </div>
          <VideoTestimonialCarousel
            items={testimonials}
            hideHeader
            ctaLabel={t("pfePack.moreTestimonials")}
            ctaHref="/testimonials"
          />
        </div>
      </section>

      <section className="pfe-section pfe-trainings">
        <div className="pfe-container">
          <div className="pfe-section__heading">
            <span className="pfe-eyebrow"><BookOpen size={16} aria-hidden="true" /> {t("pfePack.trainingsEyebrow")}</span>
            <h2>{t("pfePack.trainingsTitle")}</h2>
            <p>{t("pfePack.trainingsDescription")}</p>
          </div>
          {formationsError ? <p className="pfe-inline-error">{t("pfePack.trainingsError")}</p>
            : formations.length === 0 ? <p className="pfe-inline-empty">{t("pfePack.trainingsEmpty")}</p>
              : <div className="pfe-training-grid">{formations.slice(0, 6).map((formation) => {
                const image = getFormationImage(formation.slug);
                return (
                  <article className="pfe-training-card" key={formation._id || formation.slug}>
                    <div className="pfe-training-card__media">
                      {image
                        ? <img src={image} alt="" loading="lazy" decoding="async" width="800" height="500" />
                        : <span className="pfe-training-card__fallback"><BookOpen size={28} aria-hidden="true" /></span>}
                    </div>
                    <div className="pfe-training-card__body">
                      <h3>{formation.title}</h3>
                      <p>{formation.description}</p>
                      {formation.slug && <Link to={`/formations/${formation.slug}`}>{t("pfePack.discoverTraining")} <ArrowRight size={16} aria-hidden="true" /></Link>}
                    </div>
                  </article>
                );
              })}</div>}
        </div>
      </section>

      <section className="pfe-cta">
        <div className="pfe-container pfe-cta__inner">
          <div><span className="pfe-eyebrow">{t("pfePack.ctaEyebrow")}</span><h2>{t("pfePack.ctaTitle")}</h2><p>{t("pfePack.ctaDescription")}</p></div>
          <button type="button" className="pfe-button pfe-button--light" onClick={openForm}>{t("pfePack.register")} <ArrowRight size={18} /></button>
        </div>
      </section>

      <a
        className="pfe-whatsapp-float"
        href={buildWhatsAppLink(t("pfePack.whatsappPrefill"))}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={t("pfePack.whatsappLabel")}
        title={t("pfePack.whatsappLabel")}
      >
        <TbBrandWhatsapp size={30} aria-hidden="true" />
      </a>

      {isFormOpen && <Modal title={t("pfePack.formTitle")} onClose={() => setIsFormOpen(false)} maxWidth={620} className="pfe-form-modal">
        {submitted ? <div className="pfe-form-success" role="status"><CheckCircle2 size={36} /><h3>{t("pfePack.successTitle")}</h3><p>{t("pfePack.successDescription")}</p></div>
          : <form className="pfe-form" onSubmit={handleSubmit}>
            <p className="pfe-form__notice">{t("pfePack.formNotice")}</p>
            {formError && <p className="pfe-form__error" role="alert">{formError}</p>}
            <div className="pfe-form__grid">
              <label>{t("pfePack.firstName")}<input name="firstName" value={formData.firstName} onChange={handleChange} maxLength={80} required autoComplete="given-name" /></label>
              <label>{t("pfePack.lastName")}<input name="lastName" value={formData.lastName} onChange={handleChange} maxLength={80} required autoComplete="family-name" /></label>
              <label><span><Phone size={15} /> {t("pfePack.phone")}</span><input name="phone" type="tel" value={formData.phone} onChange={handleChange} maxLength={32} required autoComplete="tel" /></label>
              <label><span><Mail size={15} /> {t("pfePack.email")}</span><input name="email" type="email" value={formData.email} onChange={handleChange} maxLength={254} required autoComplete="email" /></label>
              <label className="pfe-form__wide">{t("pfePack.technologies")}<textarea name="technologies" value={formData.technologies} onChange={handleChange} rows={2} maxLength={1200} required placeholder={t("pfePack.technologiesHint")} /></label>
              <label className="pfe-form__wide">{t("pfePack.subject")}<textarea name="subject" value={formData.subject} onChange={handleChange} rows={4} maxLength={3000} required /></label>
            </div>
            <div className="pfe-form__actions">
              <button type="button" className="pfe-button pfe-button--secondary" onClick={() => setIsFormOpen(false)}>{t("common.cancel")}</button>
              <button type="submit" className="pfe-button pfe-button--primary" disabled={submitting}>{submitting ? t("pfePack.submitting") : t("pfePack.submit")}</button>
            </div>
          </form>}
      </Modal>}
    </main>
  );
}
