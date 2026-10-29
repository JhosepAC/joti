"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useResetPassword } from "../hooks/use-reset-password";
import { AuthAlert, AuthField, AuthHeader, AuthSubmit } from "./auth-controls";

export function ResetPasswordFlow() {
  const searchParams = useSearchParams();
  // Keep the initial token after removing it from browser history.
  const [token] = useState(() => searchParams.get("token"));
  const t = useTranslations("auth.resetPassword");
  const ui = useTranslations("auth.ui");
  const flow = useResetPassword(token);
  useEffect(() => {
    if (!token || !(flow.tokenValid === false || flow.isSuccess)) return;
    const url = new URL(window.location.href);
    url.searchParams.delete("token");
    window.history.replaceState(
      window.history.state,
      "",
      url.pathname + url.search + url.hash,
    );
  }, [token, flow.tokenValid, flow.isSuccess]);

  if (flow.isSuccess)
    return (
      <div className="auth-form auth-enter">
        <AuthHeader title={t("successTitle")}>
          {t("successDescription")}
        </AuthHeader>
        <Link href="/auth/login" className="auth-submit">
          {t("signIn")}
        </Link>
      </div>
    );
  if (!token || flow.tokenValid === false)
    return (
      <div className="auth-form auth-enter">
        <AuthHeader title={t("expiredTitle")}>
          {!token ? t("missingToken") : t("expiredDescription")}
        </AuthHeader>
        <Link href="/auth/forgot-password" className="auth-submit">
          {t("requestNew")}
        </Link>
        <p className="auth-footer">
          <Link href="/auth/login">{t("backToSignIn")}</Link>
        </p>
      </div>
    );
  if (flow.verificationError)
    return (
      <div className="auth-form">
        <AuthHeader title={ui("connectionTitle")}>
          {ui("connectionDescription")}
        </AuthHeader>
        <AuthSubmit type="button" onClick={flow.retryVerification}>
          {ui("retry")}
        </AuthSubmit>
        <Link href="/auth/login" className="auth-text-link">
          {t("backToSignIn")}
        </Link>
      </div>
    );
  if (flow.tokenValid === null)
    return (
      <div className="auth-form" role="status">
        <AuthHeader title={t("verifying")} />{" "}
        <p className="auth-hint">{ui("pleaseWait")}</p>
      </div>
    );
  return (
    <form
      className="auth-form auth-enter"
      onSubmit={flow.handleSubmit}
      noValidate
      aria-busy={flow.isLoading}
    >
      <AuthHeader title={t("title")}>{t("subtitle")}</AuthHeader>
      <AuthAlert>{flow.errors.general}</AuthAlert>
      <div className="auth-fields">
        <AuthField
          id="new-password"
          name="password"
          type="password"
          label={t("newPassword")}
          value={flow.password}
          onChange={(e) => flow.setPassword(e.target.value)}
          error={flow.errors.password}
          hint={t("newPasswordHint")}
          autoComplete="new-password"
          disabled={flow.isLoading}
          required
        />
        <AuthField
          id="confirm-password"
          name="confirmPassword"
          type="password"
          label={t("confirmPassword")}
          value={flow.confirmPassword}
          onChange={(e) => flow.setConfirmPassword(e.target.value)}
          error={flow.errors.confirmPassword}
          autoComplete="new-password"
          disabled={flow.isLoading}
          required
        />
      </div>
      <AuthSubmit busy={flow.isLoading}>{t("submit")}</AuthSubmit>
      <p className="auth-footer">
        <Link href="/auth/login">{t("backToSignIn")}</Link>
      </p>
    </form>
  );
}
