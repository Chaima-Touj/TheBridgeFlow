import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext.jsx";
import { ceremonyService } from "../services/ceremony.service.js";

// Logique de soumission du vote — extraite de CeremonyPage.jsx pour être
// réutilisée telle quelle (pas réimplémentée) sur CeremonyProjectDetail.jsx,
// même pattern que useCeremonySelection.js/useCeremonyVoteGate.js. Le
// clearSelection réel (useCeremonySelection) est injecté par l'appelant :
// ce hook ne connaît que la soumission, pas l'état de sélection lui-même.
export function useCeremonyVoteSubmit(clearSelection) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState("");
  const [success,    setSuccess]    = useState(false);

  const confirmVote = async (selected) => {
    if (selected.length < 1) return;

    if (!user) {
      navigate("/login");
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      await ceremonyService.vote(selected);
      setSuccess(true);
      clearSelection();
    } catch (err) {
      setError(err.response?.data?.message || t("ceremony.voteError"));
    } finally {
      setSubmitting(false);
    }
  };

  const clearError = () => setError("");

  return { submitting, error, success, confirmVote, clearError };
}
