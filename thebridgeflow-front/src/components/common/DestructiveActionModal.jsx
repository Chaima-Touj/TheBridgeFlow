import { FiAlertTriangle, FiLoader, FiTrash2 } from "react-icons/fi";
import Modal from "./Modal.jsx";
import "./DestructiveActionModal.css";

export default function DestructiveActionModal({
  title,
  description,
  itemName,
  consequence,
  error,
  isLoading,
  confirmLabel,
  loadingLabel,
  cancelLabel,
  isCancellation = false,
  onCancel,
  onConfirm,
}) {
  return (
    <Modal
      title={title}
      onClose={isLoading ? () => {} : onCancel}
      maxWidth={480}
      className="dam-modal"
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={isLoading} autoFocus>
            {cancelLabel}
          </button>
          <button type="button" className="btn dam-confirm" onClick={onConfirm} disabled={isLoading}>
            {isLoading
              ? <FiLoader size={15} className="dam-spinner" />
              : isCancellation ? <FiAlertTriangle size={15} /> : <FiTrash2 size={15} />}
            {isLoading ? loadingLabel : confirmLabel}
          </button>
        </>
      }
    >
      <div className="dam-content" aria-busy={isLoading}>
        <span className="dam-icon" aria-hidden="true"><FiAlertTriangle size={22} /></span>
        <p>{description} {itemName && <strong>{itemName}</strong>}</p>
        {consequence && <p className="dam-consequence">{consequence}</p>}
        {error && <p className="dam-error" role="alert">{error}</p>}
      </div>
    </Modal>
  );
}
