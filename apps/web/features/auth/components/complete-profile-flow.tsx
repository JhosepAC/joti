"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAction } from "convex/react";
import { useLocale, useTranslations } from "next-intl";
import { api } from "@/convex/_generated/api";
import { AuthAlert, AuthHeader, AuthSubmit } from "./auth-controls";
import { AuthProfileFields } from "./auth-profile-fields";
import { emptyProfile } from "../hooks/use-register-flow";
import { validateProfileInput } from "../validations/profile.schema";
import { useValidationTranslator } from "@/i18n/translate";
import {
  getAuthErrorMessage,
  useAuthErrorMessage,
} from "../utils/get-auth-error-message";
import {
  readAccountGrant,
  storeAccountGrant,
  type AccountGrant,
} from "../utils/claim-store";
import type {
  RegisterFlowData,
  RegisterFlowErrors,
} from "../types/register-flow.types";
import { establishSession } from "../utils/session-client";

export function CompleteProfileFlow() {
  const router = useRouter();
  const t = useTranslations("auth.completeProfile");
  const ui = useTranslations("auth.ui");
  const validation = useValidationTranslator();
  const locale = useLocale();
  const message = useAuthErrorMessage();
  const [grant, setGrant] = useState<AccountGrant | null | undefined>(
    undefined,
  );
  const [data, setData] = useState<RegisterFlowData>(emptyProfile);
  const [errors, setErrors] = useState<RegisterFlowErrors>({});
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const complete = useAction(api.auth.actions.completeProfile);
  const upload = useAction(api.auth.storage.generateAvatarUploadUrl);
  useEffect(() => {
    setGrant(readAccountGrant());
  }, []);
  useEffect(() => {
    const preview = data.avatarPreview;
    return () => {
      if (preview?.startsWith("blob:")) URL.revokeObjectURL(preview);
    };
  }, [data.avatarPreview]);

  function updateField<K extends keyof RegisterFlowData>(
    field: K,
    value: RegisterFlowData[K],
  ) {
    setData((previous) => ({ ...previous, [field]: value }));
    setErrors((previous) => ({
      ...previous,
      [field]: undefined,
      general: undefined,
    }));
  }
  async function submit() {
    if (!grant || inFlight.current) return;
    const nextErrors = validateProfileInput(data, validation);
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return;
    }
    inFlight.current = true;
    setBusy(true);
    setErrors({});
    let succeeded = false;
    try {
      let avatar = data.avatarUrl ?? undefined;
      if (data.avatarFile) {
        const url = await upload({ email: grant.email, claim: grant.token });
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": data.avatarFile.type },
          body: data.avatarFile,
        });
        if (!response.ok) {
          setErrors({ avatar: ui("uploadFailed") });
          return;
        }
        const body = (await response.json()) as { storageId: string };
        avatar = body.storageId;
        setData((previous) => ({
          ...previous,
          avatarFile: null,
          avatarUrl: avatar ?? null,
        }));
      }
      const result = (await complete({
        email: grant.email,
        claim: grant.token,
        username: data.username.trim().toLowerCase(),
        display_name: data.displayName.trim(),
        bio: data.bio.trim() || undefined,
        avatar,
        locale,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      })) as { claim?: string };
      succeeded = true;
      if (result.claim) {
        storeAccountGrant(grant.email, result.claim);
        try {
          await establishSession(grant.email, result.claim);
          router.replace("/spaces/new");
        } catch {
          router.replace("/auth/login?registered=1&switch=1");
        }
      } else router.replace("/auth/login");
    } catch (error) {
      if (/username.*taken/i.test(getAuthErrorMessage(error)))
        setErrors({ username: ui("usernameTaken") });
      else setErrors({ general: message(error) });
    } finally {
      if (!succeeded) {
        inFlight.current = false;
        setBusy(false);
      }
    }
  }
  if (grant === undefined)
    return (
      <div className="auth-form" role="status">
        <AuthHeader title={ui("pleaseWait")} />
      </div>
    );
  if (!grant)
    return (
      <div className="auth-form">
        <AuthHeader title={ui("sessionTitle")}>
          {ui("sessionDescription")}
        </AuthHeader>
        <Link href="/auth/login" className="auth-submit">
          {ui("backToLogin")}
        </Link>
      </div>
    );
  return (
    <form
      className="auth-form"
      noValidate
      aria-busy={busy}
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <AuthHeader title={t("title")}>{ui("profileDescription")}</AuthHeader>
      <AuthAlert>{errors.general}</AuthAlert>
      <AuthProfileFields
        data={data}
        errors={errors}
        onChange={updateField}
        disabled={busy}
      />
      <AuthSubmit busy={busy}>{t("submit")}</AuthSubmit>
      <p className="auth-footer">
        <Link href="/auth/login?switch=1">{ui("anotherAccount")}</Link>
      </p>
    </form>
  );
}
