import "./Loader.css";

export default function Loader({ size = "md", label, className = "" }) {
  return (
    <div className={`tbf-loader tbf-loader--${size} ${className}`} role="status" aria-live="polite">
      <span className="tbf-loader__mark">
        <span className="tbf-loader__ring" />
        <img src="/favicon.png" alt="" className="tbf-loader__logo" />
      </span>
      {label && <p className="tbf-loader__label">{label}</p>}
    </div>
  );
}
