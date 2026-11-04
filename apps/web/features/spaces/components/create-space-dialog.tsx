"use client";
import { useRef, useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Modal, Popover } from "@/features/lists/components/overlays";
import {
  ListIcon,
  ListGlyph,
  LIST_ICONS,
} from "@/features/lists/components/list-icon";
import { SPACE_ICON_CHOICES } from "../types/space.types";
import { SpaceSymbol } from "./space-symbol";
import {
  MediaPicker,
  uploadMedia,
} from "@/features/gallery/components/media-picker";
import { prepareSpaceIcon, readIconResponse } from "../utils/prepare-icon";
import "./create-space-dialog.css";
import { SpaceColorPicker } from "./space-color-picker";
import { spaceTileStyle } from "../utils/space-colors";
export function CreateSpaceDialog({ onClose }: { onClose: () => void }) {
  const t = useTranslations("spaces.create"),
    router = useRouter(),
    [name, setName] = useState(""),
    [template, setTemplate] = useState("blank"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const params = useParams(),
    currentSlug = String(params.slug ?? "");
  const [background, setBackground] = useState("");
  const [iconPickerOpen, setIconPickerOpen] = useState(false);
  const iconButton = useRef<HTMLButtonElement>(null);
  const [mediaOpen, setMediaOpen] = useState(false);
  const key = useRef(crypto.randomUUID());
  const [icon, setIcon] = useState(
      () =>
        SPACE_ICON_CHOICES[
          Math.floor(Math.random() * SPACE_ICON_CHOICES.length)
        ] as string,
    ),
    [picture, setPicture] = useState<File | null>(null),
    [preview, setPreview] = useState("");
  const pictureInput = useRef<HTMLInputElement>(null),
    mediaKey = useRef(crypto.randomUUID());
  useEffect(() => {
    if (!picture) {
      setPreview("");
      return;
    }
    const url = URL.createObjectURL(picture);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [picture]);
  const icons: Record<string, string> = {
    university: "book",
    work: "briefcase",
    couple: "heart",
    project: "bolt",
    blank: "table",
  };
  return (
    <Modal
      label={t("title")}
      className="space-create-dialog"
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (busy) return;
          setBusy(true);
          setError("");
          try {
            const r = await fetch("/api/spaces", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                name,
                template,
                icon,
                background,
                key: key.current,
              }),
              signal: AbortSignal.timeout(25000),
            });
            const d = await r.json();
            if (!r.ok) throw Error(d.code);
            if (picture) {
              const media = await uploadMedia(
                d.slug,
                picture,
                mediaKey.current,
              );
              const saved = await fetch("/api/spaces/icon", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ slug: d.slug, key: media }),
              });
              if (!saved.ok) throw Error("INVALID_IMAGE");
            }
            router.push(`/w/${d.slug}`);
            onClose();
          } catch (e) {
            setError(
              t(
                String(e).includes("LIMIT_REACHED")
                  ? "limit"
                  : String(e).includes("UNAUTHORIZED")
                    ? "session"
                    : "error",
              ),
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        <header>
          <div>
            <h2>{t("title")}</h2>
            <p>{t("intro")}</p>
          </div>
          <button
            type="button"
            aria-label={t("close")}
            disabled={busy}
            onClick={onClose}
          >
            <ListGlyph name="close" />
          </button>
        </header>
        <div className="space-create-identity">
          <button
            ref={iconButton}
            className="space-create-icon-trigger"
            style={spaceTileStyle(background)}
            type="button"
            aria-label={t("editIcon")}
            aria-haspopup="dialog"
            aria-expanded={iconPickerOpen}
            disabled={busy}
            onClick={() => setIconPickerOpen((value) => !value)}
          >
            {preview ? (
              <img src={preview} alt="" />
            ) : (
              <SpaceSymbol value={icon} />
            )}
            <span className="space-create-icon-edit" aria-hidden="true">
              <ListGlyph name="edit" />
            </span>
          </button>
          <label className="space-create-name">
            {t("name")}
            <input
              autoFocus
              required
              minLength={3}
              maxLength={50}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("placeholder")}
              disabled={busy}
            />
          </label>
        </div>
        <input
          hidden
          ref={pictureInput}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={async (e) => {
            const input = e.target.files?.[0];
            e.target.value = "";
            if (!input) return;
            try {
              if (
                input.size > 2 * 1024 * 1024 ||
                !["image/jpeg", "image/png", "image/webp"].includes(input.type)
              )
                throw Error();
              setPicture(await prepareSpaceIcon(input));
              setError("");
            } catch {
              setError(t("iconError"));
            }
          }}
        />
        <fieldset disabled={busy}>
          <legend>{t("template")}</legend>
          <div className="space-template-options">
            {Object.keys(icons).map((type) => (
              <button
                key={type}
                type="button"
                aria-pressed={template === type}
                onClick={() => setTemplate(type)}
              >
                <ListIcon name={icons[type]!} />
                <span>
                  <strong>{t(`templates.${type}.name`)}</strong>
                  <span>{t(`templates.${type}.description`)}</span>
                </span>
                {template === type && <ListGlyph name="tick" />}
              </button>
            ))}
          </div>
        </fieldset>
        {error && (
          <p role="alert" className="space-create-error">
            {error}
          </p>
        )}
        <footer>
          <button type="button" disabled={busy} onClick={onClose}>
            {t("cancel")}
          </button>
          <button
            className="lists-primary"
            disabled={busy || name.trim().length < 3}
          >
            {t(busy ? "creating" : "submit")}
          </button>
        </footer>
      </form>
      {iconPickerOpen && (
        <Popover
          anchor={iconButton}
          label={t("icon")}
          onClose={() => {
            setIconPickerOpen(false);
            iconButton.current?.focus();
          }}
        >
          <div className="space-create-icon-popover">
            <strong>{t("icon")}</strong>
            <div
              className="space-icon-options"
              onKeyDown={(event) => {
                const buttons = Array.from(
                  event.currentTarget.querySelectorAll<HTMLButtonElement>(
                    "button",
                  ),
                );
                const index = buttons.indexOf(
                  document.activeElement as HTMLButtonElement,
                );
                const delta: Record<string, number> = {
                  ArrowRight: 1,
                  ArrowLeft: -1,
                  ArrowDown: 5,
                  ArrowUp: -5,
                };
                if (event.key in delta) {
                  event.preventDefault();
                  buttons[
                    (index + delta[event.key]! + buttons.length) %
                      buttons.length
                  ]?.focus();
                }
              }}
            >
              {[
                ...SPACE_ICON_CHOICES,
                ...LIST_ICONS.map((v) => "symbol:" + v),
              ].map((v) => (
                <button
                  key={v}
                  type="button"
                  aria-label={t("chooseIcon", { icon: v })}
                  aria-pressed={!picture && icon === v}
                  data-popover-focus={!picture && icon === v ? "" : undefined}
                  disabled={busy}
                  onClick={() => {
                    setIcon(v);
                    setPicture(null);
                    setIconPickerOpen(false);
                    iconButton.current?.focus();
                  }}
                >
                  <SpaceSymbol value={v} />
                </button>
              ))}
            </div>

            <SpaceColorPicker
              value={background}
              onChange={setBackground}
              disabled={busy}
            />
            <div className="space-create-icon-actions">
              <button
                type="button"
                onClick={() => {
                  setIconPickerOpen(false);
                  pictureInput.current?.click();
                }}
              >
                <ListGlyph name="plus" />
                {t("uploadIcon")}
              </button>
              {currentSlug && (
                <button
                  type="button"
                  onClick={() => {
                    setIconPickerOpen(false);
                    setMediaOpen(true);
                  }}
                >
                  <ListIcon name="basket" />
                  {t("chooseMedia")}
                </button>
              )}
              {picture && (
                <button
                  type="button"
                  onClick={() => {
                    setPicture(null);
                    setIconPickerOpen(false);
                    iconButton.current?.focus();
                  }}
                >
                  {t("removeIcon")}
                </button>
              )}
            </div>
            <p>{t("iconHint")}</p>
          </div>
        </Popover>
      )}

      {mediaOpen && (
        <MediaPicker
          slug={currentSlug}
          onClose={() => setMediaOpen(false)}
          onSelect={async (url) => {
            setMediaOpen(false);
            setBusy(true);
            try {
              const response = await fetch(url, {
                signal: AbortSignal.timeout(15000),
              });
              if (!response.ok) throw Error();
              setPicture(
                await prepareSpaceIcon(await readIconResponse(response)),
              );
              setError("");
            } catch {
              setError(t("iconError"));
            } finally {
              setBusy(false);
            }
          }}
        />
      )}
    </Modal>
  );
}
