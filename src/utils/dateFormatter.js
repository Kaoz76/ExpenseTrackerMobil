// src/utils/dateFormatter.js

/**
 * Formats a Firebase Timestamp or JavaScript Date object into a readable Turkish localized string.
 * @param {Date|Object} timestamp - The date to format.
 * @returns {string} Formatted date string (e.g., 10.03.2026, 14:30).
 */
export const formatDateTime = (timestamp) => {
  if (!timestamp) return '-';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleString('tr-TR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  });
};
