"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { AuthField } from "./auth-controls";
import {
  type RegisterFlowData,
  type RegisterFlowErrors,
} from "../types/register-flow.types";

interface Props {
  data: RegisterFlowData;
  errors: RegisterFlowErrors;
  disabled?: boolean;
  onChange: <K extends keyof RegisterFlowData>(
    field: K,
    value: RegisterFlowData[K],
  ) => void;
}

export function AuthProfileFields({ data, errors, disabled, onChange }: Props) {
  const t = useTranslations("auth.register.step2");
  const ui = useTranslations("auth.ui");
  const bio = useTranslations("auth.register.step4");
  const avatar = useTranslations("auth.register.step3");
  const details = useRef<HTMLDetailsElement>(null);
  const [fileError, setFileError] = useState("");
  const bioId = useId();
  const avatarId = useId();
  useEffect(() => {
    if ((errors.avatar || errors.bio) && details.current)
      details.current.open = true;
  }, [errors.avatar, errors.bio]);
  return (
    <div className="auth-fields">
      <AuthField
        id="displayName"
        name="displayName"
        label={t("displayName")}
        value={data.displayName}
        onChange={(e) => onChange("displayName", e.target.value)}
        autoComplete="name"
        maxLength={100}
        error={errors.displayName}
        disabled={disabled}
        required
      />
      <AuthField
        id="username"
        name="username"
        label={t("username")}
        value={data.username}
        onChange={(e) => onChange("username", e.target.value.toLowerCase())}
        autoComplete="username"
        autoCapitalize="none"
        spellCheck={false}
        maxLength={20}
        hint={ui("usernameHint")}
        error={errors.username}
        disabled={disabled}
        required
      />
      <details className="auth-personalize" ref={details}>
        <summary>
          {ui("personalize")}
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            aria-hidden="true"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </summary>
        <div>
          <div className="auth-field">
            <span className="auth-label">{ui("avatar")}</span>
            <div className="auth-avatar-top">
              <div className="auth-avatar-preview">
                {data.avatarPreview ? (
                  <Image
                    unoptimized
                    src={data.avatarPreview}
                    alt={avatar("previewAlt")}
                    width={56}
                    height={56}
                  />
                ) : (
                  <span aria-hidden="true">
                    {(data.displayName || data.username || "N")
                      .charAt(0)
                      .toUpperCase()}
                  </span>
                )}
              </div>
              <label className="auth-upload" htmlFor={avatarId}>
                {avatar("upload")}
                <input
                  id={avatarId}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  disabled={disabled}
                  aria-describedby={`${avatarId}-help`}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    if (!file) return;
                    if (
                      ![
                        "image/jpeg",
                        "image/png",
                        "image/webp",
                        "image/gif",
                      ].includes(file.type)
                    ) {
                      setFileError(ui("imageTypes"));
                      return;
                    }
                    if (file.size > 5 * 1024 * 1024) {
                      setFileError(avatar("avatarErrorSize"));
                      return;
                    }
                    setFileError("");
                    onChange("avatarFile", file);
                    onChange("avatarPreview", URL.createObjectURL(file));
                    onChange("avatarUrl", null);
                  }}
                />
              </label>
              {data.avatarPreview && (
                <button
                  className="auth-avatar-remove"
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    onChange("avatarFile", null);
                    onChange("avatarPreview", null);
                    onChange("avatarUrl", null);
                    setFileError("");
                  }}
                >
                  {ui("remove")}
                </button>
              )}
            </div>
            <p
              id={`${avatarId}-help`}
              role={fileError || errors.avatar ? "alert" : undefined}
              className={
                fileError || errors.avatar ? "auth-field-error" : "auth-hint"
              }
            >
              {fileError || errors.avatar || ui("uploadHint")}
            </p>
          </div>
          <div className="auth-field">
            <label htmlFor={bioId}>{bio("bio")}</label>
            <textarea
              id={bioId}
              name="bio"
              className="auth-textarea"
              value={data.bio}
              onChange={(e) => onChange("bio", e.target.value)}
              rows={3}
              maxLength={500}
              disabled={disabled}
              aria-invalid={Boolean(errors.bio)}
              aria-describedby={`${bioId}-help`}
              placeholder={bio("bioPlaceholder")}
            />
            <p
              id={`${bioId}-help`}
              className={errors.bio ? "auth-field-error" : "auth-hint"}
            >
              {errors.bio ?? bio("bioCount", { count: data.bio.length })}
            </p>
          </div>
        </div>
      </details>
    </div>
  );
}
