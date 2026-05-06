/**
 * Locale-aware string utilities
 * Automatically detects browser language for proper character conversion (especially Turkish i/I)
 */

const getLocale = () => {
  // Use browser language if available, default to Turkish if not specified
  // but allow it to fall back to English or others naturally.
  return navigator.language || 'tr-TR';
};

const locale = getLocale();

/**
 * Converts a string to lowercase using detected locale rules.
 */
export const trToLower = (str) => {
  if (typeof str !== 'string') return "";
  return str.toLocaleLowerCase(locale);
};

/**
 * Converts a string to uppercase using detected locale rules.
 */
export const trToUpper = (str) => {
  if (typeof str !== 'string') return "";
  return str.toLocaleUpperCase(locale);
};

/**
 * Capitalizes each word in a string using detected locale rules.
 */
export const trTitleCase = (str) => {
  if (typeof str !== 'string') return "";
  return str
    .toLocaleLowerCase(locale)
    .split(' ')
    .map(word => word.charAt(0).toLocaleUpperCase(locale) + word.slice(1))
    .join(' ');
};

/**
 * Checks if a string includes another string, case-insensitively using locale rules.
 */
export const trIncludes = (source, target) => {
  if (typeof source !== 'string' || typeof target !== 'string') return false;
  return trToLower(source).includes(trToLower(target));
};

