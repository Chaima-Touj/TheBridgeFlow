import { Inbox } from "lucide-react";
import "./candidatesShared.css";

export default function EmptyState({ icon: Icon = Inbox, title, description, action = null, className = "" }) {
  return (
    <div className={`cnd-empty ${className}`}>
      <span className="cnd-empty__icon" aria-hidden="true"><Icon size={24} strokeWidth={1.75} /></span>
      {title && <p className="cnd-empty__title">{title}</p>}
      {description && <p className="cnd-empty__text">{description}</p>}
      {action && <div className="cnd-empty__action">{action}</div>}
    </div>
  );
}
