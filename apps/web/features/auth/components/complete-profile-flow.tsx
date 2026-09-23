"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useAction, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RECOMMENDED_AVATARS } from "../types/register-flow.types";
import { getAuthErrorMessage } from "../utils/get-auth-error-message";

export const CompleteProfileFlow: React.FC = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const emailParam = searchParams.get("email") ?? "";
  const [email] = useState(emailParam);
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);

  const completeProfile = useAction(api.auth.actions.completeProfile);
  const generateUploadUrl = useMutation(api.auth.storage.generateAvatarUploadUrl);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return;
    const preview = URL.createObjectURL(file);
    setAvatarFile(file);
    setAvatarPreview(preview);
    setAvatarUrl(null);
  };

  const selectRecommended = (url: string) => {
    setAvatarUrl(url);
    setAvatarPreview(url);
    setAvatarFile(null);
  };

  const handleSubmit = async () => {
    if (!username.trim() || !displayName.trim()) {
      setErrors({ general: "Username and display name are required" });
      return;
    }
    setIsLoading(true);
    try {
      let avatar: string | undefined = avatarUrl ?? undefined;
      if (avatarFile) {
        if (avatarFile.size > 5 * 1024 * 1024) throw new Error("Avatar must be less than 5MB");
        const uploadUrl = await generateUploadUrl({});
        const res = await fetch(uploadUrl as string, { method: "POST", headers: { "Content-Type": avatarFile.type }, body: avatarFile });
        if (!res.ok) throw new Error("Failed to upload avatar");
        const json = (await res.json()) as { storageId: string };
        avatar = json.storageId;
      }
      await completeProfile({
        email: email.trim().toLowerCase(),
        username: username.trim().toLowerCase(),
        display_name: displayName.trim(),
        bio: bio.trim() || undefined,
        avatar,
        locale: "system",
        timezone: "system",
      });
      router.push("/auth/login?completed=1");
    } catch (err: unknown) {
      setErrors({ general: getAuthErrorMessage(err, "Failed to complete profile") });
    } finally {
      setIsLoading(false);
    }
  };

  if (!email) {
    return <div className="p-6 text-xs text-error">Missing email. Please sign in again.</div>;
  }

  const fallbackLetter = (displayName || username || "J").charAt(0).toUpperCase();

  return (
    <div className="w-full max-w-[460px] mx-auto py-8 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-text-primary font-heading">Complete your profile</h1>
        <p className="text-sm font-light text-text-secondary mt-1.5">Your account is active but profile is mandatory for {email}</p>
      </header>
      {errors.general && <div className="p-3 bg-red-50 border border-error/20 rounded-2xl text-xs text-error">{errors.general}</div>}

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="username">Username</Label>
          <Input id="username" placeholder="joti_user" value={username} onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))} />
          <p className="text-[11px] text-text-muted">3-20 chars, a-z 0-9 _ only</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="displayName">Display Name</Label>
          <Input id="displayName" placeholder="Joti User" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        </div>
        <div className="space-y-4">
          <Label>Avatar</Label>
          <div className="flex flex-col items-center gap-3">
            <div className="w-20 h-20 rounded-full bg-surface border-2 border-border overflow-hidden flex items-center justify-center text-xl font-semibold">
              {avatarPreview ? <img src={avatarPreview} alt="preview" className="w-full h-full object-cover" /> : <span>{fallbackLetter}</span>}
            </div>
            <input type="file" accept="image/*" onChange={handleFile} className="text-xs file:mr-2 file:rounded-full file:border-0 file:bg-primary file:text-white file:px-3 file:py-1.5" />
          </div>
          <div className="grid grid-cols-6 gap-2">
            {RECOMMENDED_AVATARS.map((url) => (
              <button key={url} type="button" onClick={() => selectRecommended(url)} className={`w-10 h-10 rounded-full overflow-hidden border-2 ${avatarUrl === url ? "border-primary" : "border-border"}`}>
                <img src={url} alt="rec" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
          <p className="text-xs text-text-muted text-center">Skip uses first letter</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="bio">Bio</Label>
          <textarea id="bio" value={bio} onChange={(e) => setBio(e.target.value)} maxLength={500} rows={3} placeholder="A little about you..." className="w-full rounded-2xl border border-border p-3 text-sm resize-none" />
          <p className="text-xs text-text-muted text-right">{bio.length}/500</p>
        </div>
      </div>
      <Button variant="primary" className="w-full h-11 rounded-full" isLoading={isLoading} onClick={handleSubmit}>Complete Profile</Button>
    </div>
  );
};
