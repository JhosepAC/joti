"use client";

import * as React from "react";
import { PURPOSE_OPTIONS } from "../catalog";
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
  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-2xl font-semibold text-text-primary font-heading">
          Propósito del espacio
        </h2>
        <p className="text-sm font-light text-text-secondary mt-1.5">
          Elige para qué lo vas a usar. Esto define la plantilla inicial.
        </p>
      </header>

      <fieldset>
        <legend className="sr-only">Propósito del espacio</legend>
        <div className="space-y-3">
          {PURPOSE_OPTIONS.map((option) => {
            const selected = option.key === value;
            const Icon = iconForPurpose(option.key);
            const id = `space-purpose-${option.key}`;
            return (
              <label
                key={option.key}
                htmlFor={id}
                className={`flex cursor-pointer items-start gap-3.5 rounded-2xl border p-4 transition-all ${
                  selected
                    ? "border-primary bg-surface"
                    : "border-border bg-background hover:border-border-strong hover:bg-surface"
                }`}
              >
                <input
                  id={id}
                  type="radio"
                  name="spacePurpose"
                  value={option.key}
                  checked={selected}
                  onChange={() => onChange(option.key)}
                  className="sr-only"
                />
                <span
                  aria-hidden="true"
                  className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                    selected ? "bg-primary text-white" : "bg-surface text-icon"
                  }`}
                >
                  <Icon className="text-lg" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-text-primary">
                    {option.title}
                  </span>
                  <span className="mt-1 block text-xs font-light leading-relaxed text-text-secondary">
                    {option.description}
                  </span>
                </span>
                <span
                  aria-hidden="true"
                  className={`mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                    selected ? "border-primary bg-primary text-white" : "border-border-strong"
                  }`}
                >
                  {selected && <CheckIcon className="h-2.5 w-2.5" strokeWidth={3} />}
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>
    </div>
  );
};
