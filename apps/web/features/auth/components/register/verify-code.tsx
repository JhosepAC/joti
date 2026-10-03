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

function MailIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      width="1em"
      height="1em"
      className={className}
    >
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <path d="m4 7 8 6 8-6" />
    </svg>
  );
}

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      width="1em"
      height="1em"
      className={className}
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 3" />
    </svg>
  );
}

function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      width="1em"
      height="1em"
      className={className}
    >
      <path d="M12 3 5 6v5c0 5 3 8 7 10 4-2 7-5 7-10V6l-7-3Z" />
      <path d="m9.5 12 2 2 3.5-4" />
    </svg>
  );
}

export const VerifyCode: React.FC<Props> = ({ email, code, setCode, errors, isLoading, onVerify, onResend, expiresAt, resendCooldown = 0 }) => {
  const t = useTranslations("auth.register.verify");
  const format = useFormatter();
  const digits = code.padEnd(6, " ").slice(0, 6).split("");

  return (
    <div className="space-y-6">
      <header className="flex items-start gap-4">
        <span
          aria-hidden="true"
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-xl text-white shadow-sm"
        >
          <MailIcon className="text-2xl" />
        </span>
        <div>
          <h2 className="text-2xl font-semibold text-text-primary font-heading">{t("title")}</h2>
          <p className="text-sm font-light text-text-secondary mt-1.5 leading-relaxed">
            {t.rich("description", {
              b: (chunks) => <span className="font-medium text-text-primary">{chunks}</span>,
              email,
            })}
          </p>
        </div>
      </header>

      {errors.general && <div className="p-3 bg-red-50 border border-error/20 rounded-2xl text-xs text-error">{errors.general}</div>}

      <section
        aria-label={t("title")}
        className="rounded-3xl border border-border bg-surface p-6 shadow-sm"
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="code">{t("code")}</Label>
            {expiresAt && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-background px-2.5 py-1 text-[0.7rem] font-medium text-text-secondary ring-1 ring-border">
                <ClockIcon className="text-xs" />
                {t("expiresAt", { time: format.dateTime(new Date(expiresAt), { hour: "numeric", minute: "2-digit" }) })}
              </span>
            )}
          </div>

          {/* Segmented digit preview, driven by the single accessible input below */}
          <div aria-hidden="true" className="grid grid-cols-6 gap-2">
            {digits.map((digit, index) => (
              <span
                key={index}
                className={`flex h-12 items-center justify-center rounded-xl border bg-background text-xl font-semibold tabular-nums transition-colors ${
                  digit.trim()
                    ? "border-border-strong text-text-primary"
                    : errors.code
                      ? "border-error/40 text-text-muted"
                      : "border-border text-text-muted"
                }`}
              >
                {digit}
              </span>
            ))}
          </div>

          <Input
            id="code"
            placeholder="123456"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            hasError={Boolean(errors.code)}
            inputMode="numeric"
            autoComplete="one-time-code"
            aria-describedby={errors.code ? undefined : "codeHelp"}
            className="tracking-[0.3em] text-center text-lg"
          />
          {errors.code ? (
            <p className="text-xs text-error pl-2">{errors.code}</p>
          ) : (
            <p id="codeHelp" className="text-[11px] text-text-muted pl-1">
              {t("codeHint")}
            </p>
          )}
        </div>

        <div className="mt-6 border-t border-border pt-5">
          <Button type="button" variant="primary" className="w-full h-12 rounded-full" isLoading={isLoading} onClick={onVerify}>
            {t("submit")}
          </Button>

          <div className="mt-4 flex justify-between items-center text-xs">
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
        </div>
      </section>

      <p className="flex items-center justify-center gap-1.5 text-xs text-text-muted text-center">
        <ShieldIcon className="text-sm shrink-0" />
        {t("note")}
      </p>
    </div>
  );
};
