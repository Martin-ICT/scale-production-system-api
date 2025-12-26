/**
 * Convert date to custom format: [Year][Month][Day]
 * - Year: 2010 = A, 2025 = P, increments per year, resets to A after Z
 * - Month: January = A, December = L (always fixed)
 * - Day: 1-9 = 01-09, 10-31 = 10-31
 *
 * Example: 4 December 2025 = PL04
 *
 * @param {Date|string} date - Date object or date string
 * @returns {string} Formatted date string (e.g., "PL04")
 */
const convertDateToCustomFormat = (date) => {
  if (!date) {
    return '';
  }

  const dateObj = date instanceof Date ? date : new Date(date);

  // Check if date is valid
  if (isNaN(dateObj.getTime())) {
    return '';
  }

  const year = dateObj.getFullYear();
  const month = dateObj.getMonth(); // 0-11 (0 = January, 11 = December)
  const day = dateObj.getDate(); // 1-31

  // Convert year: 2010 = A, 2011 = B, ..., 2025 = P, ..., 2035 = Z, 2036 = A (reset)
  const baseYear = 2010;
  const yearOffset = year - baseYear;
  const yearIndex = yearOffset % 26; // 26 letters in alphabet (A-Z)
  const yearChar = String.fromCharCode(65 + yearIndex); // 65 = 'A'

  // Convert month: January (0) = A, February (1) = B, ..., December (11) = L
  const monthChar = String.fromCharCode(65 + month); // 65 = 'A', 76 = 'L'

  // Convert day: pad with zero if single digit (01-09, 10-31)
  const dayStr = String(day).padStart(2, '0');

  return `${yearChar}${monthChar}${dayStr}`;
};

/**
 * Convert custom format back to date (if needed)
 *
 * @param {string} customFormat - Formatted date string (e.g., "PL04")
 * @returns {Date|null} Date object or null if invalid
 */
const convertCustomFormatToDate = (customFormat) => {
  if (!customFormat || customFormat.length !== 4) {
    return null;
  }

  const yearChar = customFormat[0];
  const monthChar = customFormat[1];
  const dayStr = customFormat.substring(2);

  // Convert year char back to year
  const baseYear = 2010;
  const yearIndex = yearChar.charCodeAt(0) - 65; // 65 = 'A'
  const year = baseYear + yearIndex;

  // Convert month char back to month (0-11)
  const month = monthChar.charCodeAt(0) - 65; // 65 = 'A'

  // Convert day string to number
  const day = parseInt(dayStr, 10);

  if (
    isNaN(year) ||
    isNaN(month) ||
    isNaN(day) ||
    month < 0 ||
    month > 11 ||
    day < 1 ||
    day > 31
  ) {
    return null;
  }

  return new Date(year, month, day);
};

/**
 * Format current date/time to SAP API format: YYYY-MM-DD HH:mm:ss.SSS
 * Uses Asia/Jakarta timezone (WIB, UTC+7)
 *
 * Example: "2025-12-04 15:08:45.123"
 *
 * @param {Date} date - Optional date object (defaults to current time)
 * @returns {string} Formatted date string
 */
const formatDateTimeForSAP = (date = null) => {
  const now = date || new Date();

  // Format in Asia/Jakarta timezone (WIB, UTC+7)
  const options = {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  };

  const formatter = new Intl.DateTimeFormat('en-CA', options);
  const parts = formatter.formatToParts(now);

  const getPart = (type) => parts.find((p) => p.type === type)?.value || '00';

  const year = getPart('year');
  const month = getPart('month');
  const day = getPart('day');
  const hours = getPart('hour');
  const minutes = getPart('minute');
  const seconds = getPart('second');

  // Get milliseconds in Jakarta timezone
  const jakartaOffset = 7 * 60 * 60 * 1000; // UTC+7 in milliseconds
  const utcTime = now.getTime() + now.getTimezoneOffset() * 60 * 1000;
  const jakartaTime = new Date(utcTime + jakartaOffset);
  const milliseconds = String(jakartaTime.getMilliseconds()).padStart(3, '0');

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${milliseconds}`;
};

module.exports = {
  convertDateToCustomFormat,
  convertCustomFormatToDate,
  formatDateTimeForSAP,
};
