"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Divider } from "@/components/ui/divider";
import { SocialLoginButton } from "../social-login-button";
import { RegisterFlowData, RegisterFlowErrors } from "../../types/register-flow.types";

interface Props {
  data: RegisterFlowData;
  errors: RegisterFlowErrors;
  isLoading: boolean;
  onChange: <K extends keyof RegisterFlowData>(field: K, value: RegisterFlowData[K]) => void;
  onNext: () => void;
  onGoogle?: () => void;
}

export const Step1Credentials: React.FC<Props> = ({ data, errors, isLoading, onChange, onNext, onGoogle }) => {
  return (
    <div className="space-y-5">
      <header className="mb-2">
        <h1 className="text-2xl font-semibold tracking-[-0.03em] text-text-primary font-heading">Create Account</h1>
        <p className="text-[0.9rem] font-light text-text-secondary mt-1.5">Enter your email and password to get started</p>
      </header>

      {errors.general && (
        <div className="p-3 bg-red-50 border border-error/20 rounded-2xl text-xs text-error">{errors.general}</div>
      )}

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="name@example.com"
            value={data.email}
            onChange={(e) => onChange("email", e.target.value)}
            hasError={Boolean(errors.email)}
            autoComplete="email"
          />
          {errors.email && <p className="text-xs text-error pl-2">{errors.email}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            placeholder="••••••••••••"
            value={data.password}
            onChange={(e) => onChange("password", e.target.value)}
            hasError={Boolean(errors.password)}
            autoComplete="new-password"
          />
          {errors.password && <p className="text-xs text-error pl-2">{errors.password}</p>}
          <p className="text-[11px] text-text-muted pl-1">12+ characters, max 72 bytes, not containing your email or username</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirm Password</Label>
          <Input
            id="confirmPassword"
            type="password"
            placeholder="••••••••••••"
            value={data.confirmPassword}
            onChange={(e) => onChange("confirmPassword", e.target.value)}
            hasError={Boolean(errors.confirmPassword)}
            autoComplete="new-password"
          />
          {errors.confirmPassword && <p className="text-xs text-error pl-2">{errors.confirmPassword}</p>}
        </div>
      </div>

      <Button type="button" variant="primary" className="w-full h-12 rounded-full" isLoading={isLoading} onClick={onNext}>
        Continue
      </Button>

      <Divider>or</Divider>

      <SocialLoginButton provider="google" isRecommended={false} onClick={onGoogle} disabled={isLoading} />
    </div>
  );
};
