"use client";

import * as React from "react";

interface StepIndicatorProps {
  current: number;
  total: number;
  onBack?: () => void;
  canGoBack: boolean;
}

export const StepIndicator: React.FC<StepIndicatorProps> = ({ current, total, onBack, canGoBack }) => {
  return (
    <div className="flex items-center justify-between mb-6">
      <div className="text-xs font-medium text-text-secondary tracking-wide">
        Step {current} of {total}
      </div>
      {canGoBack && onBack && (
        <button
          type="button"
          onClick={onBack}
          className="text-xs font-medium text-text-secondary hover:text-text-primary transition-colors"
        >
          ← Back
        </button>
      )}
    </div>
  );
};
