import { ValidationErrors } from "../types/auth.types";

export function validateResetPasswordInput(input: {
  password: string;
  confirmPassword: string;
  email?: string;
  username?: string;
}): { isValid: boolean; errors: ValidationErrors } {
  const errors: ValidationErrors = {};
  const { password, confirmPassword, email, username } = input;

  if (!password) errors.password = "Password is required";
  else if (password.length < 12) errors.password = "Password must be at least 12 characters";
  else if (password.length > 128) errors.password = "Password must not exceed 128 characters";
  else if (email) {
    const localPart = email.split("@")[0]?.toLowerCase() ?? "";
    if (localPart.length >= 3 && password.toLowerCase().includes(localPart)) {
      errors.password = "Password must not contain your email";
    }
  }

  if (username && password.toLowerCase().includes(username.toLowerCase()) && username.length >= 3) {
    errors.password = "Password must not contain your username";
  }

  if (!confirmPassword) errors.confirmPassword = "Please confirm your password";
  else if (password !== confirmPassword) errors.confirmPassword = "Passwords do not match";

  return { isValid: Object.keys(errors).length === 0, errors };
}
