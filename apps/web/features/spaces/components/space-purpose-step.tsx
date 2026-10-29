"use client";

import { useTranslations } from "next-intl";
import { PURPOSE_KEYS } from "../catalog";
import type { SpacePurposeKey } from "../types/space.types";

export function SpacePurposeStep({
  value,
  onChange,
}: {
  value: SpacePurposeKey;
  onChange: (value: SpacePurposeKey) => void;
}) {
  const t = useTranslations("spaces.purpose");
  return (
    <div className="setup-step-content">
      <header className="setup-title">
        <h1 tabIndex={-1}>{t("title")}</h1>
        <p>{t("subtitle")}</p>
      </header>
      <fieldset className="setup-purposes">
        <legend className="sr-only">{t("title")}</legend>
        {PURPOSE_KEYS.map((key) => (
          <label key={key} data-selected={key === value}>
            <input
              type="radio"
              name="spacePurpose"
              value={key}
              checked={key === value}
              onChange={() => onChange(key)}
            />
            <span>
              <strong>{t(`options.${key}.title`)}</strong>
              <span>{t(`options.${key}.description`)}</span>
            </span>
          </label>
        ))}
      </fieldset>
    </div>
  );
}
