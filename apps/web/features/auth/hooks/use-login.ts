"use client";

import { useState } from "react";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { AuthStatus, LoginCredentials, ValidationErrors } from "../types/auth.types";
import { validateLoginCredentials } from "../validations/login.schema";
import { getAuthErrorMessage, getAuthErrorCode } from "../utils/get-auth-error-message";

export function useLogin() {
  const [credentials, setCredentials] = useState<LoginCredentials>({
    email: "",
    password: "",
  });
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [status, setStatus] = useState<AuthStatus>("idle");
  const [isOAuthLoading, setIsOAuthLoading] = useState(false);
  const [requiresActivation, setRequiresActivation] = useState(false);
  const [requiresProfile, setRequiresProfile] = useState(false);
  const [activationCode, setActivationCode] = useState("");
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);

  // Real Convex action — Argon2 verification + lockout logic lives server-side
  const loginAction = useAction(api.auth.actions.login);
  const requestCodeAction = useAction(api.auth.verification.requestEmailCode);
  const confirmCodeAction = useAction(api.auth.verification.confirmEmailCode);

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

      const result = (await loginAction({
        email: credentials.email.trim().toLowerCase(),
        password: credentials.password,
      })) as { user: { _id: string; email: string }; profile: unknown | null };

      // Mandatory profile completion gate
      if (!result.profile) {
        setRequiresProfile(true);
        setPendingEmail(result.user.email);
        setStatus("idle");
        setErrors({ general: "Please complete your profile to continue." });
        return;
      }

      setStatus("success");
      // TODO: persist session (e.g., JWT / Convex session) and redirect
      console.log("[useLogin] authenticated:", result);
    } catch (err: unknown) {
      setStatus("error");
      const code = getAuthErrorCode(err);
      if (code === "EMAIL_NOT_VERIFIED") {
        setRequiresActivation(true);
        setPendingEmail(credentials.email.trim().toLowerCase());
        setErrors({ general: getAuthErrorMessage(err) });
      } else {
        setErrors({ general: getAuthErrorMessage(err, "Invalid email or password.") });
      }
    } finally {
      setStatus("idle");
    }
  };

  const handleActivationVerify = async () => {
    if (!pendingEmail) return;
    if (!/^\d{6}$/.test(activationCode.trim())) {
      setErrors({ general: "Code must be 6 digits" });
      return;
    }
    try {
      setStatus("loading");
      await confirmCodeAction({ email: pendingEmail, code: activationCode.trim() });
      setRequiresActivation(false);
      setErrors({});
      // Retry login after activation
      await loginAction({ email: pendingEmail, password: credentials.password });
      setStatus("success");
    } catch (err: unknown) {
      setErrors({ general: getAuthErrorMessage(err, "Invalid or expired code") });
      setStatus("error");
    } finally {
      setStatus("idle");
    }
  };

  const handleResendActivation = async () => {
    if (!pendingEmail) return;
    try {
      setStatus("loading");
      await requestCodeAction({ email: pendingEmail });
      setErrors({});
    } catch (err: unknown) {
      setErrors({ general: getAuthErrorMessage(err, "Failed to resend code") });
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
      setErrors({ general: getAuthErrorMessage(err, "Failed to sign in with Google") });
    } finally {
      setIsOAuthLoading(false);
    }
  };

  return {
    credentials,
    errors,
    isLoading: status === "loading",
    isOAuthLoading,
    requiresActivation,
    requiresProfile,
    activationCode,
    setActivationCode,
    pendingEmail,
    handleActivationVerify,
    handleResendActivation,
    handleFieldChange,
    handleCredentialsSubmit,
    handleGoogleLogin,
  };
}
