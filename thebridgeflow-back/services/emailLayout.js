/* Design commun des emails 9antra.tn_the_bridge — reproduit le kit officiel :
   barre blanche avec le logo, en-tête bleu royal, corps blanc, tableau de
   détails, encadré d'information, bouton bleu et pied de page gris clair.

   Uniquement des tableaux et des styles en ligne : même rendu dans Gmail,
   Outlook, Apple Mail et les webmails mobiles. Fonctions pures, sans accès à
   la base ni au réseau.

   Convention : un paramètre dont le nom finit par « Html » est inséré tel quel
   (déjà échappé par l'appelant) ; tous les autres textes sont échappés ici. */

export const EMAIL_BRAND = "9antra.tn_the_bridge";
// Nom affiché comme expéditeur dans la boîte de réception.
export const DEFAULT_SENDER_NAME = "9antra.tn";
// Servi par le frontend (thebridgeflow-front/public/email/) : Gmail bloque les
// images intégrées en data:, le logo doit donc être hébergé.
export const DEFAULT_EMAIL_LOGO_URL = "https://9antra.tn/email/logo-9antra-the-bridge.png";

const SITE_URL = "https://9antra.tn";
const PROGRAMS_URL = "https://9antra.tn/pack-pfe";
const FACEBOOK_URL = "https://www.facebook.com/9antra.tn";
const CONTACT_EMAIL = "contact@9antra.tn";
const CONTACT_PHONE = "+216 58 840 064";
const CONTACT_PHONE_HREF = "tel:+21658840064";

const FONT_STACK = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const TABLE_ATTRS = 'role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"';

export const escapeHtml = (value = "") => String(value ?? "")
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;")
  .replace(/'/g, "&#39;");

export const emailLogoUrl = (env = process.env) => String(env.EMAIL_LOGO_URL || "").trim() || DEFAULT_EMAIL_LOGO_URL;

/* Expéditeur « 9antra.tn <adresse> » : l'adresse vient de EMAIL_FROM (seule
   ou au format « Nom <adresse> »), le nom de EMAIL_FROM_NAME, sinon 9antra.tn.
   Nodemailer encode lui-même le nom (accents, guillemets). */
export function getEmailSender(env = process.env) {
  const raw = String(env.EMAIL_FROM || "").trim();
  const bracketed = /<\s*([^<>\s]+)\s*>/.exec(raw);
  const address = (bracketed ? bracketed[1] : raw).replace(/^["']+|["']+$/g, "").trim();
  const name = String(env.EMAIL_FROM_NAME || "").trim() || DEFAULT_SENDER_NAME;
  return { name, address };
}

// Lien cliquable seulement s'il est http(s), mailto ou tel (jamais javascript:).
export function safeUrl(value) {
  const url = String(value ?? "").trim();
  if (!url) return "";
  if (/^(mailto|tel):/i.test(url)) return url;
  try {
    const parsed = new URL(url);
    return ["http:", "https:"].includes(parsed.protocol) ? url : "";
  } catch {
    return "";
  }
}

const isRtl = (dir) => dir === "rtl";
const startSide = (dir) => (isRtl(dir) ? "right" : "left");
const endSide = (dir) => (isRtl(dir) ? "left" : "right");
const forwardArrow = (dir) => (isRtl(dir) ? "&larr;" : "&rarr;");
// Marque toujours écrite de gauche à droite, même dans un texte arabe.
export const brandHtml = (style = "") => `<span dir="ltr"${style ? ` style="${style}"` : ""}>${EMAIL_BRAND}</span>`;

// ─── En-tête bleu : blocs optionnels sous le titre ──────────────────────────

/* Encadré translucide à deux colonnes (Date | Lieu) — kit « Nouveauté ».
   items : [{ label, value }] (valeurs vides ignorées). */
export function heroFacts(items = [], { dir = "ltr" } = {}) {
  const cells = items.filter((item) => item && String(item.value ?? "").trim());
  if (!cells.length) return "";
  const width = Math.floor(100 / cells.length);
  const separator = isRtl(dir) ? "border-right" : "border-left";
  const padding = isRtl(dir) ? "padding-right" : "padding-left";
  const columns = cells.map((item, index) => `
          <td width="${width}%" valign="top" style="color:#FFFFFF; font-size:13px; font-weight:700;${index ? ` ${separator}:1px solid rgba(255,255,255,0.22); ${padding}:16px;` : ""}">
            <span style="color:#93C5FD; font-size:11px; display:block; text-transform:uppercase; letter-spacing:0.7px;">${escapeHtml(item.label)}</span>
            ${escapeHtml(item.value)}
          </td>`).join("");
  return `
<table ${TABLE_ATTRS} style="margin-top:22px; background-color:rgba(255,255,255,0.12); border:1px solid rgba(255,255,255,0.24); border-radius:14px;">
  <tr>
    <td style="padding:16px 20px; text-align:${startSide(dir)};">
      <table ${TABLE_ATTRS}>
        <tr>${columns}
        </tr>
      </table>
    </td>
  </tr>
</table>`;
}

/* Carte sombre mise en avant (date de l'entretien, code de vérification,
   projet gagnant) — kit « Entretien proposé ». */
export function heroHighlight({ label, value, pill, code = false, footnote } = {}) {
  if (!String(value ?? "").trim()) return "";
  // pill : texte, ou [mode, lieu] affiché « mode  —  lieu » comme dans le kit.
  const pillHtml = (Array.isArray(pill) ? pill : [pill])
    .filter((part) => String(part ?? "").trim())
    .map(escapeHtml)
    .join(" &nbsp;&mdash;&nbsp; ");
  const valueStyle = code
    ? "font-size:34px; font-weight:800; color:#FFFFFF; letter-spacing:10px; font-family:'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace; margin-bottom:12px;"
    : "font-size:22px; font-weight:800; color:#FFFFFF; margin-bottom:12px; line-height:1.3;";
  return `
<table ${TABLE_ATTRS} style="margin-top:24px; background:linear-gradient(145deg, #0B1633 0%, #162E66 100%); background-color:#0F1E45; border-radius:16px; border:1px solid rgba(147, 197, 253, 0.35);">
  <tr>
    <td style="padding:22px 24px; text-align:center;">
      ${label ? `<div style="font-size:11px; font-weight:800; color:#93C5FD; text-transform:uppercase; letter-spacing:1px; margin-bottom:6px;">
        ${escapeHtml(label)}
      </div>` : ""}
      <div style="${valueStyle}">
        ${escapeHtml(value)}
      </div>
      ${pillHtml ? `<span style="display:inline-block; background-color:#2563EB; color:#FFFFFF; font-size:12px; font-weight:700; padding:6px 16px; border-radius:999px;">
        ${pillHtml}
      </span>` : ""}
      ${footnote ? `<div style="font-size:12px; color:#BFDBFE; margin-top:${pillHtml ? "12px" : "0"};">${escapeHtml(footnote)}</div>` : ""}
    </td>
  </tr>
</table>`;
}

// Étapes « 1. Envoyée ✓ → 2. … → 3. … » — kits « Candidature » et « Inscription ».
export function heroSteps(steps = [], { dir = "ltr" } = {}) {
  const list = steps.filter(Boolean);
  if (!list.length) return "";
  const cells = list.map((step, index) => {
    const done = Boolean(step.done);
    const text = `${index + 1}. ${escapeHtml(step.label)}${done ? " &#10003;" : ""}`;
    const cell = `<td style="color:${done ? "#FFFFFF" : "#DBEAFE"}; font-size:12px; font-weight:${done ? 700 : 600};">${text}</td>`;
    return index ? `<td style="color:#93C5FD; padding:0 10px;">${forwardArrow(dir)}</td>\n          ${cell}` : cell;
  }).join("\n          ");
  return `
<table ${TABLE_ATTRS} style="margin-top:22px;">
  <tr>
    <td align="center">
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="background-color:rgba(255,255,255,0.14); border:1px solid rgba(255,255,255,0.28); border-radius:12px; padding:10px 20px;">
        <tr>
          ${cells}
        </tr>
      </table>
    </td>
  </tr>
</table>`;
}

// Carte cliquable avec le carré ▶ — kit « Workshop Google Meet ».
export function heroActionCard({ url, kicker, title, dir = "ltr" } = {}) {
  const href = safeUrl(url);
  if (!href) return "";
  const padding = isRtl(dir) ? "padding-right" : "padding-left";
  return `
<a href="${escapeHtml(href)}" target="_blank" style="text-decoration:none; display:block; margin-top:24px;">
  <table ${TABLE_ATTRS} style="background:linear-gradient(145deg, #0B1633 0%, #162E66 100%); background-color:#0F1E45; border-radius:16px; border:1px solid rgba(147, 197, 253, 0.35);">
    <tr>
      <td style="padding:22px 24px; text-align:${startSide(dir)};">
        <table ${TABLE_ATTRS}>
          <tr>
            <td width="58" valign="middle">
              <div style="width:52px; height:52px; border-radius:14px; background-color:#2563EB; text-align:center; line-height:52px; color:#FFFFFF; font-size:20px; font-weight:800;">
                &#9654;
              </div>
            </td>
            <td valign="middle" style="${padding}:14px;">
              <div style="font-size:11px; font-weight:700; color:#93C5FD; text-transform:uppercase; letter-spacing:0.8px; margin-bottom:4px;">
                ${escapeHtml(kicker)}
              </div>
              <div style="font-size:17px; font-weight:800; color:#FFFFFF; line-height:1.35;">
                ${escapeHtml(title)}
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</a>`;
}

// ─── Corps du message ───────────────────────────────────────────────────────

export const strong = (text) => `<strong style="color:#0F172A;">${escapeHtml(text)}</strong>`;
export const strongBlue = (text) => `<strong style="color:#1D4ED8;">${escapeHtml(text)}</strong>`;
// Mot en gras dans le sous-titre blanc de l'en-tête bleu.
export const strongWhite = (text) => `<strong style="color:#FFFFFF;">${escapeHtml(text)}</strong>`;

export const textLink = (text, url) => {
  const href = safeUrl(url);
  return href
    ? `<a href="${escapeHtml(href)}" style="color:#1D4ED8; text-decoration:none; font-weight:700;">${escapeHtml(text)}</a>`
    : escapeHtml(text);
};

export const paragraph = (html, { center = false, size = 15 } = {}) => `
<p style="margin:0 0 20px 0; font-size:${size}px; line-height:${size < 15 ? "1.7" : "1.65"}; color:#334155;${center ? " text-align:center;" : ""}">
  ${html}
</p>`;

// « Bonjour <Nom>, … » (restHtml : suite de la phrase, déjà échappée).
export const greeting = (name, restHtml, options) => paragraph(`Bonjour ${strong(name)}, ${restHtml}`, options);

// Petit titre bleu en majuscules (« À la une ») suivi d'un titre de section.
export const kicker = (text) => `
<div style="font-size:11px; font-weight:800; text-transform:uppercase; letter-spacing:0.9px; color:#2563EB; margin-bottom:6px;">
  ${escapeHtml(text)}
</div>`;

export const sectionTitle = (text) => `
<h2 style="margin:0 0 14px 0; font-size:20px; font-weight:800; color:#0F172A; line-height:1.35;">
  ${escapeHtml(text)}
</h2>`;

const PILL_TONES = {
  blue: "background-color:#EFF6FF; border:1px solid #BFDBFE; color:#1D4ED8;",
  neutral: "background-color:#F1F5F9; border:1px solid #CBD5E1; color:#475569;",
  green: "background-color:#ECFDF5; border:1px solid #A7F3D0; color:#047857;",
  red: "background-color:#FEF2F2; border:1px solid #FECACA; color:#B91C1C;",
  amber: "background-color:#FFFBEB; border:1px solid #FDE68A; color:#B45309;",
  violet: "background-color:#F5F3FF; border:1px solid #DDD6FE; color:#6D28D9;",
};

export const statusPill = (text, tone = "blue") =>
  `<span style="display:inline-block; ${PILL_TONES[tone] || PILL_TONES.blue} font-size:12px; font-weight:700; padding:3px 12px; border-radius:999px;">${escapeHtml(text)}</span>`;

/* Tableau « libellé / valeur » du kit. rows : [{ label, value }] ou
   [{ label, valueHtml }] ; les lignes sans valeur sont ignorées. */
export function detailsTable(rows = [], { title } = {}) {
  const list = rows.filter((row) => row && (row.valueHtml ? String(row.valueHtml).trim() : String(row.value ?? "").trim()));
  if (!list.length) return "";
  const body = list.map((row, index) => {
    const border = index < list.length - 1 ? " border-bottom:1px solid #E2E8F0;" : " ";
    const value = row.valueHtml ?? escapeHtml(row.value);
    return `
        <tr>
          <td width="34%" valign="top" style="padding:12px 0;${border} font-size:13px; color:#64748B; font-weight:600;">${escapeHtml(row.label)}</td>
          <td width="66%" valign="top" style="padding:12px 0;${border} font-size:14px; color:#0F172A; font-weight:700; word-break:break-word;">${value}</td>
        </tr>`;
  }).join("");
  return `${title ? kicker(title) : ""}<table ${TABLE_ATTRS} style="background-color:#F8FAFC; border:1px solid #E2E8F0; border-radius:14px; padding:6px 20px; margin-bottom:24px;">${body}</table>`;
}

const INFO_TONES = {
  blue: { box: "background-color:#EFF6FF; border:1px solid #BFDBFE; border-left:4px solid #2563EB;", text: "font-size:13.5px; color:#1E3A8A; line-height:1.55;" },
  amber: { box: "background-color:#FFFBEB; border:1px solid #FDE68A; border-left:4px solid #F59E0B;", text: "font-size:13.5px; color:#92400E; line-height:1.55;" },
  green: { box: "background-color:#ECFDF5; border:1px solid #A7F3D0; border-left:4px solid #10B981;", text: "font-size:13.5px; color:#065F46; line-height:1.55;" },
  red: { box: "background-color:#FEF2F2; border:1px solid #FECACA; border-left:4px solid #EF4444;", text: "font-size:13.5px; color:#991B1B; line-height:1.55;" },
};

// Encadré « Conseil : … » / « Objectif : … » du kit (accent bleu par défaut).
export function infoBox(html, { tone = "blue", dir = "ltr" } = {}) {
  if (!String(html ?? "").trim()) return "";
  const style = INFO_TONES[tone] || INFO_TONES.blue;
  const box = isRtl(dir) ? style.box.replace("border-left:4px", "border-right:4px") : style.box;
  return `
<table ${TABLE_ATTRS} style="${box} border-radius:12px; margin-bottom:24px;">
  <tr>
    <td style="padding:16px 18px; ${style.text}">
      ${html}
    </td>
  </tr>
</table>`;
}

// Encadré neutre avec un titre (« À propos de l'événement ») — kit « Participation annulée ».
export function neutralBox({ title, html } = {}) {
  if (!String(html ?? "").trim()) return "";
  return `
<table ${TABLE_ATTRS} style="background-color:#F8FAFC; border:1px solid #E2E8F0; border-radius:12px; margin-bottom:24px;">
  <tr>
    <td style="padding:16px 18px; font-size:13px; color:#475569; line-height:1.6;">
      ${title ? `<strong style="color:#0F172A; display:block; margin-bottom:4px;">${escapeHtml(title)}</strong>` : ""}
      ${html}
    </td>
  </tr>
</table>`;
}

// Citation d'un message reçu (aperçu du texte, en italique).
export function quoteBox({ label, text, dir = "ltr" } = {}) {
  if (!String(text ?? "").trim()) return "";
  const accent = isRtl(dir) ? "border-right:4px solid #2563EB;" : "border-left:4px solid #2563EB;";
  return `
<table ${TABLE_ATTRS} style="background-color:#F8FAFC; border:1px solid #E2E8F0; ${accent} border-radius:12px; margin-bottom:24px;">
  <tr>
    <td style="padding:16px 18px;">
      ${label ? `<div style="font-size:11px; font-weight:800; text-transform:uppercase; letter-spacing:0.8px; color:#64748B; margin-bottom:8px;">${escapeHtml(label)}</div>` : ""}
      <div style="font-size:15px; color:#0F172A; line-height:1.6; font-style:italic;">&laquo;&nbsp;${escapeHtml(text)}&nbsp;&raquo;</div>
    </td>
  </tr>
</table>`;
}

// Trois cartes numérotées 01 / 02 / 03 — kit « Bienvenue newsletter ».
export function featureCards(items = []) {
  const cards = items.filter(Boolean).slice(0, 3);
  if (!cards.length) return "";
  const cells = cards.map((card, index) => `
    <td width="32%" valign="top" style="background-color:#F8FAFC; border:1px solid #E2E8F0; border-radius:12px; padding:16px 12px; text-align:center;">
      <div style="width:36px; height:36px; margin:0 auto 10px auto; border-radius:10px; background-color:#DBEAFE; color:#1D4ED8; font-weight:800; font-size:14px; line-height:36px;">${String(index + 1).padStart(2, "0")}</div>
      <div style="font-size:13px; font-weight:800; color:#0F172A; margin-bottom:4px;">${escapeHtml(card.title)}</div>
      <div style="font-size:12px; color:#64748B; line-height:1.45;">${escapeHtml(card.text)}</div>
    </td>`).join(`
    <td width="2%">&nbsp;</td>`);
  return `
<table ${TABLE_ATTRS} style="margin-bottom:26px;">
  <tr>${cells}
  </tr>
</table>`;
}

/* Bouton principal bleu. icon "play" : « ▶  Libellé » (kit Meet), sinon
   « Libellé → ». Sans lien valide, aucun bouton. */
export function ctaButton(label, url, { icon, dir = "ltr" } = {}) {
  const href = safeUrl(url);
  if (!href) return "";
  const text = icon === "play"
    ? `&#9654;&nbsp;&nbsp;${escapeHtml(label)}`
    : `${escapeHtml(label)} ${forwardArrow(dir)}`;
  return `
    <table ${TABLE_ATTRS} style="margin-top:8px;">
      <tr>
        <td align="center">
          <a href="${escapeHtml(href)}" target="_blank" style="display:inline-block; background-color:#1D4ED8; color:#FFFFFF; text-decoration:none; font-size:15px; font-weight:800; padding:15px 38px; border-radius:12px; box-shadow:0 8px 20px rgba(29, 78, 216, 0.25);">
            ${text}
          </a>
        </td>
      </tr>
    </table>`;
}

// Petite ligne centrée sous le bouton (« Besoin de reporter ? … »).
export const note = (html) => `
<p style="margin:14px 0 0 0; text-align:center; font-size:12px; color:#64748B; line-height:1.6;">
  ${html}
</p>`;

// ─── Page complète ──────────────────────────────────────────────────────────

const FOOTER_COPY = {
  fr: {
    location: "Ariana, Tunis, Tunisie",
    website: "Site web",
    newsletter: `Vous recevez cet email car vous êtes abonné à la newsletter <strong>${brandHtml()}</strong>.`,
    unsubscribe: "Se désabonner",
    automatic: (year) => `Cet email a été envoyé automatiquement par ${brandHtml()}. &copy; ${year} Tous droits réservés.`,
  },
  en: {
    location: "Ariana, Tunis, Tunisia",
    website: "Website",
    newsletter: `You are receiving this email because you subscribed to the <strong>${brandHtml()}</strong> newsletter.`,
    unsubscribe: "Unsubscribe",
    automatic: (year) => `This email was sent automatically by ${brandHtml()}. &copy; ${year} All rights reserved.`,
  },
  ar: {
    location: "أريانة، تونس",
    website: "الموقع",
    newsletter: `تتلقى هذا البريد لأنك مشترك في نشرة <strong>${brandHtml()}</strong>.`,
    unsubscribe: "إلغاء الاشتراك",
    automatic: (year) => `تم إرسال هذا البريد تلقائيًا من ${brandHtml()}. &copy; ${year} جميع الحقوق محفوظة.`,
  },
};

const footerLink = (label, href) =>
  `<a href="${escapeHtml(href)}" style="color:#475569; text-decoration:none; font-weight:600;">${label}</a>`;

/* Assemble un email complet.
   hero : { badge, title, subtitleHtml, extraHtml } — extraHtml : heroFacts,
   heroHighlight, heroSteps ou heroActionCard.
   unsubscribeUrl : ajoute la ligne newsletter + « Se désabonner » au pied. */
export function renderEmail({
  lang = "fr",
  title,
  preheader = "",
  hero = {},
  bodyHtml = "",
  unsubscribeUrl = "",
  logoUrl = emailLogoUrl(),
  year = new Date().getFullYear(),
} = {}) {
  const language = FOOTER_COPY[lang] ? lang : "fr";
  const dir = language === "ar" ? "rtl" : "ltr";
  const copy = FOOTER_COPY[language];
  const unsubscribe = safeUrl(unsubscribeUrl);
  const docTitle = `${escapeHtml(title || hero.title || EMAIL_BRAND)} — ${EMAIL_BRAND}`;

  return `<!DOCTYPE html>
<html lang="${language}" dir="${dir}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${docTitle}</title>
</head>
<body style="margin:0; padding:0; background-color:#EEF2F7; font-family:${FONT_STACK}; color:#0F172A; -webkit-font-smoothing:antialiased;">
  ${preheader ? `<div style="display:none; max-height:0; overflow:hidden; opacity:0; color:transparent;">${escapeHtml(preheader)}</div>` : ""}
  <table ${TABLE_ATTRS} dir="${dir}" style="background-color:#EEF2F7; padding:32px 14px;">
    <tr>
      <td align="center">
        <table role="presentation" width="620" cellspacing="0" cellpadding="0" border="0" style="max-width:620px; width:100%; background-color:#FFFFFF; border-radius:20px; overflow:hidden; box-shadow:0 18px 45px rgba(15, 23, 42, 0.10); border:1px solid #E2E8F0;">

          <!-- Barre blanche : logo officiel The Bridge -->
          <tr>
            <td style="background-color:#FFFFFF; padding:20px 32px; border-bottom:1px solid #E2E8F0;">
              <table ${TABLE_ATTRS}>
                <tr>
                  <td align="${startSide(dir)}" valign="middle">
                    <img src="${escapeHtml(logoUrl)}" alt="The Bridge - 9antra.tn" width="138" style="display:block; border:0; height:auto;" />
                  </td>
                  <td align="${endSide(dir)}" valign="middle">
                    <span dir="ltr" style="display:inline-block; background-color:#EFF6FF; border:1px solid #BFDBFE; color:#1D4ED8; font-size:12px; font-weight:700; padding:6px 14px; border-radius:999px; letter-spacing:0.2px;">
                      ${EMAIL_BRAND}
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- En-tête bleu royal -->
          <tr>
            <td style="background:linear-gradient(135deg, #0F2557 0%, #1D4ED8 55%, #2563EB 100%); background-color:#1D4ED8; padding:34px 36px 36px 36px; text-align:center;">
              ${hero.badge ? `<div style="display:inline-block; background-color:rgba(255,255,255,0.14); border:1px solid rgba(255,255,255,0.28); border-radius:999px; padding:6px 16px; color:#FFFFFF; font-size:11px; font-weight:700; letter-spacing:1.1px; text-transform:uppercase; margin-bottom:15px;">
                &#9679;&nbsp; ${escapeHtml(hero.badge)}
              </div>` : ""}
              <h1 style="margin:0 0 10px 0; color:#FFFFFF; font-size:27px; font-weight:800; line-height:1.25; letter-spacing:-0.4px;">
                ${escapeHtml(hero.title || title || "")}
              </h1>
              ${hero.subtitleHtml ? `<p style="margin:0; color:#DBEAFE; font-size:15px; line-height:1.6;">
                ${hero.subtitleHtml}
              </p>` : ""}
              ${hero.extraHtml || ""}
            </td>
          </tr>

          <!-- Corps -->
          <tr>
            <td style="padding:32px 34px 30px 34px;">
              ${bodyHtml}
            </td>
          </tr>

          <!-- Pied de page -->
          <tr>
            <td align="center" style="background-color:#F8FAFC; border-top:1px solid #E2E8F0; padding:24px 32px;">
              ${unsubscribe ? `<p style="margin:0 0 10px 0; font-size:11px; color:#64748B;">${copy.newsletter} <a href="${escapeHtml(unsubscribe)}" style="color:#1D4ED8; text-decoration:underline;">${copy.unsubscribe}</a></p>` : ""}
              <p style="margin:0 0 6px 0; font-size:14px; font-weight:800; color:#0F172A;">
                ${brandHtml()}
              </p>
              <p style="margin:0 0 12px 0; font-size:12px; color:#64748B; line-height:1.65;">
                ${copy.location} &nbsp;&bull;&nbsp;
                <a href="mailto:${CONTACT_EMAIL}" style="color:#1D4ED8; text-decoration:none; font-weight:600; white-space:nowrap;">${CONTACT_EMAIL}</a>
                &nbsp;&bull;&nbsp;
                <a href="${CONTACT_PHONE_HREF}" dir="ltr" style="color:#1D4ED8; text-decoration:none; font-weight:600; white-space:nowrap;">${CONTACT_PHONE}</a>
              </p>
              <p style="margin:0 0 12px 0; font-size:12px;">
                ${footerLink(copy.website, SITE_URL)}
                &nbsp;&nbsp;&bull;&nbsp;&nbsp;
                ${footerLink("Pack PFE &amp; Summer Camp", PROGRAMS_URL)}
                &nbsp;&nbsp;&bull;&nbsp;&nbsp;
                ${footerLink("Facebook", FACEBOOK_URL)}
              </p>
              <p style="margin:0; font-size:11px; color:#94A3B8;">
                ${copy.automatic(year)}
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

const NAMED_ENTITIES = {
  nbsp: " ", amp: "&", lt: "<", gt: ">", quot: '"', apos: "'",
  rarr: "→", larr: "←", bull: "•", mdash: "—", ndash: "–", copy: "©", laquo: "«", raquo: "»", hellip: "…",
};

/* Version texte brut de l'email (un email HTML sans alternative texte est un
   signal de spam classique). Le pré-en-tête caché et le <head> sont retirés. */
export const htmlToPlainText = (html) =>
  String(html ?? "")
    .replace(/<head[\s\S]*?<\/head>/gi, "")
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, "")
    .replace(/<div style="display:none;[^"]*">[\s\S]*?<\/div>/gi, "")
    .replace(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, (match, href, text) => {
      const label = text.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
      return label && !href.startsWith("mailto:") && !href.startsWith("tel:") ? `${label} (${href})` : label || href;
    })
    .replace(/<\/(p|div|tr|table|h[1-6])>/gi, "\n")
    .replace(/<\/td>/gi, "  ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&#(\d+);/g, (match, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (match, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&([a-z]+);/gi, (match, name) => NAMED_ENTITIES[name.toLowerCase()] ?? match)
    .replace(/[ \t ]+/g, " ")
    .split("\n").map((line) => line.trim()).join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
