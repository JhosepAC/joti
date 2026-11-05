"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { clearGrants } from "@/features/auth/utils/claim-store";
import {
  MediaPicker,
  uploadMedia,
} from "@/features/gallery/components/media-picker";
import { ListGlyph, ListIcon } from "@/features/lists/components/list-icon";
import { Modal, Popover } from "@/features/lists/components/overlays";
import { prepareSpaceIcon, readIconResponse } from "../utils/prepare-icon";
import { spaceTileStyle } from "../utils/space-colors";
import { SpaceColorPicker } from "./space-color-picker";
import {
  SpaceSymbol,
  normalizeWorkspaceIcon,
  workspaceIconChoices,
} from "./space-symbol";
import { LayersIcon, PencilIcon } from "./icons";
import type { DashboardSpace } from "../types/dashboard.types";

const moduleIcons = {
  pages: "book",
  lists: "table",
  calendar: "calendar",
  notes: "pin",
  gallery: "basket",
} as const;
export const SPACE_MODULES = [
  "pages",
  "lists",
  "calendar",
  "notes",
  "gallery",
] as const;

const sections = ["design", "tools", "management"] as const;
type Section = (typeof sections)[number];

export function SpaceSettings({
  space,
  activeSlug = space.slug,
  save,
  onClose,
  mode = "all",
  initialSection = "design",
}: {
  mode?: "all" | "name" | "icon";
  initialSection?: Section;
  activeSlug?: string;
  space: DashboardSpace;
  save: (input: {
    background?: string;
    iconColor?: string;
    name?: string;
    description?: string;
    icon?: string;
    modules?: string[];
  }) => Promise<void>;
  onClose: () => void;
}) {
  const t = useTranslations("spaceSettings");
  const iconLabel = useTranslations("spaceIcons");
  const [section, setSection] = useState<Section>(initialSection);
  const [media, setMedia] = useState(false);
  const [picture, setPicture] = useState<{ file: File; url: string } | null>(
    null,
  );
  const [background, setBackground] = useState(space.background ?? "");
  const [iconColor, setIconColor] = useState(space.iconColor ?? "");
  const [name, setName] = useState(space.name);
  const [description, setDescription] = useState(space.description ?? "");
  const [icon, setIcon] = useState(space.icon);
  const [modules, setModules] = useState(space.modules ?? []);
  const [busy, setBusy] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [error, setError] = useState<"error" | "imageError" | "deleteError">();
  const [picker, setPicker] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const iconButton = useRef<HTMLButtonElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const upload = useRef<{ file: File; key: string; ready: boolean } | null>(
    null,
  );

  useEffect(() => {
    if (picture) return () => URL.revokeObjectURL(picture.url);
  }, [picture]);

  const modulesChanged = SPACE_MODULES.some(
    (key) => modules.includes(key) !== Boolean(space.modules?.includes(key)),
  );
  const changes = {
    ...(name.trim() !== space.name ? { name: name.trim() } : {}),
    ...(description.trim() !== (space.description ?? "")
      ? { description: description.trim() }
      : {}),
    ...(background !== (space.background ?? "") ? { background } : {}),
    ...(iconColor !== (space.iconColor ?? "") ? { iconColor } : {}),
    ...(modulesChanged ? { modules } : {}),
    ...(!picture && icon !== space.icon ? { icon } : {}),
  };
  const dirty = Boolean(picture) || Object.keys(changes).length > 0;
  const tile = spaceTileStyle(background, iconColor);
  const closePicker = () => {
    setPicker(false);
    iconButton.current?.focus();
  };
  const setImage = async (file: File) => {
    const prepared = await prepareSpaceIcon(file);
    setPicture({ file: prepared, url: URL.createObjectURL(prepared) });
    setError(undefined);
  };
  const title =
    mode === "name" ? t("name") : mode === "icon" ? t("editIcon") : t("title");

  async function saveChanges() {
    setBusy(true);
    setError(undefined);
    try {
      if (picture) {
        if (upload.current?.file !== picture.file) {
          upload.current = {
            file: picture.file,
            key: crypto.randomUUID(),
            ready: false,
          };
        }
        if (!upload.current.ready) {
          upload.current.key = await uploadMedia(
            space.slug,
            picture.file,
            upload.current.key,
          );
          upload.current.ready = true;
        }
        await save({
          ...changes,
          icon: `media:${space.slug}:${upload.current.key}`,
        });
      } else {
        await save(changes);
      }
      onClose();
    } catch {
      setError("error");
    } finally {
      setBusy(false);
    }
  }

  async function deleteSpace() {
    setBusy(true);
    setError(undefined);
    try {
      const response = await fetch(
        `/api/workspace?slug=${encodeURIComponent(space.slug)}`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: confirmation }),
        },
      );
      if (!response.ok) throw new Error("Delete failed");
      const { nextSlug } = await response.json();
      if (activeSlug !== space.slug) window.location.reload();
      else {
        if (!nextSlug) clearGrants();
        window.location.replace(
          nextSlug ? `/w/${encodeURIComponent(nextSlug)}` : "/spaces/new",
        );
      }
    } catch {
      setError("deleteError");
      setBusy(false);
    }
  }

  return (
    <Modal
      className="space-settings-dialog"
      label={title}
      onClose={() => !busy && !preparing && onClose()}
    >
      <form
        className="space-settings-form"
        data-compact={mode !== "all"}
        onSubmit={(event) => {
          event.preventDefault();
          if (dirty && !busy && !preparing && name.trim().length >= 3)
            void saveChanges();
        }}
      >
        <header className="space-settings-header">
          <div>
            <h2>{title}</h2>
            <p>{space.name}</p>
          </div>
          <button
            type="button"
            aria-label={t("close")}
            disabled={busy || preparing}
            onClick={onClose}
          >
            <ListGlyph name="close" />
          </button>
        </header>
        <div className="space-settings-body">
          {mode === "all" && (
            <nav className="space-settings-nav" aria-label={title}>
              {sections.map((key) => (
                <button
                  type="button"
                  key={key}
                  aria-current={section === key ? "true" : undefined}
                  disabled={busy || preparing}
                  onClick={() => {
                    setPicker(false);
                    setSection(key);
                  }}
                >
                  {key === "design" ? (
                    <PencilIcon />
                  ) : key === "tools" ? (
                    <LayersIcon />
                  ) : (
                    <ListIcon name="briefcase" />
                  )}
                  {t(key)}
                </button>
              ))}
            </nav>
          )}
          <div className="space-settings-panel">
            {section === "design" && (
              <section className="space-settings-design">
                {mode === "all" && <h3>{t("design")}</h3>}
                {mode !== "name" && (
                  <div className="space-settings-preview">
                    <button
                      ref={iconButton}
                      type="button"
                      className="space-create-icon-trigger"
                      style={tile}
                      aria-label={t("editIcon")}
                      aria-haspopup="dialog"
                      aria-expanded={picker}
                      disabled={busy || preparing}
                      onClick={() => setPicker((open) => !open)}
                    >
                      {picture ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={picture.url} alt="" />
                      ) : (
                        <SpaceSymbol value={icon} />
                      )}
                      <span className="space-create-icon-edit">
                        <ListGlyph name="edit" />
                      </span>
                    </button>
                    <div>
                      <strong>{name.trim() || space.name}</strong>
                      <button
                        type="button"
                        className="space-settings-text-button"
                        disabled={busy || preparing}
                        onClick={() => setPicker((open) => !open)}
                      >
                        {t("editIcon")}
                      </button>
                    </div>
                  </div>
                )}
                {mode !== "icon" && (
                  <label className="space-settings-field">
                    {t("name")}
                    <input
                      required
                      minLength={3}
                      maxLength={50}
                      value={name}
                      disabled={busy || preparing}
                      onChange={(event) => setName(event.target.value)}
                    />
                  </label>
                )}
                {mode === "all" && (
                  <label className="space-settings-field">
                    {t("description")}
                    <textarea
                      maxLength={280}
                      rows={3}
                      value={description}
                      disabled={busy || preparing}
                      onChange={(event) => setDescription(event.target.value)}
                    />
                  </label>
                )}
              </section>
            )}
            {section === "tools" && (
              <section>
                <h3>{t("modules")}</h3>
                <p>{t("preserve")}</p>
                <div className="space-settings-tools">
                  {SPACE_MODULES.map((key) => (
                    <label className="space-module-toggle" key={key}>
                      {key === "calendar" ? (
                        <ListGlyph name="calendar" />
                      ) : (
                        <ListIcon name={moduleIcons[key]} />
                      )}
                      <span>
                        <strong>{t(key)}</strong>
                        <small>{t(`${key}Hint`)}</small>
                      </span>
                      <input
                        type="checkbox"
                        role="switch"
                        disabled={busy || preparing}
                        checked={modules.includes(key)}
                        onChange={(event) =>
                          setModules(
                            event.target.checked
                              ? [...modules, key]
                              : modules.filter((module) => module !== key),
                          )
                        }
                      />
                    </label>
                  ))}
                </div>
              </section>
            )}
            {section === "management" && (
              <section>
                <h3>{t("management")}</h3>
                <div className="space-settings-danger">
                  <strong>{t("deleteSpace")}</strong>
                  <p>{t("deleteHint")}</p>
                  <button
                    type="button"
                    disabled={busy || preparing}
                    onClick={() => {
                      setConfirmation("");
                      setError(undefined);
                      setConfirm(true);
                    }}
                  >
                    {t("deleteSpace")}
                  </button>
                </div>
              </section>
            )}
          </div>
        </div>
        <footer className="space-settings-footer">
          <span role={error ? "alert" : "status"}>
            {error
              ? t(error)
              : preparing
                ? t("preparingImage")
                : dirty
                  ? t("unsaved")
                  : ""}
          </span>
          <button type="button" disabled={busy || preparing} onClick={onClose}>
            {t("cancel")}
          </button>
          <button
            className="space-settings-save"
            disabled={busy || preparing || !dirty || name.trim().length < 3}
          >
            {t(busy && !confirm ? "saving" : "save")}
          </button>
        </footer>
      </form>
      <input
        ref={fileInput}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        hidden
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = "";
          if (!file) return;
          setPreparing(true);
          setError(undefined);
          void setImage(file)
            .catch(() => setError("imageError"))
            .finally(() => setPreparing(false));
        }}
      />
      {picker && (
        <Popover
          anchor={iconButton}
          label={t("editIcon")}
          onClose={closePicker}
        >
          <div
            className="space-create-icon-popover"
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.stopPropagation();
                event.preventDefault();
                closePicker();
              }
            }}
          >
            <strong>{t("icon")}</strong>
            <div className="space-icon-options">
              {workspaceIconChoices.map(({ value, key }) => (
                <button
                  type="button"
                  key={value}
                  title={iconLabel(key)}
                  aria-label={iconLabel(key)}
                  aria-pressed={
                    !picture && normalizeWorkspaceIcon(icon) === value
                  }
                  onClick={() => {
                    setIcon(value);
                    setPicture(null);
                  }}
                >
                  <span className="space-icon-sample" style={tile}>
                    <SpaceSymbol value={value} />
                  </span>
                </button>
              ))}
            </div>
            <SpaceColorPicker
              value={background}
              onChange={setBackground}
              iconColor={iconColor}
              onIconColorChange={setIconColor}
              image={Boolean(picture) || icon.startsWith("media:")}
            />
            <div className="space-create-icon-actions">
              <button
                type="button"
                onClick={() => {
                  closePicker();
                  fileInput.current?.click();
                }}
              >
                <ListGlyph name="plus" />
                {t("uploadImage")}
              </button>
              <button
                type="button"
                onClick={() => {
                  closePicker();
                  setMedia(true);
                }}
              >
                <ListIcon name="basket" />
                {t("chooseImage")}
              </button>
            </div>
          </div>
        </Popover>
      )}
      {media && (
        <MediaPicker
          slug={space.slug}
          onClose={() => setMedia(false)}
          onSelect={async (url) => {
            setMedia(false);
            setPreparing(true);
            setError(undefined);
            try {
              const response = await fetch(url, {
                signal: AbortSignal.timeout(15000),
              });
              await setImage(await readIconResponse(response));
            } catch {
              setError("imageError");
            } finally {
              setPreparing(false);
            }
          }}
        />
      )}
      {confirm && (
        <Modal
          className="space-settings-confirm"
          label={t("deleteSpace")}
          onClose={() => !busy && setConfirm(false)}
        >
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (!busy && confirmation === space.name) void deleteSpace();
            }}
          >
            <h2>{t("deleteSpace")}</h2>
            <p>{t("confirmDelete", { name: space.name })}</p>
            <label className="space-settings-field">
              {t("name")}
              <input
                value={confirmation}
                autoComplete="off"
                disabled={busy || preparing}
                onChange={(event) => setConfirmation(event.target.value)}
              />
            </label>
            {error === "deleteError" && <p role="alert">{t(error)}</p>}
            <div className="space-settings-confirm-actions">
              <button
                type="button"
                disabled={busy || preparing}
                onClick={() => setConfirm(false)}
              >
                {t("cancel")}
              </button>
              <button
                className="space-settings-delete"
                disabled={busy || confirmation !== space.name}
              >
                {t(busy ? "deleting" : "deleteSpace")}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </Modal>
  );
}
