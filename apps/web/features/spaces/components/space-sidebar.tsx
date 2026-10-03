"use client";

import * as React from "react";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowLeftIcon, ArrowRightIcon, LogoutIcon, PlusIcon } from "./icons";
import { LanguageSwitcher } from "@/i18n/LanguageSwitcher";
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

const TOOL_ICONS: Record<string, React.FC<React.SVGProps<SVGSVGElement>> | undefined> = {
  notes: ({ className, ...props }: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" width="1em" height="1em" className={className} {...props}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <line x1="10" y1="9" x2="8" y2="9" />
    </svg>
  ),
  tasks: ({ className, ...props }: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" width="1em" height="1em" className={className} {...props}>
      <line x1="9" y1="11" x2="15" y2="11" />
      <line x1="9" y1="7" x2="15" y2="7" />
      <path d="M5 7v10a2 2 0 0 0 2 2h10" />
      <polyline points="17 11 22 6 17 1" />
    </svg>
  ),
  journal: ({ className, ...props }: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" width="1em" height="1em" className={className} {...props}>
      <path d="M17 18H7a2 2 0 0 1-2-2V9.5" />
      <path d="M17 3a2.85 2.85 0 1 1 4 0" />
      <path d="M15 3v4" />
      <path d="M10 3v4" />
      <path d="M8 17h.01" />
      <path d="M8 13h.01" />
    </svg>
  ),
  projects: ({ className, ...props }: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" width="1em" height="1em" className={className} {...props}>
      <rect x="3" y="7.5" width="18" height="12.5" rx="2.5" />
      <path d="M9 7.5V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v1.5" />
      <path d="M3 12.5h18" />
    </svg>
  ),
  meetings: ({ className, ...props }: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" width="1em" height="1em" className={className} {...props}>
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
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" width="1em" height="1em" className={className} {...props}>
      <path d="M16 17H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v2" />
      <path d="M16 3v2" />
      <path d="M8 3v2" />
      <path d="M4 11h12" />
      <path d="M9 7h6" />
    </svg>
  ),
  calendar: ({ className, ...props }: React.SVGProps<SVGSVGElement>) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" width="1em" height="1em" className={className} {...props}>
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  ),
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
          {spaceIcon}
        </span>
        {!collapsed && (
          <h1 className="truncate text-sm font-semibold text-text-primary font-heading">
            {spaceName}
          </h1>
        )}
      </div>

      {/* Tools List */}
      <nav className="flex-1 overflow-y-auto p-3" aria-label={t("sidebar.toolsNav")}>
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
                    ${isActive
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
          {!collapsed && <span>{signingOut ? t("signingOut") : t("signOut")}</span>}
        </button>
        <button
          type="button"
          onClick={onToggleCollapse}
          className="w-full flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-text-secondary hover:bg-background hover:text-text-primary transition-colors"
          aria-label={collapsed ? tSidebar("expandBar") : tSidebar("collapseBar")}
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
        {!collapsed && (
          <div className="flex justify-center px-3 py-1">
            <LanguageSwitcher compact />
          </div>
        )}
      </div>
    </aside>
  );
};