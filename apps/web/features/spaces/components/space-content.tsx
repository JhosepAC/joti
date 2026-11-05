"use client";

import {
  BookOpen,
  CalendarDays,
  ClipboardList,
  FileText,
  FolderKanban,
  ListTodo,
  Lock,
  StickyNote,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
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

const EMPTY_STATE_ICONS: Partial<Record<string, LucideIcon>> = {
  notes: StickyNote,
  tasks: ListTodo,
  journal: BookOpen,
  projects: FolderKanban,
  meetings: UsersRound,
  assignments: ClipboardList,
  calendar: CalendarDays,
};

export const SpaceContent: React.FC<Props> = ({
  activeTool,
  tools,
  onCreateNew,
}) => {
  const t = useTranslations("spaces.workspace.content");
  const toolLabel = useToolLabel();
  // Static records (not dynamic key lookups) so every string stays type-checked.
  // Unknown tool keys fall back to the server label with generic copy.
  const emptyCopy: Record<string, { title: string; description: string }> = {
    notes: {
      title: t("tools.notes.title"),
      description: t("tools.notes.description"),
    },
    tasks: {
      title: t("tools.tasks.title"),
      description: t("tools.tasks.description"),
    },
    journal: {
      title: t("tools.journal.title"),
      description: t("tools.journal.description"),
    },
    projects: {
      title: t("tools.projects.title"),
      description: t("tools.projects.description"),
    },
    meetings: {
      title: t("tools.meetings.title"),
      description: t("tools.meetings.description"),
    },
    assignments: {
      title: t("tools.assignments.title"),
      description: t("tools.assignments.description"),
    },
    calendar: {
      title: t("tools.calendar.title"),
      description: t("tools.calendar.description"),
    },
  };

  if (!activeTool) {
    const firstTool = tools[0];
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] text-center px-6">
        <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-surface border border-border flex items-center justify-center">
          {firstTool ? (
            <Lock
              className="w-10 h-10 text-text-muted"
              strokeWidth={1.7}
              aria-hidden="true"
            />
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
    icon: EMPTY_STATE_ICONS[activeTool.key] ?? FileText,
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
            <h2 className="text-lg font-semibold text-text-primary font-heading">
              {label}
            </h2>
            <p className="text-xs font-light text-text-secondary">
              {tools.length > 1 &&
                t("position", {
                  current: tools.findIndex((t) => t.key === activeTool.key) + 1,
                  total: tools.length,
                })}
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
            <h3 className="text-lg font-semibold text-text-primary font-heading">
              {emptyState.title}
            </h3>
            <p className="mx-auto mt-2 max-w-sm text-sm font-light text-text-secondary">
              {emptyState.description}
            </p>
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
