import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FiMoreVertical } from "react-icons/fi";
import "./AdminRowActions.css";

export default function AdminRowActions({ actions, ariaLabel = "Actions" }) {
  const [open, setOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState(null);
  const menuRef = useRef(null);
  const triggerRef = useRef(null);
  const dropdownRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const closeOutside = (event) => {
      if (!menuRef.current?.contains(event.target) && !dropdownRef.current?.contains(event.target)) setOpen(false);
    };
    const closeOnEscape = (event) => { if (event.key === "Escape") setOpen(false); };
    const updatePosition = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const menuHeight = Math.min(actions.length * 40 + 12, window.innerHeight - 16);
      const top = rect.bottom + 5 + menuHeight <= window.innerHeight
        ? rect.bottom + 5
        : Math.max(8, rect.top - menuHeight - 5);
      setMenuPosition({ top, left: Math.max(8, Math.min(rect.right - 176, window.innerWidth - 184)) });
    };
    updatePosition();
    document.addEventListener("mousedown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      document.removeEventListener("mousedown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, actions.length]);

  if (!actions?.length) return <span aria-hidden="true">—</span>;

  return (
    <div className="admin-row-actions" ref={menuRef}>
      <button
        type="button"
        className="admin-row-actions__trigger"
        ref={triggerRef}
        onClick={() => setOpen((value) => !value)}
        aria-label={ariaLabel}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <FiMoreVertical size={18} />
      </button>
      {open && menuPosition && createPortal(
        <div className="admin-row-actions__menu" role="menu" ref={dropdownRef} style={menuPosition}>
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
        </div>,
        document.body
      )}
    </div>
  );
}
