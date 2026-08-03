import "./Loader.css";

/**
 * Loader — animation type "signal WiFi" (arcs concentriques + point central)
 * en dégradé magenta → orange, charte TheBridgeFlow.
 */
export default function Loader({ size = "md", label, className = "" }) {
  return (
    <div className={`tbf-loader tbf-loader--${size} ${className}`} role="status" aria-live="polite">
      <span className="tbf-loader__wifi">
        <span className="tbf-loader__arc tbf-loader__arc--1" />
        <span className="tbf-loader__arc tbf-loader__arc--2" />
        <span className="tbf-loader__arc tbf-loader__arc--3" />
        <span className="tbf-loader__dot" />
      </span>
      {label && <p className="tbf-loader__label">{label}</p>}
    </div>
  );
}
