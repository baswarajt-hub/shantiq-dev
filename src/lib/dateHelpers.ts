import { parseISO, isToday, isFuture, isPast } from 'date-fns';

/**
 * Categorize an appointment date as 'past', 'today', or 'future'.
 * 
 * @param dateString - ISO or date-like string (e.g. "2025-10-20")
 * @returns 'past' | 'today' | 'future'
 */
export function getAppointmentStatus(dateString: string): 'past' | 'today' | 'future' {
  if (!dateString) return 'past';
  const date = parseISO(dateString);

  if (isToday(date)) return 'today';
  if (isFuture(date)) return 'future';
  if (isPast(date)) return 'past';

  return 'past';
}

/**
 * Quick boolean helpers if you prefer
 */
export const isAppointmentToday = (dateString: string) => {
  if (!dateString) return false;
  return isToday(parseISO(dateString));
};

export const isAppointmentFuture = (dateString: string) => {
  if (!dateString) return false;
  return isFuture(parseISO(dateString)) && !isToday(parseISO(dateString));
};

export const isAppointmentPast = (dateString: string) => {
  if (!dateString) return false;
  return !isFuture(parseISO(dateString)) && !isToday(parseISO(dateString));
};
