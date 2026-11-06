import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowDownToLine,
  ArrowUpRight,
  BellRing,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock3,
  Eye,
  EyeOff,
  ImagePlus,
  Mail,
  MapPin,
  MessageSquareText,
  MonitorPlay,
  Star,
  UserRound,
  Video,
  X,
} from "lucide-react";
import "./EventFeedbackPreviewPage.css";

const feedbackExamples = [
  {
    id: "feedback-1",
    eventId: "event-x",
    name: "Amira Ben Salem",
    date: "6 novembre 2026",
    rating: 5,
    text: "Atelier très enrichissant, avec des exemples concrets et une équipe à l'écoute. J'ai appris à mieux structurer mes prompts.",
    image: "",
    published: false,
  },
  {
    id: "feedback-2",
    eventId: "event-y",
    name: "Youssef Trabelsi",
    date: "6 novembre 2026",
    rating: 4,
    text: "Très bonne organisation et contenu utile. J'aurais aimé avoir un peu plus de temps pour les exercices pratiques.",
    image: "",
    published: false,
  },
  {
    id: "feedback-3",
    eventId: "event-z",
    name: "Sarra Gharbi",
    date: "5 novembre 2026",
    rating: 5,
    text: "Une expérience motivante, claire et directement applicable dans mes projets.",
    image: "",
    published: false,
  },
  {
    id: "feedback-4",
    eventId: "event-y",
    name: "Nour Ben Amor",
    date: "4 novembre 2026",
    rating: 5,
    text: "Une rencontre inspirante et des échanges très utiles avec les intervenants.",
    image: "",
    published: false,
  },
];

const eventExamples = [
  { id: "event-x", title: "Atelier IA Générative", date: "5 novembre 2026" },
  { id: "event-y", title: "Conférence Carrières Tech", date: "4 novembre 2026" },
  { id: "event-z", title: "Atelier CV & LinkedIn", date: "3 novembre 2026" },
];

const eventDetails = {
  id: "event-x",
  title: "Atelier IA Générative",
  date: "Jeudi 5 novembre 2026",
  time: "14:00 – 16:00",
  location: "FIQR Coworking Space, Ariana",
  format: "Présentiel",
};

function PreviewModal({ title, onClose, children, className = "" }) {
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="evp-overlay"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className={`evp-modal ${className}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="evp-modal-title"
      >
        <div className="evp-modal__header">
          <h2 id="evp-modal-title">{title}</h2>
          <button className="evp-icon-button" type="button" onClick={onClose} aria-label="Fermer">
            <X size={19} />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}

function RatingStars({ rating, onChange, label = "Évaluation" }) {
  return (
    <div className="evp-rating" role="group" aria-label={label}>
      {[1, 2, 3, 4, 5].map((value) => (
        <button
          key={value}
          type="button"
          className={`evp-rating__star${value <= rating ? " is-active" : ""}`}
          onClick={() => onChange(value)}
          aria-label={`${value} étoile${value > 1 ? "s" : ""}`}
          aria-pressed={value === rating}
        >
          <Star size={25} fill={value <= rating ? "currentColor" : "none"} />
        </button>
      ))}
    </div>
  );
}

function EventPreview({ onOpenFeedback, publishedFeedbacks }) {
  return (
    <>
      <section className="evp-event-hero">
        <div className="evp-event-hero__copy">
          <span className="evp-eyebrow"><span className="evp-status-dot" /> Événement terminé</span>
          <h1>{eventDetails.title}</h1>
          <p>Merci d’avoir participé. Votre expérience aide notre équipe à rendre les prochains événements encore meilleurs.</p>
          <div className="evp-event-hero__actions">
            <button className="evp-button evp-button--primary" type="button" onClick={onOpenFeedback}>
              <MessageSquareText size={17} /> Donner mon avis
            </button>
            <a className="evp-button evp-button--quiet" href="#evp-about">
              À propos de l’événement <ArrowUpRight size={16} />
            </a>
          </div>
        </div>
        <div className="evp-hero-art" aria-hidden="true">
          <div className="evp-hero-art__orb evp-hero-art__orb--one" />
          <div className="evp-hero-art__orb evp-hero-art__orb--two" />
          <div className="evp-hero-art__card">
            <div className="evp-hero-art__icon"><MonitorPlay size={31} /></div>
            <span>THEBRIDGEFLOW</span>
            <strong>Learn. Build. Connect.</strong>
            <div className="evp-hero-art__line" />
          </div>
          <div className="evp-hero-art__spark evp-hero-art__spark--one" />
          <div className="evp-hero-art__spark evp-hero-art__spark--two" />
        </div>
      </section>

      <section className="evp-details-strip" aria-label="Détails de l'événement">
        <div className="evp-detail-item">
          <span className="evp-detail-item__icon"><CalendarDays size={19} /></span>
          <span><small>Date</small><strong>{eventDetails.date}</strong></span>
        </div>
        <div className="evp-detail-item">
          <span className="evp-detail-item__icon"><Clock3 size={19} /></span>
          <span><small>Horaire</small><strong>{eventDetails.time}</strong></span>
        </div>
        <div className="evp-detail-item">
          <span className="evp-detail-item__icon"><MapPin size={19} /></span>
          <span><small>Lieu</small><strong>{eventDetails.location}</strong></span>
        </div>
        <div className="evp-detail-item">
          <span className="evp-detail-item__icon"><Video size={19} /></span>
          <span><small>Format</small><strong>{eventDetails.format}</strong></span>
        </div>
      </section>

      <section className="evp-about" id="evp-about">
        <div className="evp-section-heading">
          <div>
            <span className="evp-eyebrow">Retour sur l’événement</span>
            <h2>À propos de l’événement</h2>
          </div>
          <p>Un moment pour apprendre, pratiquer et échanger autour de l’intelligence artificielle.</p>
        </div>
        <div className="evp-about__body">
          <p>
            Pendant cet atelier, les participants ont exploré les bases de l’IA générative,
            testé des outils actuels et découvert comment les intégrer dans leurs projets.
          </p>
          <a className="evp-replay-link" href="#evp-location">
            <span className="evp-replay-link__icon"><MonitorPlay size={20} /></span>
            <span><strong>Retrouver les informations de l’événement</strong><small>Consulter le lieu et les détails pratiques</small></span>
            <ArrowUpRight size={19} />
          </a>
        </div>
      </section>

      <section className="evp-public-feedback">
        <div className="evp-section-heading">
          <div>
            <span className="evp-eyebrow">Avis vérifiés</span>
            <h2>Les retours des participants</h2>
          </div>
          <span className="evp-public-feedback__count">{publishedFeedbacks.length} avis publiés</span>
        </div>
        {publishedFeedbacks.length ? (
          <div className="evp-public-feedback__grid">
            {publishedFeedbacks.map((feedback) => (
              <article className="evp-public-feedback__card" key={feedback.id}>
                <div className="evp-feedback-card__stars" aria-label={`${feedback.rating} sur 5 étoiles`}>
                  {Array.from({ length: 5 }, (_, index) => <Star key={index} size={16} fill={index < feedback.rating ? "currentColor" : "none"} />)}
                </div>
                <p>{feedback.text}</p>
                <div className="evp-public-feedback__author">
                  <span className="evp-feedback-card__avatar">
                    {feedback.image ? <img src={feedback.image} alt="" /> : <UserRound size={20} />}
                  </span>
                  <span><strong>{feedback.name}</strong><small>Participant · {feedback.date}</small></span>
                  <CheckCircle2 size={17} aria-label="Avis publié par un participant" />
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="evp-public-feedback__empty">
            <MessageSquareText size={20} />
            <span>Les avis approuvés apparaîtront ici.</span>
          </div>
        )}
      </section>

      <section className="evp-location" id="evp-location">
        <div className="evp-section-heading">
          <div>
            <span className="evp-eyebrow">Nous trouver</span>
            <h2>Le lieu de l’événement</h2>
          </div>
          <a
            className="evp-map-link"
            href="https://www.google.com/maps/search/?api=1&query=FIQR+Coworking+Space+Ariana+Tunisia"
            target="_blank"
            rel="noreferrer"
          >
            Ouvrir dans Maps <ArrowUpRight size={16} />
          </a>
        </div>
        <div className="evp-map">
          <iframe
            title="Carte de FIQR Coworking Space, Ariana"
            src="https://maps.google.com/maps?q=FIQR%20Coworking%20Space%2C%20Ariana%2C%20Tunisia&output=embed"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
          <div className="evp-map__location">
            <MapPin size={18} />
            <span><strong>FIQR Coworking Space</strong><small>Ariana, Tunisie</small></span>
          </div>
        </div>
      </section>
    </>
  );
}

function FeedbackModal({ onClose, onSubmitted }) {
  const [firstName, setFirstName] = useState("Amira");
  const [lastName, setLastName] = useState("Ben Salem");
  const [message, setMessage] = useState("");
  const [rating, setRating] = useState(5);
  const [photo, setPhoto] = useState("");
  const [photoName, setPhotoName] = useState("");
  const [photoError, setPhotoError] = useState("");

  const handlePhotoChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setPhotoError("");
    const reader = new FileReader();
    reader.onload = () => {
      setPhoto(String(reader.result || ""));
      setPhotoName(file.name);
    };
    reader.onerror = () => setPhotoError("Impossible de lire cette image.");
    reader.readAsDataURL(file);
  };

  const submit = (event) => {
    event.preventDefault();
    onSubmitted({
      name: `${firstName.trim()} ${lastName.trim()}`.trim(),
      rating,
      text: message.trim(),
      image: photo,
    });
  };

  return (
    <PreviewModal title="Votre avis compte" onClose={onClose} className="evp-feedback-modal">
      <form className="evp-feedback-form" onSubmit={submit}>
        <p className="evp-form-intro">Partagez votre expérience de l’événement avec notre équipe.</p>
        <div className="evp-form-grid">
          <label>Prénom<input value={firstName} onChange={(event) => setFirstName(event.target.value)} required /></label>
          <label>Nom<input value={lastName} onChange={(event) => setLastName(event.target.value)} required /></label>
        </div>
        <label className="evp-field-label">Votre photo <span>(facultatif)</span></label>
        <label className="evp-photo-upload">
          {photo
            ? <img src={photo} alt="Aperçu de votre photo" />
            : <span className="evp-photo-upload__icon"><ImagePlus size={21} /></span>}
          <span><strong>{photoName || "Ajouter une photo"}</strong><small>JPG, PNG ou WEBP</small></span>
          <span className="evp-photo-upload__action">{photo ? "Changer" : "Parcourir"}</span>
          <input type="file" accept="image/png,image/jpeg,image/webp" onChange={handlePhotoChange} />
        </label>
        {photoError && <p className="evp-photo-error" role="alert">{photoError}</p>}
        <label>Votre commentaire
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Qu’avez-vous pensé de cet événement ?"
            rows={4}
            maxLength={1000}
            required
          />
        </label>
        <div className="evp-rating-field">
          <span className="evp-field-label">Votre note</span>
          <RatingStars rating={rating} onChange={setRating} />
          <small>{rating}/5</small>
        </div>
        <div className="evp-preview-note">
          <BellRing size={16} /> Mode aperçu : rien ne sera envoyé ou enregistré.
        </div>
        <button className="evp-button evp-button--primary evp-button--full" type="submit">
          Envoyer mon avis <ArrowUpRight size={17} />
        </button>
      </form>
    </PreviewModal>
  );
}

function CelebrationModal({ onClose }) {
  return (
    <PreviewModal title="Merci pour votre feedback !" onClose={onClose} className="evp-celebration-modal">
      <div className="evp-celebration">
        <div className="evp-celebration__stars" aria-hidden="true">
          <Star className="evp-celebration__star evp-celebration__star--one" size={25} fill="currentColor" />
          <Star className="evp-celebration__star evp-celebration__star--two" size={34} fill="currentColor" />
          <Star className="evp-celebration__star evp-celebration__star--three" size={21} fill="currentColor" />
          <span><Check size={33} /></span>
        </div>
        <h3>Votre avis a bien été pris en compte</h3>
        <p>Merci de contribuer à améliorer les prochains événements TheBridgeFlow.</p>
        <button className="evp-button evp-button--primary" type="button" onClick={onClose}>Continuer</button>
      </div>
    </PreviewModal>
  );
}

function EmailPreview({ kind, onClose }) {
  const isFeedback = kind === "feedback";
  return (
    <PreviewModal title={isFeedback ? "Email après l’événement" : "Rappel avant l’événement"} onClose={onClose} className="evp-email-modal">
      <div className="evp-email">
        <div className="evp-email__from"><span className="evp-email__logo">B</span><span><strong>TheBridgeFlow</strong><small>contact@thebridgeflow.tn</small></span></div>
        <div className="evp-email__subject"><small>Objet</small><strong>{isFeedback ? "Votre avis sur l’Atelier IA Générative" : "Votre événement commence dans 6 heures"}</strong></div>
        <p>Bonjour Amira,</p>
        <p>{isFeedback
          ? "Merci d’avoir participé à notre Atelier IA Générative. Votre avis nous aide à améliorer les prochaines éditions."
          : "Petit rappel : votre Atelier IA Générative commence aujourd’hui. Retrouvez ci-dessous les informations pratiques."}</p>
        <div className="evp-email__event">
          <strong>{eventDetails.title}</strong>
          <span><CalendarDays size={15} /> {eventDetails.date}</span>
          <span><Clock3 size={15} /> {eventDetails.time}</span>
          <span><MapPin size={15} /> {eventDetails.location}</span>
        </div>
        <button className="evp-button evp-button--primary" type="button" onClick={onClose}>
          {isFeedback ? "Donner mon avis" : "Voir les détails"} <ArrowUpRight size={16} />
        </button>
        <small className="evp-email__disclaimer">Aperçu uniquement — aucun email ne sera envoyé.</small>
      </div>
    </PreviewModal>
  );
}

function AdminFeedbackPreview({
  events,
  feedbacks,
  selectedEventId,
  selectedIds,
  selectedFeedbacks,
  csvDownloadUrl,
  onSelectEvent,
  onBackToEvents,
  onToggle,
  onToggleAll,
  onTogglePublish,
}) {
  const selectedEvent = events.find((event) => event.id === selectedEventId);
  const eventFeedbacks = feedbacks.filter((feedback) => feedback.eventId === selectedEventId);
  const allSelected = eventFeedbacks.length > 0 && selectedIds.length === eventFeedbacks.length;
  return (
    <section className="evp-admin">
      <div className="evp-admin__heading">
        <div>
          <span className="evp-eyebrow">Espace administration</span>
          <h1>Feedback des événements</h1>
          <p>{selectedEvent ? selectedEvent.title : "Consultez les avis envoyés après les événements TheBridgeFlow."}</p>
        </div>
        {selectedEvent && (
          <a
            className="evp-button evp-button--primary"
            href={csvDownloadUrl || undefined}
            download="feedback-evenement-apercu.csv"
            aria-disabled={!selectedFeedbacks.length}
            tabIndex={selectedFeedbacks.length ? 0 : -1}
          >
            <ArrowDownToLine size={17} /> Télécharger ({selectedIds.length})
          </a>
        )}
      </div>
      {!selectedEvent ? (
        <div className="evp-event-list">
          {events.map((event) => {
            const count = feedbacks.filter((feedback) => feedback.eventId === event.id).length;
            return (
              <button className="evp-event-list__card" key={event.id} type="button" onClick={() => onSelectEvent(event.id)}>
                <span className="evp-event-list__icon"><CalendarDays size={20} /></span>
                <span className="evp-event-list__info"><strong>{event.title}</strong><small>{event.date}</small></span>
                <span className="evp-event-list__count">{count} avis</span>
                <ArrowUpRight size={17} aria-hidden="true" />
              </button>
            );
          })}
        </div>
      ) : (
        <>
          <button type="button" className="evp-back-events" onClick={onBackToEvents}>
            <ArrowLeft size={15} /> Tous les événements
          </button>
      <div className="evp-admin__toolbar">
        <label className="evp-select-all"><input type="checkbox" checked={allSelected} onChange={onToggleAll} /> Sélectionner tout</label>
        <span>{eventFeedbacks.length} avis reçus <span className="evp-admin__toolbar-dot" /> {selectedEvent.title}</span>
      </div>
      {eventFeedbacks.length ? (
        <div className="evp-feedback-grid">
        {eventFeedbacks.map((feedback) => (
          <article className={`evp-feedback-card${selectedIds.includes(feedback.id) ? " is-selected" : ""}`} key={feedback.id}>
            <label className="evp-feedback-card__check">
              <input
                type="checkbox"
                checked={selectedIds.includes(feedback.id)}
                onChange={() => onToggle(feedback.id)}
                aria-label={`Sélectionner le feedback de ${feedback.name}`}
              />
            </label>
            <div className="evp-feedback-card__top">
              <span className="evp-feedback-card__avatar">
                {feedback.image ? <img src={feedback.image} alt="" /> : <UserRound size={23} />}
              </span>
              <span className="evp-feedback-card__person"><strong>{feedback.name}</strong><small>{feedback.date}</small></span>
              <span className="evp-feedback-card__verified"><CheckCircle2 size={15} /> Participant</span>
            </div>
            <div className="evp-feedback-card__stars" aria-label={`${feedback.rating} sur 5 étoiles`}>
              {Array.from({ length: 5 }, (_, index) => <Star key={index} size={16} fill={index < feedback.rating ? "currentColor" : "none"} />)}
            </div>
            <p>{feedback.text}</p>
            <span className="evp-feedback-card__event"><CalendarDays size={14} /> {selectedEvent.title}</span>
            <div className="evp-feedback-card__publish">
              <span className={feedback.published ? "is-published" : ""}>
                {feedback.published ? "Publié sur la page" : "Pas encore publié"}
              </span>
              <button
                type="button"
                className={`evp-publish-button${feedback.published ? " is-published" : ""}`}
                onClick={() => onTogglePublish(feedback.id)}
                aria-pressed={feedback.published}
              >
                {feedback.published ? <EyeOff size={15} /> : <Eye size={15} />}
                {feedback.published ? "Retirer de la page" : "Afficher sur la page"}
              </button>
            </div>
          </article>
        ))}
        </div>
      ) : (
        <div className="evp-public-feedback__empty"><MessageSquareText size={20} /> Aucun avis n’a encore été reçu pour cet événement.</div>
      )}
      <div className="evp-preview-note"><BellRing size={16} /> Données de démonstration — ces avis ne sont pas enregistrés.</div>
        </>
      )}
    </section>
  );
}

export default function EventFeedbackPreviewPage() {
  const [view, setView] = useState("student");
  const [modal, setModal] = useState("");
  const [emailKind, setEmailKind] = useState("reminder");
  const [feedbacks, setFeedbacks] = useState(feedbackExamples);
  const [selectedEventId, setSelectedEventId] = useState("");
  const [selectedIds, setSelectedIds] = useState([]);
  const selectedFeedbacks = useMemo(
    () => feedbacks.filter((feedback) => selectedIds.includes(feedback.id) && (!selectedEventId || feedback.eventId === selectedEventId)),
    [feedbacks, selectedEventId, selectedIds],
  );
  const publishedFeedbacks = useMemo(
    () => feedbacks.filter((feedback) => feedback.eventId === eventDetails.id && feedback.published),
    [feedbacks],
  );
  const csvDownloadUrl = useMemo(() => {
    if (!selectedFeedbacks.length) return "";
    const escapeCsv = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
    const rows = [
      ["Nom", "Date", "Note", "Feedback"],
      ...selectedFeedbacks.map(({ name, date, rating, text }) => [name, date, rating, text]),
    ];
    const csv = `\uFEFF${rows.map((row) => row.map(escapeCsv).join(",")).join("\r\n")}`;
    return URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  }, [selectedFeedbacks]);

  useEffect(() => () => {
    if (csvDownloadUrl) URL.revokeObjectURL(csvDownloadUrl);
  }, [csvDownloadUrl]);

  const toggleFeedback = (id) => {
    setSelectedIds((current) => current.includes(id)
      ? current.filter((selectedId) => selectedId !== id)
      : [...current, id]);
  };

  const toggleAllFeedbacks = () => {
    const eventFeedbacks = feedbacks.filter((feedback) => feedback.eventId === selectedEventId);
    setSelectedIds((current) => current.length === eventFeedbacks.length
      ? []
      : eventFeedbacks.map(({ id }) => id));
  };

  const togglePublished = (id) => {
    setFeedbacks((current) => current.map((feedback) => (
      feedback.id === id ? { ...feedback, published: !feedback.published } : feedback
    )));
  };

  const handleFeedbackSubmitted = (feedback) => {
    setFeedbacks((current) => [{
      ...feedback,
      eventId: eventDetails.id,
      id: `preview-${Date.now()}`,
      date: "À l’instant",
      published: false,
    }, ...current]);
    setModal("thanks");
  };

  return (
    <div className="evp-page">
      <header className="evp-topbar">
        <a className="evp-brand" href="/" aria-label="TheBridgeFlow, accueil">
          <img src="/favicon.png" alt="" />
          <span>TheBridge<span>Flow</span></span>
        </a>
        <div className="evp-view-switch" role="tablist" aria-label="Aperçu selon le profil">
          <button type="button" role="tab" aria-selected={view === "student"} className={view === "student" ? "is-active" : ""} onClick={() => setView("student")}>
            Vue étudiant
          </button>
          <button type="button" role="tab" aria-selected={view === "admin"} className={view === "admin" ? "is-active" : ""} onClick={() => setView("admin")}>
            Vue admin
          </button>
        </div>
        <span className="evp-preview-badge"><span /> Aperçu interactif</span>
      </header>

      {view === "student" ? (
        <main className="evp-main">
          <div className="evp-preview-banner">
            <span><BellRing size={17} /> Les rappels par email sont prévus 24h et 6h avant l’événement.</span>
            <button type="button" onClick={() => { setEmailKind("reminder"); setModal("email"); }}>
              <Mail size={16} /> Aperçu email
            </button>
          </div>
          <EventPreview onOpenFeedback={() => setModal("feedback")} publishedFeedbacks={publishedFeedbacks} />
          <section className="evp-feedback-prompt">
            <div className="evp-feedback-prompt__icon"><MessageSquareText size={21} /></div>
            <div><strong>Vous avez participé à cet événement ?</strong><p>Votre retour ne prend qu’une minute.</p></div>
            <button className="evp-button evp-button--primary" type="button" onClick={() => setModal("feedback")}>Évaluer l’événement</button>
          </section>
          <section className="evp-after-event-email">
            <span className="evp-after-event-email__icon"><Mail size={18} /></span>
            <p><strong>Un email de feedback sera aussi envoyé après l’événement.</strong><small>Le bouton dans l’email ouvre le même formulaire, sans créer un doublon.</small></p>
            <button type="button" onClick={() => { setEmailKind("feedback"); setModal("email"); }}>Voir l’email <ArrowUpRight size={15} /></button>
          </section>
        </main>
      ) : (
        <main className="evp-main evp-main--admin">
          <AdminFeedbackPreview
            events={eventExamples}
            feedbacks={feedbacks}
            selectedEventId={selectedEventId}
            selectedIds={selectedIds}
            selectedFeedbacks={selectedFeedbacks}
            csvDownloadUrl={csvDownloadUrl}
            onSelectEvent={(eventId) => { setSelectedEventId(eventId); setSelectedIds([]); }}
            onBackToEvents={() => { setSelectedEventId(""); setSelectedIds([]); }}
            onToggle={toggleFeedback}
            onToggleAll={toggleAllFeedbacks}
            onTogglePublish={togglePublished}
          />
        </main>
      )}

      <footer className="evp-footer">TheBridgeFlow <span>·</span> Maquette de validation — données de démonstration uniquement</footer>

      {modal === "feedback" && <FeedbackModal onClose={() => setModal("")} onSubmitted={handleFeedbackSubmitted} />}
      {modal === "thanks" && <CelebrationModal onClose={() => setModal("")} />}
      {modal === "email" && <EmailPreview kind={emailKind} onClose={() => setModal("")} />}
    </div>
  );
}
