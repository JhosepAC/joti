"use client";

import { useState, useCallback, useRef } from "react";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { getAuthErrorCode, getAuthErrorMessage } from "../utils/get-auth-error-message";
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
    if (!email) newErrors.email = "Email is required";
    else if (email.length > 320) newErrors.email = "Email must not exceed 320 characters";
    else if (/\s/.test(email)) newErrors.email = "Email must not contain spaces";
    else if (!EMAIL_REGEX.test(email)) newErrors.email = "Please enter a valid email address";

    if (!data.password) newErrors.password = "Password is required";
    else if (data.password.length < 12) newErrors.password = "Password must be at least 12 characters";
    // Bytes, not chars: the server caps passwords at 72 UTF-8 bytes (bcrypt limit).
    else if (new TextEncoder().encode(data.password).length > 72) newErrors.password = "Password must not exceed 72 bytes";
    else if (email && data.password.toLowerCase().includes(email.split("@")[0] ?? "") && (email.split("@")[0]?.length ?? 0) >= 3) {
      newErrors.password = "Password must not contain your email";
    }

    if (data.password !== data.confirmPassword) newErrors.confirmPassword = "Passwords do not match";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateStep2 = (): boolean => {
    const newErrors: RegisterFlowErrors = {};
    const username = data.username.trim().toLowerCase();
    if (!username) newErrors.username = "Username is required";
    else if (username.length < 3 || username.length > 20) newErrors.username = "Username must be 3-20 characters";
    else if (!USERNAME_REGEX.test(username)) newErrors.username = "Use only a-z, 0-9 and _";
    else if (RESERVED.has(username)) newErrors.username = "This username is reserved";

    const displayName = data.displayName.trim();
    if (!displayName) newErrors.displayName = "Display name is required";
    else if (displayName.length > 100) newErrors.displayName = "Display name must not exceed 100 characters";
    else if (/[\u0000-\u001F\u007F-\u009F]/.test(displayName)) newErrors.displayName = "Invalid characters";

    if (data.password.toLowerCase().includes(username) && username.length >= 3) {
      newErrors.password = "Password must not contain your username";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateStep4 = (): boolean => {
    const newErrors: RegisterFlowErrors = {};
    if (data.bio.trim().length > 500) newErrors.bio = "Bio must not exceed 500 characters";
    else if (/[\u0000-\u001F\u007F-\u009F]/.test(data.bio)) newErrors.bio = "Bio contains invalid characters";
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
      })) as { expiresAt: number };
      setCodeExpiresAt(res.expiresAt);
      setStep(1.1);
      setErrors({});
    } catch (err: unknown) {
      const msg = getAuthErrorMessage(err, "Failed to create account");
      const code = getAuthErrorCode(err);
      if (code === "RATE_LIMITED") {
        const m = msg.match(/(\d+)s/);
        const wait = m?.[1] ? parseInt(m[1], 10) : 60;
        setResendCooldown(wait);
        const interval = setInterval(() => {
          setResendCooldown((prev) => {
            if (prev <= 1) {
              clearInterval(interval);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
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
      setErrors({ code: getAuthErrorMessage(err, "Invalid or expired code") });
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
      const res = await requestCodeAction({ email: data.email.trim().toLowerCase() });
      setCodeExpiresAt((res as { expiresAt: number }).expiresAt);
      setResendCooldown(30);
      const interval = setInterval(() => {
        setResendCooldown((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      setErrors({});
    } catch (err: unknown) {
      const msg = getAuthErrorMessage(err, "Failed to resend code");
      const code = getAuthErrorCode(err);
      if (code === "RATE_LIMITED") {
        const m = msg.match(/(\d+)s/);
        const wait = m?.[1] ? parseInt(m[1], 10) : 60;
        setResendCooldown(wait);
        const interval = setInterval(() => {
          setResendCooldown((prev) => {
            if (prev <= 1) {
              clearInterval(interval);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
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
      setErrors({ general: "Please verify your email first" });
      setStep(1.1);
      return;
    }
    if (inFlight.current) return;
    inFlight.current = true;
    setIsLoading(true);
    try {
      let avatar: string | undefined = data.avatarUrl ?? undefined;

      if (data.avatarFile) {
        if (data.avatarFile.size > 5 * 1024 * 1024) {
          setErrors({ avatar: "Avatar must be less than 5MB", general: "Avatar must be less than 5MB" });
          throw new Error("Avatar must be less than 5MB");
        }
        if (!data.avatarFile.type.startsWith("image/")) {
          setErrors({ avatar: "Please upload an image file", general: "Please upload an image file" });
          throw new Error("Please upload an image file");
        }
        if (!claim) {
          const msg = "Your verification session expired. Please request a new code.";
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
        if (!res.ok) throw new Error("Failed to upload avatar");
        const json = (await res.json()) as { storageId: string };
        avatar = json.storageId;
      }

      if (!claim) {
        const msg = "Your verification session expired. Please request a new code.";
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
      const msg = getAuthErrorMessage(err, "Failed to complete profile");
      // Route avatar-specific errors to the avatar field so Step3 can display inline
      if (msg.toLowerCase().includes("avatar")) {
        setErrors({ avatar: msg, general: msg });
        // Optionally guide user back to avatar step if they used an invalid preset
        // but keep them on bio step to show context; user can navigate back
      } else {
        setErrors({ general: msg });
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
