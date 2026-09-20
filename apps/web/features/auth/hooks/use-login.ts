"use client";

import { useState } from "react";
import { AuthStatus, LoginCredentials, ValidationErrors } from "../types/auth.types";
import { validateLoginCredentials } from "../validations/login.schema";
import { authService } from "../services/auth.service";

export function useLogin() {
  const [credentials, setCredentials] = useState<LoginCredentials>({
    email: "",
    password: "",
  });
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [status, setStatus] = useState<AuthStatus>("idle");
  const [isOAuthLoading, setIsOAuthLoading] = useState(false);

  const handleFieldChange = (field: keyof LoginCredentials, value: string) => {
    setCredentials((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const { isValid, errors: validationErrors } = validateLoginCredentials(credentials);
    if (!isValid) {
      setErrors(validationErrors);
      return;
    }

    try {
      setStatus("loading");
      setErrors({});
      await authService.loginWithCredentials(credentials);
      setStatus("success");
      alert("Signing in with credentials...");
    } catch (err: unknown) {
      setStatus("error");
      const errorMessage =
        err instanceof Error ? err.message : "Failed to sign in";
      setErrors({ general: errorMessage });
    } finally {
      setStatus("idle");
    }
  };

  const handleGoogleLogin = async () => {
    try {
      setIsOAuthLoading(true);
      await authService.loginWithOAuth("google");
      alert("Redirecting to Google...");
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to sign in with Google";
      setErrors({ general: errorMessage });
    } finally {
      setIsOAuthLoading(false);
    }
  };

  return {
    credentials,
    errors,
    isLoading: status === "loading",
    isOAuthLoading,
    handleFieldChange,
    handleCredentialsSubmit,
    handleGoogleLogin,
  };
}
