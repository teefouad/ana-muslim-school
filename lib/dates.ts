import dayjs from "dayjs";

/**
 * Converts a timezone-less date-time string (e.g. Mantine's DateTimePicker
 * value, "YYYY-MM-DD HH:mm:ss") to an ISO 8601 string using the current
 * runtime's local timezone, so the instant survives a client -> server
 * round trip regardless of what timezone the server runs in.
 */
export function toIsoStringOrNull(value: string | null): string | null {
  return value ? dayjs(value).toISOString() : null;
}
