import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowRight, BookOpen, Building2, CheckCircle2, Code2, FileText, Gift, GraduationCap, Lightbulb, Mail, MapPin, Monitor, Phone, Trophy, University, UserRound } from "lucide-react";
import Modal from "../components/common/Modal.jsx";
import SiteNavbar from "../components/common/SiteNavbar.jsx";
import VideoTestimonialCarousel from "../components/common/VideoTestimonialCarousel.jsx";
import { DEFAULT_PROGRAM, PROGRAM_PAGES } from "../constants/programPages.js";
import { getFormationImage } from "../constants/formationImages.js";
import { buildWhatsAppLink } from "../utils/whatsapp.js";
import { TbBrandWhatsapp } from "react-icons/tb";
import { formationsService } from "../services/formations.service.js";
import { pfePackService } from "../services/pfePack.service.js";
import { settingsService } from "../services/settings.service.js";
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

// Vidéo de SiteSettings.testimonialVideos → format attendu par VideoTestimonialCarousel (même mapping que LandingPage).
const toTestimonialItem = (video) => ({ id: video._id, videoUrl: video.url, posterUrl: video.thumbnail, category: video.category });
const getFallbackTestimonials = (config) => config.testimonialGroups.flatMap((group) => group.fallback());

// Page publique d'un programme : « pfe-pack » (/pack-pfe) ou « summer-camp » (/summer-camp).
// Les routes passent une `key` différente par programme pour repartir d'un état vierge.
export default function PfePackPage({ program = DEFAULT_PROGRAM }) {
  const { t } = useTranslation();
  const programId = PROGRAM_PAGES[program] ? program : DEFAULT_PROGRAM;
  const config = PROGRAM_PAGES[programId];
  // Textes propres au programme (pfePack.* ou summerCamp.*) ; les libellés du formulaire restent partagés dans pfePack.*.
  const pt = (key) => t(`${config.textNamespace}.${key}`);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    university: "",
    city: "",
    technologies: [],
    // Aucun mode présélectionné : l'étudiant choisit « À distance » ou « Présentiel ».
    locationMode: "",
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
  // Témoignages vidéo : `null` tant que la liste gérée par l'admin n'a pas répondu.
  const [testimonialItems, setTestimonialItems] = useState(() => (config.adminTestimonials ? null : getFallbackTestimonials(config)));
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
        console.error(`Failed to load trainings for the ${programId} page`, error);
        if (active) setFormationsError(true);
      });
    return () => { active = false; };
  }, [programId]);

  // Même source que la page d'accueil (vidéos gérées depuis le dashboard admin) ;
  // les vidéos fixes de constants/testimonials.js ne servent qu'en cas d'échec de la requête.
  useEffect(() => {
    if (!config.adminTestimonials) return undefined;
    let active = true;
    settingsService.get()
      .then(({ data }) => {
        if (active) setTestimonialItems(Array.isArray(data?.testimonialVideos) ? data.testimonialVideos.map(toTestimonialItem) : []);
      })
      .catch((error) => {
        console.error(`Failed to load testimonial videos for the ${programId} page`, error);
        if (active) setTestimonialItems(getFallbackTestimonials(config));
      });
    return () => { active = false; };
  }, [config, programId]);

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
    // Une seule technologie suffit (Pack PFE comme Summer Camp).
    if (technologies.length < 1) {
      setFormError(t("pfePack.technologyRequired"));
      return;
    }
    if (formData.locationMode !== "remote" && formData.locationMode !== "onsite") {
      setFormError(t("pfePack.locationModeRequired"));
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
    if (!formData.consentConfirmed) {
      setFormError(t("pfePack.consentRequired"));
      return;
    }
    if (captcha.missing) {
      setFormError(t("captcha.required"));
      return;
    }
    setSubmitting(true);
    setFormError("");
    try {
      await pfePackService.register({ ...formData, technologies, preferredLocation, program: programId }, captcha.requestConfig);
      setSubmitted(true);
      setFormData({ firstName: "", lastName: "", phone: "", email: "", university: "", city: "", technologies: [], locationMode: "", preferredLocation: "", customLocation: "", consentConfirmed: false });
      setOtherTechSelected(false);
      setOtherTechnology("");
    } catch (error) {
      setFormError(error.response?.data?.message || t("pfePack.formError"));
    } finally {
      setSubmitting(false);
      captcha.reset();
    }
  };

  // Un carrousel par groupe ; un groupe sans vidéo n'est pas affiché.
  const testimonialsLoading = testimonialItems === null;
  const testimonialGroups = testimonialsLoading ? [] : config.testimonialGroups
    .map((group) => ({ ...group, items: testimonialItems.filter((item) => item.category === group.category) }))
    .filter((group) => group.items.length > 0);
  const hasTestimonials = testimonialsLoading || testimonialGroups.length > 0;

  return (
    <main className="pfe-page">
      <SiteNavbar />
      <section className="pfe-hero">
        <div className="pfe-container pfe-hero__grid">
          <div className="pfe-hero__content">
            <span className="pfe-eyebrow"><Code2 size={16} aria-hidden="true" /> {pt("eyebrow")}</span>
            <h1>{pt("heroTitle")}</h1>
            <p>{pt("heroDescription")}</p>
            <div className="pfe-hero__actions">
              <button type="button" className="pfe-button pfe-button--primary" onClick={openForm}>
                {t("pfePack.register")} <ArrowRight size={18} aria-hidden="true" />
              </button>
              {hasTestimonials && <a className="pfe-button pfe-button--secondary" href={`#${config.testimonialsId}`}>
                {t("pfePack.watchTestimonials")}
              </a>}
            </div>
            <p className="pfe-hero__notice"><CheckCircle2 size={17} aria-hidden="true" /> {t("pfePack.independentNotice")}</p>
          </div>
          <div className="pfe-hero__visual" aria-hidden="true">
            <div className="pfe-code-card">
              <div className="pfe-code-card__header">
                <div className="pfe-code-card__dots"><i /><i /><i /></div>
                <div className="pfe-code-card__tab"><span>JS</span> {config.code.file}</div>
              </div>
              <div className="pfe-code-card__code">
                <p><span className="pfe-code-card__number">01</span><span className="pfe-code-card__comment">// {config.code.banner}</span></p>
                <p><span className="pfe-code-card__number">02</span></p>
                <p><span className="pfe-code-card__number">03</span><span className="pfe-code-card__line"><b>if</b> ({config.code.condition}) &#123;</span></p>
                <p><span className="pfe-code-card__number">04</span><span className="pfe-code-card__line pfe-code-card__line--indent">console.log(<em><FileText /> {pt("codeSuccess")}</em>);</span></p>
                <p><span className="pfe-code-card__number">05</span><span className="pfe-code-card__line pfe-code-card__line--indent">console.log(<strong><Trophy /> {pt("codeExcellent")}</strong>);</span></p>
                <p><span className="pfe-code-card__number">06</span><span className="pfe-code-card__line">&#125; <b>else</b> <i>// {pt("codeNoTopic")}</i></span></p>
                <p><span className="pfe-code-card__number">07</span><span className="pfe-code-card__line pfe-code-card__line--indent">console.log(<em><FileText /> {pt("codeSuccess")}</em>);</span></p>
                <p><span className="pfe-code-card__number">08</span><span className="pfe-code-card__line pfe-code-card__line--indent">console.log(<strong><Trophy /> {pt("codeExcellent")}</strong>);</span></p>
                <p><span className="pfe-code-card__number">09</span><span className="pfe-code-card__line">&#125;</span></p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="pfe-section pfe-about">
        <div className="pfe-container">
          <div className="pfe-section__heading">
            <h2>{pt("aboutTitle")}</h2>
            <p>{pt("aboutDescription")}</p>
          </div>
          <div className="pfe-steps">
            {STEPS.map(({ key, Icon }, index) => (
              <article className="pfe-step" key={key}>
                <span className="pfe-step__number">0{index + 1}</span>
                <span className="pfe-step__icon"><Icon size={22} aria-hidden="true" /></span>
                <h3>{pt(`${key}Title`)}</h3>
                <p>{pt(`${key}Description`)}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {hasTestimonials && <section className="pfe-section pfe-testimonials" id={config.testimonialsId} aria-busy={testimonialsLoading}>
        <div className="pfe-container">
          {testimonialsLoading
            ? <div className="pfe-testimonials__loading" role="status">
              <span className="pfe-sr-only">{t("common.loading")}</span>
              {[0, 1, 2, 3].map((index) => <span className="pfe-testimonials__placeholder" key={index} aria-hidden="true" />)}
            </div>
            : testimonialGroups.map((group, index) => (
              <div className="pfe-testimonials__group" key={group.category}>
                <div className="pfe-section__heading">
                  <h2>{t(group.titleKey)}</h2>
                  <p>{t(group.subtitleKey)}</p>
                </div>
                <VideoTestimonialCarousel
                  items={group.items}
                  hideHeader
                  // Un seul lien « Tous les témoignages », sous le dernier carrousel.
                  ctaLabel={t("pfePack.moreTestimonials")}
                  ctaHref={index === testimonialGroups.length - 1 ? "/testimonials" : undefined}
                />
              </div>
            ))}
        </div>
      </section>}

      <section className="pfe-section pfe-trainings">
        <div className="pfe-container">
          <div className="pfe-section__heading">
            <h2>{t("pfePack.trainingsTitle")}</h2>
            <p>{pt("trainingsDescription")}</p>
          </div>
          {formationsError ? <p className="pfe-inline-error">{t("pfePack.trainingsError")}</p>
            : formations.length === 0 ? <p className="pfe-inline-empty">{t("pfePack.trainingsEmpty")}</p>
              : <div className="pfe-training-grid">{formations.map((formation) => {
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
          <div><h2>{pt("ctaTitle")}</h2><p>{pt("ctaDescription")}</p></div>
          <button type="button" className="pfe-button pfe-button--light" onClick={openForm}>{t("pfePack.register")} <ArrowRight size={18} aria-hidden="true" /></button>
        </div>
      </section>

      <a
        className="pfe-whatsapp-float"
        href={buildWhatsAppLink(pt("whatsappPrefill"))}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={t("pfePack.whatsappLabel")}
        title={t("pfePack.whatsappLabel")}
      >
        <TbBrandWhatsapp size={30} aria-hidden="true" />
      </a>

      {isFormOpen && <Modal
        title={pt("formTitle")}
        onClose={() => setIsFormOpen(false)}
        maxWidth={640}
        className="pfe-form-modal"
        titleIcon={<span className="pfe-form-modal__title-icon" aria-hidden="true"><GraduationCap size={30} /></span>}
        headerContent={<span className="pfe-form-modal__badge"><Gift size={16} aria-hidden="true" />{t("pfePack.formBadge")}</span>}
      >
        {submitted ? <div className="pfe-form-success" role="status"><CheckCircle2 size={36} /><h3>{t("pfePack.successTitle")}</h3><p>{pt("successDescription")}</p></div>
          : <form className="pfe-form" onSubmit={handleSubmit}>
            <p className="pfe-form__notice"><span><CheckCircle2 size={17} aria-hidden="true" /></span>{pt("formNotice")}</p>
            {formError && <p className="pfe-form__error" role="alert">{formError}</p>}
            <div className="pfe-form__grid">
              <label><span><UserRound size={15} /> {t("pfePack.lastName")}</span><input name="lastName" value={formData.lastName} onChange={handleChange} maxLength={80} required autoComplete="family-name" placeholder={t("pfePack.placeholders.lastName")} /></label>
              <label><span><UserRound size={15} /> {t("pfePack.firstName")}</span><input name="firstName" value={formData.firstName} onChange={handleChange} maxLength={80} required autoComplete="given-name" placeholder={t("pfePack.placeholders.firstName")} /></label>
              <label><span><Phone size={15} /> {t("pfePack.phone")}</span><input name="phone" type="tel" value={formData.phone} onChange={handleChange} maxLength={32} required autoComplete="tel" placeholder={t("pfePack.placeholders.phone")} /></label>
              <label><span><Mail size={15} /> {t("pfePack.email")}</span><input name="email" type="email" value={formData.email} onChange={handleChange} maxLength={254} required autoComplete="email" placeholder={t("pfePack.placeholders.email")} /></label>
              <label><span><University size={15} /> {t("pfePack.university")}</span><input name="university" value={formData.university} onChange={handleChange} maxLength={160} required autoComplete="organization" placeholder={t("pfePack.placeholders.university")} /></label>
              <label><span><MapPin size={15} /> {t("pfePack.city")}</span><input name="city" value={formData.city} onChange={handleChange} maxLength={100} required autoComplete="address-level2" placeholder={t("pfePack.placeholders.city")} /></label>
              <div className="pfe-form__wide pfe-form__technology-field">
                <span className="pfe-form__field-label"><Code2 size={16} aria-hidden="true" /> {t("pfePack.technologies")}</span>
                <p className="pfe-form__tech-description">{pt("technologyInstructions")}</p>
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
                    placeholder={t("pfePack.placeholders.otherTechnology")}
                  />}
                  {otherTechSelected && <p className="pfe-tech-other-hint" id="pfe-other-technology-hint">{t("pfePack.otherTechnologyHint")}</p>}
                  {otherTechnologies.length > 0 && <div className="pfe-tech-other-chips" aria-live="polite">
                    {otherTechnologies.map((technology) => <span key={technology}>{technology}</span>)}
                  </div>}
                </div>
                <span className={`pfe-form__field-hint${selectedTechnologyCount < 1 ? " is-required" : ""}`}>{t("pfePack.technologyMinimum", { count: selectedTechnologyCount })}</span>
                {formationsError && <span className="pfe-form__offers-status" role="status">{t("pfePack.technologiesLoadError")}</span>}
              </div>
              <div className="pfe-form__wide pfe-location-field">
                <span className="pfe-form__field-label"><MapPin size={16} aria-hidden="true" /> {t("pfePack.locationHeading")}</span>
                <div className="pfe-location-options">
                  <button type="button" aria-pressed={formData.locationMode === "remote"} className={`pfe-location-card${formData.locationMode === "remote" ? " is-selected" : ""}`} onClick={() => setFormData((current) => ({ ...current, locationMode: "remote", preferredLocation: "", customLocation: "" }))}>
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
                {formData.locationMode === "onsite" && formData.preferredLocation === "other" && <input className="pfe-location-custom" value={formData.customLocation} onChange={(event) => setFormData((current) => ({ ...current, customLocation: event.target.value }))} maxLength={200} required aria-label={t("pfePack.locationHeading")} placeholder={t("pfePack.placeholders.customLocation")} />}
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
