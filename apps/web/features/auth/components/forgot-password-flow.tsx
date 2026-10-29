"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useForgotPassword } from "../hooks/use-forgot-password";
import { AuthAlert, AuthField, AuthHeader, AuthSubmit } from "./auth-controls";

export function ForgotPasswordFlow() {
  const t = useTranslations("auth.forgotPassword");
  const ui = useTranslations("auth.ui");
  const flow = useForgotPassword();
  if (flow.isSuccess)
    return (
      <div className="auth-form auth-enter">
        <AuthHeader title={t("successTitle")}>
          {t.rich("successDescription", {
            b: (chunks) => <strong>{chunks}</strong>,
            email: flow.email.trim().toLowerCase(),
          })}
        </AuthHeader>
        <p className="auth-hint">{t("resendPrompt")}</p>
        <AuthAlert>{flow.errors.general}</AuthAlert>
        <button
          type="button"
          className="auth-text-button"
          disabled={flow.isLoading || flow.cooldown > 0}
          onClick={() => void flow.handleResend()}
        >
          {flow.isLoading
            ? ui("working")
            : flow.cooldown > 0
              ? t("resendAvailableIn", { seconds: flow.cooldown })
              : t("resend")}
        </button>
        <Link className="auth-submit" href="/auth/login">
          {t("backToSignIn")}
        </Link>
        <button
          type="button"
          className="auth-back"
          onClick={flow.changeEmail}
          disabled={flow.isLoading}
        >
          {ui("changeEmail")}
        </button>
      </div>
    );
  return (
    <form
      className="auth-form"
      onSubmit={flow.handleSubmit}
      noValidate
      aria-busy={flow.isLoading}
    >
      <AuthHeader title={t("title")}>{t("subtitle")}</AuthHeader>
      <AuthAlert>{flow.errors.general}</AuthAlert>
      <AuthField
        id="email"
        name="email"
        type="email"
        label={t("email")}
        placeholder={ui("emailPlaceholder")}
        value={flow.email}
        onChange={(e) => flow.setEmail(e.target.value)}
        error={flow.errors.email}
        autoComplete="email"
        autoCapitalize="none"
        spellCheck={false}
        disabled={flow.isLoading}
        required
      />
      <AuthSubmit busy={flow.isLoading} disabled={flow.cooldown > 0}>
        {flow.cooldown > 0
          ? t("submitWait", { seconds: flow.cooldown })
          : t("submit")}
      </AuthSubmit>
      <p className="auth-footer">
        <Link href="/auth/login">{t("backToSignIn")}</Link>
      </p>
    </form>
  );
}
