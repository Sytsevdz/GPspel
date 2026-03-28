const EUROPE_AMSTERDAM_TIMEZONE = "Europe/Amsterdam";

type DateParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
};

const amsterdamFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: EUROPE_AMSTERDAM_TIMEZONE,
  hour12: false,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

function parseDateTimeLocalValue(value: string): DateParts | null {
  const parsed = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);

  if (!parsed) {
    return null;
  }

  const [, year, month, day, hour, minute] = parsed;

  return {
    year: Number(year),
    month: Number(month),
    day: Number(day),
    hour: Number(hour),
    minute: Number(minute),
  };
}

function getTimeZoneOffsetMs(utcDate: Date): number {
  const formattedParts = amsterdamFormatter.formatToParts(utcDate);
  const values = Object.fromEntries(formattedParts.map((part) => [part.type, part.value]));

  const localAsUtcMs = Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day),
    Number(values.hour),
    Number(values.minute),
    Number(values.second),
  );

  return localAsUtcMs - utcDate.getTime();
}

function toPartsInAmsterdam(utcDate: Date): DateParts {
  const formattedParts = amsterdamFormatter.formatToParts(utcDate);
  const values = Object.fromEntries(formattedParts.map((part) => [part.type, part.value]));

  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
  };
}

function matchesParts(left: DateParts, right: DateParts): boolean {
  return (
    left.year === right.year
    && left.month === right.month
    && left.day === right.day
    && left.hour === right.hour
    && left.minute === right.minute
  );
}

export function parseAmsterdamDateTimeLocalToUtcIso(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const dateParts = parseDateTimeLocalValue(value);

  if (!dateParts) {
    return null;
  }

  const baseUtcMs = Date.UTC(dateParts.year, dateParts.month - 1, dateParts.day, dateParts.hour, dateParts.minute);
  let utcMs = baseUtcMs - getTimeZoneOffsetMs(new Date(baseUtcMs));

  utcMs = baseUtcMs - getTimeZoneOffsetMs(new Date(utcMs));

  const utcDate = new Date(utcMs);

  if (Number.isNaN(utcDate.getTime())) {
    return null;
  }

  const resolvedParts = toPartsInAmsterdam(utcDate);

  if (!matchesParts(resolvedParts, dateParts)) {
    return null;
  }

  return utcDate.toISOString();
}

export function toAmsterdamDateTimeLocalValue(dateValue: string): string {
  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const parts = toPartsInAmsterdam(date);
  const pad = (value: number) => String(value).padStart(2, "0");

  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}T${pad(parts.hour)}:${pad(parts.minute)}`;
}

export function formatUtcIsoInAmsterdam(dateValue: string): string {
  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("nl-NL", {
    timeZone: EUROPE_AMSTERDAM_TIMEZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function formatUtcIsoInAmsterdamShort(dateValue: string): string {
  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("nl-NL", {
    timeZone: EUROPE_AMSTERDAM_TIMEZONE,
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
