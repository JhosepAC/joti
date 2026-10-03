"use client";

import { useEffect, useRef, useState } from "react";
import { useAction } from "convex/react";
import { useLocale, useTranslations } from "next-intl";
import { api } from "@/convex/_generated/api";
import { ValidationErrors } from "../types/auth.types";
import { validateResetPasswordInput } from "../validations/reset-password.schema";
import { useAuthErrorMessage } from "../utils/get-auth-error-message";
import { useValidationTranslator } from "@/i18n/translate";

export function useResetPassword(token: string | null) {
  const tValidation = useValidationTranslator();
  const tErrors = useAuthErrorMessage();
  const tGeneral = useTranslations("validation.general");
  const locale = useLocale();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [tokenValid, setTokenValid] = useState<boolean | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const verifyAction = useAction(api.auth.passwordReset.verifyResetToken);
  const resetAction = useAction(api.auth.passwordReset.resetPassword);

  // Synchronous in-flight guard against double submits.
  const inFlight = useRef(false);

  useEffect(() => {
    if (!token) {
      setTokenValid(false);
      return;
    }
    let cancelled = false;
    verifyAction({ token })
      .then((res) => {
        if (cancelled) return;
        // The backend answers validity only (no email: the token is already
        // takeover-capable, so echoing the address would widen exposure).
        // The email-containment password rule is still enforced server-side
        // by `resetPassword`, which resolves the address itself.
        const r = res as { valid: boolean };
        setTokenValid(r.valid);
        if (!r.valid) setErrors({ general: tErrors(undefined, tGeneral("resetFailed")) });
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
      setErrors({ general: tGeneral("resetFailed") });
      return;
    }
    const { isValid, errors: vErrors } = validateResetPasswordInput({
      password,
      confirmPassword,
    }, tValidation);
    if (!isValid) {
      setErrors(vErrors);
      return;
    }
    if (inFlight.current) return;
    inFlight.current = true;
    setStatus("loading");
    setErrors({});
    try {
      await resetAction({ token, password, confirmPassword, locale });
      setIsSuccess(true);
      setStatus("success");
    } catch (err: unknown) {
      setStatus("error");
      setErrors({ general: tErrors(err, tGeneral("resetFailed")) });
    } finally {
      inFlight.current = false;
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
    handleSubmit,
  };
}
