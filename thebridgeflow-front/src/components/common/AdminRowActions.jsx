import { useEffect, useRef, useState } from "react";
import { FiMoreVertical } from "react-icons/fi";
import "./AdminRowActions.css";

export default function AdminRowActions({ actions, ariaLabel = "Actions" }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const closeOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) setOpen(false);
    };
    const closeOnEscape = (event) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  if (!actions?.length) return <span aria-hidden="true">—</span>;

  return (
    <div className="admin-row-actions" ref={menuRef}>
      <button
        type="button"
        className="admin-row-actions__trigger"
        onClick={() => setOpen((value) => !value)}
        aria-label={ariaLabel}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <FiMoreVertical size={18} />
      </button>
      {open && (
        <div className="admin-row-actions__menu" role="menu">
          {actions.map(({ label, onClick, disabled = false, danger = false }, index) => (
            <button
              type="button"
              role="menuitem"
              key={`${label}-${index}`}
              className={danger ? "admin-row-actions__item admin-row-actions__item--danger" : "admin-row-actions__item"}
              disabled={disabled}
              onClick={() => { setOpen(false); onClick(); }}
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
