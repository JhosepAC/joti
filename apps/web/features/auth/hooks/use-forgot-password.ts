"use client";

import { useState } from "react";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { ValidationErrors } from "../types/auth.types";
import { validateForgotPasswordEmail } from "../validations/forgot-password.schema";
import { getAuthErrorMessage } from "../utils/get-auth-error-message";

export function useForgotPassword() {
  const [email, setEmail] = useState("");
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [isSuccess, setIsSuccess] = useState(false);

  const requestAction = useAction(api.auth.passwordReset.requestPasswordReset);

  const handleChange = (value: string) => {
    setEmail(value);
    if (errors.email) setErrors((p) => ({ ...p, email: undefined }));
    if (errors.general) setErrors((p) => ({ ...p, general: undefined }));
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
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
    } catch (err: unknown) {
      setStatus("error");
      setErrors({ general: getAuthErrorMessage(err, "Failed to send reset link") });
    } finally {
      setStatus("idle");
    }
  };

  return {
    email,
    setEmail: handleChange,
    errors,
    isLoading: status === "loading",
    isSuccess,
    handleSubmit,
  };
}
