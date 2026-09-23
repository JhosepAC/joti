"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useResetPassword } from "../hooks/use-reset-password";

export const ResetPasswordFlow: React.FC = () => {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

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

  if (!token) {
    return (
      <div className="w-full max-w-[460px] mx-auto py-8 space-y-6">
        <div className="p-4 bg-red-50 border border-error/20 rounded-2xl text-xs text-error">
          Missing reset token. Please use the link from your email.
        </div>
        <Link href="/auth/forgot-password" className="block">
          <Button variant="primary" className="w-full h-11 rounded-full">Request new link</Button>
        </Link>
      </div>
    );
  }

  if (tokenValid === false) {
    return (
      <div className="w-full max-w-[460px] mx-auto py-8 space-y-6">
        <header>
          <h1 className="text-3xl font-semibold tracking-[-0.03em] text-text-primary font-heading">Link expired</h1>
          <p className="text-sm font-light text-text-secondary mt-2">This reset link is invalid, already used, or has expired (60 minutes).</p>
        </header>
        {errors.general && <div className="p-3.5 bg-red-50 border border-error/20 rounded-2xl text-xs text-error">{errors.general}</div>}
        <Link href="/auth/forgot-password" className="block">
          <Button variant="primary" className="w-full h-11 rounded-full">Request new link</Button>
        </Link>
        <Link href="/auth/login" className="block text-center text-xs text-text-secondary hover:text-text-primary hover:underline">
          Back to Sign In
        </Link>
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className="w-full max-w-[460px] mx-auto py-8 space-y-6">
        <header>
          <h1 className="text-3xl font-semibold tracking-[-0.03em] text-text-primary font-heading">Password updated</h1>
          <p className="text-sm font-light text-text-secondary mt-2">
            Your password was changed successfully. A confirmation email was sent from jhosepjamil@gmail.com.
          </p>
        </header>
        <Link href="/auth/login" className="block">
          <Button variant="primary" className="w-full h-12 rounded-full">Sign In</Button>
        </Link>
      </div>
    );
  }

  if (tokenValid === null) {
    return (
      <div className="w-full max-w-[460px] mx-auto py-8">
        <p className="text-sm text-text-secondary animate-pulse">Verifying reset link...</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[460px] mx-auto py-8">
      <header className="mb-8">
        <h1 className="text-3xl font-semibold tracking-[-0.03em] text-text-primary font-heading leading-tight">Reset password</h1>
        <p className="text-sm font-light text-text-secondary mt-2">Choose a new password. It must be 12–128 characters and not contain your email or username.</p>
      </header>

      {errors.general && (
        <div className="mb-6 p-3.5 bg-red-50 border border-error/20 rounded-2xl text-xs text-error">{errors.general}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        <div className="space-y-2.5">
          <Label htmlFor="password">New password</Label>
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
          <p className="text-[11px] text-text-muted pl-1">12–128 characters. Spaces allowed. Must not contain your email or username.</p>
        </div>

        <div className="space-y-2.5">
          <Label htmlFor="confirmPassword">Confirm new password</Label>
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
            Update password
          </Button>
        </div>
      </form>

      <footer className="text-center mt-8 text-xs text-text-secondary">
        <Link href="/auth/login" className="hover:text-text-primary hover:underline">Back to Sign In</Link>
      </footer>
    </div>
  );
};
