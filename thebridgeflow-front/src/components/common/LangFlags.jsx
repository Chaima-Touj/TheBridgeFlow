import { useLang } from "../../context/langContext.js";
import { useEffect, useRef, useState } from "react";
import { FiGlobe, FiX } from "react-icons/fi";
import "./LangFlags.css";

const LANG_OPTIONS = [
  { code: "fr", label: "Français", img: "fr" },
  { code: "en", label: "English",  img: "gb" },
  { code: "ar", label: "العربية",  img: "tn" },
];

export default function LangFlags() {
  const { lang, changeLang } = useLang();
  const [open, setOpen] = useState(false);
  const dialogRef = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const closeOnEscape = (event) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [open]);
  return (
    <>
      <button type="button" className="lf-trigger" onClick={() => setOpen(true)} aria-label="Choose a language" title="Choose a language">
        <FiGlobe size={19} />
      </button>
      {open && (
        <div className="lf-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
          <div className="lf-dialog" role="dialog" aria-modal="true" aria-labelledby="lf-title" ref={dialogRef}>
            <div className="lf-dialog__header">
              <h2 id="lf-title">Choose a language</h2>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close"><FiX size={20} /></button>
            </div>
            <div className="lf-options">
              {LANG_OPTIONS.map((l) => (
                <button key={l.code} className={`lf-option${lang === l.code ? " lf-option--active" : ""}`} onClick={() => { changeLang(l.code); setOpen(false); }} aria-current={lang === l.code ? "true" : undefined}>
                  <img src={`https://flagcdn.com/w40/${l.img}.png`} alt="" className="lf-flag-img" draggable={false} />
                  <span>{l.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
