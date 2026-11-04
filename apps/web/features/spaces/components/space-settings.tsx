"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  MediaPicker,
  uploadMedia,
} from "@/features/gallery/components/media-picker";
import { prepareSpaceIcon, readIconResponse } from "../utils/prepare-icon";
import { Modal } from "@/features/lists/components/overlays";
import { SPACE_ICON_CHOICES } from "../types/space.types";
import { LIST_ICONS } from "@/features/lists/components/list-icon";
import { SpaceColorPicker } from "./space-color-picker";
import { spaceTileStyle } from "../utils/space-colors";
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
  mode = "all",
}: {
  mode?: "all" | "name" | "icon";
  space: DashboardSpace;
  save: (input: {
    background?: string;
    name: string;
    description: string;
    icon?: string;
    modules: string[];
  }) => Promise<void>;
  onClose: () => void;
}) {
  const [media, setMedia] = useState(false),
    [picture, setPicture] = useState<File | null>(null),
    [background, setBackground] = useState(space.background ?? "");
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
            if (picture) {
              const key = await uploadMedia(space.slug, picture);
              const response = await fetch("/api/spaces/icon", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ slug: space.slug, key }),
              });
              if (!response.ok) throw new Error("upload failed");
            }
            await save({
              background,
              name,
              description,
              modules,
              ...(!picture && icon !== space.icon ? { icon } : {}),
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
        <label hidden={mode === "icon"}>
          {t("name")}
          <input
            required
            minLength={3}
            maxLength={50}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label hidden={mode !== "all"}>
          {t("description")}
          <textarea
            maxLength={280}
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        <fieldset hidden={mode === "name"}>
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
                style={spaceTileStyle(background)}
                onClick={() => {
                  setIcon(value);
                  setPicture(null);
                }}
              >
                <SpaceSymbol value={value} />
              </button>
            ))}
          </div>
          <button type="button" onClick={() => setMedia(true)}>
            {t("chooseImage")}
          </button>
          {picture && <p role="status">{picture.name}</p>}
          <label>
            {t("background")}
            <input
              value={background}
              placeholder="#d3e3fd"
              maxLength={7}
              pattern="#[a-fA-F0-9]{6}|"
              onChange={(e) => setBackground(e.target.value)}
            />
          </label>
          <SpaceColorPicker
            value={background}
            onChange={setBackground}
            disabled={busy}
          />
        </fieldset>
        <fieldset hidden={mode !== "all"}>
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
      {media && (
        <MediaPicker
          slug={space.slug}
          onClose={() => setMedia(false)}
          onSelect={async (url) => {
            setError(false);
            try {
              const response = await fetch(url, {
                signal: AbortSignal.timeout(15000),
              });
              setPicture(
                await prepareSpaceIcon(await readIconResponse(response)),
              );
              setMedia(false);
            } catch {
              setError(true);
            }
          }}
        />
      )}
    </Modal>
  );
}
