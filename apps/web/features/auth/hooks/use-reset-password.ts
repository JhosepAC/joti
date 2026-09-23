"use client";

import { useEffect, useState } from "react";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { ValidationErrors } from "../types/auth.types";
import { validateResetPasswordInput } from "../validations/reset-password.schema";
import { getAuthErrorMessage } from "../utils/get-auth-error-message";

export function useResetPassword(token: string | null) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [tokenValid, setTokenValid] = useState<boolean | null>(null);
  const [tokenEmail, setTokenEmail] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const verifyAction = useAction(api.auth.passwordReset.verifyResetToken);
  const resetAction = useAction(api.auth.passwordReset.resetPassword);

  useEffect(() => {
    if (!token) {
      setTokenValid(false);
      return;
    }
    let cancelled = false;
    verifyAction({ token })
      .then((res) => {
        if (cancelled) return;
        const r = res as { valid: boolean; email?: string };
        setTokenValid(r.valid);
        if (r.email) setTokenEmail(r.email);
        if (!r.valid) setErrors({ general: "This reset link is invalid or has expired." });
      })
      .catch(() => {
        if (!cancelled) setTokenValid(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, verifyAction]);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!token) {
      setErrors({ general: "Missing reset token." });
      return;
    }
    const { isValid, errors: vErrors } = validateResetPasswordInput({
      password,
      confirmPassword,
      email: tokenEmail ?? undefined,
    });
    if (!isValid) {
      setErrors(vErrors);
      return;
    }
    setStatus("loading");
    setErrors({});
    try {
      await resetAction({ token, password, confirmPassword });
      setIsSuccess(true);
      setStatus("success");
    } catch (err: unknown) {
      setStatus("error");
      setErrors({ general: getAuthErrorMessage(err, "Failed to reset password") });
    } finally {
      setStatus("idle");
    }
  };

  return {
    password,
    setPassword: (v: string) => {
      setPassword(v);
      if (errors.password) setErrors((p) => ({ ...p, password: undefined }));
    },
    confirmPassword,
    setConfirmPassword: (v: string) => {
      setConfirmPassword(v);
      if (errors.confirmPassword) setErrors((p) => ({ ...p, confirmPassword: undefined }));
    },
    errors,
    isLoading: status === "loading",
    isSuccess,
    tokenValid,
    tokenEmail,
    handleSubmit,
  };
}
