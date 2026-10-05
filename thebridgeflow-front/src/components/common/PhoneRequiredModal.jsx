import { useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../context/AuthContext.jsx";
import { profileService } from "../../services/profile.service.js";
import { normalizeTunisianPhone } from "../../utils/tunisianPhone.js";
import "./PhoneRequiredModal.css";

export default function PhoneRequiredModal({ onClose, onSaved }) {
  const { t } = useTranslation();
  const { user, refreshUser } = useAuth();
  const [phone, setPhone] = useState(user?.phone || "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const normalizedPhone = normalizeTunisianPhone(phone);
    if (!normalizedPhone) {
      setError(t("phoneRequirement.invalidPhone"));
      return;
    }

    setSaving(true);
    setError("");
    try {
      await profileService.updateProfile({ phone: normalizedPhone });
      const refreshedUser = await refreshUser();
      if (!refreshedUser || refreshedUser.phone !== normalizedPhone) {
        throw new Error(t("phoneRequirement.saveError"));
      }
      await onSaved();
    } catch (saveError) {
      setError(saveError?.response?.data?.message || saveError.message || t("phoneRequirement.saveError"));
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div className="phone-required-overlay" role="presentation">
      <section className="phone-required-modal" role="dialog" aria-modal="true" aria-labelledby="phone-required-title">
        <h2 id="phone-required-title">{t("phoneRequirement.modalTitle")}</h2>
        <p>{t("phoneRequirement.modalMessage")}</p>
        <form onSubmit={handleSubmit}>
          <label htmlFor="required-student-phone">{t("phoneRequirement.phoneLabel")}</label>
          <input
            id="required-student-phone"
            type="tel"
            autoComplete="tel"
            inputMode="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder={t("phoneRequirement.phonePlaceholder")}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? "required-student-phone-error" : undefined}
          />
          {error && <p className="phone-required-error" id="required-student-phone-error" role="alert">{error}</p>}
          <div className="phone-required-actions">
            <button type="button" className="phone-required-cancel" onClick={onClose} disabled={saving}>
              {t("common.cancel")}
            </button>
            <button type="submit" className="phone-required-submit" disabled={saving}>
              {saving ? t("phoneRequirement.saving") : t("phoneRequirement.save")}
            </button>
          </div>
        </form>
      </section>
    </div>,
    document.body
  );
}
