"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { CheckIcon } from "./icons";

interface StepIndicatorProps {
  current: number;
  total: number;
}

const STEP_KEYS = ["identity", "purpose", "review"] as const;

/** Numbered steps with labels and connecting segments. */
export const SpaceStepIndicator: React.FC<StepIndicatorProps> = ({ current, total }) => {
  const t = useTranslations("spaces.steps");
  // Static record (not a dynamic key lookup) so every label stays type-checked.
  const labels: Record<(typeof STEP_KEYS)[number], string> = {
    identity: t("identity"),
    purpose: t("purpose"),
    review: t("review"),
  };
  const steps = STEP_KEYS.slice(0, total);

  return (
    <nav aria-label={t("navLabel")} className="mb-8">
      <p className="sr-only">{t("progress", { current, total })}</p>
      <ol className="flex items-start">
        {steps.map((key, index) => {
          const stepNumber = index + 1;
          const completed = stepNumber < current;
          const active = stepNumber === current;
          const isLast = stepNumber === total;
          return (
            <li
              key={key}
              aria-current={active ? "step" : undefined}
              className={`flex items-start ${isLast ? "" : "flex-1"}`}
            >
              <div className="flex flex-col items-center gap-2">
                <span
                  aria-hidden="true"
                  className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-medium transition-colors ${
                    completed
                      ? "bg-primary text-white"
                      : active
                        ? "bg-primary text-white ring-4 ring-focus-ring"
                        : "border border-border-strong bg-background text-text-muted"
                  }`}
                >
                  {completed ? (
                    <CheckIcon className="h-4 w-4" strokeWidth={2.5} />
                  ) : (
                    stepNumber
                  )}
                </span>
                <span
                  className={`whitespace-nowrap text-xs ${
                    active || completed
                      ? "font-medium text-text-primary"
                      : "font-light text-text-muted"
                  }`}
                >
                  {labels[key]}
                </span>
              </div>
              {!isLast && (
                <span
                  aria-hidden="true"
                  className={`mx-3 mt-[18px] h-0.5 flex-1 rounded-full transition-colors ${
                    stepNumber < current ? "bg-primary" : "bg-border"
                  }`}
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
};
