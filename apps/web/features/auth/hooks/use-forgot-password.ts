"use client";

import { useEffect, useRef, useState } from "react";
import { useAction } from "convex/react";
import { useLocale, useTranslations } from "next-intl";
import { api } from "@/convex/_generated/api";
import { ValidationErrors } from "../types/auth.types";
import { validateForgotPasswordEmail } from "../validations/forgot-password.schema";
import {
  getAuthErrorCode,
  getRetryAfterSeconds,
  useAuthErrorMessage,
} from "../utils/get-auth-error-message";
import { useValidationTranslator } from "@/i18n/translate";

export function useForgotPassword() {
  const tValidation = useValidationTranslator();
  const tErrors = useAuthErrorMessage();
  const tGeneral = useTranslations("validation.general");
  const locale = useLocale();
  const [email, setEmail] = useState("");
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [status, setStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [isSuccess, setIsSuccess] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const requestAction = useAction(api.auth.passwordReset.requestPasswordReset);

  // Synchronous in-flight guard: `cooldown`/`status` flip only after a
  // render, so rapid double submits could otherwise fire twice.
  const inFlight = useRef(false);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const startCooldown = (seconds: number) => {
    setCooldown(seconds);
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleChange = (value: string) => {
    if (value.trim().toLowerCase() !== email.trim().toLowerCase()) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setCooldown(0);
    }
    setEmail(value);
    if (errors.email) setErrors((p) => ({ ...p, email: undefined }));
    if (errors.general) setErrors((p) => ({ ...p, general: undefined }));
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (cooldown > 0) return;
    const { isValid, errors: vErrors } = validateForgotPasswordEmail(
      email,
      tValidation,
    );
    if (!isValid) {
      setErrors(vErrors);
      return;
    }
    if (inFlight.current) return;
    inFlight.current = true;
    setStatus("loading");
    setErrors({});
    try {
      await requestAction({ email: email.trim().toLowerCase(), locale });
      setIsSuccess(true);
      setStatus("success");
      startCooldown(60);
    } catch (err: unknown) {
      setStatus("error");
      const code = getAuthErrorCode(err);
      if (code === "RATE_LIMITED") {
        const msg = tErrors(err);
        setErrors({ general: msg });
        // Parse wait seconds from message e.g. "Please wait 42s"
        startCooldown(getRetryAfterSeconds(err));
      } else {
        setErrors({ general: tErrors(err, tGeneral("resetLinkFailed")) });
      }
    } finally {
      inFlight.current = false;
      setStatus("idle");
    }
  };

  const handleResend = async () => {
    if (cooldown > 0 || status === "loading") return;
    // Reuse same submit logic but without re-validating success state
    await handleSubmit();
  };

  return {
    email,
    setEmail: handleChange,
    errors,
    isLoading: status === "loading",
    isSuccess,
    cooldown,
    handleResend,
    handleSubmit,
    changeEmail: () => {
      setIsSuccess(false);
      setErrors({});
    },
  };
}
