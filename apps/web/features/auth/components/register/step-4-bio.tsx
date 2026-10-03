"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RegisterFlowData, RegisterFlowErrors } from "../../types/register-flow.types";

interface Props {
  data: RegisterFlowData;
  errors: RegisterFlowErrors;
  isLoading: boolean;
  onChange: <K extends keyof RegisterFlowData>(field: K, value: RegisterFlowData[K]) => void;
  onSubmit: () => Promise<unknown>;
}

export const Step4Bio: React.FC<Props> = ({ data, errors, isLoading, onChange, onSubmit }) => {
  const t = useTranslations("auth.register.step4");
  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-2xl font-semibold text-text-primary font-heading">{t("title")}</h2>
        <p className="text-sm font-light text-text-secondary mt-1.5">{t("subtitle")}</p>
      </header>

      {errors.general && <div className="p-3 bg-red-50 border border-error/20 rounded-2xl text-xs text-error">{errors.general}</div>}

      <div className="space-y-2">
        <Label htmlFor="bio">{t("bio")}</Label>
        <textarea
          id="bio"
          placeholder={t("bioPlaceholder")}
          value={data.bio}
          onChange={(e) => onChange("bio", e.target.value)}
          maxLength={500}
          rows={4}
          className="w-full min-h-[110px] rounded-2xl border border-border bg-background px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-border-strong focus:ring-2 focus:ring-focus-ring resize-none"
        />
        <div className="flex justify-between text-xs px-1">
          <span className={errors.bio ? "text-error" : "text-text-muted"}>{errors.bio ?? t("bioHint")}</span>
          <span className="text-text-muted">{t("bioCount", { count: data.bio.length })}</span>
        </div>
      </div>

      <div className="flex justify-end">
        <Button type="button" variant="primary" className="h-11 px-8 rounded-full" isLoading={isLoading} onClick={onSubmit}>
          {t("submit")}
        </Button>
      </div>
    </div>
  );
};
