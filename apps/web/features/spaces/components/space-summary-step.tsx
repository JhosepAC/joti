"use client";

import { useTranslations } from "next-intl";
import { SpaceSymbol } from "./space-symbol";
import { LockIcon } from "./icons";
import { useToolLabel } from "../utils/tool-labels";
import type { SpaceDraft, SpaceTool } from "../types/space.types";

export function SpaceSummaryStep({
  draft,
  purposeLabel,
  tools,
  onEdit,
}: {
  draft: SpaceDraft;
  purposeLabel: string;
  tools: SpaceTool[];
  onEdit: (step: number) => void;
}) {
  const t = useTranslations("spaces.summary");
  const toolLabel = useToolLabel();
  return (
    <div className="setup-step-content">
      <header className="setup-title">
        <h1 tabIndex={-1}>{t("title")}</h1>
        <p>{t("subtitle")}</p>
      </header>
      <dl className="setup-review">
        <div>
          <dt>{t("name")}</dt>
          <dd>
            <span className="setup-review-name">
              <SpaceSymbol value={draft.icon} />
              {draft.name.trim()}
            </span>
            <button
              type="button"
              onClick={() => onEdit(1)}
              aria-label={t("editName")}
            >
              {t("edit")}
            </button>
          </dd>
        </div>
        <div>
          <dt>{t("purpose")}</dt>
          <dd>
            <span>{purposeLabel}</span>
            <button
              type="button"
              onClick={() => onEdit(2)}
              aria-label={t("editPurpose")}
            >
              {t("edit")}
            </button>
          </dd>
        </div>
        <div>
          <dt>{t("tools")}</dt>
          <dd>
            <span>
              {tools.map((tool) => toolLabel(tool.key, tool.label)).join(" · ")}
            </span>
          </dd>
        </div>
      </dl>
      <p className="setup-privacy">
        <LockIcon />
        {t("privacy")}
      </p>
    </div>
  );
}
