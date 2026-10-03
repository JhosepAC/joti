"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useResetPassword } from "../hooks/use-reset-password";

export const ResetPasswordFlow: React.FC = () => {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const t = useTranslations("auth.resetPassword");

  const {
    password,
    setPassword,
    confirmPassword,
    setConfirmPassword,
    errors,
    isLoading,
    isSuccess,
    tokenValid,
    handleSubmit,
  } = useResetPassword(token);

  // The token arrives by email link, which puts it in history as a side
  // effect. Once it is consumed (success) or known-dead (invalid/expired),
  // strip it from the URL so it does not linger in history, Referer headers
  // or logs. State already holds what the UI needs, so no reload occurs.
  React.useEffect(() => {
    if (typeof window === "undefined" || !token) return;
    if (tokenValid === false || isSuccess) {
      const url = new URL(window.location.href);
      url.searchParams.delete("token");
      window.history.replaceState(null, "", url.pathname + url.search + url.hash);
    }
  }, [token, tokenValid, isSuccess]);

  if (!token) {
    return (
      <div className="w-full max-w-[460px] mx-auto py-8 space-y-6">
        <div className="p-4 bg-red-50 border border-error/20 rounded-2xl text-xs text-error">
          {t("missingToken")}
        </div>
        <Link href="/auth/forgot-password" className="block">
          <Button variant="primary" className="w-full h-11 rounded-full">{t("requestNew")}</Button>
        </Link>
      </div>
    );
  }

  if (tokenValid === false) {
    return (
      <div className="w-full max-w-[460px] mx-auto py-8 space-y-6">
        <header>
          <h1 className="text-3xl font-semibold tracking-[-0.03em] text-text-primary font-heading">{t("expiredTitle")}</h1>
          <p className="text-sm font-light text-text-secondary mt-2">{t("expiredDescription")}</p>
        </header>
        {errors.general && <div className="p-3.5 bg-red-50 border border-error/20 rounded-2xl text-xs text-error">{errors.general}</div>}
        <Link href="/auth/forgot-password" className="block">
          <Button variant="primary" className="w-full h-11 rounded-full">{t("requestNew")}</Button>
        </Link>
        <Link href="/auth/login" className="block text-center text-xs text-text-secondary hover:text-text-primary hover:underline">
          {t("backToSignIn")}
        </Link>
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className="w-full max-w-[460px] mx-auto py-8 space-y-6">
        <header>
          <h1 className="text-3xl font-semibold tracking-[-0.03em] text-text-primary font-heading">{t("successTitle")}</h1>
          <p className="text-sm font-light text-text-secondary mt-2">
            {t("successDescription")}
          </p>
        </header>
        <Link href="/auth/login" className="block">
          <Button variant="primary" className="w-full h-12 rounded-full">{t("signIn")}</Button>
        </Link>
      </div>
    );
  }

  if (tokenValid === null) {
    return (
      <div className="w-full max-w-[460px] mx-auto py-8">
        <p className="text-sm text-text-secondary animate-pulse">{t("verifying")}</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[460px] mx-auto py-8">
      <header className="mb-8">
        <h1 className="text-3xl font-semibold tracking-[-0.03em] text-text-primary font-heading leading-tight">{t("title")}</h1>
        <p className="text-sm font-light text-text-secondary mt-2">{t("subtitle")}</p>
      </header>

      {errors.general && (
        <div className="mb-6 p-3.5 bg-red-50 border border-error/20 rounded-2xl text-xs text-error">{errors.general}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        <div className="space-y-2.5">
          <Label htmlFor="password">{t("newPassword")}</Label>
          <Input
            id="password"
            type="password"
            placeholder="••••••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            hasError={Boolean(errors.password)}
            autoComplete="new-password"
            required
          />
          {errors.password && <p className="text-xs text-error pl-3">{errors.password}</p>}
          <p className="text-[11px] text-text-muted pl-1">{t("newPasswordHint")}</p>
        </div>

        <div className="space-y-2.5">
          <Label htmlFor="confirmPassword">{t("confirmPassword")}</Label>
          <Input
            id="confirmPassword"
            type="password"
            placeholder="••••••••••••"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            hasError={Boolean(errors.confirmPassword)}
            autoComplete="new-password"
            required
          />
          {errors.confirmPassword && <p className="text-xs text-error pl-3">{errors.confirmPassword}</p>}
        </div>

        <div className="pt-2">
          <Button type="submit" variant="primary" isLoading={isLoading} className="w-full h-12 text-sm font-medium rounded-full">
            {t("submit")}
          </Button>
        </div>
      </form>
    </div>
  );
};
