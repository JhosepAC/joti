"use client";

import * as React from "react";
import { CheckIcon } from "./icons";

interface StepIndicatorProps {
  current: number;
  total: number;
}

const STEP_LABELS = ["Identidad", "Propósito", "Resumen"] as const;

/** Numbered steps with labels and connecting segments. */
export const SpaceStepIndicator: React.FC<StepIndicatorProps> = ({ current, total }) => {
  const steps = STEP_LABELS.slice(0, total);

  return (
    <nav aria-label="Progreso de la creación del espacio" className="mb-8">
      <ol className="flex items-start">
        {steps.map((label, index) => {
          const stepNumber = index + 1;
          const completed = stepNumber < current;
          const active = stepNumber === current;
          const isLast = stepNumber === total;
          return (
            <li
              key={label}
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
                  {label}
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
