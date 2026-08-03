import { useLang } from "../../context/LangContext.jsx";
import "./LangFlags.css";

const LANG_OPTIONS = [
  { code: "fr", label: "Français", img: "fr" },
  { code: "en", label: "English",  img: "gb" },
  { code: "ar", label: "العربية",  img: "tn" },
];

export default function LangFlags() {
  const { lang, changeLang } = useLang();
  return (
    <div className="lf-flags">
      {LANG_OPTIONS.map((l) => (
        <button
          key={l.code}
          className={`lf-btn${lang === l.code ? " lf-btn--active" : ""}`}
          onClick={() => changeLang(l.code)}
          aria-label={l.label}
          title={l.label}
        >
          <img
            src={`https://flagcdn.com/w40/${l.img}.png`}
            srcSet={`https://flagcdn.com/w80/${l.img}.png 2x`}
            alt={l.label}
            className="lf-flag-img"
            draggable={false}
          />
        </button>
      ))}
    </div>
  );
}
