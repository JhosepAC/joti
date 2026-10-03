"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { AuthStatus, LoginCredentials, ValidationErrors } from "../types/auth.types";
import { validateLoginCredentials } from "../validations/login.schema";
import { getAuthErrorMessage, getAuthErrorCode } from "../utils/get-auth-error-message";
import { storeAccountGrant, type AccountGrant } from "../utils/claim-store";
import { useEntryGate } from "./use-entry-gate";

type LoginResult = {
  user: { _id: string; email: string };
  profile: unknown | null;
  claim?: string;
};

export function useLogin() {
  const [credentials, setCredentials] = useState<LoginCredentials>({
    email: "",
    password: "",
  });
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [status, setStatus] = useState<AuthStatus>("idle");
  const [isOAuthLoading, setIsOAuthLoading] = useState(false);
  const [requiresActivation, setRequiresActivation] = useState(false);
  const [activationCode, setActivationCode] = useState("");
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Set once the password check succeeds. The entry gate consumes the claim and
  // routes to whichever stage comes next: profile, first space, or workspace.
  // It stays `undefined` until then, which tells the gate there is nothing to
  // resolve yet -- as opposed to `null`, which means "no grant, sign in".
  const [entry, setEntry] = useState<AccountGrant | null | undefined>(undefined);

  // Synchronous in-flight guard. `status === "loading"` flips only after a
  // render, so two rapid submits (Enter + click, double click) could otherwise
  // dispatch the action twice before the button disables.
  const inFlight = useRef(false);

  // Real Convex action — Argon2 verification + lockout logic lives server-side
  const loginAction = useAction(api.auth.actions.login);
  const requestCodeAction = useAction(api.auth.verification.requestEmailCode);
  const confirmCodeAction = useAction(api.auth.verification.confirmEmailCode);

  const gate = useEntryGate(entry);

  // The gate navigates "profile" and "workspace" itself, but the "space"
  // stage (first-space onboarding) renders on /spaces/new, so the login page
  // has to send the user there. The rotated grant is already in
  // sessionStorage (see use-entry-gate), so /spaces/new can resume.
  const router = useRouter();
  useEffect(() => {
    if (gate.stage === "ready") {
      router.replace("/spaces/new");
    }
  }, [gate.stage, router]);

  const handleFieldChange = (field: keyof LoginCredentials, value: string) => {
    setCredentials((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  /**
   * Stashes the claim and hands control to the entry gate, which is the single
   * place that decides between the profile gate, the first space and an
   * existing workspace.
   */
  const enterFrom = (result: LoginResult) => {
    if (!result.claim) {
      setErrors({ general: "No pudimos iniciar tu sesión. Inténtalo de nuevo." });
      setStatus("error");
      return;
    }
    // Drop the password from memory now that it has served its purpose; the
    // navigation ahead unmounts this screen anyway.
    setCredentials((prev) => ({ ...prev, password: "" }));
    // Stored before navigating so a reload mid-redirect can still resume.
    storeAccountGrant(result.user.email, result.claim);
    setEntry({ email: result.user.email, token: result.claim });
  };

  // Cooldown ticker for the activation-code resend. Cleared on unmount so no
  // timer outlives the screen.
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

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const { isValid, errors: validationErrors } = validateLoginCredentials(credentials);
    if (!isValid) {
      setErrors(validationErrors);
      return;
    }
    if (inFlight.current) return;
    inFlight.current = true;

    try {
      setStatus("loading");
      setErrors({});

      const result = (await loginAction({
        email: credentials.email.trim().toLowerCase(),
        password: credentials.password,
      })) as LoginResult;

      setStatus("success");
      enterFrom(result);
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
      inFlight.current = false;
      setStatus("idle");
    }
  };

  const handleActivationVerify = async () => {
    if (!pendingEmail) return;
    if (!/^\d{6}$/.test(activationCode.trim())) {
      setErrors({ general: "Code must be 6 digits" });
      return;
    }
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      setStatus("loading");
      await confirmCodeAction({ email: pendingEmail, code: activationCode.trim() });
      setRequiresActivation(false);
      setErrors({});
      // Retry login after activation, then continue into the app.
      const result = (await loginAction({
        email: pendingEmail,
        password: credentials.password,
      })) as LoginResult;
      setStatus("success");
      enterFrom(result);
    } catch (err: unknown) {
      setErrors({ general: getAuthErrorMessage(err, "Invalid or expired code") });
      setStatus("error");
    } finally {
      inFlight.current = false;
      setStatus("idle");
    }
  };

  const handleResendActivation = async () => {
    if (!pendingEmail || resendCooldown > 0) return;
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      setStatus("loading");
      await requestCodeAction({ email: pendingEmail });
      setErrors({});
      startResendCooldown(30);
    } catch (err: unknown) {
      const code = getAuthErrorCode(err);
      const msg = getAuthErrorMessage(err, "Failed to resend code");
      setErrors({ general: msg });
      if (code === "RATE_LIMITED") {
        const match = msg.match(/(\d+)s/);
        startResendCooldown(match?.[1] ? parseInt(match[1], 10) : 60);
      }
    } finally {
      inFlight.current = false;
      setStatus("idle");
    }
  };

  const handleGoogleLogin = async () => {
    setIsOAuthLoading(true);
    const siteUrl = process.env.NEXT_PUBLIC_CONVEX_SITE_URL;
    if (siteUrl && typeof window !== "undefined") {
      window.location.href = `${siteUrl}/oauth/google/authorize`;
      return;
    }
    setIsOAuthLoading(false);
  };

  return {
    credentials,
    // A gate failure replaces the credentials screen with itself in place, so it
    // has to be reported here or the form would just silently re-enable.
    errors: gate.stage === "error" && gate.error
      ? { ...errors, general: gate.error }
      : errors,
    isLoading: status === "loading",
    isOAuthLoading,
    // While the gate resolves, the screen is about to be replaced: keep the form
    // from being resubmitted.
    isEntering: entry !== undefined && gate.stage !== "error",
    requiresActivation,
    activationCode,
    setActivationCode,
    pendingEmail,
    resendCooldown,
    handleActivationVerify,
    handleResendActivation,
    handleFieldChange,
    handleCredentialsSubmit,
    handleGoogleLogin,
  };
}
