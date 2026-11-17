import { useCallback, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import PhoneRequiredModal from "../components/common/PhoneRequiredModal.jsx";
import { isValidTunisianPhone } from "../utils/tunisianPhone.js";

// `options` ({ title, message }) personnalise le texte de la fenêtre pour une
// action précise (ex. postuler à une offre) ; sinon textes génériques.
export function usePhoneRequirement() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState({});
  const pendingAction = useRef(null);

  const runWithPhone = useCallback(async (action, modalOptions = {}) => {
    if (user?.role !== "étudiant" || isValidTunisianPhone(user.phone)) {
      await action();
      return true;
    }

    pendingAction.current = action;
    setOptions(modalOptions);
    setIsOpen(true);
    return false;
  }, [user]);

  // Ouvre la saisie du numéro même si le profil chargé côté client semble en
  // avoir un : utilisé quand le serveur répond STUDENT_PHONE_REQUIRED.
  const askForPhone = useCallback((action = null, modalOptions = {}) => {
    pendingAction.current = action;
    setOptions(modalOptions);
    setIsOpen(true);
  }, []);

  const handleSaved = useCallback(async () => {
    const action = pendingAction.current;
    pendingAction.current = null;
    setIsOpen(false);
    if (action) await action();
  }, []);

  const closeModal = useCallback(() => {
    pendingAction.current = null;
    setIsOpen(false);
  }, []);

  const modal = isOpen
    ? <PhoneRequiredModal title={options.title} message={options.message} onClose={closeModal} onSaved={handleSaved} />
    : null;

  return { runWithPhone, askForPhone, phoneRequiredModal: modal };
}
