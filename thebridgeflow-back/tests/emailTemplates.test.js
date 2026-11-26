import test from "node:test";
import assert from "node:assert/strict";
import { emailTemplates } from "../services/email.service.js";
import {
  DEFAULT_EMAIL_LOGO_URL,
  EMAIL_BRAND,
  getEmailSender,
  htmlToPlainText,
  safeUrl,
} from "../services/emailLayout.js";

const event = {
  eventTitle: "Workshop DevOps",
  startsAt: "2026-12-15T09:00:00.000Z",
  timezone: "Africa/Tunis",
  location: "Ariana",
  description: "Atelier pratique sur Docker.",
  mode: "onsite",
  eventId: "64b000000000000000000001",
};

// Données représentatives de chaque template (mêmes champs que les contrôleurs).
const SAMPLES = {
  welcome: [{ name: "Amel Ben Ali", role: "étudiant" }, { name: "Admin", role: "admin" }],
  applicationSent: [{ studentName: "Amel", offerTitle: "Stage React", companyName: "Acme" }],
  applicationReceived: [{ companyName: "Acme", studentName: "Amel", studentEmail: "amel@example.com", studentPhone: "+216 29 324 873", offerTitle: "Stage React" }],
  applicationStatus: [
    { studentName: "Amel", offerTitle: "Stage React", companyName: "Acme", status: "acceptée" },
    { studentName: "Amel", offerTitle: "Stage React", companyName: "Acme", status: "refusée" },
    { studentName: "Amel", offerTitle: "Stage React", companyName: "Acme", status: "en cours" },
  ],
  interviewProposed: [
    { studentName: "Amel", companyName: "Acme", offerTitle: "Stage React", scheduledAt: "2026-12-15T09:00:00.000Z", mode: "présentiel", location: "Ariana" },
    { studentName: "Amel", companyName: "Acme", offerTitle: "Stage React", scheduledAt: "2026-12-15T09:00:00.000Z", mode: "en ligne", location: "https://meet.google.com/abc-defg-hij" },
  ],
  interviewStatus: [
    { recipientName: "Amel", status: "confirmé", offerTitle: "Stage React", scheduledAt: "2026-12-15T09:00:00.000Z", recipientRole: "étudiant" },
    { recipientName: "Admin", status: "annulé", offerTitle: "Stage React", scheduledAt: "2026-12-15T09:00:00.000Z", recipientRole: "admin", studentName: "Amel", studentEmail: "amel@example.com", studentPhone: "29324873", mode: "présentiel", location: "Ariana", link: "/dashboard/admin/candidatures", linkLabel: "Voir les candidatures" },
  ],
  enrollmentRequestReceived: [
    { adminName: "Admin", studentName: "Amel", studentEmail: "amel@example.com", studentPhone: "+216 29 324 873", formationTitle: "DevOps", mode: "En ligne" },
    { adminName: "Admin", studentName: "Amel", studentEmail: "amel@example.com", formationTitle: "DevOps", mode: "Inscription directe" },
  ],
  enrollmentRequestSent: [{ studentName: "Amel", formationTitle: "DevOps", mode: "En ligne", message: "Disponible le soir" }],
  enrollmentRequestStatus: [
    { studentName: "Amel", formationTitle: "DevOps", status: "acceptée" },
    { studentName: "Amel", formationTitle: "DevOps", status: "refusée", link: "/dashboard/student/demandes" },
    { studentName: "Amel", formationTitle: "DevOps", status: "annulée", link: "/dashboard/student/formations" },
  ],
  eventPublished: [{ recipientName: "Amel", event }],
  eventRegistrationConfirmed: [{ recipientName: "Amel", event }],
  eventRegistrationReceived: [{ adminName: "Admin", studentName: "Amel", studentEmail: "amel@example.com", studentPhone: "29324873", event }],
  eventRegistrationCancelled: [{ recipientName: "Amel", event }, { recipientName: "Amel", event, eventCancelled: true }],
  eventUpdated: [{ recipientName: "Amel", event }],
  eventReminder: [
    { recipientName: "Amel", event, reminderHours: 24 },
    { recipientName: "Amel", event: { ...event, mode: "online", location: "", meetingUrl: "https://meet.google.com/abc-defg-hij" }, reminderHours: 6 },
  ],
  eventFeedbackRequest: [{ recipientName: "Amel", event, feedbackUrl: "https://9antra.tn/events/1?feedback=1" }],
  eventRecordingAvailable: [{ recipientName: "Amel", eventTitle: "Workshop DevOps", recordingUrl: "/events/1/session" }],
  newMessage: [
    { recipientName: "Amel", senderName: "Admin", recipientRole: "étudiant", preview: "Bonjour, votre dossier est complet.", link: "/dashboard/student/messages" },
    { recipientName: "Admin", senderName: "Amel", senderEmail: "amel@example.com", senderPhone: "29324873", recipientRole: "admin", preview: "x".repeat(260), link: "/dashboard/admin/messages" },
  ],
  newUserAdmin: [{ userName: "Amel", userEmail: "amel@example.com", userPhone: "29324873", userRole: "étudiant" }],
  accountCreatedByAdmin: [{ name: "Amel", email: "amel@example.com", password: "Tmp#2026", role: "étudiant" }],
  verifyCode: [{ name: "Amel", code: "482913" }],
  resetPassword: [{ name: "Amel", resetUrl: "https://9antra.tn/reset-password/token" }],
  voteConfirmation: [{ studentName: "Amel", projectTitles: ["Projet A", "Projet B", "Projet C"] }],
  winnerCongrats: [{ studentName: "Amel", projectTitle: "Projet A", edition: 2026 }],
  ceremonyResults: [{ studentName: "Sami", winnerTitle: "Projet A", winnerStudentName: "Amel", edition: 2026 }],
  ceremonyProjectDecision: [{ studentName: "Amel", projectTitle: "Projet A", edition: 2026, accepted: true }, { studentName: "Amel", projectTitle: "Projet A", accepted: false }],
  newsletterWelcome: ["fr", "en", "ar"].map((language) => ({ language, unsubscribeUrl: "https://9antra.tn/newsletter/unsubscribe/tok" })),
  newsletterAdmin: [{ language: "fr", subscriberEmail: "visiteur@example.com" }],
  newsletterPublication: [
    { language: "fr", title: "Job Fair 2026", excerpt: "Rencontrez les recruteurs.", url: "https://9antra.tn/events/1", unsubscribeUrl: "https://9antra.tn/newsletter/unsubscribe/tok", startsAt: event.startsAt, timezone: "Africa/Tunis", location: "Tunis", mode: "onsite" },
    { language: "en", title: "New article", excerpt: "Read it.", url: "https://9antra.tn/blog/1", unsubscribeUrl: "https://9antra.tn/newsletter/unsubscribe/tok" },
    { language: "ar", title: "خبر جديد", excerpt: "اقرأ المزيد", url: "https://9antra.tn/blog/1", unsubscribeUrl: "https://9antra.tn/newsletter/unsubscribe/tok" },
  ],
};

const render = (name, data) => emailTemplates[name](data);

test("every email template has sample data", () => {
  assert.deepEqual(Object.keys(SAMPLES).sort(), Object.keys(emailTemplates).sort());
});

for (const [name, samples] of Object.entries(SAMPLES)) {
  test(`${name}: kit layout, brand and no missing values`, () => {
    for (const data of samples) {
      const { subject, html } = render(name, data);
      assert.ok(subject && !/TheBridgeFlow|undefined|null|NaN/.test(subject), subject);
      assert.ok(html.startsWith("<!DOCTYPE html>"));
      assert.ok(html.includes(`src="${DEFAULT_EMAIL_LOGO_URL}"`), "logo");
      assert.ok(html.includes(EMAIL_BRAND), "brand");
      assert.ok(html.includes("linear-gradient(135deg, #0F2557 0%, #1D4ED8 55%, #2563EB 100%)"), "royal blue hero");
      assert.ok(html.includes("contact@9antra.tn") && html.includes("+216 58 840 064"), "footer contact");
      assert.doesNotMatch(html, /TheBridgeFlow|undefined|\bnull\b|NaN|Invalid Date|\[object Object\]/);
      const text = htmlToPlainText(html);
      assert.doesNotMatch(text, /<[a-z/!]/i, "plain text has no tags");
      assert.ok(text.includes(EMAIL_BRAND));
    }
  });
}

test("user data is escaped everywhere", () => {
  const evil = `<img src=x onerror="alert(1)">`;
  const cases = [
    ["applicationSent", { studentName: evil, offerTitle: evil, companyName: evil }],
    ["interviewProposed", { studentName: evil, companyName: evil, offerTitle: evil, scheduledAt: event.startsAt, mode: "présentiel", location: evil }],
    ["newMessage", { recipientName: evil, senderName: evil, recipientRole: "admin", senderEmail: evil, preview: evil, link: "/x" }],
    ["eventReminder", { recipientName: evil, event: { ...event, eventTitle: evil, description: evil, location: evil }, reminderHours: 24 }],
    ["welcome", { name: evil, role: "étudiant" }],
    ["newsletterPublication", { language: "fr", title: evil, excerpt: evil, url: "https://9antra.tn/blog/1", unsubscribeUrl: "https://9antra.tn/u" }],
  ];
  for (const [name, data] of cases) {
    const { html } = render(name, data);
    assert.ok(!html.includes("<img src=x"), `${name} must escape user input`);
    assert.ok(html.includes("&lt;img src=x"), `${name} shows the escaped text`);
  }
});

test("unsafe links are never rendered as buttons", () => {
  assert.equal(safeUrl("javascript:alert(1)"), "");
  assert.equal(safeUrl("https://9antra.tn/x"), "https://9antra.tn/x");
  const { html } = render("resetPassword", { name: "Amel", resetUrl: "javascript:alert(1)" });
  assert.ok(!html.includes("javascript:"));
});

test("sender is displayed as 9antra.tn whatever the EMAIL_FROM format", () => {
  assert.deepEqual(getEmailSender({ EMAIL_FROM: "no-reply@9antra.tn" }), { name: "9antra.tn", address: "no-reply@9antra.tn" });
  assert.deepEqual(getEmailSender({ EMAIL_FROM: "\"TheBridgeFlow\" <no-reply@9antra.tn>" }), { name: "9antra.tn", address: "no-reply@9antra.tn" });
  assert.deepEqual(getEmailSender({ EMAIL_FROM: "x@y.tn", EMAIL_FROM_NAME: " The Bridge " }), { name: "The Bridge", address: "x@y.tn" });
});

test("interview and event times are shown in Tunis time", () => {
  const interview = render("interviewProposed", SAMPLES.interviewProposed[0]).html;
  assert.match(interview, /Mardi 15 décembre 2026 à 10:00/);
  assert.match(interview, /Présentiel &nbsp;&mdash;&nbsp; Ariana/);
  const reminder = render("eventReminder", SAMPLES.eventReminder[0]).html;
  assert.match(reminder, /15 décembre 2026 à 10:00/);
});

test("online reminder uses the live session card and join button", () => {
  const { html } = render("eventReminder", SAMPLES.eventReminder[1]);
  assert.match(html, /Session en direct • Google Meet/);
  assert.match(html, /Rejoindre sur Google Meet/);
  assert.match(html, /href="https:\/\/meet\.google\.com\/abc-defg-hij"/);
  const onsite = render("eventReminder", SAMPLES.eventReminder[0]).html;
  assert.doesNotMatch(onsite, /Rejoindre sur/);
  assert.match(onsite, /Voir l&#39;événement|Voir l'événement/);
});

test("kit-specific blocks", () => {
  const sent = render("applicationSent", SAMPLES.applicationSent[0]).html;
  assert.match(sent, /1\. Envoyée &#10003;/);
  assert.match(sent, /Conseil :/);
  const enrollment = render("enrollmentRequestSent", SAMPLES.enrollmentRequestSent[0]).html;
  assert.match(enrollment, /1\. Demande reçue &#10003;/);
  assert.match(enrollment, /En attente de traitement/);
  const cancelled = render("eventRegistrationCancelled", SAMPLES.eventRegistrationCancelled[1]).html;
  assert.match(cancelled, /annulé par l&#39;organisateur|annulé par l'organisateur/);
  assert.match(cancelled, /Voir les prochains événements/);
  const welcome = render("newsletterWelcome", SAMPLES.newsletterWelcome[0]).html;
  assert.match(welcome, /Free Workshops/);
  assert.match(welcome, /Se désabonner/);
  const code = render("verifyCode", SAMPLES.verifyCode[0]);
  assert.match(code.html, /482913/);
  assert.match(htmlToPlainText(code.html), /482913/);
});

test("newsletter emails follow the subscriber language", () => {
  const ar = render("newsletterPublication", SAMPLES.newsletterPublication[2]).html;
  assert.match(ar, /<html lang="ar" dir="rtl">/);
  assert.match(ar, /إلغاء الاشتراك/);
  const en = render("newsletterWelcome", SAMPLES.newsletterWelcome[1]);
  assert.match(en.subject, /Welcome/);
  assert.match(en.html, /Unsubscribe/);
  // Une actualité n'a ni date ni lieu : pas d'encadré vide.
  const news = render("newsletterPublication", SAMPLES.newsletterPublication[1]).html;
  assert.doesNotMatch(news, />Location</);
  const eventNews = render("newsletterPublication", SAMPLES.newsletterPublication[0]).html;
  assert.match(eventNews, /Tunis/);
});

test("plain-text version keeps links and readable symbols", () => {
  const text = htmlToPlainText(render("applicationSent", SAMPLES.applicationSent[0]).html);
  assert.match(text, /Voir mes candidatures → \(https?:\/\/[^)\s]+\/dashboard\/student\/applications\)/);
  assert.doesNotMatch(text, /&[a-z]+;|&#\d+;/);
});
