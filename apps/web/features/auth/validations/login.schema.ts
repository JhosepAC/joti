import { LoginCredentials, ValidationErrors } from "../types/auth.types";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateLoginCredentials(credentials: LoginCredentials): {
  isValid: boolean;
  errors: ValidationErrors;
} {
  const errors: ValidationErrors = {};
  const email = credentials.email.trim().toLowerCase();
  const password = credentials.password;

  // Email Validation according to project specifications (database/auth.md)
  if (!email) {
    errors.email = "Email is required";
  } else if (email.length > 320) {
    errors.email = "Email must not exceed 320 characters";
  } else if (/\s/.test(email)) {
    errors.email = "Email must not contain spaces";
  } else if (!EMAIL_REGEX.test(email)) {
    errors.email = "Please enter a valid email address";
  }

  // Password — do NOT reveal policy on login (avoids user enumeration / length oracle)
  // Only check presence; actual verification is server-side with generic error
  if (!password) {
    errors.password = "Password is required";
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}
