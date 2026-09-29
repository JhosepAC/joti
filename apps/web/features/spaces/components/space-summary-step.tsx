"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { LayersIcon, LockIcon, RocketIcon } from "./icons";
import { purposeTitle } from "../catalog";
import type { SpaceDraft, SpaceTool } from "../types/space.types";

interface Props {
  draft: SpaceDraft;
  tools: SpaceTool[];
  isLoadingTools: boolean;
  isCreating: boolean;
  onSubmit: () => void;
}

/** Step 3 — review and confirm. */
export const SpaceSummaryStep: React.FC<Props> = ({
  draft,
  tools,
  isLoadingTools,
  isCreating,
  onSubmit,
}) => {
  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-2xl font-semibold text-text-primary font-heading">
          Resumen del espacio
        </h2>
        <p className="text-sm font-light text-text-secondary mt-1.5">
          Revisa antes de crear. Podrás cambiarlo todo más adelante.
        </p>
      </header>

      <div className="rounded-3xl border border-border bg-surface p-5">
        <div className="flex items-center gap-4">
          <span
            aria-hidden="true"
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-background text-3xl ring-1 ring-border"
          >
            {draft.icon}
          </span>
          <div className="min-w-0">
            <p className="truncate text-lg font-semibold text-text-primary font-heading">
              {draft.name.trim()}
            </p>
            <p className="text-xs font-light text-text-secondary">
              {purposeTitle(draft.purpose)}
            </p>
          </div>
        </div>

        <div className="mt-5 border-t border-border pt-4">
          <p className="mb-2.5 flex items-center gap-1.5 text-xs font-medium text-text-primary">
            <LayersIcon className="text-sm text-icon" />
            Herramientas habilitadas
          </p>
          {isLoadingTools ? (
            <div className="flex flex-wrap gap-1.5" aria-hidden="true">
              <span className="h-6 w-20 animate-pulse rounded-full bg-background" />
              <span className="h-6 w-24 animate-pulse rounded-full bg-background" />
              <span className="h-6 w-16 animate-pulse rounded-full bg-background" />
            </div>
          ) : (
            <ul className="flex flex-wrap gap-1.5">
              {tools.map((tool) => (
                <li
                  key={tool.key}
                  className="rounded-full border border-border bg-background px-2.5 py-1 text-[0.7rem] text-text-secondary"
                >
                  {tool.label}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mt-4 flex items-center gap-1.5 border-t border-border pt-4 text-[0.7rem] text-text-muted">
          <LockIcon className="text-xs" />
          Espacio privado
        </div>
      </div>

      {/* `disabled` rather than `isLoading`: the overlay carries the progress
          narration, and this only has to stop a second click. */}
      <div className="flex justify-end">
        <Button
          type="button"
          variant="primary"
          className="h-12 gap-2 rounded-full px-7"
          disabled={isCreating}
          onClick={onSubmit}
        >
          <RocketIcon className="text-base" />
          Crear mi espacio
        </Button>
      </div>
    </div>
  );
};
