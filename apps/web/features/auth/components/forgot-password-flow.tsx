"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useForgotPassword } from "../hooks/use-forgot-password";

export const ForgotPasswordFlow: React.FC = () => {
  const { email, setEmail, errors, isLoading, isSuccess, cooldown, handleResend, handleSubmit } = useForgotPassword();

  if (isSuccess) {
    return (
      <div className="w-full max-w-[460px] mx-auto py-8 space-y-6">
        <header>
          <h1 className="text-3xl font-semibold tracking-[-0.03em] text-text-primary font-heading leading-tight">
            Check your email
          </h1>
          <p className="text-sm font-light text-text-secondary mt-2">
            If an account exists for <span className="font-medium text-text-primary">{email}</span>, we&apos;ve sent a password reset link from jhosepjamil@gmail.com. It expires in 60 minutes.
          </p>
        </header>
        <div className="p-4 bg-surface border border-border rounded-2xl text-xs text-text-secondary space-y-2">
          <p>Didn&apos;t receive it? Check spam. The link is single-use. You can request a new one after 60 seconds.</p>
          {cooldown > 0 ? (
            <p className="text-text-muted">Resend available in {cooldown}s</p>
          ) : (
            <Button variant="outline" className="w-full h-9 rounded-full text-xs mt-2" onClick={handleResend} disabled={isLoading}>
              Resend link
            </Button>
          )}
          {errors.general && <p className="text-error text-xs mt-2">{errors.general}</p>}
        </div>
        <Link href="/auth/login" className="block">
          <Button variant="outline" className="w-full h-11 rounded-full">Back to Sign In</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[460px] mx-auto py-8">
      <header className="mb-8">
        <h1 className="text-3xl md:text-[2.25rem] font-semibold tracking-[-0.03em] text-text-primary font-heading leading-tight">
          Forgot password?
        </h1>
        <p className="text-[0.95rem] font-light text-text-secondary mt-2">
          Enter your email and we&apos;ll send you a reset link
        </p>
      </header>

      {errors.general && (
        <div className="mb-6 p-3.5 bg-red-50 border border-error/20 rounded-2xl text-xs text-error">
          {errors.general}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        <div className="space-y-2.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="name@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            hasError={Boolean(errors.email)}
            autoComplete="email"
            required
          />
          {errors.email && <p className="text-xs text-error pl-3">{errors.email}</p>}
        </div>

        <div className="pt-2">
          <Button
            type="submit"
            variant="primary"
            isLoading={isLoading}
            disabled={cooldown > 0}
            className="w-full h-12 text-sm font-medium rounded-full"
          >
            {cooldown > 0 ? `Wait ${cooldown}s` : "Send reset link"}
          </Button>
          {cooldown > 0 && <p className="text-xs text-text-muted text-center mt-2">Please wait before requesting another link.</p>}
        </div>
      </form>

      <footer className="text-center mt-10 text-[0.825rem] font-light text-text-secondary">
        Remembered your password?{" "}
        <Link href="/auth/login" className="text-text-primary font-medium hover:underline transition-all">
          Sign In
        </Link>
      </footer>
    </div>
  );
};
