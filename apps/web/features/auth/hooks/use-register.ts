"use client";

import { useState } from "react";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { AuthStatus, RegisterPayload, ValidationErrors } from "../types/auth.types";
import { validateRegisterPayload } from "../validations/register.schema";

export function useRegister() {
  const [payload, setPayload] = useState<RegisterPayload>({
    email: "",
    password: "",
    username: "",
    displayName: "",
    bio: "",
  });
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [status, setStatus] = useState<AuthStatus>("idle");

  const registerAction = useAction(api.auth.actions.register);

  const handleFieldChange = (field: keyof RegisterPayload, value: string) => {
    setPayload((prev) => ({ ...prev, [field]: value }));
    if (errors[field as keyof ValidationErrors]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { isValid, errors: validationErrors } = validateRegisterPayload(payload);
    if (!isValid) {
      setErrors(validationErrors);
      return;
    }

    try {
      setStatus("loading");
      setErrors({});
      const result = await registerAction({
        email: payload.email.trim().toLowerCase(),
        password: payload.password,
        username: payload.username.trim().toLowerCase(),
        display_name: payload.displayName.trim(),
        bio: payload.bio?.trim(),
        locale: payload.locale ?? "system",
        timezone: payload.timezone ?? "system",
      });
      setStatus("success");
      console.log("[useRegister] created:", result);
      return result;
    } catch (err: unknown) {
      setStatus("error");
      const message =
        err instanceof Error
          ? (err as Error & { data?: { message?: string } }).data?.message ?? err.message
          : "Failed to create account";
      setErrors({ general: message });
      throw err;
    } finally {
      setStatus("idle");
    }
  };

  return {
    payload,
    errors,
    isLoading: status === "loading",
    handleFieldChange,
    handleSubmit,
  };
}
