import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  FiUser, FiMail, FiLock, FiArrowRight,
  FiPlus, FiTrash2, FiChevronLeft, FiMapPin,
  FiEye, FiEyeOff,
} from "react-icons/fi";
import LangFlags from "../../components/common/LangFlags.jsx";
import GoogleAuthButton from "../../components/common/GoogleAuthButton.jsx";
import AuthOrbit from "../../components/auth/AuthOrbit.jsx";
import BoxReveal from "../../components/auth/BoxReveal.jsx";
import api from "../../services/api.js";
import "./Auth.css";

/* ─── Composants utilitaires — EN DEHORS du composant principal ─────────── */
const Field = ({ label, children }) => (
  <div className="auth-field">
    {label && <label className="auth-label">{label}</label>}
    {children}
  </div>
);

const AuthInput = ({ icon, ...props }) => (
  <div className="auth-input-wrap">
    {icon && <span className="auth-input-icon">{icon}</span>}
    <input
      className="auth-input"
      style={icon ? {} : { paddingLeft: "1rem" }}
      {...props}
    />
  </div>
);

/* Niveaux : valeurs canoniques françaises (alignées sur le schéma backend / ProfileEditor) — affichage traduit via profileEditor.level* */
const SKILL_LEVELS = ["Débutant", "Intermédiaire", "Avancé", "Expert"];
const LANG_LEVELS  = ["Débutant", "Intermédiaire", "Courant", "Natif"];
const LEVEL_KEY = {
  "Débutant": "profileEditor.levelDebutant",
  "Intermédiaire": "profileEditor.levelIntermediaire",
  "Avancé": "profileEditor.levelAvance",
  "Expert": "profileEditor.levelExpert",
  "Courant": "profileEditor.levelCourant",
  "Natif": "profileEditor.levelNatif",
};

const EMPTY_SKILL    = { name: "", level: "Débutant" };
const EMPTY_LANGUAGE = { name: "", level: "Courant" };
const EMPTY_EXP      = { company:"", position:"", location:"", startDate:"", endDate:"", current:false, description:"", technologies:"" };

/* ─── Composant principal ────────────────────────────────────────────────── */
export default function Register() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [step,     setStep]     = useState(0);
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);
  const [showPass, setShowPass] = useState(false);

  const [account,    setAccount]    = useState({ name:"", email:"", password:"", gender:"", phone:"", university:"", specialty:"", bio:"" });
  const [education,  setEducation]  = useState({ institution:"", degree:"", fieldOfStudy:"", startDate:"", endDate:"", current:false, grade:"", courses:"" });
  const [experience, setExperience] = useState([]);
  const [skills,     setSkills]     = useState([{ ...EMPTY_SKILL }]);
  const [languages,  setLanguages]  = useState([{ ...EMPTY_LANGUAGE }]);
  const [socialLinks,setSocialLinks]= useState({ linkedin:"", github:"", portfolio:"" });

  const addSkill    = () => setSkills([...skills, { ...EMPTY_SKILL }]);
  const removeSkill = (i) => setSkills(skills.filter((_, idx) => idx !== i));
  const updateSkill = (i, field, val) => setSkills(skills.map((s, idx) => idx === i ? { ...s, [field]: val } : s));

  const addLang    = () => setLanguages([...languages, { ...EMPTY_LANGUAGE }]);
  const removeLang = (i) => setLanguages(languages.filter((_, idx) => idx !== i));
  const updateLang = (i, field, val) => setLanguages(languages.map((l, idx) => idx === i ? { ...l, [field]: val } : l));

  const addExp    = () => setExperience([...experience, { ...EMPTY_EXP }]);
  const removeExp = (i) => setExperience(experience.filter((_, idx) => idx !== i));
  const updateExp = (i, field, val) => setExperience(experience.map((e, idx) => {
    if (idx !== i) return e;
    if (field === "current" && val) return { ...e, [field]: val, endDate: "" };
    return { ...e, [field]: val };
  }));

  const nextStep = (e) => {
    e.preventDefault();
    setError("");
    if (step === 0 && (!account.name || !account.email || !account.password)) {
      setError(t("register.errorRequired"));
      return;
    }
    if (step === 0 && account.password.length < 6) {
      setError(t("register.errorPasswordLength"));
      return;
    }
    if (step === 0 && !account.gender) {
      setError(t("register.errorGenderRequired"));
      return;
    }
    setStep(s => s + 1);
  };

  const prevStep = () => {
    setError("");
    setStep(s => s - 1);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const payload = {
      ...account,
      education: education.institution ? {
        ...education,
        startDate: education.startDate || null,
        endDate:   education.current ? null : (education.endDate || null),
        courses:   education.courses ? education.courses.split(",").map(c => c.trim()).filter(Boolean) : [],
      } : undefined,
      skills:     skills.filter(s => s.name.trim()),
      languages:  languages.filter(l => l.name.trim()),
      experience: experience
        .filter(exp => exp.company.trim() || exp.position.trim())
        .map(exp => ({ ...exp, startDate: exp.startDate || null, endDate: exp.current ? null : (exp.endDate || null), technologies: exp.technologies ? exp.technologies.split(",").map(t => t.trim()).filter(Boolean) : [] })),
      socialLinks,
    };

    try {
      const { data } = await api.post("/auth/register", payload);
      if (data.needsVerify) {
        navigate("/verify-email", { state: { email: data.email } });
        return;
      }
      navigate("/dashboard/student");
    } catch (err) {
      setError(err.response?.data?.message || t("register.errorDefault"));
    } finally {
      setLoading(false);
    }
  };

  const stepLabels = [
    t("register.stepAccount"), t("profileEditor.formation"), t("register.expLabel"),
    t("profileEditor.skills"), t("register.summary"),
  ];

  const btnStyle = { border:"1.5px dashed var(--primary)", borderRadius:"8px", background:"transparent", color:"var(--primary)", padding:"0.4rem 0.75rem", cursor:"pointer", fontSize:"0.85rem", fontWeight:600, display:"inline-flex", alignItems:"center", gap:"0.25rem" };
  const cardStyle = { background:"var(--bg)", border:"1px solid var(--border)", borderRadius:"12px", padding:"1.25rem", marginBottom:"1rem" };

  return (
    <div className="auth-page">

      {/* ── Panneau gauche ─────────────────────────────────────────────── */}
      <div className="auth-left">
        <AuthOrbit/>
        <Link to="/" className="auth-left__logo">
          <img src="/favicon.png" alt="Logo" className="auth-left__logo-icon" />
          <span>TheBridge<span style={{opacity:0.85}}>Flow</span></span>
        </Link>
        <div className="auth-left__content">
          <h2 className="auth-left__title">{t("login.left1")}<br/>{t("login.left2")}</h2>
          <p className="auth-left__sub">{t("login.leftSub")}</p>
        </div>
      </div>

      {/* ── Panneau droit ──────────────────────────────────────────────── */}
      <div className="auth-right">
        <div className="auth-form-wrap" style={{maxWidth:480, overflowY:"auto", maxHeight:"100vh", paddingTop:"1.5rem", paddingBottom:"1.5rem"}}>

          <div style={{ display:"flex", justifyContent:"flex-end" }}>
            <LangFlags/>
          </div>

          {/* Steps */}
          <div className="auth-steps">
            {stepLabels.map((label, i) => (
              <div key={i} className={`auth-step ${i === step ? "active" : ""} ${i < step ? "done" : ""}`}>
                <div className="auth-step-dot">{i < step ? "✓" : i + 1}</div>
                <span className="auth-step-label">{label}</span>
              </div>
            ))}
          </div>

          {error && <div className="auth-error">{error}</div>}

          {/* ── Étape 0 : Compte ─────────────────────────────────────── */}
          {step === 0 && (
            <form onSubmit={nextStep} className="auth-form-body" noValidate>
              <BoxReveal width="100%"><h2 className="auth-form-title" style={{marginBottom:"1rem"}}>{t("login.signup")}</h2></BoxReveal>

              <div className="auth-socials" style={{marginBottom:"1rem"}}>
                <GoogleAuthButton onError={setError} />
              </div>
              <div className="auth-separator" style={{marginBottom:"1.25rem"}}>
                <span/><em>{t("login.or")}</em><span/>
              </div>

              <Field label={`${t("profileEditor.fullName")} *`}>
                <AuthInput icon={<FiUser size={15}/>} placeholder="Sarra Ben Ali"
                  value={account.name} onChange={e => setAccount({...account, name:e.target.value})} required/>
              </Field>

              <Field label={`${t("register.genderLabel")} *`}>
                <div className="auth-gender-toggle">
                  <button type="button" className={`auth-gender-btn ${account.gender === "femme" ? "active" : ""}`}
                    onClick={() => setAccount({...account, gender:"femme"})}>
                    {t("register.genderFemale")}
                  </button>
                  <button type="button" className={`auth-gender-btn ${account.gender === "homme" ? "active" : ""}`}
                    onClick={() => setAccount({...account, gender:"homme"})}>
                    {t("register.genderMale")}
                  </button>
                </div>
              </Field>

              <Field label={`${t("profile.email")} *`}>
                <AuthInput icon={<FiMail size={15}/>} type="email" placeholder="sarra.benali@example.com"
                  value={account.email} onChange={e => setAccount({...account, email:e.target.value})} required/>
              </Field>

              <Field label={`${t("profileEditor.password")} *`}>
                <div className="auth-input-wrap">
                  <span className="auth-input-icon"><FiLock size={15}/></span>
                  <input type={showPass ? "text" : "password"} className="auth-input"
                    placeholder="••••••••" value={account.password} required minLength={6}
                    onChange={e => setAccount({...account, password:e.target.value})}/>
                  <button type="button" className="auth-input-toggle" onClick={() => setShowPass(!showPass)}>
                    {showPass ? <FiEyeOff size={15}/> : <FiEye size={15}/>}
                  </button>
                </div>
              </Field>

              <div className="reg-grid2">
                <Field label={t("profile.university")}>
                  <AuthInput placeholder="ESPRIT" value={account.university}
                    onChange={e => setAccount({...account, university:e.target.value})}/>
                </Field>
                <Field label={t("profile.specialty")}>
                  <AuthInput placeholder={t("register.fieldExample")} value={account.specialty}
                    onChange={e => setAccount({...account, specialty:e.target.value})}/>
                </Field>
              </div>
              <Field label={t("register.shortBio")}>
                <textarea className="auth-input" rows={2} placeholder={t("register.bioPh")}
                  style={{paddingLeft:"1rem", paddingTop:"0.75rem", resize:"vertical"}}
                  value={account.bio} onChange={e => setAccount({...account, bio:e.target.value})}/>
              </Field>

              <button type="submit" className="auth-submit-btn" style={{marginTop:"0.5rem"}}>
                {t("register.next")} <FiArrowRight size={16}/>
              </button>
              <p className="auth-switch" style={{marginTop:"1rem"}}>
                {t("register.alreadyAccount")} <Link to="/login">{t("nav.signIn")}</Link>
              </p>
            </form>
          )}

          {/* ── Étape 1 : Formation ──────────────────────────────────── */}
          {step === 1 && (
            <form onSubmit={nextStep} className="auth-form-body" noValidate>
              <BoxReveal width="100%"><h2 className="auth-form-title" style={{marginBottom:"1rem"}}>{t("profileEditor.formation")}</h2></BoxReveal>

              <Field label={t("profileEditor.institution")}>
                <AuthInput placeholder="ESPRIT" value={education.institution}
                  onChange={e => setEducation({...education, institution:e.target.value})}/>
              </Field>

              <div className="reg-grid2">
                <Field label={t("profileEditor.degree")}>
                  <AuthInput placeholder={t("profileEditor.degreePlaceholder")} value={education.degree}
                    onChange={e => setEducation({...education, degree:e.target.value})}/>
                </Field>
                <Field label={t("profileEditor.fieldOfStudy")}>
                  <AuthInput placeholder={t("register.fieldExample")} value={education.fieldOfStudy}
                    onChange={e => setEducation({...education, fieldOfStudy:e.target.value})}/>
                </Field>
                <Field label={t("register.startDate")}>
                  <AuthInput type="date" value={education.startDate}
                    onChange={e => setEducation({...education, startDate:e.target.value})}/>
                </Field>
                <Field label={t("register.endDate")}>
                  <AuthInput type="date" disabled={education.current} value={education.endDate}
                    onChange={e => setEducation({...education, endDate:e.target.value})}/>
                </Field>
                <Field label={t("register.grade")}>
                  <AuthInput placeholder="14.5/20" value={education.grade}
                    onChange={e => setEducation({...education, grade:e.target.value})}/>
                </Field>
                <Field label={t("register.courses")}>
                  <AuthInput placeholder={t("register.coursesPh")} value={education.courses}
                    onChange={e => setEducation({...education, courses:e.target.value})}/>
                </Field>
              </div>

              <label className="auth-checkbox" style={{margin:"0.5rem 0 1rem"}}>
                <input type="checkbox" checked={education.current}
                  onChange={e => setEducation({...education, current:e.target.checked})}/>
                <span>{t("register.inProgress")}</span>
              </label>

              <div className="auth-nav">
                <button type="button" className="auth-nav-back" onClick={prevStep}>
                  <FiChevronLeft/> {t("offers.previous")}
                </button>
                <button type="submit" className="auth-submit-btn" style={{marginBottom:0}}>
                  {t("register.next")} <FiArrowRight size={15}/>
                </button>
              </div>
            </form>
          )}

          {/* ── Étape 2 : Expériences ────────────────────────────────── */}
          {step === 2 && (
            <form onSubmit={nextStep} className="auth-form-body" noValidate>
              <BoxReveal width="100%"><h2 className="auth-form-title" style={{marginBottom:"1rem"}}>{t("register.expLabel")}</h2></BoxReveal>

              {experience.length === 0 && (
                <div style={{textAlign:"center", padding:"1.5rem", border:"1.5px dashed var(--border)", borderRadius:"12px", color:"var(--text-muted)", marginBottom:"1rem"}}>
                  {t("profile.noExperience")}
                </div>
              )}

              {experience.map((exp, i) => (
                <div key={i} style={cardStyle}>
                  <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"0.75rem"}}>
                    <span style={{fontWeight:700, fontSize:"0.9rem"}}>#{i+1}</span>
                    <button type="button" onClick={() => removeExp(i)}
                      style={{border:"none", background:"none", color:"#EF4444", cursor:"pointer", fontSize:"0.8rem", display:"flex", alignItems:"center", gap:"0.25rem"}}>
                      <FiTrash2 size={13}/> {t("notifications.deleteLabel")}
                    </button>
                  </div>
                  <div className="reg-grid2">
                    <Field label={t("profileEditor.company")}>
                      <AuthInput placeholder="BeeCoders" value={exp.company}
                        onChange={e => updateExp(i,"company",e.target.value)}/>
                    </Field>
                    <Field label={t("profileEditor.position")}>
                      <AuthInput placeholder={t("register.positionPh")} value={exp.position}
                        onChange={e => updateExp(i,"position",e.target.value)}/>
                    </Field>
                  </div>
                  <Field label={t("profileEditor.location")}>
                    <AuthInput icon={<FiMapPin size={14}/>} placeholder={t("profileEditor.locationPlaceholder")}
                      value={exp.location} onChange={e => updateExp(i,"location",e.target.value)}/>
                  </Field>
                  <div className="reg-grid2">
                    <Field label={t("register.startDate")}>
                      <AuthInput type="date" value={exp.startDate}
                        onChange={e => updateExp(i,"startDate",e.target.value)}/>
                    </Field>
                    <Field label={t("register.endDate")}>
                      <AuthInput type="date" disabled={exp.current} value={exp.endDate}
                        onChange={e => updateExp(i,"endDate",e.target.value)}/>
                    </Field>
                  </div>
                  <label className="auth-checkbox" style={{margin:"0.25rem 0 0.75rem"}}>
                    <input type="checkbox" checked={exp.current}
                      onChange={e => updateExp(i,"current",e.target.checked)}/>
                    <span>{t("register.currentPosition")}</span>
                  </label>
                  <Field label={t("profileEditor.description")}>
                    <textarea className="auth-input" rows={2} placeholder={t("register.descPh")}
                      style={{paddingLeft:"1rem", paddingTop:"0.75rem", resize:"vertical"}}
                      value={exp.description} onChange={e => updateExp(i,"description",e.target.value)}/>
                  </Field>
                  <Field label={t("register.technologies")}>
                    <AuthInput placeholder="React, Node.js" value={exp.technologies}
                      onChange={e => updateExp(i,"technologies",e.target.value)}/>
                  </Field>
                </div>
              ))}

              <button type="button" onClick={addExp} style={{...btnStyle, width:"100%", justifyContent:"center", marginBottom:"1rem", padding:"0.75rem"}}>
                + {t("profileEditor.addExperience")}
              </button>

              <div className="auth-nav">
                <button type="button" className="auth-nav-back" onClick={prevStep}>
                  <FiChevronLeft/> {t("offers.previous")}
                </button>
                <button type="submit" className="auth-submit-btn" style={{marginBottom:0}}>
                  {t("register.next")} <FiArrowRight size={15}/>
                </button>
              </div>
            </form>
          )}

          {/* ── Étape 3 : Compétences ────────────────────────────────── */}
          {step === 3 && (
            <form onSubmit={nextStep} className="auth-form-body" noValidate>
              <BoxReveal width="100%"><h2 className="auth-form-title" style={{marginBottom:"1rem"}}>{t("profileEditor.skills")}</h2></BoxReveal>

              <p style={{fontWeight:700, fontSize:"0.85rem", color:"var(--text)", marginBottom:"0.5rem"}}>{t("register.technicalSkills")}</p>
              {skills.map((s, i) => (
                <div key={i} className="reg-skill-row">
                  <AuthInput placeholder="React" value={s.name}
                    onChange={e => updateSkill(i,"name",e.target.value)}/>
                  <select className="auth-input" style={{paddingLeft:"0.75rem"}}
                    value={s.level} onChange={e => updateSkill(i,"level",e.target.value)}>
                    {SKILL_LEVELS.map(l => <option key={l} value={l}>{t(LEVEL_KEY[l])}</option>)}
                  </select>
                  {skills.length > 1 && (
                    <button type="button" onClick={() => removeSkill(i)}
                      style={{border:"none", background:"none", color:"#EF4444", cursor:"pointer"}}>
                      <FiTrash2 size={15}/>
                    </button>
                  )}
                </div>
              ))}
              <button type="button" onClick={addSkill} style={{...btnStyle, marginBottom:"1rem"}}>
                <FiPlus size={13}/> {t("register.addSkillShort")}
              </button>

              <p style={{fontWeight:700, fontSize:"0.85rem", color:"var(--text)", margin:"0.75rem 0 0.5rem"}}>{t("profile.languages")}</p>
              {languages.map((l, i) => (
                <div key={i} className="reg-skill-row">
                  <AuthInput placeholder={t("profileEditor.languageNamePlaceholder")} value={l.name}
                    onChange={e => updateLang(i,"name",e.target.value)}/>
                  <select className="auth-input" style={{paddingLeft:"0.75rem"}}
                    value={l.level} onChange={e => updateLang(i,"level",e.target.value)}>
                    {LANG_LEVELS.map(lv => <option key={lv} value={lv}>{t(LEVEL_KEY[lv])}</option>)}
                  </select>
                  {languages.length > 1 && (
                    <button type="button" onClick={() => removeLang(i)}
                      style={{border:"none", background:"none", color:"#EF4444", cursor:"pointer"}}>
                      <FiTrash2 size={15}/>
                    </button>
                  )}
                </div>
              ))}
              <button type="button" onClick={addLang} style={{...btnStyle, marginBottom:"1rem"}}>
                <FiPlus size={13}/> {t("register.addLangShort")}
              </button>

              <p style={{fontWeight:700, fontSize:"0.85rem", color:"var(--text)", margin:"0.75rem 0 0.5rem"}}>{t("profileEditor.socialLinks")}</p>
              <Field label={t("profileEditor.linkedin")}>
                <AuthInput placeholder="https://linkedin.com/in/sarra-benali"
                  value={socialLinks.linkedin}
                  onChange={e => setSocialLinks({...socialLinks, linkedin:e.target.value})}/>
              </Field>
              <Field label={t("profileEditor.github")}>
                <AuthInput placeholder="https://github.com/sarrabenali"
                  value={socialLinks.github}
                  onChange={e => setSocialLinks({...socialLinks, github:e.target.value})}/>
              </Field>

              <div className="auth-nav">
                <button type="button" className="auth-nav-back" onClick={prevStep}>
                  <FiChevronLeft/> {t("offers.previous")}
                </button>
                <button type="submit" className="auth-submit-btn" style={{marginBottom:0}}>
                  {t("register.next")} <FiArrowRight size={15}/>
                </button>
              </div>
            </form>
          )}

          {/* ── Étape 4 : Confirmation ───────────────────────────────── */}
          {step === 4 && (
            <form onSubmit={handleSubmit} className="auth-form-body" noValidate>
              <BoxReveal width="100%"><h2 className="auth-form-title" style={{marginBottom:"1rem"}}>{t("register.summary")}</h2></BoxReveal>

              <div style={{...cardStyle, display:"flex", flexDirection:"column", gap:"0.75rem"}}>
                {[
                  [t("register.nameLabel"), account.name],
                  [t("profile.email"), account.email],
                  [t("register.genderLabel"), account.gender === "femme" ? t("register.genderFemale") : t("register.genderMale")],
                  account.university ? [t("profile.university"), account.university] : null,
                  education.institution ? [t("profileEditor.formation"), `${education.institution} — ${education.degree}`] : null,
                  experience.filter(e => e.company).length > 0 ? [t("register.expLabel"), experience.filter(e => e.company).map(e => e.company).join(", ")] : null,
                  skills.filter(s => s.name).length > 0 ? [t("profileEditor.skills"), skills.filter(s => s.name).map(s => s.name).join(", ")] : null,
                ].filter(Boolean).map(([label, value], i) => (
                  <div key={i} style={{display:"flex", justifyContent:"space-between", fontSize:"0.875rem", gap:"1rem"}}>
                    <span style={{color:"var(--text-secondary)", fontWeight:600, flexShrink:0}}>{label}</span>
                    <span style={{color:"var(--text)", textAlign:"right"}}>{value}</span>
                  </div>
                ))}
              </div>

              <div className="auth-nav">
                <button type="button" className="auth-nav-back" onClick={prevStep}>
                  <FiChevronLeft/> {t("offers.previous")}
                </button>
                <button type="submit" className="auth-submit-btn" style={{marginBottom:0}} disabled={loading}>
                  {loading ? t("register.creating") : <>{t("register.confirm")} <FiArrowRight size={15}/></>}
                </button>
              </div>
            </form>
          )}

        </div>
      </div>
    </div>
  );
}