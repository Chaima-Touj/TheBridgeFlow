// eslint-disable-next-line no-unused-vars
import React from "react";
import "./SectionCard.css";

/**
 * SectionCard - Conteneur pour chaque section du profil
 * @param {string} title - Titre de la section
 * @param {React.ReactNode} icon - Icône facultative
 * @param {React.ReactNode} children - Contenu de la section
 * @param {string} className - Classe CSS additionnelle
 */
const SectionCard = ({ title, icon, children, className = "" }) => {
  return (
    <div className={`section-card ${className}`}>
      {title && (
        <h2 className="section-title">
          {icon && <span className="section-icon">{icon}</span>}
          {title}
        </h2>
      )}
      <div className="section-content">{children}</div>
    </div>
  );
};

export default SectionCard;