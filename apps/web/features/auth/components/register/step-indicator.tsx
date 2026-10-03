"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

interface StepIndicatorProps {
  current: number;
  total: number;
  onBack?: () => void;
  canGoBack: boolean;
}

export const StepIndicator: React.FC<StepIndicatorProps> = ({ current, total, onBack, canGoBack }) => {
  const t = useTranslations("auth.register");
  return (
    <div className="flex items-center justify-between mb-6">
      <div className="text-xs font-medium text-text-secondary tracking-wide">
        {t("step", { current, total })}
      </div>
      {canGoBack && onBack && (
        <button
          type="button"
          onClick={onBack}
          className="text-xs font-medium text-text-secondary hover:text-text-primary transition-colors"
        >
          {t("back")}
        </button>
      )}
    </div>
  );
};
