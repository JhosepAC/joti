"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useLogin } from "../hooks/use-login";
import {
  AuthAlert,
  AuthField,
  AuthHeader,
  AuthSubmit,
  VerificationInput,
} from "./auth-controls";

export function LoginForm() {
  const t = useTranslations("auth.login");
  const ui = useTranslations("auth.ui");
  const flow = useLogin();
  const busy = flow.isLoading || flow.isEntering;
  if (flow.requiresActivation && flow.pendingEmail)
    return (
      <form
        className="auth-form auth-enter"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void flow.handleActivationVerify();
        }}
        aria-busy={busy}
      >
        <AuthHeader title={ui("activateTitle")}>
          {t("activationTitle", { email: flow.pendingEmail })}
        </AuthHeader>
        <AuthAlert>{flow.errors.general}</AuthAlert>
        {flow.activationSent && (
          <AuthAlert success>{ui("activationSent")}</AuthAlert>
        )}
        <VerificationInput
          value={flow.activationCode}
          onChange={flow.setActivationCode}
          disabled={busy}
        />
        <AuthSubmit busy={busy} disabled={flow.activationCode.length !== 6}>
          {t("activationVerify")}
        </AuthSubmit>
        <button
          className="auth-text-button"
          type="button"
          disabled={busy || flow.resendCooldown > 0}
          onClick={() => void flow.handleResendActivation()}
        >
          {flow.resendCooldown
            ? t("activationResendIn", { seconds: flow.resendCooldown })
            : flow.activationSent
              ? t("activationResend")
              : t("activationSend")}
        </button>
        <button
          className="auth-back"
          type="button"
          onClick={flow.cancelActivation}
          disabled={busy}
        >
          {ui("backToLogin")}
        </button>
      </form>
    );

  return (
    <form
      className="auth-form"
      onSubmit={flow.handleCredentialsSubmit}
      noValidate
      aria-busy={busy}
    >
      <AuthHeader title={t("title")}>{t("subtitle")}</AuthHeader>
      <AuthAlert>{flow.errors.general}</AuthAlert>
      <div className="auth-fields">
        <AuthField
          id="email"
          name="email"
          type="email"
          label={t("email")}
          placeholder={ui("emailPlaceholder")}
          value={flow.credentials.email}
          onChange={(e) => flow.handleFieldChange("email", e.target.value)}
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
          label={t("password")}
          value={flow.credentials.password}
          onChange={(e) => flow.handleFieldChange("password", e.target.value)}
          error={flow.errors.password}
          autoComplete="current-password"
          disabled={busy}
          required
          action={
            <Link href="/auth/forgot-password">{t("forgotPassword")}</Link>
          }
        />
      </div>
      <AuthSubmit busy={busy}>{t("submit")}</AuthSubmit>
      <p className="auth-footer">
        {t("noAccount")} <Link href="/auth/register">{t("createAccount")}</Link>
      </p>
    </form>
  );
}
