"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RegisterFlowErrors } from "../../types/register-flow.types";

interface Props {
  email: string;
  code: string;
  setCode: (v: string) => void;
  errors: RegisterFlowErrors;
  isLoading: boolean;
  onVerify: () => void;
  onResend?: () => void;
  expiresAt: number | null;
  resendCooldown?: number;
}

export const VerifyCode: React.FC<Props> = ({ email, code, setCode, errors, isLoading, onVerify, onResend, expiresAt, resendCooldown = 0 }) => {
  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-2xl font-semibold text-text-primary font-heading">Confirm your email</h2>
        <p className="text-sm font-light text-text-secondary mt-2">
          We sent a 6-digit code to <span className="font-medium text-text-primary">{email}</span> from{" "}
          <span className="font-medium">jhosepjamil@gmail.com</span>. Enter it below.
        </p>
        {expiresAt && (
          <p className="text-xs text-text-muted mt-1">Expires at {new Date(expiresAt).toLocaleTimeString()}</p>
        )}
      </header>

      {errors.general && <div className="p-3 bg-red-50 border border-error/20 rounded-2xl text-xs text-error">{errors.general}</div>}

      <div className="space-y-2">
        <Label htmlFor="code">Verification Code</Label>
        <Input
          id="code"
          placeholder="123456"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          hasError={Boolean(errors.code)}
          inputMode="numeric"
          autoComplete="one-time-code"
          className="tracking-[0.3em] text-center text-lg"
        />
        {errors.code && <p className="text-xs text-error pl-2">{errors.code}</p>}
      </div>

      <Button type="button" variant="primary" className="w-full h-12 rounded-full" isLoading={isLoading} onClick={onVerify}>
        Verify & Continue
      </Button>

      <div className="flex justify-between items-center text-xs">
        <span className="text-text-muted">Didn&apos;t receive it?</span>
        <button
          type="button"
          onClick={onResend}
          disabled={resendCooldown > 0 || isLoading}
          className="font-medium text-text-primary hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend code"}
        </button>
      </div>

      <p className="text-xs text-text-muted text-center">If you close this screen, you&apos;ll need to verify when you sign in.</p>
    </div>
  );
};
