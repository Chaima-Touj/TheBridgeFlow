import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowRight, BookOpen, Building2, CheckCircle2, Code2, FileText, Gift, GraduationCap, Lightbulb, Mail, MapPin, Monitor, Phone, Trophy, University, UserRound } from "lucide-react";
import Modal from "../components/common/Modal.jsx";
import SiteNavbar from "../components/common/SiteNavbar.jsx";
import VideoTestimonialCarousel from "../components/common/VideoTestimonialCarousel.jsx";
import { getFeaturedPfeTestimonials } from "../constants/testimonials.js";
import { getFormationImage } from "../constants/formationImages.js";
import { buildWhatsAppLink } from "../utils/whatsapp.js";
import { TbBrandWhatsapp } from "react-icons/tb";
import { formationsService } from "../services/formations.service.js";
import { pfePackService } from "../services/pfePack.service.js";
import { useRecaptchaCheckbox } from "../hooks/useRecaptchaCheckbox.jsx";
import "./PfePackPage.css";

const STEPS = [
  { key: "stepOne", Icon: Lightbulb },
  { key: "stepTwo", Icon: Code2 },
  { key: "stepThree", Icon: CheckCircle2 },
];

const FEATURED_TECHNOLOGIES = [
  "Mobile Development (Flutter + Node/Spring Boot)",
  "Full Stack Development (Spring Boot + Angular)",
  "Marketing Digital",
  "Business Intelligence (BI)",
  "Artificial Intelligence (AI Chatbot / Système de recommandation)",
  "Internet of Things (IoT)",
  "DevOps",
  "MERN Stack Development (React + Node)",
  "Cyber Security",
];

// « Autre » : plusieurs technologies séparées par un espace, une virgule, un point-virgule, / ou \.
function splitTechnologies(value) {
  return [...new Set(value.split(/[\s,;/\\]+/).map((item) => item.trim()).filter(Boolean))];
}

export default function PfePackPage() {
  const { t } = useTranslation();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    university: "",
    city: "",
    technologies: [],
    locationMode: "remote",
    preferredLocation: "",
    customLocation: "",
    consentConfirmed: false,
  });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [formations, setFormations] = useState([]);
  const [formationsError, setFormationsError] = useState(false);
  // Option « Autre » : l'étudiant écrit lui-même une technologie absente de la liste.
  const [otherTechSelected, setOtherTechSelected] = useState(false);
  const [otherTechnology, setOtherTechnology] = useState("");
  const captcha = useRecaptchaCheckbox();

  const technologyOptions = [...new Set([
    ...FEATURED_TECHNOLOGIES,
    ...formations.map((formation) => formation.title?.trim()).filter(Boolean),
  ])].sort((a, b) => a.localeCompare(b));
  const otherTechnologies = otherTechSelected ? splitTechnologies(otherTechnology) : [];
  const selectedTechnologyCount = new Set([...formData.technologies, ...otherTechnologies]).size;

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

  const toggleTechnology = (technology) => {
    setFormData((current) => ({
      ...current,
      technologies: current.technologies.includes(technology)
        ? current.technologies.filter((item) => item !== technology)
        : current.technologies.length < 20 ? [...current.technologies, technology] : current.technologies,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (otherTechSelected && otherTechnologies.length === 0) {
      setFormError(t("pfePack.otherTechnologyRequired"));
      return;
    }
    const technologies = [...new Set([...formData.technologies, ...otherTechnologies]
      .map((technology) => technology.trim())
      .filter(Boolean))];
    if (technologies.length < 2) {
      setFormError(t("pfePack.technologyRequired"));
      return;
    }
    if (!formData.consentConfirmed) {
      setFormError(t("pfePack.consentRequired"));
      return;
    }
    const preferredLocation = formData.locationMode === "remote"
      ? ""
      : formData.preferredLocation === "other"
        ? formData.customLocation.trim()
        : formData.preferredLocation;
    if (formData.locationMode === "onsite" && !preferredLocation) {
      setFormError(t("pfePack.locationRequired"));
      return;
    }
    if (captcha.missing) {
      setFormError(t("captcha.required"));
      return;
    }
    setSubmitting(true);
    setFormError("");
    try {
      await pfePackService.register({ ...formData, technologies, preferredLocation }, captcha.requestConfig);
      setSubmitted(true);
      setFormData({ firstName: "", lastName: "", phone: "", email: "", university: "", city: "", technologies: [], locationMode: "remote", preferredLocation: "", customLocation: "", consentConfirmed: false });
      setOtherTechSelected(false);
      setOtherTechnology("");
    } catch (error) {
      setFormError(error.response?.data?.message || t("pfePack.formError"));
    } finally {
      setSubmitting(false);
      captcha.reset();
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

      {isFormOpen && <Modal
        title={t("pfePack.formTitle")}
        onClose={() => setIsFormOpen(false)}
        maxWidth={640}
        className="pfe-form-modal"
        titleIcon={<span className="pfe-form-modal__title-icon" aria-hidden="true"><GraduationCap size={30} /></span>}
        headerContent={<span className="pfe-form-modal__badge"><Gift size={16} aria-hidden="true" />{t("pfePack.formBadge")}</span>}
      >
        {submitted ? <div className="pfe-form-success" role="status"><CheckCircle2 size={36} /><h3>{t("pfePack.successTitle")}</h3><p>{t("pfePack.successDescription")}</p></div>
          : <form className="pfe-form" onSubmit={handleSubmit}>
            <p className="pfe-form__notice"><span><CheckCircle2 size={17} aria-hidden="true" /></span>{t("pfePack.formNotice")}</p>
            {formError && <p className="pfe-form__error" role="alert">{formError}</p>}
            <div className="pfe-form__grid">
              <label><span><UserRound size={15} /> {t("pfePack.lastName")}</span><input name="lastName" value={formData.lastName} onChange={handleChange} maxLength={80} required autoComplete="family-name" placeholder={t("register.lastNamePlaceholder")} /></label>
              <label><span><UserRound size={15} /> {t("pfePack.firstName")}</span><input name="firstName" value={formData.firstName} onChange={handleChange} maxLength={80} required autoComplete="given-name" placeholder={t("register.firstNamePlaceholder")} /></label>
              <label><span><Phone size={15} /> {t("pfePack.phone")}</span><input name="phone" type="tel" value={formData.phone} onChange={handleChange} maxLength={32} required autoComplete="tel" placeholder={t("pfePack.phonePlaceholder")} /></label>
              <label><span><Mail size={15} /> {t("pfePack.email")}</span><input name="email" type="email" value={formData.email} onChange={handleChange} maxLength={254} required autoComplete="email" placeholder={t("register.emailPlaceholder")} /></label>
              <label><span><University size={15} /> {t("pfePack.university")}</span><input name="university" value={formData.university} onChange={handleChange} maxLength={160} required autoComplete="organization" placeholder={t("pfePack.universityPlaceholder")} /></label>
              <label><span><MapPin size={15} /> {t("pfePack.city")}</span><input name="city" value={formData.city} onChange={handleChange} maxLength={100} required autoComplete="address-level2" placeholder={t("pfePack.cityPlaceholder")} /></label>
              <div className="pfe-form__wide pfe-form__technology-field">
                <span className="pfe-form__field-label"><Code2 size={16} aria-hidden="true" /> {t("pfePack.technologies")}</span>
                <p className="pfe-form__tech-description">{t("pfePack.technologyInstructions")}</p>
                <div className="pfe-tech-picker__options" role="group" aria-label={t("pfePack.technologies")}>
                  {technologyOptions.map((technology) => {
                    const selected = formData.technologies.includes(technology);
                    return <button type="button" role="checkbox" aria-checked={selected} className={`pfe-tech-option${selected ? " is-selected" : ""}`} key={technology} onClick={() => toggleTechnology(technology)} disabled={!selected && formData.technologies.length >= 20}>
                      <span className="pfe-tech-option__check">{selected && <CheckCircle2 size={15} />}</span>{technology}
                    </button>;
                  })}
                  <button type="button" role="checkbox" aria-checked={otherTechSelected} aria-expanded={otherTechSelected} className={`pfe-tech-option pfe-tech-option--other${otherTechSelected ? " is-selected" : ""}`} onClick={() => setOtherTechSelected((selected) => !selected)}>
                    <span className="pfe-tech-option__check">{otherTechSelected && <CheckCircle2 size={15} />}</span>{t("pfePack.otherTechnology")}
                  </button>
                  {otherTechSelected && <input
                    className="pfe-tech-other-input"
                    value={otherTechnology}
                    onChange={(event) => setOtherTechnology(event.target.value)}
                    maxLength={160}
                    required
                    autoFocus
                    aria-label={t("pfePack.otherTechnology")}
                    aria-describedby="pfe-other-technology-hint"
                    placeholder={t("pfePack.otherTechnologyPlaceholder")}
                  />}
                  {otherTechSelected && <p className="pfe-tech-other-hint" id="pfe-other-technology-hint">{t("pfePack.otherTechnologyHint")}</p>}
                  {otherTechnologies.length > 0 && <div className="pfe-tech-other-chips" aria-live="polite">
                    {otherTechnologies.map((technology) => <span key={technology}>{technology}</span>)}
                  </div>}
                </div>
                <span className={`pfe-form__field-hint${selectedTechnologyCount < 2 ? " is-required" : ""}`}>{t("pfePack.technologyMinimum", { count: selectedTechnologyCount })}</span>
                {formationsError && <span className="pfe-form__offers-status" role="status">{t("pfePack.technologiesLoadError")}</span>}
              </div>
              <div className="pfe-form__wide pfe-location-field">
                <span className="pfe-form__field-label"><MapPin size={16} aria-hidden="true" /> {t("pfePack.locationHeading")}</span>
                <div className="pfe-location-options">
                  <button type="button" className={`pfe-location-card${formData.locationMode === "remote" ? " is-selected" : ""}`} onClick={() => setFormData((current) => ({ ...current, locationMode: "remote", preferredLocation: "", customLocation: "" }))}>
                    <Monitor size={22} aria-hidden="true" /><span><strong>{t("pfePack.remote")}</strong><small>{t("pfePack.remoteDescription")}</small></span>
                  </button>
                  <div className={`pfe-location-card pfe-location-card--onsite${formData.locationMode === "onsite" ? " is-selected" : ""}`}>
                    <Building2 size={22} aria-hidden="true" />
                    <span><strong>{t("pfePack.onsite")}</strong><small>{t("pfePack.onsiteDescription")}</small></span>
                    <select aria-label={t("pfePack.chooseLocation")} value={formData.preferredLocation === "other" ? "other" : formData.preferredLocation} onChange={(event) => setFormData((current) => ({ ...current, locationMode: "onsite", preferredLocation: event.target.value, customLocation: event.target.value === "other" ? current.customLocation : "" }))}>
                      <option value="">{t("pfePack.chooseLocation")}</option>
                      <option value={t("pfePack.locationLac1")}>{t("pfePack.locationLac1")}</option>
                      <option value={t("pfePack.locationSahloul")}>{t("pfePack.locationSahloul")}</option>
                      <option value={t("pfePack.locationFirq")}>{t("pfePack.locationFirq")}</option>
                      <option value="other">{t("pfePack.locationOther")}</option>
                    </select>
                  </div>
                </div>
                {formData.locationMode === "onsite" && formData.preferredLocation === "other" && <input className="pfe-location-custom" value={formData.customLocation} onChange={(event) => setFormData((current) => ({ ...current, customLocation: event.target.value }))} maxLength={200} required placeholder={t("pfePack.customLocationPlaceholder")} />}
              </div>
            </div>
            <label className="pfe-form__consent">
              <input
                type="checkbox"
                name="consentConfirmed"
                checked={formData.consentConfirmed}
                onChange={(event) => setFormData((current) => ({ ...current, consentConfirmed: event.target.checked }))}
                required
              />
              <span>{t("pfePack.consentConfirmation")} <strong className="pfe-form__required-mark" aria-hidden="true">*</strong></span>
            </label>
            {captcha.widget}
            <div className="pfe-form__actions">
              <button type="button" className="pfe-button pfe-button--secondary" onClick={() => setIsFormOpen(false)}>{t("common.cancel")}</button>
              <button type="submit" className="pfe-button pfe-button--primary" disabled={submitting}>{submitting ? t("pfePack.submitting") : t("pfePack.submit")}</button>
            </div>
          </form>}
      </Modal>}
    </main>
  );
}
