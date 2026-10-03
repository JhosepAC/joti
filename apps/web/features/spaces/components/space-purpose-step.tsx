"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { PURPOSE_KEYS } from "../catalog";
import { CheckIcon, iconForPurpose } from "./icons";
import type { SpacePurposeKey } from "../types/space.types";

interface Props {
  value: SpacePurposeKey;
  onChange: (purpose: SpacePurposeKey) => void;
}

/**
 * Step 2 — purpose. Single choice, one option preselected.
 *
 * Built from native radio inputs rather than `role="radio"` buttons: the browser
 * then supplies the roving arrow-key behaviour and the selected-state semantics
 * for free, which a div/button grid has to reimplement (and usually gets wrong).
 * The input is visually hidden, not `display: none`, so it keeps focusability;
 * the label carries the presentation.
 */
export const SpacePurposeStep: React.FC<Props> = ({ value, onChange }) => {
  const t = useTranslations("spaces.purpose");
  // Static record (not a dynamic key lookup) so every title/description stays
  // type-checked against the dictionary.
  const copy: Record<SpacePurposeKey, { title: string; description: string }> = {
    personal: {
      title: t("options.personal.title"),
      description: t("options.personal.description"),
    },
    work: {
      title: t("options.work.title"),
      description: t("options.work.description"),
    },
    study: {
      title: t("options.study.title"),
      description: t("options.study.description"),
    },
    blank: {
      title: t("options.blank.title"),
      description: t("options.blank.description"),
    },
  };

  return (
    <div>
      <header className="mb-6">
        <h2 className="text-xl font-semibold text-text-primary font-heading">
          {t("title")}
        </h2>
        <p className="mt-1 text-sm font-light text-text-secondary">
          {t("subtitle")}
        </p>
      </header>

      <fieldset>
        <legend className="sr-only">{t("title")}</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {PURPOSE_KEYS.map((key) => {
            const selected = key === value;
            const Icon = iconForPurpose(key);
            const id = `space-purpose-${key}`;
            const option = copy[key];
            return (
              <label
                key={key}
                htmlFor={id}
                className={`relative flex cursor-pointer flex-col gap-3 rounded-2xl border bg-surface p-5 transition-all focus-within:ring-2 focus-within:ring-focus-ring ${
                  selected
                    ? "border-primary shadow-sm ring-1 ring-primary"
                    : "border-border hover:border-border-strong hover:shadow-sm"
                }`}
              >
                <input
                  id={id}
                  type="radio"
                  name="spacePurpose"
                  value={key}
                  checked={selected}
                  onChange={() => onChange(key)}
                  className="sr-only"
                />
                <span
                  aria-hidden="true"
                  className={`flex h-11 w-11 items-center justify-center rounded-2xl transition-colors ${
                    selected ? "bg-primary text-white" : "bg-background text-icon ring-1 ring-border"
                  }`}
                >
                  <Icon className="text-xl" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-text-primary">
                    {option.title}
                  </span>
                  <span className="mt-1 block text-xs font-light leading-relaxed text-text-secondary">
                    {option.description}
                  </span>
                </span>
                <span
                  aria-hidden="true"
                  className={`absolute top-4 right-4 flex h-5 w-5 items-center justify-center rounded-full border transition-colors ${
                    selected ? "border-primary bg-primary text-white" : "border-border-strong bg-background"
                  }`}
                >
                  {selected && <CheckIcon className="h-3 w-3" strokeWidth={3} />}
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>
    </div>
  );
};
