"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAction } from "convex/react";
import { useLocale, useTranslations } from "next-intl";
import { api } from "@/convex/_generated/api";
import {
  AuthStatus,
  LoginCredentials,
  ValidationErrors,
} from "../types/auth.types";
import { validateLoginCredentials } from "../validations/login.schema";
import {
  getAuthErrorCode,
  getRetryAfterSeconds,
  useAuthErrorMessage,
} from "../utils/get-auth-error-message";
import { useValidationTranslator } from "@/i18n/translate";
import { clearGrants, type AccountGrant } from "../utils/claim-store";
import { useEntryGate } from "./use-entry-gate";
import { establishSession, resumeSession } from "../utils/session-client";

type LoginResult = {
  user: { _id: string; email: string };
  profile: unknown | null;
  claim?: string;
};

export function useLogin() {
  const tValidation = useValidationTranslator();
  const tErrors = useAuthErrorMessage();
  const tActivation = useTranslations("auth.activation");
  const tGeneral = useTranslations("validation.general");
  const locale = useLocale();
  const [credentials, setCredentials] = useState<LoginCredentials>({
    email: "",
    password: "",
  });
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [status, setStatus] = useState<AuthStatus>("idle");
  const [requiresActivation, setRequiresActivation] = useState(false);
  const [activationCode, setActivationCode] = useState("");
  const [activationSent, setActivationSent] = useState(false);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Set once the password check succeeds. The entry gate consumes the claim and
  // routes to whichever stage comes next: profile, first space, or workspace.
  // It stays `undefined` until then, which tells the gate there is nothing to
  // resolve yet -- as opposed to `null`, which means "no grant, sign in".
  const [entry, setEntry] = useState<AccountGrant | null | undefined>(
    undefined,
  );
  const [resuming, setResuming] = useState(true);
  const resumeRequest = useRef<Promise<AccountGrant | null> | null>(null);
  useEffect(() => {
    let cancelled = false;
    resumeRequest.current ??= (async () => {
      if (new URL(window.location.href).searchParams.has("switch")) {
        await fetch("/api/auth/session", {
          method: "DELETE",
          credentials: "same-origin",
        });
        clearGrants();
        return null;
      }
      return resumeSession();
    })();
    void resumeRequest.current
      .then((grant) => {
        if (!cancelled && grant) setEntry(grant);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setResuming(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Password verification and lockout logic live server-side.
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

  // Synchronous in-flight guard. `status === "loading"` flips only after a
  // render, so two rapid submits (Enter + click, double click) could otherwise
  // dispatch the action twice before the button disables.
  const inFlight = useRef(false);

  const handleFieldChange = (field: keyof LoginCredentials, value: string) => {
    setErrors({});
    if (field === "email") {
      if (
        value.trim().toLowerCase() !== credentials.email.trim().toLowerCase()
      ) {
        if (cooldownRef.current) clearInterval(cooldownRef.current);
        setResendCooldown(0);
      }
      setRequiresActivation(false);
      setPendingEmail(null);
      setActivationCode("");
      setActivationSent(false);
    }
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
  const enterFrom = async (result: LoginResult) => {
    if (!result.claim) {
      setErrors({ general: tGeneral("signInFailed") });
      setStatus("error");
      return;
    }
    // Drop the password from memory now that it has served its purpose; the
    // navigation ahead unmounts this screen anyway.
    setCredentials((prev) => ({ ...prev, password: "" }));
    // Stored before navigating so a reload mid-redirect can still resume.
    const grant = await establishSession(result.user.email, result.claim);
    setEntry(grant);
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
    if (entry !== undefined && gate.stage !== "error") return;

    const { isValid, errors: validationErrors } = validateLoginCredentials(
      credentials,
      tValidation,
    );
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
      await enterFrom(result);
    } catch (err: unknown) {
      setStatus("error");
      const code = getAuthErrorCode(err);
      if (code === "EMAIL_NOT_VERIFIED") {
        setRequiresActivation(true);
        setActivationSent(false);
        setPendingEmail(credentials.email.trim().toLowerCase());
        setErrors({});
      } else {
        setErrors({ general: tErrors(err) });
      }
    } finally {
      inFlight.current = false;
      setStatus("idle");
    }
  };

  const handleActivationVerify = async () => {
    if (!pendingEmail) return;
    if (!/^\d{6}$/.test(activationCode.trim())) {
      setErrors({ general: tActivation("codeMustBeDigits") });
      return;
    }
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      setStatus("loading");
      await confirmCodeAction({
        email: pendingEmail,
        code: activationCode.trim(),
        password: credentials.password,
      });
      setRequiresActivation(false);
      setErrors({});
      // Retry login after activation, then continue into the app.
      const result = (await loginAction({
        email: pendingEmail,
        password: credentials.password,
      })) as LoginResult;
      setStatus("success");
      await enterFrom(result);
    } catch (err: unknown) {
      setErrors({ general: tErrors(err) });
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
      await requestCodeAction({ email: pendingEmail, locale });
      setActivationSent(true);
      setErrors({});
      startResendCooldown(60);
    } catch (err: unknown) {
      const code = getAuthErrorCode(err);
      const msg = tErrors(err);
      setErrors({ general: msg });
      if (code === "RATE_LIMITED") {
        startResendCooldown(getRetryAfterSeconds(err));
      }
    } finally {
      inFlight.current = false;
      setStatus("idle");
    }
  };

  return {
    credentials,
    // A gate failure replaces the credentials screen with itself in place, so it
    // has to be reported here or the form would just silently re-enable.
    errors:
      gate.stage === "error" && gate.error
        ? { ...errors, general: gate.error }
        : errors,
    isLoading: status === "loading" || resuming,
    // While the gate resolves, the screen is about to be replaced: keep the form
    // from being resubmitted.
    isEntering: entry !== undefined && gate.stage !== "error",
    requiresActivation,
    activationCode,
    activationSent,
    setActivationCode: (value: string) => {
      setActivationCode(value);
      setErrors({});
    },
    pendingEmail,
    resendCooldown,
    handleActivationVerify,
    handleResendActivation,
    handleFieldChange,
    handleCredentialsSubmit,
    cancelActivation: () => {
      setRequiresActivation(false);
      setPendingEmail(null);
      setActivationCode("");
      setActivationSent(false);
      setErrors({});
    },
  };
}
