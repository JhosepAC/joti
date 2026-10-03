"use client";

import * as React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Divider } from "@/components/ui/divider";
import { SocialLoginButton } from "./social-login-button";
import { useLogin } from "../hooks/use-login";

export const LoginForm: React.FC = () => {
  const t = useTranslations("auth.login");
  const tCommon = useTranslations("common.actions");
  const {
    credentials,
    errors,
    isLoading,
    isOAuthLoading,
    isEntering,
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
  } = useLogin();

  return (
    <div className="w-full max-w-[460px] mx-auto py-8">
      {/* Header */}
      <header className="mb-8">
        <h1 className="text-3xl md:text-[2.25rem] font-semibold tracking-[-0.03em] text-text-primary font-heading leading-tight">
          {t("title")}
        </h1>
        <p className="text-[0.95rem] font-light text-text-secondary mt-2">
          {t("subtitle")}
        </p>
      </header>

      {/* General Form Error Alert */}
      {errors.general && (
        <div className="mb-6 p-3.5 bg-red-50 border border-error/20 rounded-2xl text-xs text-error">
          {errors.general}
        </div>
      )}

      {/* Activation Required (inactive account) */}
      {requiresActivation && pendingEmail && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-2xl space-y-3">
          <p className="text-xs font-medium text-amber-900">{t("activationTitle", { email: pendingEmail })}</p>
          <Input
            placeholder="123456"
            value={activationCode}
            onChange={(e) => setActivationCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            inputMode="numeric"
            className="tracking-[0.3em] text-center"
          />
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1 h-9 rounded-full text-xs"
              onClick={handleResendActivation}
              disabled={isLoading || resendCooldown > 0}
            >
              {resendCooldown > 0 ? t("activationResendIn", { seconds: resendCooldown }) : t("activationResend")}
            </Button>
            <Button variant="primary" className="flex-1 h-9 rounded-full text-xs" onClick={handleActivationVerify} isLoading={isLoading}>
              {t("activationVerify")}
            </Button>
          </div>
        </div>
      )}

      {/* Traditional Form */}
      <form onSubmit={handleCredentialsSubmit} className="space-y-5" noValidate aria-busy={isEntering}>
        {/* Email Field */}
        <div className="space-y-2.5">
          <Label htmlFor="email" className="inline-block mb-1">
            {t("email")}
          </Label>
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="name@example.com"
            value={credentials.email}
            onChange={(e) => handleFieldChange("email", e.target.value)}
            hasError={Boolean(errors.email)}
            autoComplete="email"
            required
          />
          {errors.email && (
            <p className="text-xs text-error pl-3">{errors.email}</p>
          )}
        </div>

        {/* Password Field */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between mb-1">
            <Label htmlFor="password">{t("password")}</Label>
            <Link
              href="/auth/forgot-password"
              className="text-xs font-normal text-text-secondary hover:text-text-primary hover:underline transition-colors"
            >
              {t("forgotPassword")}
            </Link>
          </div>
          <Input
            id="password"
            name="password"
            type="password"
            placeholder="••••••••"
            value={credentials.password}
            onChange={(e) => handleFieldChange("password", e.target.value)}
            hasError={Boolean(errors.password)}
            autoComplete="current-password"
            required
          />
          {errors.password && (
            <p className="text-xs text-error pl-3">{errors.password}</p>
          )}
        </div>

        {/* Submit Button */}
        <div className="pt-2">
          <Button
            type="submit"
            variant="primary"
            isLoading={isLoading || isEntering}
            disabled={isOAuthLoading}
            className="w-full h-12 text-sm font-medium rounded-full"
          >
            {t("submit")}
          </Button>
        </div>
      </form>

      {/* Divider */}
      <Divider>{tCommon("or")}</Divider>

      {/* Google OAuth Login */}
      <SocialLoginButton
        provider="google"
        isRecommended={true}
        isLoading={isOAuthLoading}
        disabled={isLoading}
        onClick={handleGoogleLogin}
      />

      {/* Footer */}
      <footer className="text-center mt-10 text-[0.825rem] font-light text-text-secondary">
        {t("noAccount")}{" "}
        <Link
          href="/auth/register"
          className="text-text-primary font-medium hover:underline transition-all"
        >
          {t("createAccount")}
        </Link>
      </footer>
    </div>
  );
};
