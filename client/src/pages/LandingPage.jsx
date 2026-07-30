import { useState, useEffect, useMemo, useRef } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { motion, useScroll, useTransform } from "framer-motion";
import {
  FiArrowRight, FiPlay, FiX,
  FiMapPin, FiPhone, FiMail, FiSend,
  FiFacebook, FiLinkedin, FiInstagram, FiYoutube,
  FiUsers, FiAward, FiTarget, FiBookOpen,
  FiClock, FiCheckCircle, FiTrendingUp, FiMessageCircle,
  FiGlobe, FiLink,
  // eslint-disable-next-line no-unused-vars
  FiShield,
  FiCpu, FiLock,
} from "react-icons/fi";
import { FaChartBar, FaRobot } from "react-icons/fa";
// Feather (react-icons/fi, utilisé pour tous les autres icônes sociaux
// ci-dessous) n'a pas de logo WhatsApp — Tabler est le set outline le plus
// proche visuellement (même grille 24x24, même épaisseur de trait ~2px),
// déjà disponible via la dépendance react-icons existante (pas un nouveau
// package).
import { TbBrandWhatsapp } from "react-icons/tb";
import { SiFlutter, SiSpringboot, SiAngular, SiReact, SiNodedotjs, SiDocker, SiKubernetes } from "react-icons/si";
import { useLang } from "../context/LangContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import SiteNavbar from "../components/common/SiteNavbar.jsx";
import { scrollToSection } from "../utils/scrollToSection.js";
import { VIDEO_URLS } from "../constants/videoUrls.js";
import { getFeaturedSummerCampTestimonials, getFeaturedPfeTestimonials, getFeaturedFormationTestimonials } from "../constants/testimonials.js";
import VideoTestimonialCarousel from "../components/common/VideoTestimonialCarousel.jsx";
import TestimonialsScreenshotCarousel from "../components/common/TestimonialsScreenshotCarousel.jsx";
import TechMarquee from "../components/common/TechMarquee.jsx";
import FormationCategories from "../components/common/FormationCategories.jsx";
import NewsSection from "../components/common/NewsSection.jsx";
import api from "../services/api.js";
import { settingsService } from "../services/settings.service.js";
import { PHONE_NUMBER } from "../utils/phoneDisplay.jsx";
import { buildWhatsAppLink } from "../utils/whatsapp.js";
import "./LandingPage.css";

// ─── Icon map (keyed by slug for exact matching) ──────────────────────────────
const ICON_MAP = {
  "fullstack-spring-angular": [
    { Comp: SiSpringboot, color: "#6DB33F" },
    { Comp: SiAngular,    color: "#DD0031" },
  ],
  "mern-stack": [
    { Comp: SiReact,     color: "#61DAFB" },
    { Comp: SiNodedotjs, color: "#339933" },
  ],
  "mobile-flutter": [
    { Comp: SiFlutter,    color: "#54C5F8" },
    { Comp: SiNodedotjs,  color: "#339933" },
    { Comp: SiSpringboot, color: "#6DB33F" },
  ],
  "bi":                [{ Comp: FaChartBar,   color: "#F59E0B" }],
  "devops": [
    { Comp: SiDocker,     color: "#2496ED" },
    { Comp: SiKubernetes, color: "#326CE5" },
  ],
  "ai":                [{ Comp: FaRobot,       color: "#8B5CF6" }],
  "iot":               [{ Comp: FiCpu,         color: "#3B82F6" }],
  "cyber-security":    [{ Comp: FiLock,        color: "#10B981" }],
  "digital-marketing": [{ Comp: FiTrendingUp,  color: "#6366F1" }],
};

const getIconEntry = (slug = "") => ICON_MAP[slug] ?? [{ Comp: SiReact, color: "#61DAFB" }];

// ─────────────────────────────────────────────────────────────────────────────
export default function LandingPage() {
  const { t }                       = useTranslation();
  const { lang } = useLang();
  // eslint-disable-next-line no-unused-vars
  const { user }                    = useAuth();
  // eslint-disable-next-line no-unused-vars
  const navigate                    = useNavigate();
  const location                    = useLocation();

  const [form,        setForm]        = useState({ name: "", email: "", subject: "", message: "" });
  const [sent,        setSent]        = useState(false);
  const [newsletter,  setNewsletter]  = useState("");
  const [allFormations, setAllFormations] = useState([]);
  const [promoOpen,   setPromoOpen]   = useState(false);

  // Sync html lang attribute
  useEffect(() => { document.documentElement.lang = lang; }, [lang]);

  // Smart scroll: when landing via navigate('/', { state: { scrollTo: 'about' } })
  useEffect(() => {
    const target = location.state?.scrollTo;
    if (!target) return;
    // Small delay to let page render
    const t = setTimeout(() => scrollToSection(target), 120);
    return () => clearTimeout(t);
  }, [location.state]);

  // Fetch all formations once — filtering/slicing happens client-side below
  useEffect(() => {
    api.get("/formations")
      .then(res => setAllFormations(res.data || []))
      .catch(() => {});
  }, []);

  // Formations Populaires : 4 premières formations
  const displayedFormations = useMemo(() => allFormations.slice(0, 4), [allFormations]);

  /* Promo modal: ESC to close + scroll lock */
  useEffect(() => {
    if (!promoOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e) => { if (e.key === "Escape") setPromoOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [promoOpen]);

  const handleContact = (e) => {
    e.preventDefault();
    setSent(true);
    setForm({ name: "", email: "", subject: "", message: "" });
    setTimeout(() => setSent(false), 4000);
  };

  // ── Scroll-tilt 3D effect for promo video section ─────────────────────
  const promoSectionRef = useRef(null);
  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
  const { scrollYProgress } = useScroll({
    target: promoSectionRef,
    offset: ["start end", "end start"],
  });
  const rotateX = useTransform(
    scrollYProgress,
    [0, 0.3, 0.7, 1],
    isMobile ? [8, 3, 0, 0] : [18, 6, 0, -2]
  );
  const scale = useTransform(
    scrollYProgress,
    [0, 0.4, 0.7, 1],
    isMobile ? [0.97, 0.99, 1, 1] : [0.92, 0.97, 1, 1]
  );

  // ── Vidéo "Découvrez TheBridgeFlow en action" — pilotée par SiteSettings
  // (MongoDB), plus l'ancien VIDEO_URLS["/stageflow-promo.mp4"] codé en dur.
  // Fallback conservé si le fetch échoue ou tant qu'il n'a pas résolu.
  const [actionVideo, setActionVideo] = useState(null);
  useEffect(() => {
    settingsService.get()
      .then(({ data }) => setActionVideo(data.actionVideo))
      .catch(() => {}); // silencieux — le fallback VIDEO_URLS prend le relais
  }, []);
  const promoVideoUrl = actionVideo?.url || VIDEO_URLS["/stageflow-promo.mp4"];
  const promoIsDrive  = actionVideo
    ? actionVideo.provider === "google_drive"
    : promoVideoUrl.includes("drive.google.com");
  // Best-effort autoplay params for the Drive iframe preview — Google Drive's
  // embedded /preview player has no postMessage control API (unlike YouTube),
  // so play()/pause() can't be called on it from outside. `mute=1` is
  // undocumented/unverified; browsers may block audible autoplay entirely if
  // Drive ignores it. Mount/unmount (below) is the only reliable lever we have.
  const promoDriveEmbedSrc = promoVideoUrl.includes("?")
    ? `${promoVideoUrl}&autoplay=1&mute=1`
    : `${promoVideoUrl}?autoplay=1&mute=1`;

  /* ── Preview card muted-autoplay, gated by viewport visibility (économie
     de ressources) — même pattern que VideoTestimonialCarousel.jsx. Pour la
     source Cloudinary (<video>), play()/pause() est appelé directement ;
     pour Google Drive (<iframe>), l'iframe est simplement monté/démonté
     (aucune API de contrôle externe possible sur le lecteur intégré). ── */
  const promoCardRef  = useRef(null);
  const promoVideoRef = useRef(null);
  const [promoInView, setPromoInView] = useState(false);

  useEffect(() => {
    const el = promoCardRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setPromoInView(entry.isIntersecting),
      { threshold: 0.25 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (promoIsDrive) return; // iframe: géré par mount/unmount, pas par play()/pause()
    const v = promoVideoRef.current;
    if (!v) return;
    if (promoInView) v.play().catch(() => {});
    else v.pause();
  }, [promoInView, promoIsDrive]);

  return (
    <div className="landing" dir={lang === "ar" ? "rtl" : "ltr"}>

      <SiteNavbar />

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <section id="hero" className="lp-hero">
        <video
          className="lp-hero__video"
          src="/videos/hero-background.mp4"
          autoPlay
          muted
          loop
          playsInline
          aria-hidden="true"
        />
        <div className="lp-hero__overlay" aria-hidden="true" />
        <div className="lp-hero__inner">
          <motion.div
            className="lp-hero__content"
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, ease: "easeOut" }}
          >
            <span className="lp-badge">🚀 {t("landing.heroBadge")}</span>
            <h1 className="lp-hero__title">
              <span>{t("landing.heroTitle1")}</span><br />
              <span className="lp-accent">{t("landing.heroTitle2")}</span>
            </h1>
            <p className="lp-hero__desc">{t("landing.heroDesc")}</p>
            <div className="lp-hero__ctas">
              <Link to="/formations" className="btn btn-primary btn-lg">
                {t("landing.ctaFormations")} <FiArrowRight />
              </Link>
              <Link to="/register" className="btn btn-outline btn-lg">
                {t("landing.ctaStart")}
              </Link>
            </div>
            {/* Remplace la ligne de badges texte — style dédié, distinct de
                .lp-contact__social-btn (celle-ci reste inchangée dans Contact/Footer) */}
            <div className="lp-hero__socials">
              <a href="https://www.facebook.com/9antra.tn" target="_blank" rel="noopener noreferrer" aria-label="Facebook"  className="lp-hero__social-btn"><FiFacebook  size={20} /></a>
              <a href="https://www.linkedin.com/company/9antra-tn-the-bridge/" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn"  className="lp-hero__social-btn"><FiLinkedin  size={20} /></a>
              <a href="https://www.instagram.com/9antra.tn_the_bridge/" target="_blank" rel="noopener noreferrer" aria-label="Instagram" className="lp-hero__social-btn"><FiInstagram size={20} /></a>
              <a href="https://www.youtube.com/@9antra.tn_the_bridge" target="_blank" rel="noopener noreferrer" aria-label="YouTube" className="lp-hero__social-btn"><FiYoutube size={20} /></a>
              <a href={buildWhatsAppLink(t("common.whatsappPrefill"))} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp" className="lp-hero__social-btn"><TbBrandWhatsapp size={21} /></a>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── BANDE DE LOGOS TECHS — vitrine statique complète, indépendante de
          formation.technologies (utilisé uniquement sur FormationDetail) ── */}
      <TechMarquee
        title={t("landing.techMarqueeTitle")}
        subtitle={t("landing.techMarqueeSub")}
      />

      {/* ── CATÉGORIES DE FORMATIONS ──────────────────────────────────────── */}
      {allFormations.length > 0 && (
        <FormationCategories formations={allFormations} />
      )}

      {/* ── FORMATIONS POPULAIRES ─────────────────────────────────────────── */}
      {allFormations.length > 0 && (
        <section id="formations-populaires" className="lp-popular">
          <div className="lp-popular__inner">
            <div className="lp-section-header">
              <span className="lp-section-badge">{t("landing.popularBadge")}</span>
              <h2 className="lp-section-title">{t("landing.popularTitle")}</h2>
              <p className="lp-section-sub">{t("landing.popularSub")}</p>
            </div>
            {displayedFormations.length === 0 && (
              <p className="lp-popular__empty">{t("landing.popularEmptyCategory")}</p>
            )}
            <div className="lp-popular__grid">
              {displayedFormations.map((f, i) => {
                const icons = getIconEntry(f.slug);
                return (
                  <motion.div
                    key={f._id}
                    className="lp-pop-card"
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.07, duration: 0.4 }}
                  >
                    <div className="lp-pop-card__icons">
                      {icons.map(({ Comp: Ic, color: c }, j) => (
                        <div
                          key={j}
                          className="lp-pop-card__icon"
                          style={{
                            background: `${c}18`,
                            color: c,
                            ...(icons.length >= 3 && { width: 38, height: 38 }),
                          }}
                        >
                          <Ic size={icons.length >= 3 ? 17 : 24} />
                        </div>
                      ))}
                    </div>
                    <h3 className="lp-pop-card__title">{f.title}</h3>
                    <p className="lp-pop-card__desc">
                      {f.description
                        ? f.description.slice(0, 100) + (f.description.length > 100 ? "…" : "")
                        : ""}
                    </p>
                    <div className="lp-pop-card__meta">
                      <span className="lp-pop-chip">
                        <FiClock size={12} /> {f.duration}
                      </span>
                      {f.price?.onsite && (
                        <span className="lp-pop-chip lp-pop-chip--price">
                          {f.price.onsite}
                        </span>
                      )}
                    </div>
                    <Link to={`/formations/${f.slug}`} className="lp-pop-card__cta">
                      {t("landing.viewDetails")} <FiArrowRight size={14} />
                    </Link>
                  </motion.div>
                );
              })}
            </div>
            <div className="lp-popular__footer">
              <Link to="/formations" className="btn btn-outline">
                {t("landing.viewAllFormations")}
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* ── TESTIMONIALS (vidéo) — 3 carrousels distincts : Summer Camp, PFE, puis Formation ── */}
      <VideoTestimonialCarousel
        sectionId="testimonials"
        items={getFeaturedSummerCampTestimonials()}
        title={t("landing.testiSummerCampTitle")}
        subtitle={t("landing.testiSummerCampSub")}
        ctaLabel={t("testimonials.ctaDefault")}
        ctaHref="/formations"
      />
      <VideoTestimonialCarousel
        sectionId="testimonials-formation"
        items={getFeaturedFormationTestimonials()}
        title={t("landing.testiFormationTitle")}
        subtitle={t("landing.testiFormationSub")}
        ctaLabel={t("testimonials.ctaDefault")}
        ctaHref="/formations"
      />
      <VideoTestimonialCarousel
        sectionId="testimonials-pfe"
        items={getFeaturedPfeTestimonials()}
        title={t("landing.testiPfeTitle")}
        subtitle={t("landing.testiPfeSub")}
        ctaLabel={t("testimonials.ctaDefault")}
        ctaHref="/formations"
      />

      {/* ── TÉMOIGNAGES (screenshots) — section distincte, indépendante du
          carousel vidéo ci-dessus ─────────────────────────────────────── */}
      <TestimonialsScreenshotCarousel
        title={t("landing.screenshotTestiTitle")}
        subtitle={t("landing.screenshotTestiSub")}
      />

      {/* ── PRÉSENTATION VIDÉO ──────────────────────────────────────────── */}
      <section className="lp-promo-video" ref={promoSectionRef}>
        <div className="lp-promo-video__inner">

          {/* Header */}
          <motion.div
            className="lp-section-header"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <span className="lp-badge">🎥 {t("landing.promoBadge")}</span>
            <h2 className="lp-section-title" style={{ marginTop: "1rem" }}>{t("landing.promoTitle")}</h2>
            <p className="lp-section-sub">
              {t("landing.promoSub")}
            </p>
          </motion.div>

          {/* Cadre "tablette" avec effet de tilt 3D au scroll — le tilt
              s'applique à l'ensemble du cadre (bordure + vidéo), pas
              seulement au contenu vidéo, pour un vrai effet d'appareil qui
              se redresse. */}
          <motion.div
            style={{
              perspective: "1000px",
              rotateX,
              scale,
            }}
          >
            <div className="lp-promo-video__frame">
              <button
                className="lp-promo-video__card"
                ref={promoCardRef}
                onClick={() => setPromoOpen(true)}
                aria-label={t("landing.promoPlayAriaLabel")}
              >
                {/* Autoplay preview — muted, loop, no controls. Play/pause
                    piloté par IntersectionObserver (voir promoInView) :
                    ne consomme des ressources que quand la section est
                    visible à l'écran. */}
                {promoIsDrive ? (
                  promoInView && (
                    <iframe
                      className="lp-promo-video__preview"
                      src={promoDriveEmbedSrc}
                      allow="autoplay; encrypted-media"
                      title={t("landing.promoVideoLabel")}
                      tabIndex={-1}
                    />
                  )
                ) : (
                  <video
                    ref={promoVideoRef}
                    className="lp-promo-video__preview"
                    src={promoVideoUrl}
                    muted
                    loop
                    playsInline
                    preload="metadata"
                    tabIndex={-1}
                  />
                )}
                {/* Subtle gradient overlay (glassmorphism feel) */}
                <div className="lp-promo-video__card-overlay" />
                <div className="lp-promo-video__play-ring">
                  <FiPlay size={28} />
                </div>
                <div className="lp-promo-video__caption">
                  <span className="lp-promo-video__caption-label">{t("landing.promoVideoLabel")}</span>
                  <span className="lp-promo-video__caption-sub">{t("landing.promoVideoSub")}</span>
                </div>
              </button>
            </div>
          </motion.div>
        </div>

        {/* Promo modal */}
        {promoOpen && (
          <div
            className="lp-promo-video__overlay"
            onClick={() => setPromoOpen(false)}
            role="dialog"
            aria-modal="true"
            aria-label={t("landing.promoModalAriaLabel")}
          >
            <motion.div
              className="lp-promo-video__modal"
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.22 }}
            >
              <button
                className="lp-promo-video__modal-close"
                onClick={() => setPromoOpen(false)}
                aria-label={t("applications.closeModal")}
              >
                <FiX size={18} />
              </button>
              {promoIsDrive ? (
                <iframe
                  className="lp-promo-video__modal-video"
                  src={promoVideoUrl}
                  allow="autoplay; encrypted-media"
                  allowFullScreen
                  title="Stageflow Coding Academy"
                />
              ) : (
                <video
                  className="lp-promo-video__modal-video"
                  src={promoVideoUrl}
                  controls
                  autoPlay
                  preload="metadata"
                  controlsList="nodownload"
                  disablePictureInPicture
                  onContextMenu={(e) => e.preventDefault()}
                >
                  <track kind="captions" />
                </video>
              )}
            </motion.div>
          </div>
        )}
      </section>

      {/* ── ABOUT ────────────────────────────────────────────────────────── */}
      <section id="about" className="lp-about">
        <div className="lp-about__inner">
          <motion.div
            className="lp-about__left"
            initial={{ opacity: 0, x: lang === "ar" ? 40 : -40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.55 }}
          >
            <span className="lp-section-badge">{t("landing.aboutBadge")}</span>
            <h2 className="lp-about__title">{t("landing.aboutTitle")}</h2>
            <p className="lp-about__sub">{t("landing.aboutSub")}</p>

            <div className="lp-about__pillars">
              <div className="lp-pillar">
                <div className="lp-pillar__icon"><FiTarget size={18} /></div>
                <div>
                  <div className="lp-pillar__label">{t("landing.missionLabel")}</div>
                  <div className="lp-pillar__text">{t("landing.missionText")}</div>
                </div>
              </div>
              <div className="lp-pillar">
                <div className="lp-pillar__icon lp-pillar__icon--green"><FiTrendingUp size={18} /></div>
                <div>
                  <div className="lp-pillar__label">{t("landing.visionLabel")}</div>
                  <div className="lp-pillar__text">{t("landing.visionText")}</div>
                </div>
              </div>
            </div>
          </motion.div>

          <div className="lp-about__right">
            {[
              { title: t("landing.aboutCard1Title"), desc: t("landing.aboutCard1Desc"), icon: <FiUsers size={22} />, color: "#2563EB" },
              { title: t("landing.aboutCard2Title"), desc: t("landing.aboutCard2Desc"), icon: <FiMessageCircle size={22} />, color: "#10B981" },
              { title: t("landing.aboutCard3Title"), desc: t("landing.aboutCard3Desc"), icon: <FiAward size={22} />, color: "#F59E0B" },
              { title: t("landing.aboutCard4Title"), desc: t("landing.aboutCard4Desc"), icon: <FiBookOpen size={22} />, color: "#8B5CF6" },
            ].map((card, i) => (
              <motion.div
                key={card.title}
                className="lp-about-card"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08, duration: 0.4 }}
              >
                <div className="lp-about-card__icon" style={{ background: `${card.color}18`, color: card.color }}>
                  {card.icon}
                </div>
                <div>
                  <div className="lp-about-card__title">{card.title}</div>
                  <div className="lp-about-card__desc">{card.desc}</div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── WHY CHOOSE US ────────────────────────────────────────────────── */}
      <section id="features" className="lp-why">
        <div className="lp-why__inner">
          <div className="lp-section-header">
            <span className="lp-section-badge">{t("landing.whyBadge")}</span>
            <h2 className="lp-section-title">{t("landing.whyTitle")}</h2>
            <p className="lp-section-sub">{t("landing.whySub")}</p>
          </div>
          <div className="lp-why__grid">
            {[
              { key: "why1", icon: <FiCheckCircle size={24} />, color: "#2563EB" },
              { key: "why2", icon: <FiBookOpen     size={24} />, color: "#10B981" },
              { key: "why3", icon: <FiUsers        size={24} />, color: "#F59E0B" },
              { key: "why4", icon: <FiTrendingUp   size={24} />, color: "#EF4444" },
              { key: "why5", icon: <FiMessageCircle size={24}/>, color: "#8B5CF6" },
              { key: "why6", icon: <FiAward        size={24} />, color: "#06B6D4" },
              { key: "why7", icon: <FiGlobe        size={24} />, color: "#0EA5E9" },
              { key: "why8", icon: <FiClock        size={24} />, color: "#F97316" },
              { key: "why9", icon: <FiLink         size={24} />, color: "#22C55E" },
            ].map((f, i) => (
              <motion.div
                key={f.key}
                className="lp-why-card"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.06, duration: 0.4 }}
              >
                <div className="lp-why-card__icon" style={{ background: `${f.color}18`, color: f.color }}>
                  {f.icon}
                </div>
                <h3 className="lp-why-card__title">{t(`landing.${f.key}Title`)}</h3>
                <p className="lp-why-card__desc">{t(`landing.${f.key}Desc`)}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── ACTUALITÉS & BLOGS ──────────────────────────────────────────────── */}
      <NewsSection lang={lang} limit={3} />

      {/* ── CONTACT ──────────────────────────────────────────────────────── */}
      <section id="contact" className="lp-contact">
        <div className="lp-contact__inner">

          {/* Left: form */}
          <div className="lp-contact__form-wrap">
            <span className="lp-section-badge">{t("landing.contactBadge")}</span>
            <h2 className="lp-contact__title">{t("landing.contactTitle")}</h2>
            <p className="lp-contact__sub">{t("landing.contactSub")}</p>

            {sent && (
              <div className="lp-contact__success">
                ✅ {t("landing.contactSuccess")}
              </div>
            )}

            <form className="lp-contact__form" onSubmit={handleContact}>
              <div className="lp-form-row">
                <div className="lp-input-wrap">
                  <span className="lp-input-icon">👤</span>
                  <input
                    required
                    value={form.name}
                    onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                    className="lp-input"
                    placeholder={t("landing.contactName")}
                  />
                </div>
                <div className="lp-input-wrap">
                  <span className="lp-input-icon">✉️</span>
                  <input
                    required
                    type="email"
                    value={form.email}
                    onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                    className="lp-input"
                    placeholder={t("landing.contactEmail")}
                  />
                </div>
              </div>
              <div className="lp-input-wrap">
                <span className="lp-input-icon">📌</span>
                <input
                  value={form.subject}
                  onChange={e => setForm(p => ({ ...p, subject: e.target.value }))}
                  className="lp-input"
                  placeholder={t("landing.contactSubject")}
                />
              </div>
              <div className="lp-input-wrap lp-input-wrap--textarea">
                <span className="lp-input-icon lp-input-icon--top">✏️</span>
                <textarea
                  required
                  rows={5}
                  value={form.message}
                  onChange={e => setForm(p => ({ ...p, message: e.target.value }))}
                  className="lp-input lp-textarea"
                  placeholder={t("landing.contactMessage")}
                />
              </div>
              <button type="submit" className="btn btn-primary lp-contact__submit">
                {t("landing.contactSend")} <FiSend size={16} />
              </button>
            </form>
          </div>

          {/* Right: info + map */}
          <div className="lp-contact__info-wrap">
            <div className="lp-contact__info-card--full">
              {/* Brand */}
              <div className="lp-contact__brand">
                <img src="/favicon.png" alt="Logo" className="lp-nav__logo-icon" />
                <span className="lp-contact__brand-name">TheBridge<span className="lp-accent">Flow</span></span>
              </div>
              <p className="lp-contact__info-desc">{t("landing.contactSub")}</p>

              {/* Info list */}
              <div className="lp-contact__info-list">
                {[
                  { icon: <FiPhone size={16} />, label: t("landing.contactPhone"), val: PHONE_NUMBER, ltr: true },
                  { icon: <FiMail  size={16} />, label: t("profile.email"),        val: "contact@9antra.tn" },
                ].map(info => (
                  <div key={info.label} className="lp-contact__info-item">
                    <div className="lp-contact__info-icon">{info.icon}</div>
                    <div>
                      <div className="lp-contact__info-label">{info.label}</div>
                      <div className="lp-contact__info-val" dir={info.ltr ? "ltr" : undefined}>{info.val}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Social links */}
              <div className="lp-contact__socials">
                <a href="https://www.facebook.com/9antra.tn" target="_blank" rel="noopener noreferrer" aria-label="Facebook"  className="lp-contact__social-btn"><FiFacebook  size={17} /></a>
                <a href="https://www.linkedin.com/company/9antra-tn-the-bridge/" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn"  className="lp-contact__social-btn"><FiLinkedin  size={17} /></a>
                <a href="https://www.instagram.com/9antra.tn_the_bridge/" target="_blank" rel="noopener noreferrer" aria-label="Instagram" className="lp-contact__social-btn"><FiInstagram size={17} /></a>
              </div>

              {/* Adresses — 2 localisations, chacune avec un lien Google Maps */}
              <div className="lp-contact__addresses">
                <div className="lp-contact__map-label">
                  <FiMapPin size={14} /> {t("landing.mapTitle")}
                </div>
                {[
                  { city: "Lac 1, Tunis", place: "Level 1", href: "https://maps.app.goo.gl/fapcW6wn8dZgZaFX9" },
                  { city: "Sahloul, Sousse", place: "Rockets", href: "https://maps.app.goo.gl/YJY6vKBw1RJJ9XEo7" },
                ].map(addr => (
                  <div key={addr.city} className="lp-contact__address-card">
                    <div className="lp-contact__address-icon"><FiMapPin size={16} /></div>
                    <div className="lp-contact__address-text">
                      <div className="lp-contact__address-city">{addr.city}</div>
                      <div className="lp-contact__address-place">{addr.place}</div>
                    </div>
                    <a href={addr.href} target="_blank" rel="noopener noreferrer" className="lp-contact__address-link">
                      {t("landing.viewOnMaps")}
                    </a>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── NEWSLETTER ───────────────────────────────────────────────────── */}
      <section className="lp-newsletter">
        <div className="lp-newsletter__inner">
          <div>
            <div className="lp-newsletter__icon">✈️</div>
            <h3 className="lp-newsletter__title">{t("landing.newsletterTitle")}</h3>
            <p className="lp-newsletter__sub">{t("landing.newsletterSub")}</p>
          </div>
          <div className="lp-newsletter__form">
            <input
              value={newsletter}
              onChange={e => setNewsletter(e.target.value)}
              className="lp-newsletter__input"
              placeholder={t("landing.newsletterInput")}
            />
            <button className="btn btn-primary" onClick={() => setNewsletter("")}>
              {t("landing.newsletterBtn")}
            </button>
          </div>
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────────────────────────────────── */}
      <footer className="lp-footer">
        <div className="lp-footer__inner">
          <div className="lp-footer__brand">
            <Link to="/" className="lp-nav__logo" style={{ color: "#94A3B8" }}>
              <img src="/favicon.png" alt="Logo" className="lp-nav__logo-icon" />
              <span>TheBridge<span className="lp-accent">Flow</span></span>
            </Link>
            <p className="lp-footer__tagline">{t("landing.footerTagline")}</p>
            <div className="lp-footer__socials">
              <a href="https://www.facebook.com/9antra.tn" target="_blank" rel="noopener noreferrer" aria-label="Facebook"><FiFacebook   size={17} /></a>
              <a href="https://www.linkedin.com/company/9antra-tn-the-bridge/" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn"><FiLinkedin   size={17} /></a>
              <a href="https://www.instagram.com/9antra.tn_the_bridge/" target="_blank" rel="noopener noreferrer" aria-label="Instagram"><FiInstagram size={17} /></a>
              <a href="https://www.youtube.com/@9antra.tn_the_bridge" target="_blank" rel="noopener noreferrer" aria-label="YouTube"><FiYoutube size={17} /></a>
              <a href={buildWhatsAppLink(t("common.whatsappPrefill"))} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp"><TbBrandWhatsapp size={18} /></a>
            </div>
          </div>

          <div className="lp-footer__col">
            <h4>{t("landing.footerNav")}</h4>
            <a href="#hero"         onClick={e => { e.preventDefault(); scrollToSection("hero"); }}>{t("landing.footerHome")}</a>
            <a href="#about"        onClick={e => { e.preventDefault(); scrollToSection("about"); }}>{t("landing.footerAbout")}</a>
            <a href="#features"     onClick={e => { e.preventDefault(); scrollToSection("features"); }}>{t("landing.footerFeatures")}</a>
            <Link to="/tarifs">{t("landing.footerPricing")}</Link>
            <Link to="/conditions">{t("landing.footerTerms")}</Link>
          </div>

          <div className="lp-footer__col">
            <h4>{t("landing.footerResources")}</h4>
            <a href="https://www.instagram.com/p/DZZuwmXggHz/?img_index=1&igsh=MWs3Y3pxcnpsZ3IzOQ%3D%3D" target="_blank" rel="noopener noreferrer">{t("landing.footerFAQ")}</a>
            <Link to="/blog">{t("landing.footerBlog")}</Link>
            <Link to="/guides">{t("landing.footerGuides")}</Link>
            <Link to="/aide">{t("landing.footerHelp")}</Link>
          </div>

          <div className="lp-footer__col">
            <h4>{t("landing.footerLegal")}</h4>
            <Link to="/mentions-legales">{t("landing.footerMentions")}</Link>
            <Link to="/confidentialite">{t("landing.footerPrivacy")}</Link>
            <Link to="/cgu">{t("landing.footerCGU")}</Link>
          </div>

          <div className="lp-footer__col">
            <h4>{t("nav.contact")}</h4>
            <span><FiMapPin size={13} /> Lac 1, Tunis — Level 1</span>
            <span><FiMapPin size={13} /> Sahloul, Sousse — Rockets</span>
            <span><FiPhone  size={13} /> <span dir="ltr">{PHONE_NUMBER}</span></span>
            <span><FiMail   size={13} /> contact@9antra.tn</span>
          </div>
        </div>

        <div className="lp-footer__bottom">
          © 2026 TheBridgeFlow. {t("landing.copyright")}.
        </div>
      </footer>

    </div>
  );
}
