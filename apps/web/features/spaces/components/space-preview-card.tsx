"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { SpaceSymbol } from "./space-symbol";
import { BlankIcon, CheckIcon, LockIcon } from "./icons";
import { useToolLabel } from "../utils/tool-labels";
import type { SpacePurposeKey, SpaceTool } from "../types/space.types";

interface Props {
  icon: string;
  name: string;
  purpose: SpacePurposeKey;
  purposeLabel: string;
  tools: SpaceTool[];
  isLoadingTools: boolean;
}

export function SpacePreviewCard({
  icon,
  name,
  purpose,
  purposeLabel,
  tools,
  isLoadingTools,
}: Props) {
  const t = useTranslations("spaces.preview");
  const toolLabel = useToolLabel();
  const [selected, setSelected] = useState("notes");
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [day, setDay] = useState(15);
  const active = tools.find((tool) => tool.key === selected) ?? tools[0];
  const activeKey = active?.key ?? "notes";
  const isChecklist = activeKey === "tasks" || activeKey === "assignments";
  const isBoard = activeKey === "projects";
  const isCalendar = activeKey === "calendar";
  const sampleKey = `${purpose}.${activeKey}`;
  const displayName = name || t("nameFallback");

  return (
    <div className="setup-preview">
      <div className="setup-preview-caption">
        <span>{t("label")}</span>
        <span className="setup-live-dot">{t("live")}</span>
      </div>
      <div className="setup-workspace" data-ui aria-busy={isLoadingTools}>
        <header className="setup-workspace-header">
          <SpaceSymbol value={icon} />
          <span title={displayName}>{displayName}</span>
          <LockIcon />
        </header>
        <div className="setup-workspace-body">
          <nav className="setup-tool-nav" aria-label={t("toolsLabel")}>
            <span>{purposeLabel}</span>
            {tools.map((tool) => (
              <button
                type="button"
                key={tool.key}
                aria-pressed={activeKey === tool.key}
                onClick={() => setSelected(tool.key)}
              >
                {tool.key === "tasks" || tool.key === "assignments" ? (
                  <CheckIcon />
                ) : (
                  <BlankIcon />
                )}
                {toolLabel(tool.key, tool.label)}
              </button>
            ))}
          </nav>
          <div className="setup-document">
            {isLoadingTools ? (
              <div role="status" className="setup-preview-loading">
                {t("loading")}
              </div>
            ) : (
              <div key={sampleKey} className="setup-document-content">
                <div className="setup-document-art" aria-hidden="true">
                  <svg viewBox="0 0 320 112" fill="none">
                    <path
                      d="M56 56h208"
                      stroke="var(--setup-border)"
                      strokeWidth="2"
                    />
                    <g className="setup-art-leaf">
                      <rect
                        x="24"
                        y="20"
                        width="64"
                        height="72"
                        rx="6"
                        fill="var(--setup-blue-soft)"
                      />
                      <path
                        d="M42 40h28m-28 10h22m-22 10h28m-28 10h16"
                        stroke="var(--setup-accent)"
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
                    </g>
                    <g className="setup-art-leaf">
                      <rect
                        x="128"
                        y="20"
                        width="64"
                        height="72"
                        rx="6"
                        fill="var(--setup-surface)"
                      />
                      <path
                        d="m144 43 4 4 7-8m4 5h17m-32 19 4 4 7-8m4 5h17"
                        stroke="var(--setup-ink)"
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
                    </g>
                    <g className="setup-art-leaf">
                      <rect
                        x="232"
                        y="20"
                        width="64"
                        height="72"
                        rx="6"
                        fill="var(--setup-green-soft)"
                      />
                      <circle
                        cx="264"
                        cy="56"
                        r="16"
                        stroke="var(--setup-green)"
                        strokeWidth="2"
                      />
                      <path
                        d="m256 56 6 6 10-12"
                        stroke="var(--setup-green)"
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
                    </g>
                  </svg>
                </div>
                <p className="setup-example-label">{t("example")}</p>
                <h2>{t(`samples.${purpose}.title`)}</h2>
                {isChecklist ? (
                  <div className="setup-demo-tasks">
                    {[0, 1, 2].map((index) => {
                      const key = `${sampleKey}-${index}`;
                      return (
                        <label key={key}>
                          <input
                            type="checkbox"
                            checked={Boolean(checked[key])}
                            onChange={(event) =>
                              setChecked((prev) => ({
                                ...prev,
                                [key]: event.target.checked,
                              }))
                            }
                          />
                          <span>{t(`samples.${purpose}.task${index}`)}</span>
                        </label>
                      );
                    })}
                  </div>
                ) : isCalendar ? (
                  <div className="setup-demo-calendar">
                    <p>{t("calendarExample")}</p>
                    <div>
                      {[12, 13, 14, 15, 16, 17, 18].map((date) => (
                        <button
                          type="button"
                          key={date}
                          aria-pressed={day === date}
                          aria-label={t("selectDay", { day: date })}
                          onClick={() => setDay(date)}
                        >
                          {date}
                        </button>
                      ))}
                    </div>
                    <p>
                      {t("selectedDay", { day })} · {t("samples.study.task1")}
                    </p>
                  </div>
                ) : isBoard ? (
                  <div className="setup-demo-board">
                    {[0, 1].map((index) => (
                      <div key={index}>
                        <strong>
                          {t(index === 0 ? "toDo" : "inProgress")}
                        </strong>
                        <p>{t(`samples.work.task${index}`)}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <textarea
                    key={sampleKey}
                    aria-label={t("editExample")}
                    value={notes[sampleKey] ?? t(`samples.${purpose}.note`)}
                    onChange={(event) =>
                      setNotes((prev) => ({
                        ...prev,
                        [sampleKey]: event.target.value,
                      }))
                    }
                    spellCheck={false}
                  />
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      <p className="setup-preview-hint">{t("hint")}</p>
    </div>
  );
}
