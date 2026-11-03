"use client";

import { useEffect, useRef, useState } from "react";
import { useAction } from "convex/react";
import { useLocale, useTranslations } from "next-intl";
import { api } from "@/convex/_generated/api";
import {
  getAuthErrorCode,
  getAuthErrorMessage,
  getRetryAfterSeconds,
  useAuthErrorMessage,
} from "../utils/get-auth-error-message";
import { useValidationTranslator } from "@/i18n/translate";
import { validateForgotPasswordEmail } from "../validations/forgot-password.schema";
import { validateResetPasswordInput } from "../validations/reset-password.schema";
import { validateProfileInput } from "../validations/profile.schema";
import type {
  RegisterFlowData,
  RegisterFlowErrors,
  RegisterStep,
} from "../types/register-flow.types";

export const emptyProfile: RegisterFlowData = {
  email: "",
  password: "",
  confirmPassword: "",
  username: "",
  displayName: "",
  avatarFile: null,
  avatarPreview: null,
  avatarUrl: null,
  bio: "",
};

export function useRegisterFlow() {
  const t = useValidationTranslator();
  const message = useAuthErrorMessage();
  const ui = useTranslations("auth.ui");
  const locale = useLocale();
  const [step, setStep] = useState<RegisterStep>(1);
  const [data, setData] = useState<RegisterFlowData>(emptyProfile);
  const [errors, setErrors] = useState<RegisterFlowErrors>({});
  const [isLoading, setIsLoading] = useState(false);
  const [code, setCodeValue] = useState("");
  const [claim, setClaim] = useState<string | null>(null);
  const [isVerified, setIsVerified] = useState(false);
  const [codeExpiresAt, setCodeExpiresAt] = useState<number | null>(null);
  const [resendAt, setResendAt] = useState(0);
  const [now, setNow] = useState(0);
  const resendCooldown = Math.max(0, Math.ceil((resendAt - now) / 1000));
  const inFlight = useRef(false);
  const pending = useAction(api.auth.actions.registerPending);
  const confirm = useAction(api.auth.verification.confirmEmailCode);
  const resend = useAction(api.auth.verification.requestEmailCode);
  const complete = useAction(api.auth.actions.completeProfile);
  const generateUpload = useAction(api.auth.storage.generateAvatarUploadUrl);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    const preview = data.avatarPreview;
    return () => {
      if (preview?.startsWith("blob:")) URL.revokeObjectURL(preview);
    };
  }, [data.avatarPreview]);
  const cooldown = () => {
    const time = Date.now();
    setNow(time);
    setResendAt(time + 60000);
  };

  function updateField<K extends keyof RegisterFlowData>(
    field: K,
    value: RegisterFlowData[K],
  ) {
    if (
      field === "email" &&
      String(value).trim().toLowerCase() !== data.email.trim().toLowerCase()
    ) {
      setIsVerified(false);
      setClaim(null);
      setCodeValue("");
      setCodeExpiresAt(null);
      setResendAt(0);
    }
    setData((previous) => ({ ...previous, [field]: value }));
    setErrors((previous) => ({
      ...previous,
      [field]: undefined,
      general: undefined,
    }));
  }

  async function handleStep1Next() {
    if (inFlight.current) return;
    const emailErrors = validateForgotPasswordEmail(data.email, t).errors;
    const passwordErrors = validateResetPasswordInput(
      {
        password: data.password,
        confirmPassword: data.confirmPassword,
        email: data.email.trim().toLowerCase(),
      },
      t,
    ).errors;
    const nextErrors = { ...emailErrors, ...passwordErrors };
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    if (isVerified && claim) {
      setStep(2);
      return;
    }
    if (Date.now() < resendAt) return;
    inFlight.current = true;
    setIsLoading(true);
    try {
      const result = await pending({
        email: data.email.trim().toLowerCase(),
        password: data.password,
        locale,
      });
      setCodeExpiresAt(result.expiresAt);
      setCodeValue("");
      cooldown();
      setStep(1.1);
    } catch (error) {
      if (getAuthErrorCode(error) === "RATE_LIMITED") {
        const time = Date.now();
        setNow(time);
        setResendAt(time + getRetryAfterSeconds(error) * 1000);
      }
      setErrors({ general: message(error) });
    } finally {
      inFlight.current = false;
      setIsLoading(false);
    }
  }

  async function handleVerifyCode() {
    if (inFlight.current) return;
    if (!/^\d{6}$/.test(code)) {
      setErrors({ code: ui("sixDigits") });
      return;
    }
    inFlight.current = true;
    setIsLoading(true);
    setErrors({});
    try {
      const result = (await confirm({
        email: data.email.trim().toLowerCase(),
        code,
        password: data.password,
      })) as { claim?: string };
      if (!result.claim) throw new Error("Session expired");
      setClaim(result.claim);
      setIsVerified(true);
      setStep(2);
      setCodeValue("");
    } catch (error) {
      setErrors({ code: message(error) });
    } finally {
      inFlight.current = false;
      setIsLoading(false);
    }
  }

  async function handleResendCode() {
    if (inFlight.current || Date.now() < resendAt) return;
    inFlight.current = true;
    setIsLoading(true);
    setErrors({});
    try {
      const result = await resend({
        email: data.email.trim().toLowerCase(),
        locale,
      });
      setCodeExpiresAt(result.expiresAt);
      setCodeValue("");
      cooldown();
    } catch (error) {
      if (getAuthErrorCode(error) === "RATE_LIMITED") {
        const time = Date.now();
        setNow(time);
        setResendAt(time + getRetryAfterSeconds(error) * 1000);
      }
      setErrors({ general: message(error) });
    } finally {
      inFlight.current = false;
      setIsLoading(false);
    }
  }

  async function handleFinalSubmit() {
    if (inFlight.current) return null;
    const profileErrors = validateProfileInput(data, t);
    if (Object.keys(profileErrors).length) {
      setErrors(profileErrors);
      return null;
    }
    const passwordErrors = validateResetPasswordInput(
      { ...data, email: data.email.trim().toLowerCase() },
      t,
    ).errors;
    if (Object.keys(passwordErrors).length) {
      setErrors(passwordErrors);
      setStep(1);
      return null;
    }
    if (!claim || !isVerified) {
      setErrors({ general: ui("verifyAgain") });
      setStep(1.1);
      return null;
    }
    inFlight.current = true;
    setIsLoading(true);
    setErrors({});
    try {
      let avatar = data.avatarUrl ?? undefined;
      if (data.avatarFile) {
        const url = await generateUpload({
          email: data.email.trim().toLowerCase(),
          claim,
        });
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": data.avatarFile.type },
          body: data.avatarFile,
        });
        if (!response.ok) {
          setErrors({ avatar: ui("uploadFailed") });
          return null;
        }
        const uploaded = (await response.json()) as { storageId: string };
        avatar = uploaded.storageId;
        // Reuse a successful upload if profile validation later fails.
        setData((previous) => ({
          ...previous,
          avatarFile: null,
          avatarUrl: avatar ?? null,
        }));
      }
      const result = await complete({
        email: data.email.trim().toLowerCase(),
        claim,
        username: data.username.trim().toLowerCase(),
        display_name: data.displayName.trim(),
        password: data.password,
        bio: data.bio.trim() || undefined,
        avatar,
        locale,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
      setData((previous) => ({
        ...previous,
        password: "",
        confirmPassword: "",
      }));
      return result;
    } catch (error) {
      const raw = getAuthErrorMessage(error);
      if (/username.*taken/i.test(raw))
        setErrors({ username: ui("usernameTaken") });
      else if (/session.*(expired|valid)|grant.*(expired|invalid)/i.test(raw)) {
        setIsVerified(false);
        setClaim(null);
        setStep(1.1);
        setErrors({ general: ui("verifyAgain") });
      } else setErrors({ general: message(error) });
      return null;
    } finally {
      inFlight.current = false;
      setIsLoading(false);
    }
  }

  return {
    step,
    data,
    errors,
    isLoading,
    code,
    codeExpiresAt,
    resendCooldown,
    isVerified,
    updateField,
    handleStep1Next,
    handleVerifyCode,
    handleResendCode,
    handleFinalSubmit,
    setCode: (value: string) => {
      setCodeValue(value);
      setErrors({});
    },
    handleBack: () => {
      if (!inFlight.current) {
        setErrors({});
        setStep(1);
      }
    },
  };
}
