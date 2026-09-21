"use client";

import { useState } from "react";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { AuthStatus, LoginCredentials, ValidationErrors } from "../types/auth.types";
import { validateLoginCredentials } from "../validations/login.schema";

export function useLogin() {
  const [credentials, setCredentials] = useState<LoginCredentials>({
    email: "",
    password: "",
  });
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [status, setStatus] = useState<AuthStatus>("idle");
  const [isOAuthLoading, setIsOAuthLoading] = useState(false);

  // Real Convex action — Argon2 verification + lockout logic lives server-side
  const loginAction = useAction(api.auth.actions.login);

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

      const result = await loginAction({
        email: credentials.email.trim().toLowerCase(),
        password: credentials.password,
      });

      setStatus("success");
      // TODO: persist session (e.g., JWT / Convex session) and redirect
      console.log("[useLogin] authenticated:", result);
    } catch (err: unknown) {
      setStatus("error");
      // ConvexError shape: { data: { code, message } } or Error
      const message =
        err instanceof Error
          ? (err as Error & { data?: { message?: string } }).data?.message ?? err.message
          : "Failed to sign in";
      setErrors({ general: message });
    } finally {
      setStatus("idle");
    }
  };

  const handleGoogleLogin = async () => {
    try {
      setIsOAuthLoading(true);
      const siteUrl = process.env.NEXT_PUBLIC_CONVEX_SITE_URL;
      if (siteUrl && typeof window !== "undefined") {
        window.location.href = `${siteUrl}/oauth/google/authorize`;
        return;
      }
      // Fallback placeholder
      console.log("[useLogin] Redirecting to Google…");
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Failed to sign in with Google";
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
