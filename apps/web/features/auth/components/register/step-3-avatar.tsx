"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RegisterFlowData, RECOMMENDED_AVATARS } from "../../types/register-flow.types";

interface Props {
  data: RegisterFlowData;
  onChange: <K extends keyof RegisterFlowData>(field: K, value: RegisterFlowData[K]) => void;
  onNext: () => void;
  onSkip: () => void;
  error?: string;
}

export const Step3Avatar: React.FC<Props> = ({ data, onChange, onNext, onSkip, error }) => {
  const [fileError, setFileError] = React.useState<string | null>(null);
  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setFileError("Please upload an image file");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setFileError("Avatar must be less than 5MB");
      return;
    }
    setFileError(null);
    // Revoke previous blob URL
    if (data.avatarPreview?.startsWith("blob:")) URL.revokeObjectURL(data.avatarPreview);
    const preview = URL.createObjectURL(file);
    onChange("avatarFile", file);
    onChange("avatarPreview", preview);
    onChange("avatarUrl", null);
  };

  const selectRecommended = (url: string) => {
    setFileError(null);
    if (data.avatarPreview?.startsWith("blob:")) URL.revokeObjectURL(data.avatarPreview);
    onChange("avatarUrl", url);
    onChange("avatarPreview", url);
    onChange("avatarFile", null);
  };

  const preview = data.avatarPreview;
  const fallbackLetter = (data.displayName || data.username || "J").charAt(0).toUpperCase();

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-2xl font-semibold text-text-primary font-heading">Add avatar</h2>
        <p className="text-sm font-light text-text-secondary mt-1.5">Upload an image or choose a recommended one</p>
      </header>

      {(error || fileError) && (
        <div className="p-3 bg-red-50 border border-error/20 rounded-2xl text-xs text-error">{fileError ?? error}</div>
      )}

      <div className="flex flex-col items-center gap-4">
        <div className="w-28 h-28 rounded-full bg-surface border-2 border-border flex items-center justify-center overflow-hidden text-3xl font-semibold text-text-secondary">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="avatar preview" className="w-full h-full object-cover" />
          ) : (
            <span>{fallbackLetter}</span>
          )}
        </div>

        <div className="w-full space-y-2">
          <Label htmlFor="avatar">Upload image</Label>
          <input
            id="avatar"
            type="file"
            accept="image/*"
            onChange={handleFile}
            className="w-full text-xs file:mr-3 file:py-2 file:px-4 file:rounded-full file:border-0 file:bg-primary file:text-white file:text-xs file:font-medium hover:file:bg-action-hover"
          />
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium text-text-secondary">Recommended avatars</p>
        <div className="grid grid-cols-6 gap-2">
          {RECOMMENDED_AVATARS.map((url) => (
            <button
              key={url}
              type="button"
              onClick={() => selectRecommended(url)}
              className={`w-12 h-12 rounded-full overflow-hidden border-2 transition ${data.avatarUrl === url ? "border-primary" : "border-border hover:border-border-strong"}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="recommended" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-3">
        <Button type="button" variant="outline" className="flex-1 h-11 rounded-full" onClick={onSkip}>
          Skip
        </Button>
        <Button type="button" variant="primary" className="flex-1 h-11 rounded-full" onClick={onNext}>
          Continue
        </Button>
      </div>
      <p className="text-xs text-text-muted text-center">Skip will use the first letter of your name</p>
    </div>
  );
};
