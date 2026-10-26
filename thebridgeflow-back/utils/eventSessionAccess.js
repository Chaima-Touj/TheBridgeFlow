export function isSafeSessionUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
}

export function isSessionLinkAvailable(event, now = new Date()) {
  return Boolean(
    event?.status === "published" &&
    event.endsAt &&
    new Date(event.endsAt) <= now &&
    isSafeSessionUrl(event.sessionUrl)
  );
}
