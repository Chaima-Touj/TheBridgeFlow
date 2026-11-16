import { useState } from "react";
import { UserRound } from "lucide-react";
import { avatarTone, getInitials, safeExternalUrl } from "../candidatesUtils.js";
import { toneClass } from "../candidatesConfig.js";
import "./candidatesShared.css";

// Avatar d'un étudiant : photo de profil si disponible (et chargeable), sinon
// initiales sur un dégradé dont la teinte est stable pour un même nom.
export default function CandidateAvatar({ name = "", avatarUrl = "", size = "md", className = "" }) {
  const [failedUrl, setFailedUrl] = useState("");
  const isRelative = typeof avatarUrl === "string" && /^\/(?![\\/])/.test(avatarUrl);
  const src = isRelative ? avatarUrl : safeExternalUrl(avatarUrl);
  const showImage = Boolean(src) && failedUrl !== src;
  const initials = getInitials(name);

  return (
    <span className={`cnd-avatar cnd-avatar--${size} ${toneClass(avatarTone(name))} ${className}`} aria-hidden="true">
      {showImage ? (
        <img src={src} alt="" loading="lazy" decoding="async" onError={() => setFailedUrl(src)} />
      ) : initials ? (
        initials
      ) : (
        <UserRound size={size === "xl" ? 28 : 16} strokeWidth={1.9} />
      )}
    </span>
  );
}
