"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Modal } from "@/features/lists/components/overlays";
import { SPACE_ICON_CHOICES } from "../types/space.types";
import { LIST_ICONS } from "@/features/lists/components/list-icon";
import { SpaceSymbol } from "./space-symbol";
import type { DashboardSpace } from "../types/dashboard.types";
export const SPACE_MODULES = [
  "pages",
  "lists",
  "calendar",
  "notes",
  "gallery",
] as const;
export function SpaceSettings({
  space,
  save,
  onClose,
}: {
  space: DashboardSpace;
  save: (input: {
    name: string;
    description: string;
    icon?: string;
    modules: string[];
  }) => Promise<void>;
  onClose: () => void;
}) {
  const t = useTranslations("spaceSettings");
  const [name, setName] = useState(space.name),
    [description, setDescription] = useState(space.description ?? ""),
    [icon, setIcon] = useState(space.icon),
    [modules, setModules] = useState(space.modules ?? []),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(false);
  return (
    <Modal
      label={t("title")}
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <form
        className="space-settings-form"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError(false);
          try {
            await save({
              name,
              description,
              modules,
              ...(icon !== space.icon ? { icon } : {}),
            });
            onClose();
          } catch {
            setError(true);
          } finally {
            setBusy(false);
          }
        }}
      >
        <h2>{t("title")}</h2>
        <label>
          {t("name")}
          <input
            required
            minLength={3}
            maxLength={50}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label>
          {t("description")}
          <textarea
            maxLength={280}
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        <fieldset>
          <legend>{t("icon")}</legend>
          <div className="space-settings-icons">
            {[
              ...SPACE_ICON_CHOICES,
              ...LIST_ICONS.map((key) => `symbol:${key}`),
            ].map((value) => (
              <button
                type="button"
                key={value}
                aria-label={value}
                aria-pressed={value === icon}
                onClick={() => setIcon(value)}
              >
                <SpaceSymbol value={value} />
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend>{t("modules")}</legend>
          <p>{t("preserve")}</p>
          {SPACE_MODULES.map((key) => (
            <label className="space-module-toggle" key={key}>
              <span>
                <strong>{t(key)}</strong>
                <small>{t(`${key}Hint`)}</small>
              </span>
              <input
                type="checkbox"
                checked={modules.includes(key)}
                onChange={(e) =>
                  setModules(
                    e.target.checked
                      ? [...modules, key]
                      : modules.filter((m) => m !== key),
                  )
                }
              />
            </label>
          ))}
        </fieldset>
        {error && <p role="alert">{t("error")}</p>}
        <footer>
          <button type="button" disabled={busy} onClick={onClose}>
            {t("cancel")}
          </button>
          <button
            className="workspace-primary"
            disabled={busy || name.trim().length < 3}
          >
            {t(busy ? "saving" : "save")}
          </button>
        </footer>
      </form>
    </Modal>
  );
}
