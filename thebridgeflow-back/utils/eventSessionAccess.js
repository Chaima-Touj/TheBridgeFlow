export function isSafeSessionUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
}

export function isSessionLinkAvailable(event) {
  return Boolean(
    event?.status === "published" &&
    isSafeSessionUrl(event.sessionUrl)
  );
}
