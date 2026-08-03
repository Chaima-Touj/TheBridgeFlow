// src/components/profile/ProfileEditor.jsx
import { useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import { useTranslation } from "react-i18next";
import {
  FiPlus,
  FiTrash2,
  FiUpload,
  FiUser,
  FiBriefcase,
  FiBookOpen,
  FiLink,
  FiCode,
  FiGlobe,
} from "react-icons/fi";
import SectionCard from "../common/SectionCard";
import FileUpload from "../common/FileUpload";
import "./ProfileEditor.css";

const splitComma = (val, orig) =>
  typeof orig === "string"
    ? orig.split(",").map((s) => s.trim()).filter(Boolean)
    : val;

/* An empty <input type="date"> submits "" (not null/undefined). yup.date()
   treats "" as an invalid date rather than an absent one, so a genuinely
   optional end date (e.g. education/experience still in progress) blocked
   the whole form with a silent validation failure. Normalize "" to null
   before yup's own date parsing runs. */
const emptyStringToNull = (value, originalValue) =>
  originalValue === "" ? null : value;

/* Les messages yup stockent une CLÉ i18n (pas le texte) : traduits au rendu via t(errors.x.message) */
const experienceSchema = yup.object().shape({
  id: yup.string().nullable(),
  company: yup.string().required("profileEditor.errors.companyRequired"),
  position: yup.string().required("profileEditor.errors.positionRequired"),
  location: yup.string().nullable(),
  startDate: yup.date().required("profileEditor.errors.startDateRequired"),
  endDate: yup.date().nullable().transform(emptyStringToNull),
  current: yup.boolean().default(false),
  description: yup.string().nullable(),
  technologies: yup.array().transform(splitComma).of(yup.string()).nullable(),
});

const skillSchema = yup.object().shape({
  id: yup.string().nullable(),
  name: yup.string().required("profileEditor.errors.skillNameRequired"),
  category: yup.string().nullable(),
  level: yup.string()
    .oneOf(["Débutant", "Intermédiaire", "Avancé", "Expert"])
    .required("profileEditor.errors.levelRequired"),
});

const languageSchema = yup.object().shape({
  id: yup.string().nullable(),
  name: yup.string().required("profileEditor.errors.languageNameRequired"),
  level: yup.string()
    .oneOf(["Débutant", "Intermédiaire", "Courant", "Natif"])
    .required("profileEditor.errors.levelRequired"),
});

const studentProfileSchema = yup.object().shape({
  name: yup.string().required("profileEditor.errors.nameRequired"),
  phone: yup.string().nullable(),
  university: yup.string().nullable(),
  specialty: yup.string().nullable(),
  email: yup.string().email("profileEditor.errors.emailInvalid").required("profileEditor.errors.emailRequired"),
  gender: yup.string().oneOf(["homme", "femme", ""]).nullable(),
  password: yup.string()
    .when("isRegistering", {
      is: true,
      then: (schema) => schema.required("profileEditor.errors.passwordRequired").min(6, "settings.errors.minLength6"),
      otherwise: (schema) => schema.nullable(),
    }),
  role: yup.string().oneOf(["étudiant"]).default("étudiant"),
  bio: yup.string().nullable(),
  education: yup.object().shape({
    institution: yup.string().required("profileEditor.errors.institutionRequired"),
    degree: yup.string().required("profileEditor.errors.degreeRequired"),
    fieldOfStudy: yup.string().required("profileEditor.errors.fieldOfStudyRequired"),
    startDate: yup.date().required("profileEditor.errors.startDateRequired"),
    endDate: yup.date().nullable().transform(emptyStringToNull),
    current: yup.boolean().default(false),
    grade: yup.string().nullable(),
    courses: yup.array().transform(splitComma).of(yup.string()).nullable(),
  }),
  experience: yup.array().of(experienceSchema).default([]),
  skills: yup.array().of(skillSchema).default([]),
  languages: yup.array().of(languageSchema).default([]),
  cv: yup.object().shape({
    fileName: yup.string().nullable(),
    fileUrl: yup.string().nullable(),
  }),
  socialLinks: yup.object().shape({
    linkedin: yup.string().url("profileEditor.errors.urlInvalid").nullable(),
    github: yup.string().url("profileEditor.errors.urlInvalid").nullable(),
    portfolio: yup.string().url("profileEditor.errors.urlInvalid").nullable(),
  }),
});

const ProfileEditor = ({
  initialData = {},
  isRegistering = false,
  onSuccess,
  onCancel,
  onSubmit: externalSubmit,
}) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const defaultValues = {
    name: initialData.name || "",
    phone: initialData.phone || "",
    university: initialData.university || "",
    specialty: initialData.specialty || "",
    email: initialData.email || "",
    gender: initialData.gender || "",
    password: "",
    role: initialData.role || "étudiant",
    bio: initialData.bio || "",
    education: initialData.education || {
      institution: "",
      degree: "",
      fieldOfStudy: "",
      startDate: "",
      endDate: "",
      current: false,
      grade: "",
      courses: [],
    },
    experience: initialData.experience || [],
    skills: initialData.skills || [],
    languages: initialData.languages || [],
    cv: initialData.cv || { fileName: "", fileUrl: "" },
    socialLinks: initialData.socialLinks || { linkedin: "", github: "", portfolio: "" },
  };

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
  } = useForm({
    resolver: yupResolver(studentProfileSchema),
    defaultValues,
    context: { isRegistering },
  });

  const experienceFields = useFieldArray({ control, name: "experience" });
  const skillsFields = useFieldArray({ control, name: "skills" });
  const languagesFields = useFieldArray({ control, name: "languages" });

  const handleCVUpload = (file) => {
    if (!file) {
      setValue("cv", { fileName: "", fileUrl: "" });
      return;
    }
    setValue("cv", {
      fileName: file.name,
      fileUrl: URL.createObjectURL(file),
    });
  };

  const onFormSubmit = async (data) => {
    setLoading(true);
    setError(null);
    try {
      if (externalSubmit) {
        await externalSubmit(data);
      }
      if (onSuccess) onSuccess();
    } catch (err) {
      setError(err.response?.data?.message || t("profileEditor.genericError"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onFormSubmit)} className="profile-editor">
      {error && <div className="alert alert-danger">{error}</div>}

      <SectionCard title={t("profileEditor.identity")} icon={<FiUser size={18} />}>
        <div className="form-group">
          <label className="label">{t("profileEditor.fullName")}</label>
          <input {...register("name")} className="input" placeholder="Chima Touj" />
          {errors.name && <p className="error-text">{t(errors.name.message)}</p>}
        </div>
        <div className="form-group">
          <label className="label">{t("profileEditor.phone")}</label>
          <input {...register("phone")} className="input" placeholder={t("settings.compte.phonePlaceholder")} />
          {errors.phone && <p className="error-text">{t(errors.phone.message)}</p>}
        </div>
        <div className="form-group">
          <label className="label">{t("profileEditor.email")}</label>
          <input {...register("email")} type="email" className="input" placeholder="email@exemple.com" />
          {errors.email && <p className="error-text">{t(errors.email.message)}</p>}
        </div>
        <div className="form-group">
          <label className="label">{t("register.genderLabel")}</label>
          <div className="gender-toggle">
            <button type="button" className={`gender-btn ${watch("gender") === "femme" ? "active" : ""}`}
              onClick={() => setValue("gender", "femme", { shouldDirty: true })}>
              {t("register.genderFemale")}
            </button>
            <button type="button" className={`gender-btn ${watch("gender") === "homme" ? "active" : ""}`}
              onClick={() => setValue("gender", "homme", { shouldDirty: true })}>
              {t("register.genderMale")}
            </button>
          </div>
          {errors.gender && <p className="error-text">{t(errors.gender.message)}</p>}
        </div>
        {isRegistering && (
          <div className="form-group">
            <label className="label">{t("profileEditor.password")}</label>
            <input {...register("password")} type="password" className="input" placeholder="••••••••" />
            {errors.password && <p className="error-text">{t(errors.password.message)}</p>}
          </div>
        )}
        <div className="form-group">
          <label className="label">{t("profileEditor.bio")}</label>
          <textarea {...register("bio")} className="input" rows="3" placeholder={t("profileEditor.bioPlaceholder")} />
        </div>
      </SectionCard>

      <SectionCard title={t("profileEditor.formation")} icon={<FiBookOpen size={18} />}>
        <div className="form-row">
          <div className="form-group">
            <label className="label">{t("profile.university")}</label>
            <input {...register("university")} className="input" placeholder="IMSET" />
          </div>
          <div className="form-group">
            <label className="label">{t("profile.specialty")}</label>
            <input {...register("specialty")} className="input" placeholder={t("profileEditor.specialtyPlaceholder")} />
          </div>
        </div>
        <div className="form-group">
          <label className="label">{t("profileEditor.institution")}</label>
          <input {...register("education.institution")} className="input" placeholder="ESPRIT" />
          {errors.education?.institution && <p className="error-text">{t(errors.education.institution.message)}</p>}
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="label">{t("profileEditor.degree")}</label>
            <input {...register("education.degree")} className="input" placeholder={t("profileEditor.degreePlaceholder")} />
          </div>
          <div className="form-group">
            <label className="label">{t("profileEditor.fieldOfStudy")}</label>
            <input {...register("education.fieldOfStudy")} className="input" placeholder={t("profileEditor.fieldOfStudyPlaceholder")} />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="label">{t("profileEditor.startDate")}</label>
            <input {...register("education.startDate")} type="date" className="input" />
          </div>
          <div className="form-group">
            <label className="label">{t("profileEditor.endDate")}</label>
            <input {...register("education.endDate")} type="date" className="input" />
          </div>
        </div>
        <div className="form-group">
          <label className="checkbox-label">
            <input type="checkbox" {...register("education.current")} />
            {t("profileEditor.current")}
          </label>
        </div>
        <div className="form-group">
          <label className="label">{t("profileEditor.grade")}</label>
          <input {...register("education.grade")} className="input" placeholder="14.5/20" />
        </div>
        <div className="form-group">
          <label className="label">{t("profileEditor.courses")}</label>
          <input {...register("education.courses")} className="input" placeholder={t("profileEditor.coursesPlaceholder")} />
        </div>
      </SectionCard>

      <SectionCard title={t("profileEditor.experience")} icon={<FiBriefcase size={18} />}>
        {experienceFields.fields.map((field, index) => (
          <div key={field.id} className="dynamic-item">
            <div className="form-row">
              <div className="form-group">
                <label className="label">{t("profileEditor.company")}</label>
                <input {...register(`experience.${index}.company`)} className="input" placeholder="BeeCoders" />
              </div>
              <div className="form-group">
                <label className="label">{t("profileEditor.position")}</label>
                <input {...register(`experience.${index}.position`)} className="input" placeholder={t("profileEditor.positionPlaceholder")} />
              </div>
            </div>
            <div className="form-group">
              <label className="label">{t("profileEditor.location")}</label>
              <input {...register(`experience.${index}.location`)} className="input" placeholder={t("profileEditor.locationPlaceholder")} />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="label">{t("profileEditor.startDate")}</label>
                <input {...register(`experience.${index}.startDate`)} type="date" className="input" />
              </div>
              <div className="form-group">
                <label className="label">{t("profileEditor.endDate")}</label>
                <input {...register(`experience.${index}.endDate`)} type="date" className="input" />
              </div>
            </div>
            <div className="form-group">
              <label className="checkbox-label">
                <input type="checkbox" {...register(`experience.${index}.current`)} />
                {t("profileEditor.current")}
              </label>
            </div>
            <div className="form-group">
              <label className="label">{t("profileEditor.description")}</label>
              <textarea {...register(`experience.${index}.description`)} className="input" rows="2" />
            </div>
            <div className="form-group">
              <label className="label">{t("profileEditor.technologies")}</label>
              <input {...register(`experience.${index}.technologies`)} className="input" placeholder="React, Node.js" />
            </div>
            <button type="button" className="btn btn-danger btn-sm" onClick={() => experienceFields.remove(index)}>
              <FiTrash2 /> {t("notifications.deleteLabel")}
            </button>
            <hr className="dynamic-divider" />
          </div>
        ))}
        <button type="button" className="btn btn-outline btn-sm" onClick={() =>
          experienceFields.append({
            company: "",
            position: "",
            location: "",
            startDate: "",
            endDate: "",
            current: false,
            description: "",
            technologies: [],
          })
        }>
          <FiPlus /> {t("profileEditor.addExperience")}
        </button>
      </SectionCard>

      <SectionCard title={t("profileEditor.skills")} icon={<FiCode size={18} />}>
        {skillsFields.fields.map((field, index) => (
          <div key={field.id} className="dynamic-item inline-item">
            <div className="form-row">
              <div className="form-group">
                <label className="label">{t("profileEditor.skillName")}</label>
                <input {...register(`skills.${index}.name`)} className="input" placeholder="React" />
              </div>
              <div className="form-group">
                <label className="label">{t("profileEditor.level")}</label>
                <select {...register(`skills.${index}.level`)} className="input">
                  <option value="">{t("profileEditor.select")}</option>
                  <option value="Débutant">{t("profileEditor.levelDebutant")}</option>
                  <option value="Intermédiaire">{t("profileEditor.levelIntermediaire")}</option>
                  <option value="Avancé">{t("profileEditor.levelAvance")}</option>
                  <option value="Expert">{t("profileEditor.levelExpert")}</option>
                </select>
              </div>
            </div>
            <button type="button" className="btn btn-danger btn-sm" onClick={() => skillsFields.remove(index)}>
              <FiTrash2 />
            </button>
          </div>
        ))}
        <button type="button" className="btn btn-outline btn-sm" onClick={() => skillsFields.append({ name: "", level: "" })}>
          <FiPlus /> {t("profileEditor.addSkill")}
        </button>
      </SectionCard>

      <SectionCard title={t("profile.languages")} icon={<FiGlobe size={18} />}>
        {languagesFields.fields.map((field, index) => (
          <div key={field.id} className="dynamic-item inline-item">
            <div className="form-row">
              <div className="form-group">
                <label className="label">{t("profileEditor.languageName")}</label>
                <input {...register(`languages.${index}.name`)} className="input" placeholder={t("profileEditor.languageNamePlaceholder")} />
              </div>
              <div className="form-group">
                <label className="label">{t("profileEditor.level")}</label>
                <select {...register(`languages.${index}.level`)} className="input">
                  <option value="">{t("profileEditor.select")}</option>
                  <option value="Débutant">{t("profileEditor.levelDebutant")}</option>
                  <option value="Intermédiaire">{t("profileEditor.levelIntermediaire")}</option>
                  <option value="Courant">{t("profileEditor.levelCourant")}</option>
                  <option value="Natif">{t("profileEditor.levelNatif")}</option>
                </select>
              </div>
            </div>
            <button type="button" className="btn btn-danger btn-sm" onClick={() => languagesFields.remove(index)}>
              <FiTrash2 />
            </button>
          </div>
        ))}
        <button type="button" className="btn btn-outline btn-sm" onClick={() => languagesFields.append({ name: "", level: "" })}>
          <FiPlus /> {t("profileEditor.addLanguage")}
        </button>
      </SectionCard>

      {isRegistering && (
        <SectionCard title={t("profileEditor.cv")} icon={<FiUpload size={18} />}>
          <FileUpload
            onUpload={handleCVUpload}
            // eslint-disable-next-line react-hooks/incompatible-library
            currentFile={watch("cv.fileName")}
            accept=".pdf,.doc,.docx"
            maxSize={5 * 1024 * 1024}
          />
        </SectionCard>
      )}

      <SectionCard title={t("profileEditor.socialLinks")} icon={<FiLink size={18} />}>
        <div className="form-group">
          <label className="label">{t("profileEditor.linkedin")}</label>
          <input {...register("socialLinks.linkedin")} className="input" placeholder="https://linkedin.com/in/..." />
        </div>
        <div className="form-group">
          <label className="label">{t("profileEditor.github")}</label>
          <input {...register("socialLinks.github")} className="input" placeholder="https://github.com/..." />
        </div>
        <div className="form-group">
          <label className="label">{t("profileEditor.portfolio")}</label>
          <input {...register("socialLinks.portfolio")} className="input" placeholder="https://..." />
        </div>
      </SectionCard>

      <div className="form-actions">
        {onCancel && (
          <button type="button" className="btn btn-outline btn-block" onClick={onCancel} disabled={loading}>
            {t("common.cancel")}
          </button>
        )}
        <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
          {loading ? t("common.loading") : isRegistering ? t("profileEditor.createAccount") : t("profileEditor.saveChanges")}
        </button>
      </div>
    </form>
  );
};

export default ProfileEditor;
