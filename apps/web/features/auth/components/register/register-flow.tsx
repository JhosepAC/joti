"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useRegisterFlow } from "../../hooks/use-register-flow";
import {
  AuthAlert,
  AuthField,
  AuthHeader,
  AuthSubmit,
  VerificationInput,
} from "../auth-controls";
import { AuthProfileFields } from "../auth-profile-fields";
import { establishSession } from "../../utils/session-client";
import { useAuthErrorMessage } from "../../utils/get-auth-error-message";

export function RegisterFlow() {
  const t = useTranslations("auth.register");
  const ui = useTranslations("auth.ui");
  const flow = useRegisterFlow();
  const router = useRouter();
  const [redirecting, setRedirecting] = useState(false);
  const [sessionError, setSessionError] = useState("");
  const finishing = useRef(false);
  const sessionProof = useRef<{ email: string; token: string } | null>(null);
  const message = useAuthErrorMessage();
  const title = useRef<HTMLDivElement>(null);
  const previousStep = useRef(flow.step);
  useEffect(() => {
    if (previousStep.current !== flow.step) {
      previousStep.current = flow.step;
      title.current?.querySelector("h1")?.focus();
    }
  }, [flow.step]);
  const current = flow.step === 1 ? 1 : flow.step === 1.1 ? 2 : 3;
  const busy = flow.isLoading || redirecting;
  async function finish() {
    if (finishing.current) return;
    finishing.current = true;
    if (!sessionProof.current) {
      const result = (await flow.handleFinalSubmit()) as {
        claim?: string;
      } | null;
      if (!result) {
        finishing.current = false;
        return;
      }
      if (!result.claim) {
        router.replace("/auth/login");
        return;
      }
      sessionProof.current = { email: flow.data.email, token: result.claim };
    }
    setRedirecting(true);
    setSessionError("");
    try {
      await establishSession(
        sessionProof.current.email,
        sessionProof.current.token,
      );
      router.replace("/spaces/new");
    } catch (error) {
      setSessionError(message(error));
      setRedirecting(false);
      finishing.current = false;
    }
  }
  return (
    <div ref={title}>
      <div
        className="auth-progress"
        role="group"
        aria-label={t("step", { current, total: 3 })}
      >
        {[1, 2, 3].map((index) => (
          <span key={index} data-complete={index <= current} />
        ))}
      </div>
      <form
        key={flow.step}
        className="auth-form auth-enter"
        noValidate
        aria-busy={busy}
        onSubmit={(event) => {
          event.preventDefault();
          if (flow.step === 1) void flow.handleStep1Next();
          else if (flow.step === 1.1) void flow.handleVerifyCode();
          else void finish();
        }}
      >
        {flow.step === 1 && (
          <>
            <AuthHeader title={t("step1.title")}>
              {t("step1.subtitle")}
            </AuthHeader>
            <AuthAlert>{flow.errors.general}</AuthAlert>
            <div className="auth-fields">
              <AuthField
                id="email"
                name="email"
                type="email"
                label={t("step1.email")}
                value={flow.data.email}
                onChange={(e) => flow.updateField("email", e.target.value)}
                error={flow.errors.email}
                autoComplete="email"
                autoCapitalize="none"
                spellCheck={false}
                disabled={busy}
                required
              />
              <AuthField
                id="password"
                name="password"
                type="password"
                label={t("step1.password")}
                value={flow.data.password}
                onChange={(e) => flow.updateField("password", e.target.value)}
                error={flow.errors.password}
                hint={t("step1.passwordHint")}
                autoComplete="new-password"
                disabled={busy}
                required
              />
              <AuthField
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                label={t("step1.confirmPassword")}
                value={flow.data.confirmPassword}
                onChange={(e) =>
                  flow.updateField("confirmPassword", e.target.value)
                }
                error={flow.errors.confirmPassword}
                autoComplete="new-password"
                disabled={busy}
                required
              />
            </div>
            <AuthSubmit
              busy={busy}
              disabled={!flow.isVerified && flow.resendCooldown > 0}
            >
              {!flow.isVerified && flow.resendCooldown > 0
                ? t("verify.resendIn", { seconds: flow.resendCooldown })
                : t("step1.submit")}
            </AuthSubmit>
          </>
        )}
        {flow.step === 1.1 && (
          <>
            <AuthHeader title={t("verify.title")}>
              {t.rich("verify.description", {
                b: (chunks) => <strong>{chunks}</strong>,
                email: flow.data.email.trim().toLowerCase(),
              })}
            </AuthHeader>
            <AuthAlert>{flow.errors.general}</AuthAlert>
            <VerificationInput
              value={flow.code}
              onChange={flow.setCode}
              error={flow.errors.code}
              disabled={busy}
            />
            <AuthSubmit busy={busy} disabled={flow.code.length !== 6}>
              {t("verify.submit")}
            </AuthSubmit>
            <p className="auth-hint">{ui("codeExpiry")}</p>
            <div className="auth-resend">
              <span>{t("verify.resendPrompt")}</span>
              <button
                type="button"
                className="auth-text-button"
                onClick={() => void flow.handleResendCode()}
                disabled={busy || flow.resendCooldown > 0}
              >
                {flow.resendCooldown
                  ? t("verify.resendIn", { seconds: flow.resendCooldown })
                  : t("verify.resend")}
              </button>
            </div>
            <button
              className="auth-back"
              type="button"
              onClick={flow.handleBack}
              disabled={busy}
            >
              {ui("changeEmail")}
            </button>
          </>
        )}
        {flow.step === 2 && (
          <>
            <AuthHeader title={t("step2.title")}>
              {t("step2.subtitle")}
            </AuthHeader>
            <AuthAlert>{sessionError || flow.errors.general}</AuthAlert>
            <AuthProfileFields
              data={flow.data}
              errors={flow.errors}
              onChange={flow.updateField}
              disabled={busy || Boolean(sessionProof.current)}
            />
            <AuthSubmit busy={busy}>
              {sessionProof.current ? ui("retry") : ui("finishAccount")}
            </AuthSubmit>
            {!sessionProof.current && (
              <button
                className="auth-back"
                type="button"
                onClick={flow.handleBack}
                disabled={busy}
              >
                {ui("editAccount")}
              </button>
            )}
          </>
        )}
        <p className="auth-footer">
          {t("step1.footer")}{" "}
          <Link href="/auth/login">{t("step1.signIn")}</Link>
        </p>
      </form>
    </div>
  );
}
