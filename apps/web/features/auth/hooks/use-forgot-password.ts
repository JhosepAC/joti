"use client";

import { useEffect, useRef, useState } from "react";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { ValidationErrors } from "../types/auth.types";
import { validateForgotPasswordEmail } from "../validations/forgot-password.schema";
import { getAuthErrorCode, getAuthErrorMessage } from "../utils/get-auth-error-message";

export function useForgotPassword() {
  const [email, setEmail] = useState("");
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [isSuccess, setIsSuccess] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const requestAction = useAction(api.auth.passwordReset.requestPasswordReset);

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
    setEmail(value);
    if (errors.email) setErrors((p) => ({ ...p, email: undefined }));
    if (errors.general) setErrors((p) => ({ ...p, general: undefined }));
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (cooldown > 0) return;
    const { isValid, errors: vErrors } = validateForgotPasswordEmail(email);
    if (!isValid) {
      setErrors(vErrors);
      return;
    }
    setStatus("loading");
    setErrors({});
    try {
      await requestAction({ email: email.trim().toLowerCase() });
      setIsSuccess(true);
      setStatus("success");
      startCooldown(60);
    } catch (err: unknown) {
      setStatus("error");
      const code = getAuthErrorCode(err);
      if (code === "RATE_LIMITED") {
        const msg = getAuthErrorMessage(err);
        setErrors({ general: msg });
        // Parse wait seconds from message e.g. "Please wait 42s"
        const match = msg.match(/(\d+)s/);
        const wait = match?.[1] ? parseInt(match[1], 10) : 60;
        startCooldown(wait);
      } else {
        setErrors({ general: getAuthErrorMessage(err, "Failed to send reset link") });
      }
    } finally {
      setStatus("idle");
    }
  };

  const handleResend = async () => {
    if (cooldown > 0 || status === "loading") return;
    // Reuse same submit logic but without re-validating success state
    setIsSuccess(false);
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
  };
}
