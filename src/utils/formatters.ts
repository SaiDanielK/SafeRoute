export function formatDuration(
  totalSeconds: number
): string {
  const totalMinutes = Math.max(
    0,
    Math.round(totalSeconds / 60)
  );

  if (totalMinutes < 60) {
    return `${totalMinutes} min`;
  }

  const totalHours = Math.floor(
    totalMinutes / 60
  );

  const minutes = totalMinutes % 60;

  if (totalHours < 24) {
    if (minutes === 0) {
      return `${totalHours} hr`;
    }

    return `${totalHours} hr ${minutes} min`;
  }

  const days = Math.floor(
    totalHours / 24
  );

  const hours = totalHours % 24;

  const dayLabel =
    days === 1 ? "day" : "days";

  if (hours === 0) {
    return `${days} ${dayLabel}`;
  }

  return `${days} ${dayLabel} ${hours} hr`;
}