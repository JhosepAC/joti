"use client";

import * as React from "react";
import { useTranslations, useFormatter } from "next-intl";
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
  const t = useTranslations("auth.register.verify");
  const format = useFormatter();
  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-2xl font-semibold text-text-primary font-heading">{t("title")}</h2>
        <p className="text-sm font-light text-text-secondary mt-2">
          {t.rich("description", {
            b: (chunks) => <span className="font-medium text-text-primary">{chunks}</span>,
            email,
          })}
        </p>
        {expiresAt && (
          <p className="text-xs text-text-muted mt-1">
            {t("expiresAt", { time: format.dateTime(new Date(expiresAt), { hour: "numeric", minute: "2-digit" }) })}
          </p>
        )}
      </header>

      {errors.general && <div className="p-3 bg-red-50 border border-error/20 rounded-2xl text-xs text-error">{errors.general}</div>}

      <div className="space-y-2">
        <Label htmlFor="code">{t("code")}</Label>
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
        {t("submit")}
      </Button>

      <div className="flex justify-between items-center text-xs">
        <span className="text-text-muted">{t("resendPrompt")}</span>
        <button
          type="button"
          onClick={onResend}
          disabled={resendCooldown > 0 || isLoading}
          className="font-medium text-text-primary hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {resendCooldown > 0 ? t("resendIn", { seconds: resendCooldown }) : t("resend")}
        </button>
      </div>

      <p className="text-xs text-text-muted text-center">{t("note")}</p>
    </div>
  );
};
