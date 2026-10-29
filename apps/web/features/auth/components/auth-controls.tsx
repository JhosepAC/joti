"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";
import { useTranslations } from "next-intl";

export function AuthHeader({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <header className="auth-heading">
      <h1 tabIndex={-1}>{title}</h1>
      {children && <p>{children}</p>}
    </header>
  );
}

export function AuthAlert({
  children,
  success = false,
}: {
  children?: ReactNode;
  success?: boolean;
}) {
  if (!children) return null;
  return (
    <div
      className={`auth-alert${success ? " auth-alert-success" : ""}`}
      role={success ? "status" : "alert"}
    >
      {children}
    </div>
  );
}

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
  action?: ReactNode;
}

export function AuthField({
  label,
  error,
  hint,
  action,
  id: suppliedId,
  type,
  ...props
}: FieldProps) {
  const generatedId = useId();
  const id = suppliedId ?? generatedId;
  const t = useTranslations("auth.ui");
  const [visible, setVisible] = useState(false);
  const isPassword = type === "password";
  useEffect(() => {
    if (
      error &&
      document.querySelector('.auth-form [aria-invalid="true"]')?.id === id
    )
      document.getElementById(id)?.focus();
  }, [error, id]);
  return (
    <div className="auth-field">
      <div className="auth-label-row">
        <label htmlFor={id}>{label}</label>
        {action}
      </div>
      <div className="auth-input-wrap">
        <input
          {...props}
          id={id}
          type={isPassword && visible ? "text" : type}
          aria-invalid={Boolean(error)}
          aria-describedby={error || hint ? `${id}-help` : undefined}
          className={
            isPassword ? "auth-input auth-input-password" : "auth-input"
          }
        />
        {isPassword && (
          <button
            type="button"
            className="auth-password-toggle"
            onClick={() => setVisible(!visible)}
            aria-label={visible ? t("hidePassword") : t("showPassword")}
            aria-pressed={visible}
            disabled={props.disabled}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              aria-hidden="true"
            >
              <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
              <circle cx="12" cy="12" r="3" />
              {visible && <path d="m3 3 18 18" />}
            </svg>
          </button>
        )}
      </div>
      {(error || hint) && (
        <p
          id={`${id}-help`}
          className={error ? "auth-field-error" : "auth-hint"}
        >
          {error ?? hint}
        </p>
      )}
    </div>
  );
}

export function AuthSubmit({
  children,
  busy,
  disabled,
  type = "submit",
  onClick,
}: {
  children: ReactNode;
  busy?: boolean;
  disabled?: boolean;
  type?: "submit" | "button";
  onClick?: () => void;
}) {
  const t = useTranslations("auth.ui");
  return (
    <button
      className="auth-submit"
      type={type}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      onClick={onClick}
    >
      {busy && <span className="auth-spinner" aria-hidden="true" />}
      <span>{busy ? t("working") : children}</span>
    </button>
  );
}

export function VerificationInput({
  value,
  onChange,
  error,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  error?: string;
  disabled?: boolean;
}) {
  const t = useTranslations("auth.register.verify");
  const id = useId();
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (error) ref.current?.focus();
  }, [error]);
  return (
    <div className="auth-field">
      <label htmlFor={id}>{t("code")}</label>
      <div className="auth-code" onClick={() => ref.current?.focus()}>
        <div className="auth-code-boxes" aria-hidden="true">
          {Array.from({ length: 6 }, (_, index) => (
            <span
              key={index}
              className={
                index === Math.min(value.length, 5) ? "auth-code-current" : ""
              }
            >
              {value[index] ?? ""}
            </span>
          ))}
        </div>
        <input
          ref={ref}
          id={id}
          name="verificationCode"
          value={value}
          onChange={(e) =>
            onChange(e.target.value.replace(/\D/g, "").slice(0, 6))
          }
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{6}"
          maxLength={6}
          disabled={disabled}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
          aria-label={t("code")}
        />
      </div>
      {error && (
        <p className="auth-field-error" id={`${id}-error`} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
