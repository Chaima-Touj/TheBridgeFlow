export function isSafeSessionUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
}

export function isSessionLinkAvailable(event, now = new Date()) {
  const availableAt = event?.endsAt || event?.startsAt;
  return Boolean(
    event?.status === "published" &&
    availableAt && new Date(availableAt) <= now &&
    isSafeSessionUrl(event.sessionUrl)
  );
}
