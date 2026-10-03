"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useAction } from "convex/react";
import { useLocale, useTranslations } from "next-intl";
import { api } from "@/convex/_generated/api";
import { getAuthErrorCode } from "../utils/get-auth-error-message";
import { useAuthErrorMessage } from "../utils/get-auth-error-message";
import { useValidationTranslator } from "@/i18n/translate";
import {
  RegisterFlowData,
  RegisterFlowErrors,
  RegisterStep,
} from "../types/register-flow.types";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_REGEX = /^[a-z0-9_]+$/;
const RESERVED = new Set([
  "admin",
  "administrator",
  "root",
  "api",
  "auth",
  "login",
  "register",
  "signin",
  "signup",
  "settings",
  "dashboard",
  "joti",
  "help",
  "support",
  "terms",
  "privacy",
  "workspace",
  "null",
  "undefined",
  "system",
  "profile",
]);

const initialData: RegisterFlowData = {
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
  const tValidation = useValidationTranslator();
  const tErrors = useAuthErrorMessage();
  const tGeneral = useTranslations("validation.general");
  const tAvatar = useTranslations("auth.register.step3");
  const locale = useLocale();
  const [step, setStep] = useState<RegisterStep>(1);
  const [data, setData] = useState<RegisterFlowData>(initialData);
  const [errors, setErrors] = useState<RegisterFlowErrors>({});
  const [isLoading, setIsLoading] = useState(false);
  const [code, setCode] = useState("");
  const [isVerified, setIsVerified] = useState(false);
  const [codeExpiresAt, setCodeExpiresAt] = useState<number | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  // Short-lived proof of address ownership, returned by confirmEmailCode and
  // required by both the avatar upload and the final profile submit. Held in
  // memory only -- never persisted or put in a URL.
  const [claim, setClaim] = useState<string | null>(null);

  const registerPendingAction = useAction(api.auth.actions.registerPending);
  const requestCodeAction = useAction(api.auth.verification.requestEmailCode);
  const confirmCodeAction = useAction(api.auth.verification.confirmEmailCode);
  const completeProfileAction = useAction(api.auth.actions.completeProfile);
  const generateUploadUrl = useAction(api.auth.storage.generateAvatarUploadUrl);

  // Synchronous in-flight guard (see use-login): button state flips only
  // after a render, so rapid double submits could otherwise fire twice --
  // burning a single-use claim on the second call.
  const inFlight = useRef(false);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Cooldown ticker owned in one place: every resend path funnels through
  // here, previous tickers are replaced (never stacked), and unmount clears
  // the timer so no setState fires on an unmounted hook.
  useEffect(() => {
    return () => {
      if (cooldownRef.current) clearInterval(cooldownRef.current);
    };
  }, []);

  const startResendCooldown = (seconds: number) => {
    setResendCooldown(seconds);
    if (cooldownRef.current) clearInterval(cooldownRef.current);
    cooldownRef.current = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) {
          if (cooldownRef.current) clearInterval(cooldownRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const updateField = useCallback(
    <K extends keyof RegisterFlowData>(field: K, value: RegisterFlowData[K]) => {
      setData((prev) => ({ ...prev, [field]: value }));
      if (errors[field as keyof RegisterFlowErrors]) {
        setErrors((prev) => ({ ...prev, [field]: undefined }));
      }
    },
    [errors],
  );

  const validateStep1 = (): boolean => {
    const newErrors: RegisterFlowErrors = {};
    const email = data.email.trim().toLowerCase();
    if (!email) newErrors.email = tValidation("email.required");
    else if (email.length > 320) newErrors.email = tValidation("email.tooLong");
    else if (/\s/.test(email)) newErrors.email = tValidation("email.noSpaces");
    else if (!EMAIL_REGEX.test(email)) newErrors.email = tValidation("email.invalid");

    if (!data.password) newErrors.password = tValidation("password.required");
    else if (data.password.length < 12) newErrors.password = tValidation("password.tooShort");
    // Bytes, not chars: the server caps passwords at 72 UTF-8 bytes (bcrypt limit).
    else if (new TextEncoder().encode(data.password).length > 72) newErrors.password = tValidation("password.tooLongBytes");
    else if (email && data.password.toLowerCase().includes(email.split("@")[0] ?? "") && (email.split("@")[0]?.length ?? 0) >= 3) {
      newErrors.password = tValidation("password.containsEmail");
    }

    if (data.password !== data.confirmPassword) newErrors.confirmPassword = tValidation("password.mismatch");

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateStep2 = (): boolean => {
    const newErrors: RegisterFlowErrors = {};
    const username = data.username.trim().toLowerCase();
    if (!username) newErrors.username = tValidation("username.required");
    else if (username.length < 3 || username.length > 20) newErrors.username = tValidation("username.length");
    else if (!USERNAME_REGEX.test(username)) newErrors.username = tValidation("username.charset");
    else if (RESERVED.has(username)) newErrors.username = tValidation("username.reserved");

    const displayName = data.displayName.trim();
    if (!displayName) newErrors.displayName = tValidation("displayName.required");
    else if (displayName.length > 100) newErrors.displayName = tValidation("displayName.tooLong");
    else if (/[\u0000-\u001F\u007F-\u009F]/.test(displayName)) newErrors.displayName = tValidation("displayName.invalidChars");

    if (data.password.toLowerCase().includes(username) && username.length >= 3) {
      newErrors.password = tValidation("password.containsUsername");
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateStep4 = (): boolean => {
    const newErrors: RegisterFlowErrors = {};
    if (data.bio.trim().length > 500) newErrors.bio = tValidation("bio.tooLong");
    else if (/[\u0000-\u001F\u007F-\u009F]/.test(data.bio)) newErrors.bio = tValidation("bio.invalidChars");
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleStep1Next = async () => {
    if (!validateStep1()) return;
    if (inFlight.current) return;
    inFlight.current = true;
    setIsLoading(true);
    try {
      // Spec: email+password already creates inactive account
      const res = (await registerPendingAction({
        email: data.email.trim().toLowerCase(),
        password: data.password,
        locale,
      })) as { expiresAt: number };
      setCodeExpiresAt(res.expiresAt);
      setStep(1.1);
      setErrors({});
    } catch (err: unknown) {
      const msg = tErrors(err, tGeneral("accountFailed"));
      const code = getAuthErrorCode(err);
      if (code === "RATE_LIMITED") {
        const m = msg.match(/(\d+)s/);
        const wait = m?.[1] ? parseInt(m[1], 10) : 60;
        startResendCooldown(wait);
      }
      setErrors({ general: msg });
    } finally {
      inFlight.current = false;
      setIsLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!/^\d{6}$/.test(code.trim())) {
      setErrors({ code: "Code must be 6 digits" });
      return;
    }
    if (inFlight.current) return;
    inFlight.current = true;
    setIsLoading(true);
    try {
      const res = (await confirmCodeAction({
        email: data.email.trim().toLowerCase(),
        code: code.trim(),
      })) as { claim?: string };
      if (res?.claim) setClaim(res.claim);
      setIsVerified(true);
      setStep(2);
      setErrors({});
    } catch (err: unknown) {
      setErrors({ code: tErrors(err, tValidation("code.invalid")) });
    } finally {
      inFlight.current = false;
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (resendCooldown > 0) return;
    if (inFlight.current) return;
    inFlight.current = true;
    setIsLoading(true);
    try {
      const res = await requestCodeAction({ email: data.email.trim().toLowerCase(), locale });
      setCodeExpiresAt((res as { expiresAt: number }).expiresAt);
      startResendCooldown(30);
      setErrors({});
    } catch (err: unknown) {
      const msg = tErrors(err, tGeneral("resendFailed"));
      const code = getAuthErrorCode(err);
      if (code === "RATE_LIMITED") {
        const m = msg.match(/(\d+)s/);
        const wait = m?.[1] ? parseInt(m[1], 10) : 60;
        startResendCooldown(wait);
      }
      setErrors({ general: msg });
    } finally {
      inFlight.current = false;
      setIsLoading(false);
    }
  };

  const handleStep2Next = () => {
    if (!validateStep2()) return;
    setStep(3);
  };

  const handleStep3Next = () => {
    setStep(4);
  };

  const handleSkipAvatar = () => {
    setData((prev) => ({ ...prev, avatarFile: null, avatarPreview: null, avatarUrl: null }));
    setStep(4);
  };

  const handleFinalSubmit = async () => {
    if (!validateStep4()) return;
    if (!isVerified) {
      setErrors({ general: tGeneral("verifyEmailFirst") });
      setStep(1.1);
      return;
    }
    if (inFlight.current) return;
    inFlight.current = true;
    setIsLoading(true);
    // Set when the failure originates in the avatar upload block below, so
    // the catch routes it to the avatar field. Server messages stay English
    // (backend contracts), so the substring routing further down keeps
    // working in every UI locale.
    let avatarError: string | null = null;
    try {
      let avatar: string | undefined = data.avatarUrl ?? undefined;

      if (data.avatarFile) {
        if (data.avatarFile.size > 5 * 1024 * 1024) {
          avatarError = tAvatar("avatarErrorSize");
          setErrors({ avatar: avatarError, general: avatarError });
          throw new Error("avatar-validation");
        }
        if (!data.avatarFile.type.startsWith("image/")) {
          avatarError = tAvatar("avatarErrorImage");
          setErrors({ avatar: avatarError, general: avatarError });
          throw new Error("avatar-validation");
        }
        if (!claim) {
          const msg = tGeneral("sessionExpired");
          setErrors({ general: msg, avatar: msg });
          throw new Error(msg);
        }
        const uploadUrl = await generateUploadUrl({
          email: data.email.trim().toLowerCase(),
          claim,
        });
        const res = await fetch(uploadUrl as string, {
          method: "POST",
          headers: { "Content-Type": data.avatarFile.type || "image/png" },
          body: data.avatarFile,
        });
        if (!res.ok) {
          avatarError = tAvatar("uploadFailed");
          setErrors({ avatar: avatarError, general: avatarError });
          throw new Error("avatar-upload");
        }
        const json = (await res.json()) as { storageId: string };
        avatar = json.storageId;
      }

      if (!claim) {
        const msg = tGeneral("sessionExpired");
        setErrors({ general: msg });
        throw new Error(msg);
      }

      const result = await completeProfileAction({
        email: data.email.trim().toLowerCase(),
        claim,
        username: data.username.trim().toLowerCase(),
        display_name: data.displayName.trim(),
        // The account row is only created here, once the address has been
        // proven, so the password collected back in step 1 is committed now.
        password: data.password,
        bio: data.bio.trim() || undefined,
        avatar,
        locale: "system",
        timezone: "system",
      });
      setErrors({});
      return result;
    } catch (err: unknown) {
      if (avatarError) {
        setErrors({ avatar: avatarError, general: avatarError });
      } else {
        const msg = tErrors(err, tGeneral("completeProfileFailed"));
        // Route avatar-specific errors to the avatar field so Step3 can display inline.
        // Server messages stay English (backend contracts), so this substring
        // check holds in every UI locale; local avatar failures set
        // `avatarError` above instead.
        if (msg.toLowerCase().includes("avatar")) {
          setErrors({ avatar: msg, general: msg });
          // Optionally guide user back to avatar step if they used an invalid preset
          // but keep them on bio step to show context; user can navigate back
        } else {
          setErrors({ general: msg });
        }
      }
      throw err;
    } finally {
      inFlight.current = false;
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    if (step === 1.1) setStep(1);
    else if (step === 2) setStep(1.1);
    else if (step === 3) setStep(2);
    else if (step === 4) setStep(3);
  };

  const canGoBack = step !== 1;
  const displayStep = step === 1.1 ? 1 : step;
  const totalSteps = 4;

  return {
    step,
    displayStep,
    totalSteps,
    data,
    code,
    setCode,
    isVerified,
    codeExpiresAt,
    resendCooldown,
    errors,
    isLoading,
    updateField,
    handleStep1Next,
    handleVerifyCode,
    handleResendCode,
    handleStep2Next,
    handleStep3Next,
    handleSkipAvatar,
    handleFinalSubmit,
    handleBack,
    canGoBack,
    validateStep1,
    validateStep2,
  };
}
