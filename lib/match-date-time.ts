function splitRawDateTime(value: string) {
  const [datePart = "", rawTime = ""] = value.split("T");
  const timeMatch = rawTime.match(/^(\d{2}):(\d{2})/);
  return {
    date: datePart,
    time: timeMatch ? `${timeMatch[1]}:${timeMatch[2]}` : "",
  };
}

export function splitMatchDateTime(value?: string | null) {
  if (!value) return { date: "", time: "" };
  return splitRawDateTime(value);
}

export function matchDateInput(value?: string | null) {
  return splitMatchDateTime(value).date;
}

export function matchTimeInput(value?: string | null, fallback = "18:00") {
  return splitMatchDateTime(value).time || fallback;
}

export function matchDateTimeLocalInput(value?: string | null) {
  const { date, time } = splitMatchDateTime(value);
  return date && time ? `${date}T${time}` : "";
}

export function matchLocalDateTimeToIso(value?: string | null) {
  if (!value) return null;
  const { date, time } = splitMatchDateTime(value);
  return date && time ? `${date}T${time}` : value;
}

export function formatLiteralMatchDate(
  value?: string | null,
  options: Intl.DateTimeFormatOptions = {},
) {
  const { date } = splitMatchDateTime(value);
  if (!date) return "";
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("es-ES", {
    timeZone: "UTC",
    ...options,
  });
}
