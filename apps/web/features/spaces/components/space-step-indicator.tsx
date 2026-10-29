"use client";

import { useTranslations } from "next-intl";
import { CheckIcon } from "./icons";

const KEYS = ["identity", "purpose", "review"] as const;
export function SpaceStepIndicator({
  current,
  total,
  onSelect,
  disabled,
}: {
  current: number;
  total: number;
  onSelect: (step: number) => void;
  disabled: boolean;
}) {
  const t = useTranslations("spaces.steps");
  return (
    <nav className="setup-progress" aria-label={t("navLabel")}>
      <span className="sr-only">{t("progress", { current, total })}</span>
      <ol>
        {KEYS.slice(0, total).map((key, index) => (
          <li
            key={key}
            data-state={
              index + 1 === current
                ? "current"
                : index + 1 < current
                  ? "done"
                  : "next"
            }
          >
            <button
              type="button"
              aria-current={index + 1 === current ? "step" : undefined}
              disabled={disabled || index + 1 > current}
              onClick={() => onSelect(index + 1)}
            >
              <span className="setup-progress-mark" aria-hidden="true">
                {index + 1 < current ? <CheckIcon /> : index + 1}
              </span>
              <span>{t(key)}</span>
            </button>
          </li>
        ))}
      </ol>
    </nav>
  );
}
