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
