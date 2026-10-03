"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RegisterFlowData, RegisterFlowErrors } from "../../types/register-flow.types";

interface Props {
  data: RegisterFlowData;
  errors: RegisterFlowErrors;
  onChange: <K extends keyof RegisterFlowData>(field: K, value: RegisterFlowData[K]) => void;
  onNext: () => void;
}

export const Step2Profile: React.FC<Props> = ({ data, errors, onChange, onNext }) => {
  const t = useTranslations("auth.register.step2");
  return (
    <div className="space-y-5">
      <header>
        <h2 className="text-2xl font-semibold text-text-primary font-heading">{t("title")}</h2>
        <p className="text-sm font-light text-text-secondary mt-1.5">{t("subtitle")}</p>
      </header>

      {errors.general && <div className="p-3 bg-red-50 border border-error/20 rounded-2xl text-xs text-error">{errors.general}</div>}

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="username">{t("username")}</Label>
          <Input
            id="username"
            placeholder="joti_user"
            value={data.username}
            onChange={(e) => onChange("username", e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
            hasError={Boolean(errors.username)}
            autoComplete="username"
          />
          {errors.username && <p className="text-xs text-error pl-2">{errors.username}</p>}
          <div className="rounded-xl bg-surface border border-border p-3 text-xs text-text-secondary leading-relaxed">
            <p className="font-medium text-text-primary mb-1">{t("restrictionsTitle")}</p>
            <ul className="list-disc list-inside space-y-0.5 text-[11px]">
              <li>{t("restrictionLength")}</li>
              <li>{t("restrictionAllowed")} <code className="bg-background px-1 py-0.5 rounded">a-z</code>, <code className="bg-background px-1 py-0.5 rounded">0-9</code>, <code className="bg-background px-1 py-0.5 rounded">_</code></li>
              <li>{t("restrictionReserved")}</li>
              <li>{t("restrictionUnique")}</li>
            </ul>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="displayName">{t("displayName")}</Label>
          <Input
            id="displayName"
            placeholder={t("displayNamePlaceholder")}
            value={data.displayName}
            onChange={(e) => onChange("displayName", e.target.value)}
            hasError={Boolean(errors.displayName)}
            autoComplete="name"
          />
          {errors.displayName && <p className="text-xs text-error pl-2">{errors.displayName}</p>}
          <p className="text-[11px] text-text-muted pl-1">{t("displayNameHint")}</p>
        </div>
      </div>

      <Button type="button" variant="primary" className="w-full h-12 rounded-full" onClick={onNext}>
        {t("submit")}
      </Button>
    </div>
  );
};
