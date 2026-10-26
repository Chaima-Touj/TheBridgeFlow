export function buildEventDuplicateDraft(event, copySuffix) {
  const suffix = ` (${copySuffix})`;
  return {
    title: `${(event.title || "").slice(0, Math.max(0, 160 - suffix.length)).trim()}${suffix}`,
    description: event.description || "",
    image: event.image || "",
    category: event.category || "",
    startsAt: event.startsAt || "",
    endsAt: event.endsAt || "",
    timezone: event.timezone || "Africa/Tunis",
    mode: event.mode || "onsite",
    location: event.location || "",
    capacity: event.capacity ?? "",
    registrationRequired: event.registrationRequired !== false,
    status: "draft",
  };
}
