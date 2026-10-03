"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { LayersIcon, RocketIcon } from "./icons";
import type { SpaceDraft, SpacePurposeKey, SpaceTool } from "../types/space.types";
import { useToolLabel } from "../utils/tool-labels";

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
  const t = useTranslations("spaces.summary");
  const tPurpose = useTranslations("spaces.purpose.options");
  const toolLabel = useToolLabel();
  // Static record (not a dynamic key lookup) so the title stays type-checked.
  const purposeTitles: Record<SpacePurposeKey, string> = {
    personal: tPurpose("personal.title"),
    work: tPurpose("work.title"),
    study: tPurpose("study.title"),
    blank: tPurpose("blank.title"),
  };
  // Server labels stay as fallback for tool keys this client does not know.
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

      {/* Space preview */}
      <div className="rounded-2xl border border-border bg-surface p-5">
        <div className="flex items-center gap-4">
          <span
            aria-hidden="true"
            className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-border bg-background text-4xl shadow-sm"
          >
            {draft.icon}
          </span>
          <div className="min-w-0">
            <p className="truncate text-lg font-semibold text-text-primary font-heading">
              {draft.name.trim()}
            </p>
            <p className="mt-1 inline-flex items-center rounded-full bg-background px-2.5 py-1 text-[0.7rem] font-medium text-text-secondary ring-1 ring-border">
              {purposeTitles[draft.purpose]}
            </p>
          </div>
        </div>
      </div>

      <div aria-hidden="true" className="my-6 border-t border-border" />

      {/* Enabled tools */}
      <div className="rounded-2xl border border-border bg-surface p-5">
        <p className="flex items-center gap-2 text-sm font-medium text-text-primary">
          <span aria-hidden="true" className="flex h-8 w-8 items-center justify-center rounded-xl bg-background text-icon ring-1 ring-border">
            <LayersIcon className="text-base" />
          </span>
          {t("tools")}
          {!isLoadingTools && (
            <span className="ml-auto rounded-full bg-background px-2.5 py-0.5 text-[0.7rem] font-medium text-text-secondary tabular-nums ring-1 ring-border">
              {tools.length}
            </span>
          )}
        </p>
        {isLoadingTools ? (
          <div className="mt-4 flex flex-wrap gap-1.5" aria-hidden="true">
            <span className="h-6 w-20 animate-pulse rounded-full bg-background" />
            <span className="h-6 w-24 animate-pulse rounded-full bg-background" />
            <span className="h-6 w-16 animate-pulse rounded-full bg-background" />
          </div>
        ) : (
          <ul className="mt-4 flex flex-wrap gap-1.5">
            {tools.map((tool) => (
              <li
                key={tool.key}
                className="rounded-full border border-border bg-background px-3 py-1.5 text-xs font-light text-text-secondary"
              >
                {toolLabel(tool.key, tool.label)}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* `disabled` rather than `isLoading`: the overlay carries the progress
          narration, and this only has to stop a second click. */}
      <div className="mt-8 border-t border-border pt-6">
        <Button
          type="button"
          variant="primary"
          className="group h-12 w-full gap-2 rounded-full text-sm"
          disabled={isCreating}
          onClick={onSubmit}
        >
          <span className="inline-flex transition-transform duration-300 ease-out group-hover:-translate-y-1 group-hover:translate-x-0.5">
            <span className="animate-rocket inline-flex">
              <RocketIcon className="text-xl" strokeWidth={2} />
            </span>
          </span>
          {t("submit")}
        </Button>
      </div>
    </div>
  );
};
