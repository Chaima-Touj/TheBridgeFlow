import "./candidatesShared.css";

// Bloc de chargement animé (shimmer). `circle` pour un avatar.
export default function Skeleton({ width = "100%", height = 14, circle = false, className = "", style = {} }) {
  return (
    <span
      className={`cnd-skel ${circle ? "cnd-skel--circle" : ""} ${className}`}
      style={{ width, height, ...style }}
      aria-hidden="true"
    />
  );
}
