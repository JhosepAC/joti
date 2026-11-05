"use client";

import {
  BookOpen,
  CalendarDays,
  ClipboardList,
  FolderKanban,
  ListTodo,
  StickyNote,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { SpaceSymbol } from "./space-symbol";
import * as React from "react";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowLeftIcon, ArrowRightIcon, LogoutIcon, PlusIcon } from "./icons";
import { useToolLabel } from "../utils/tool-labels";
import type { SpaceTool } from "../types/space.types";

interface Props {
  tools: SpaceTool[];
  activeTool: string | null;
  onToolClick: (toolKey: string) => void;
  onCreateNew: (toolKey: string) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  spaceName: string;
  spaceIcon: string;
  onSignOut: () => void;
  signingOut: boolean;
}

const TOOL_ICONS: Partial<Record<string, LucideIcon>> = {
  notes: StickyNote,
  tasks: ListTodo,
  journal: BookOpen,
  projects: FolderKanban,
  meetings: UsersRound,
  assignments: ClipboardList,
  calendar: CalendarDays,
};

export const SpaceSidebar: React.FC<Props> = ({
  tools,
  activeTool,
  onToolClick,
  onCreateNew,
  collapsed,
  onToggleCollapse,
  spaceName,
  spaceIcon,
  onSignOut,
  signingOut,
}) => {
  const t = useTranslations("spaces.workspace");
  const tSidebar = useTranslations("spaces.workspace.sidebar");
  const toolLabel = useToolLabel();
  const [hoveredTool, setHoveredTool] = useState<string | null>(null);

  const getToolIcon = (key: string) => {
    const Icon = TOOL_ICONS[key] ?? TOOL_ICONS.notes!;
    return React.createElement(Icon, { className: "w-5 h-5 flex-shrink-0" });
  };

  return (
    <aside
      className={`fixed left-0 top-0 z-40 h-screen bg-surface border-r border-border transition-all duration-200 ${
        collapsed ? "w-16" : "w-64"
      }`}
      aria-label={t("sidebar.tools")}
    >
      {/* Space Header */}
      <div
        className={`flex items-center gap-3 p-4 border-b border-border transition-all duration-200 ${
          collapsed ? "justify-center" : ""
        }`}
      >
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-background text-xl ring-1 ring-border flex-shrink-0">
          <SpaceSymbol value={spaceIcon} />
        </span>
        {!collapsed && (
          <h1 className="truncate text-sm font-semibold text-text-primary font-heading">
            {spaceName}
          </h1>
        )}
      </div>

      {/* Tools List */}
      <nav
        className="flex-1 overflow-y-auto p-3"
        aria-label={t("sidebar.toolsNav")}
      >
        <ul className="space-y-1" role="list">
          {tools.map((tool) => {
            const isActive = activeTool === tool.key;
            const label = toolLabel(tool.key, tool.label);
            return (
              <li key={tool.key}>
                <button
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  aria-controls={`panel-${tool.key}`}
                  id={`tab-${tool.key}`}
                  onClick={() => onToolClick(tool.key)}
                  onMouseEnter={() => setHoveredTool(tool.key)}
                  onMouseLeave={() => setHoveredTool(null)}
                  className={`
                    w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150
                    ${
                      isActive
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-text-secondary hover:bg-background hover:text-text-primary"
                    }
                    ${collapsed ? "justify-center px-0" : ""}
                  `}
                  title={collapsed ? label : undefined}
                >
                  {getToolIcon(tool.key)}
                  {!collapsed && <span className="truncate">{label}</span>}
                  {!collapsed && hoveredTool === tool.key && !isActive && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onCreateNew(tool.key);
                      }}
                      className="ml-auto flex h-7 w-7 items-center justify-center rounded-lg text-text-muted hover:bg-background hover:text-text-primary transition-colors"
                      aria-label={t("content.createNew", { label })}
                    >
                      <PlusIcon className="w-4 h-4" />
                    </button>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Sign out + Collapse Toggle */}
      <div className="space-y-1 border-t border-border p-3">
        <button
          type="button"
          onClick={onSignOut}
          disabled={signingOut}
          className="w-full flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-text-secondary hover:bg-background hover:text-text-primary transition-colors disabled:opacity-50"
          aria-label={t("signOut")}
          title={collapsed ? t("signOut") : undefined}
        >
          <LogoutIcon className="w-5 h-5 flex-shrink-0" />
          {!collapsed && (
            <span>{signingOut ? t("signingOut") : t("signOut")}</span>
          )}
        </button>
        <button
          type="button"
          onClick={onToggleCollapse}
          className="w-full flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-text-secondary hover:bg-background hover:text-text-primary transition-colors"
          aria-label={
            collapsed ? tSidebar("expandBar") : tSidebar("collapseBar")
          }
          aria-expanded={!collapsed}
        >
          {collapsed ? (
            <ArrowRightIcon className="w-5 h-5" />
          ) : (
            <>
              <ArrowLeftIcon className="w-5 h-5 flex-shrink-0" />
              <span>{tSidebar("collapse")}</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
};
