export function getEventPeriodFilter(period, now = new Date()) {
  if (period === "upcoming") {
    return {
      $or: [
        { endsAt: { $gte: now } },
        { endsAt: null, startsAt: { $gte: now } },
      ],
    };
  }
  if (period === "past") {
    return {
      $or: [
        { endsAt: { $lt: now } },
        { endsAt: null, startsAt: { $lt: now } },
      ],
    };
  }
  return {};
}
