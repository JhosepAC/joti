"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { PlusIcon, SearchIcon, FilterIcon, MoreHorizontalIcon } from "./icons";
import { useToolLabel } from "../utils/tool-labels";
import type { SpaceTool } from "../types/space.types";

interface Props {
  activeTool: SpaceTool | null;
  tools: SpaceTool[];
  onCreateNew: (toolKey: string) => void;
}

type EmptyStateIcon = (props: React.SVGProps<SVGSVGElement>) => React.ReactNode;

const EMPTY_STATE_ICONS: Record<string, EmptyStateIcon> = {
  notes: ({ className, ...props }: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" width="1em" height="1em" className={className} {...props}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <line x1="10" y1="9" x2="8" y2="9" />
    </svg>
  ),
  tasks: ({ className, ...props }: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" width="1em" height="1em" className={className} {...props}>
      <line x1="9" y1="11" x2="15" y2="11" />
      <line x1="9" y1="7" x2="15" y2="7" />
      <path d="M5 7v10a2 2 0 0 0 2 2h10" />
      <polyline points="17 11 22 6 17 1" />
    </svg>
  ),
  journal: ({ className, ...props }: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" width="1em" height="1em" className={className} {...props}>
      <path d="M17 18H7a2 2 0 0 1-2-2V9.5" />
      <path d="M17 3a2.85 2.85 0 1 1 4 0" />
      <path d="M15 3v4" />
      <path d="M10 3v4" />
      <path d="M8 17h.01" />
      <path d="M8 13h.01" />
    </svg>
  ),
  projects: ({ className, ...props }: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" width="1em" height="1em" className={className} {...props}>
      <rect x="3" y="7.5" width="18" height="12.5" rx="2.5" />
      <path d="M9 7.5V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v1.5" />
      <path d="M3 12.5h18" />
    </svg>
  ),
  meetings: ({ className, ...props }: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" width="1em" height="1em" className={className} {...props}>
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
      <path d="M8 14h.01" />
      <path d="M12 14h.01" />
      <path d="M16 14h.01" />
    </svg>
  ),
  assignments: ({ className, ...props }: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" width="1em" height="1em" className={className} {...props}>
      <path d="M16 17H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v2" />
      <path d="M16 3v2" />
      <path d="M8 3v2" />
      <path d="M4 11h12" />
      <path d="M9 7h6" />
    </svg>
  ),
  calendar: ({ className, ...props }: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" width="1em" height="1em" className={className} {...props}>
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  ),
};

const GENERIC_EMPTY_ICON: EmptyStateIcon = ({ className, ...props }: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className={className} {...props}>
    <circle cx="12" cy="12" r="10" />
    <path d="M12 8v4l3 3" />
  </svg>
);

export const SpaceContent: React.FC<Props> = ({ activeTool, tools, onCreateNew }) => {
  const t = useTranslations("spaces.workspace.content");
  const toolLabel = useToolLabel();
  // Static records (not dynamic key lookups) so every string stays type-checked.
  // Unknown tool keys fall back to the server label with generic copy.
  const emptyCopy: Record<string, { title: string; description: string }> = {
    notes: { title: t("tools.notes.title"), description: t("tools.notes.description") },
    tasks: { title: t("tools.tasks.title"), description: t("tools.tasks.description") },
    journal: { title: t("tools.journal.title"), description: t("tools.journal.description") },
    projects: { title: t("tools.projects.title"), description: t("tools.projects.description") },
    meetings: { title: t("tools.meetings.title"), description: t("tools.meetings.description") },
    assignments: {
      title: t("tools.assignments.title"),
      description: t("tools.assignments.description"),
    },
    calendar: { title: t("tools.calendar.title"), description: t("tools.calendar.description") },
  };

  if (!activeTool) {
    const firstTool = tools[0];
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] text-center px-6">
        <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-surface border border-border flex items-center justify-center">
          {firstTool ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-10 h-10 text-text-muted" aria-hidden="true">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 8v4l3 3" />
            </svg>
          ) : (
            <PlusIcon className="w-10 h-10 text-text-muted" />
          )}
        </div>
        <h2 className="text-xl font-semibold text-text-primary font-heading">
          {t("selectTool")}
        </h2>
        <p className="mt-2 max-w-sm text-sm font-light text-text-secondary">
          {t("selectToolHint")}
        </p>
      </div>
    );
  }

  const label = toolLabel(activeTool.key, activeTool.label);
  const known = emptyCopy[activeTool.key];
  const emptyState = {
    title: known?.title ?? t("emptyFallbackTitle", { label }),
    description: known?.description ?? t("emptyFallbackDescription", { label }),
    icon: EMPTY_STATE_ICONS[activeTool.key] ?? GENERIC_EMPTY_ICON,
  };

  return (
    <div className="flex flex-col h-full">
      {/* Tool Header */}
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-6 border-b border-border bg-background/50 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            {emptyState.icon({ className: "w-5 h-5" })}
          </div>
          <div>
            <h2 className="text-lg font-semibold text-text-primary font-heading">{label}</h2>
            <p className="text-xs font-light text-text-secondary">
              {tools.length > 1 && t("position", { current: tools.findIndex(t => t.key === activeTool.key) + 1, total: tools.length })}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface border border-border text-text-secondary hover:bg-background hover:text-text-primary transition-colors"
            aria-label={t("search")}
          >
            <SearchIcon className="w-4 h-4" />
          </button>
          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface border border-border text-text-secondary hover:bg-background hover:text-text-primary transition-colors"
            aria-label={t("filter")}
          >
            <FilterIcon className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => onCreateNew(activeTool.key)}
            className="flex h-9 items-center gap-2 rounded-full bg-primary px-4 text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-colors"
            aria-label={t("createNew", { label })}
          >
            <PlusIcon className="w-4 h-4" />
            <span>{t("new")}</span>
          </button>
        </div>
      </header>

      {/* Content Area */}
      <main className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto w-full max-w-4xl">
          {/* Empty State */}
          <div className="flex flex-col items-center justify-center min-h-[calc(100vh-320px)] text-center px-4">
            <div className="w-24 h-24 mx-auto mb-6 rounded-2xl bg-surface border border-border flex items-center justify-center">
              {emptyState.icon({ className: "w-12 h-12 text-text-muted" })}
            </div>
            <h3 className="text-lg font-semibold text-text-primary font-heading">{emptyState.title}</h3>
            <p className="mx-auto mt-2 max-w-sm text-sm font-light text-text-secondary">{emptyState.description}</p>
            <button
              type="button"
              onClick={() => onCreateNew(activeTool.key)}
              className="mt-6 flex h-10 items-center gap-2 rounded-full bg-primary px-5 text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-colors"
            >
              <PlusIcon className="w-4 h-4" />
              <span>{t("create", { label })}</span>
            </button>
          </div>

          {/* Placeholder for future list view */}
          <div className="mt-12 border-t border-border pt-8" aria-hidden="true">
            <p className="text-center text-xs text-text-muted">
              {t("listPlaceholder")}
            </p>
          </div>
        </div>
      </main>
    </div>
  );
};
