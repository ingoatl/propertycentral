import { format, parseISO } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

export const EST_TIMEZONE = 'America/New_York';

/**
 * Format a UTC date/time string or Date object to EST timezone
 * @param dateString - ISO date string (UTC) or Date object
 * @param formatStr - date-fns format string (e.g., "MMM d, h:mm a")
 * @returns Formatted date string in EST timezone
 */
export function formatInEST(dateString: string | Date, formatStr: string): string {
  const date = typeof dateString === 'string' ? parseISO(dateString) : dateString;
  const estDate = toZonedTime(date, EST_TIMEZONE);
  return format(estDate, formatStr);
}

/**
 * Get a Date object representing the EST time (for display/comparison purposes)
 * @param dateString - ISO date string (UTC) or Date object
 * @returns Date object adjusted to EST timezone
 */
export function getESTTime(dateString: string | Date): Date {
  const date = typeof dateString === 'string' ? parseISO(dateString) : dateString;
  return toZonedTime(date, EST_TIMEZONE);
}

/**
 * Format date with EST timezone indicator
 * @param dateString - ISO date string (UTC) or Date object
 * @param formatStr - date-fns format string
 * @returns Formatted string with " EST" appended
 */
export function formatInESTWithLabel(dateString: string | Date, formatStr: string): string {
  return `${formatInEST(dateString, formatStr)} EST`;
}

/**
 * Get human-readable date and time in EST
 * @param dateString - ISO date string (UTC) or Date object
 * @returns Object with formatted date and time strings
 */
export function getESTDateTimeParts(dateString: string | Date): { date: string; time: string; dateTime: string } {
  return {
    date: formatInEST(dateString, "EEEE, MMMM d, yyyy"),
    time: formatInEST(dateString, "h:mm a"),
    dateTime: formatInEST(dateString, "EEEE, MMMM d, yyyy 'at' h:mm a"),
  };
}
