// src/utils/dateFormatter.js

/**
 * Safely parses various representations of Firebase Timestamps or JavaScript dates.
 * Handles Timestamps, plain JS objects with seconds/nanoseconds, ISO strings, Dates, numbers.
 * @param {*} timestamp
 * @returns {Date}
 */
export const parseDate = (timestamp) => {
  if (!timestamp) return new Date();
  if (typeof timestamp.toDate === 'function') return timestamp.toDate();
  if (timestamp.seconds !== undefined) return new Date(timestamp.seconds * 1000);
  if (timestamp._seconds !== undefined) return new Date(timestamp._seconds * 1000);
  if (timestamp instanceof Date) return timestamp;
  const parsed = new Date(timestamp);
  return isNaN(parsed.getTime()) ? new Date() : parsed;
};

/**
 * Formats a Firebase Timestamp or JavaScript Date object into a readable Turkish localized string.
 * @param {Date|Object} timestamp - The date to format.
 * @returns {string} Formatted date string (e.g., 10.03.2026, 14:30).
 */
export const formatDateTime = (timestamp) => {
  if (!timestamp) return '-';
  const date = parseDate(timestamp);
  return date.toLocaleString(navigator.language || 'tr-TR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  });
};

/**
 * Formats a Firebase Timestamp or JavaScript Date object into a readable date string without time.
 * @param {Date|Object} timestamp - The date to format.
 * @returns {string} Formatted date string (e.g., 10.03.2026).
 */
export const formatDate = (timestamp) => {
  if (!timestamp) return '-';
  const date = parseDate(timestamp);
  return date.toLocaleDateString(navigator.language || 'tr-TR', {
    day: '2-digit', month: '2-digit', year: 'numeric'
  });
};

