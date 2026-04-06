/** MSBTE-style roll: 4 digits — 15xx 1st year, 25xx 2nd year, 35xx 3rd year */
export const ROLL_NUMBER_PATTERN = /^(15|25|35)\d{2}$/;

export const ROLL_NUMBER_HINT =
  "Enter your 4-digit roll number: 15xx (1st year), 25xx (2nd year), 35xx (3rd year).";

export function normalizeRollDigits(value) {
  return String(value ?? "")
    .trim()
    .replace(/\D/g, "")
    .slice(0, 4);
}

export function isValidRollNumber(value) {
  return ROLL_NUMBER_PATTERN.test(normalizeRollDigits(value));
}

/** Excel / paste: coerce number cells to 4-digit string */
export function rollFromSpreadsheetCell(value) {
  if (value == null || value === "") return "";
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(Math.round(value)).replace(/\D/g, "").slice(0, 4);
  }
  return normalizeRollDigits(value);
}
