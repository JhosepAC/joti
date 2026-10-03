"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { useAction } from "convex/react";
import { useTranslations } from "next-intl";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RECOMMENDED_AVATARS } from "../types/register-flow.types";
import { useAuthErrorMessage } from "../utils/get-auth-error-message";
import { takeAccountGrant, storeAccountGrant } from "../utils/claim-store";

export const CompleteProfileFlow: React.FC = () => {
  const router = useRouter();
  const t = useTranslations("auth.completeProfile");
  const tErrors = useAuthErrorMessage();
  const tGeneral = useTranslations("validation.general");
  const tValidation = useTranslations("validation");
  // Address and proof of ownership come from the stored grant, never from the
  // URL: query parameters persist in history, Referer headers and server
  // logs. Read once on mount, then cleared, so a reload cannot replay it.
  const [grant] = useState(() => takeAccountGrant());
  const email = grant?.email ?? "";
  const claim = grant?.token ?? null;
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [isLoading, setIsLoading] = useState(false);

  const completeProfile = useAction(api.auth.actions.completeProfile);
  const generateUploadUrl = useAction(api.auth.storage.generateAvatarUploadUrl);

  // Synchronous in-flight guard: the Complete button disables only after a
  // render, and a second submit would burn the single-use claim with a
  // confusing error.
  const inFlight = useRef(false);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      const msg = t("avatarImageError");
      setErrors({ general: msg, avatar: msg });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      const msg = t("avatarSizeError");
      setErrors({ general: msg, avatar: msg });
      return;
    }
    // Revoke previous preview URL to avoid leaks
    if (avatarPreview?.startsWith("blob:")) URL.revokeObjectURL(avatarPreview);
    const preview = URL.createObjectURL(file);
    setAvatarFile(file);
    setAvatarPreview(preview);
    setAvatarUrl(null);
    if (errors.avatar) setErrors((p) => ({ ...p, avatar: undefined, general: undefined }));
  };

  const selectRecommended = (url: string) => {
    if (avatarPreview?.startsWith("blob:")) URL.revokeObjectURL(avatarPreview);
    setAvatarUrl(url);
    setAvatarPreview(url);
    setAvatarFile(null);
    if (errors.avatar) setErrors((p) => ({ ...p, avatar: undefined, general: undefined }));
  };

  const handleSubmit = async () => {
    if (!username.trim() || !displayName.trim()) {
      setErrors({ general: t("required") });
      return;
    }
    // Validate username/displayName format early for better UX
    if (username.trim().length < 3 || username.trim().length > 20) {
      setErrors({ general: t("usernameLength") });
      return;
    }
    if (!/^[a-z0-9_]+$/.test(username.trim().toLowerCase())) {
      setErrors({ general: t("usernameRule") });
      return;
    }
    if (inFlight.current) return;
    inFlight.current = true;
    // Set when the failure originates in the avatar upload block, so the
    // catch routes it to the avatar field. Server messages stay English
    // (backend contracts), so the substring routing below keeps working in
    // every UI locale.
    let avatarError: string | null = null;
    setIsLoading(true);
    try {
      let avatar: string | undefined = avatarUrl ?? undefined;
      if (avatarFile) {
        if (avatarFile.size > 5 * 1024 * 1024) {
          avatarError = t("avatarSizeError");
          setErrors({ general: avatarError, avatar: avatarError });
          throw new Error("avatar-validation");
        }
        if (!avatarFile.type.startsWith("image/")) {
          avatarError = t("avatarImageError");
          setErrors({ general: avatarError, avatar: avatarError });
          throw new Error("avatar-validation");
        }
        if (!claim) throw new Error(tErrors(undefined, tGeneral("sessionExpired")));
        const uploadUrl = await generateUploadUrl({ email: email.trim().toLowerCase(), claim });
        const res = await fetch(uploadUrl as string, { method: "POST", headers: { "Content-Type": avatarFile.type }, body: avatarFile });
        if (!res.ok) {
          avatarError = t("avatarUploadError");
          setErrors({ general: avatarError, avatar: avatarError });
          throw new Error("avatar-upload");
        }
        const json = (await res.json()) as { storageId: string };
        avatar = json.storageId;
      }
      if (!claim) throw new Error(tErrors(undefined, tGeneral("sessionExpired")));
      const result = (await completeProfile({
        email: email.trim().toLowerCase(),
        claim,
        username: username.trim().toLowerCase(),
        display_name: displayName.trim(),
        bio: bio.trim() || undefined,
        avatar,
        locale: "system",
        timezone: "system",
      })) as { claim?: string } | null;
      // The profile gate returns a fresh grant for the next onboarding step.
      if (result?.claim) {
        storeAccountGrant(email.trim().toLowerCase(), result.claim);
        router.push("/spaces/new");
      } else {
        router.push("/auth/login");
      }
    } catch (err: unknown) {
      if (avatarError) {
        setErrors({ general: avatarError, avatar: avatarError });
      } else {
        const msg = tErrors(err, tGeneral("completeProfileFailed"));
        if (msg.toLowerCase().includes("avatar")) {
          setErrors({ general: msg, avatar: msg });
        } else if (msg.toLowerCase().includes("username")) {
          setErrors({ general: msg, username: msg });
        } else {
          setErrors({ general: msg });
        }
      }
    } finally {
      inFlight.current = false;
      setIsLoading(false);
    }
  };

  if (!email) {
    return <div className="p-6 text-xs text-error">{t("missingEmail")}</div>;
  }

  const fallbackLetter = (displayName || username || "J").charAt(0).toUpperCase();

  return (
    <div className="w-full max-w-[460px] mx-auto py-8 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-text-primary font-heading">{t("title")}</h1>
        <p className="text-sm font-light text-text-secondary mt-1.5">{t("subtitle", { email })}</p>
      </header>
      {errors.general && <div className="p-3 bg-red-50 border border-error/20 rounded-2xl text-xs text-error">{errors.general}</div>}

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="username">{t("username")}</Label>
          <Input
            id="username"
            placeholder="joti_user"
            value={username}
            hasError={Boolean(errors.username)}
            onChange={(e) => {
              setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""));
              if (errors.username) setErrors((p) => ({ ...p, username: undefined, general: undefined }));
            }}
          />
          {errors.username ? (
            <p className="text-xs text-error pl-1">{errors.username}</p>
          ) : (
            <p className="text-[11px] text-text-muted">{t("usernameHint")}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="displayName">{t("displayName")}</Label>
          <Input
            id="displayName"
            placeholder={t("displayNamePlaceholder")}
            value={displayName}
            hasError={Boolean(errors.displayName)}
            onChange={(e) => {
              setDisplayName(e.target.value);
              if (errors.displayName) setErrors((p) => ({ ...p, displayName: undefined, general: undefined }));
            }}
          />
          {errors.displayName && <p className="text-xs text-error pl-1">{errors.displayName}</p>}
        </div>
        <div className="space-y-4">
          <Label>{t("avatar")}</Label>
          <div className="flex flex-col items-center gap-3">
            <div className="w-20 h-20 rounded-full bg-surface border-2 border-border overflow-hidden flex items-center justify-center text-xl font-semibold">
              {avatarPreview ? <img src={avatarPreview} alt={t("previewAlt")} className="w-full h-full object-cover" /> : <span>{fallbackLetter}</span>}
            </div>
            <input type="file" accept="image/*" onChange={handleFile} className="text-xs file:mr-2 file:rounded-full file:border-0 file:bg-primary file:text-white file:px-3 file:py-1.5" aria-label={t("avatar")} />
          </div>
          {errors.avatar && <p className="text-xs text-error text-center">{errors.avatar}</p>}
          <div className="grid grid-cols-6 gap-2">
            {RECOMMENDED_AVATARS.map((url) => (
              <button key={url} type="button" onClick={() => selectRecommended(url)} aria-label={t("useRecommended")} className={`w-10 h-10 rounded-full overflow-hidden border-2 ${avatarUrl === url ? "border-primary" : "border-border"}`}>
                <img src={url} alt={t("recommendedAlt")} className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
          <p className="text-xs text-text-muted text-center">{t("skipAvatar")}</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="bio">{t("bio")}</Label>
          <textarea id="bio" value={bio} onChange={(e) => setBio(e.target.value)} maxLength={500} rows={3} placeholder={t("bioPlaceholder")} className="w-full rounded-2xl border border-border bg-background p-3 text-sm placeholder:text-text-muted focus:border-border-strong focus:outline-none resize-none" />
          <p className="text-xs text-text-muted text-right">{t("bioCount", { count: bio.length })}</p>
        </div>
      </div>
      <Button variant="primary" className="w-full h-11 rounded-full" isLoading={isLoading} onClick={handleSubmit}>{t("submit")}</Button>
    </div>
  );
};
