import { useCallback, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import PhoneRequiredModal from "../components/common/PhoneRequiredModal.jsx";
import { isValidTunisianPhone } from "../utils/tunisianPhone.js";

export function usePhoneRequirement() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const pendingAction = useRef(null);

  const runWithPhone = useCallback(async (action) => {
    if (user?.role !== "étudiant" || isValidTunisianPhone(user.phone)) {
      await action();
      return true;
    }

    pendingAction.current = action;
    setIsOpen(true);
    return false;
  }, [user]);

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
    ? <PhoneRequiredModal onClose={closeModal} onSaved={handleSaved} />
    : null;

  return { runWithPhone, phoneRequiredModal: modal };
}
