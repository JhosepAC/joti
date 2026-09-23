import { ValidationErrors } from "../types/auth.types";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateForgotPasswordEmail(email: string): { isValid: boolean; errors: ValidationErrors } {
  const errors: ValidationErrors = {};
  const normalized = email.trim().toLowerCase();
  if (!normalized) errors.email = "Email is required";
  else if (normalized.length > 320) errors.email = "Email must not exceed 320 characters";
  else if (/\s/.test(normalized)) errors.email = "Email must not contain spaces";
  else if (!EMAIL_REGEX.test(normalized)) errors.email = "Please enter a valid email address";
  return { isValid: Object.keys(errors).length === 0, errors };
}
