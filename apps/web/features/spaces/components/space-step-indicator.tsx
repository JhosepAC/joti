"use client";

import * as React from "react";
import { ArrowLeftIcon } from "./icons";

interface StepIndicatorProps {
  current: number;
  total: number;
  canGoBack: boolean;
  onBack: () => void;
}

/** "Paso n de N" with a progress bar, per the flow spec. */
export const SpaceStepIndicator: React.FC<StepIndicatorProps> = ({
  current,
  total,
  canGoBack,
  onBack,
}) => {
  const percent = Math.min(100, Math.max(0, (current / total) * 100));

  return (
    <div className="mb-7">
      <div className="flex items-center justify-between mb-2.5">
        <span className="text-xs font-medium text-text-secondary tracking-wide">
          Paso {current} de {total}
        </span>
        {canGoBack && (
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1 text-xs font-medium text-text-secondary hover:text-text-primary transition-colors"
          >
            <ArrowLeftIcon />
            Regresar
          </button>
        )}
      </div>
      <div
        className="h-1 w-full rounded-full bg-surface overflow-hidden"
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={total}
        aria-valuenow={current}
        aria-label={`Paso ${current} de ${total}`}
      >
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-300 ease-out"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
};
