import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../context/AuthContext.jsx";
import DashboardLayout from "../../components/layout/DashboardLayout.jsx";
import ProfileView from "../../components/profile/ProfileView";
import ProfileEditor from "../../components/profile/ProfileEditor";
import Loader from "../../components/common/Loader.jsx";
import { profileService } from "../../services/profile.service";
import "./Profile.css";

const Profile = () => {
  const { t } = useTranslation();
  const { user, refreshUser } = useAuth();

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState("");

  const loadProfile = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await profileService.getMyProfile();
      setProfile(response?.data?.user || response?.data?.profile || response?.data);
    } catch (err) {
      console.error("Erreur chargement profil:", err);
      setError(err?.response?.data?.message || t("settings.toast.loadError"));
      setProfile(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    profileService.getMyProfile()
      .then((response) => {
        if (!active) return;
        setProfile(response?.data?.user || response?.data?.profile || response?.data);
      })
      .catch((err) => {
        if (!active) return;
        console.error("Erreur chargement profil:", err);
        setError(err?.response?.data?.message || t("settings.toast.loadError"));
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const handleEditSuccess = async () => {
    setIsEditing(false);
    await loadProfile();
    refreshUser();
  };

  const handleCVUpload = async (formData) => {
    try {
      await profileService.uploadCV(formData);
      await loadProfile();
      refreshUser();
    } catch (err) {
      console.error("Erreur upload CV:", err);
      throw err;
    }
  };

  const handleCVDelete = async () => {
    try {
      await profileService.updateProfile({ cv: { fileName: "", fileUrl: "" } });
      await loadProfile();
      refreshUser();
    } catch (err) {
      console.error("Erreur suppression CV:", err);
      throw err;
    }
  };

  if (loading) {
    return (
      <DashboardLayout title={t("profile.pageTitle")}>
        <div className="profile-loading"><Loader size="lg" label={t("profile.loading")} /></div>
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout title={t("profile.pageTitle")}>
        <div className="profile-error">
          <h3>{t("profile.errorTitle")}</h3>
          <p>{error}</p>
          <button className="btn btn-primary" onClick={loadProfile}>{t("offers.retry")}</button>
        </div>
      </DashboardLayout>
    );
  }

  if (!profile) {
    return (
      <DashboardLayout title={t("profile.pageTitle")}>
        <div className="profile-empty"><p>{t("profile.emptyData")}</p></div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title={t("profile.pageTitleWithName", { name: profile?.name || user?.name || "" })}>
      {isEditing ? (
        <ProfileEditor
          initialData={profile}
          onCancel={() => setIsEditing(false)}
          onSuccess={handleEditSuccess}
          onSubmit={async (data) => {
            const { name, phone, university, specialty, bio, education, experience, skills, languages, socialLinks, gender } = data;
            await profileService.updateProfile({ name, phone, university, specialty, bio, education, experience, skills, languages, socialLinks, gender: gender || undefined });
          }}
        />
      ) : (
        <ProfileView
          profile={profile}
          onEdit={() => setIsEditing(true)}
          onCVUpload={handleCVUpload}
          onCVDelete={handleCVDelete}
        />
      )}
    </DashboardLayout>
  );
};

export default Profile;
