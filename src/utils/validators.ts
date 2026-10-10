export const PASSWORD_MIN_LENGTH = 6;

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
}

export function isValidPassword(value: string, min = PASSWORD_MIN_LENGTH): boolean {
  return value.length >= min;
}

export function isNumeric(value: string, maxLen = 15): boolean {
  return /^\d{1,15}$/.test(value.trim()) && value.length <= maxLen;
}

export function isEgyptianPhone(value: string): boolean {
  return /^(\+2|20)?01(0|1|2|5)[0-9]{8}$/.test(value.replace(/[\s-]/g, ''));
}