"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Modal } from "@/features/lists/components/overlays";
import { ListSelect } from "@/features/lists/components/list-select";
import { GalleryIcon } from "./gallery-icon";
import type { GalleryAlbum, GalleryModel } from "../hooks/use-gallery";
import { galleryError } from "../hooks/use-gallery";

export function GalleryTagPicker({
  available,
  selected,
  onChange,
}: {
  available: string[];
  selected: string[];
  onChange: (tags: string[]) => void;
}) {
  const t = useTranslations("gallery");
  const options = [...new Set(available)]
    .filter((tag) => !selected.includes(tag))
    .sort((a, b) => a.localeCompare(b))
    .map((value) => ({ value, label: value }));
  return (
    <div className="gallery-tag-picker">
      <span className="gallery-field-label">{t("tags")}</span>
      {!!selected.length && (
        <div className="gallery-tags">
          {selected.map((tag) => (
            <button
              key={tag}
              type="button"
              aria-label={t("removeTag", { tag })}
              onClick={() =>
                onChange(selected.filter((value) => value !== tag))
              }
            >
              {tag} <GalleryIcon name="close" />
            </button>
          ))}
        </div>
      )}
      {selected.length < 12 && options.length > 0 && (
        <ListSelect
          label={t("tags")}
          value=""
          placeholder={t("chooseTag")}
          options={options}
          onChange={(tag) => onChange([...selected, tag])}
        />
      )}
      {!selected.length && !options.length && <p>{t("noTags")}</p>}
    </div>
  );
}

export function NewTagDialog({
  model,
  onClose,
}: {
  model: GalleryModel;
  onClose: () => void;
}) {
  const t = useTranslations("gallery");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <Modal
      label={t("newTag")}
      className="gallery-dialog"
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          if (busy || !name.trim()) return;
          setBusy(true);
          setError("");
          try {
            await model.createTag(name);
            onClose();
          } catch (cause) {
            setError(t(`errors.${galleryError(cause)}`));
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="gallery-queue-heading">
          <h2>{t("newTag")}</h2>
          <button
            type="button"
            className="gallery-icon-button"
            aria-label={t("close")}
            disabled={busy}
            onClick={onClose}
          >
            <GalleryIcon name="close" />
          </button>
        </div>
        <label>
          {t("tagName")}
          <input
            autoFocus
            required
            maxLength={382}
            placeholder="etiqueta1, etiqueta2"
            aria-describedby="gallery-tag-batch-hint"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <p id="gallery-tag-batch-hint">{t("tagBatchHint")}</p>
        {error && (
          <p role="alert" className="gallery-error">
            {error}
          </p>
        )}
        <div className="gallery-dialog-actions">
          <button type="button" onClick={onClose} disabled={busy}>
            {t("cancel")}
          </button>
          <button className="lists-primary" disabled={busy || !name.trim()}>
            {t(busy ? "working" : "save")}
          </button>
        </div>
      </form>
    </Modal>
  );
}
export function GalleryConfirm({
  count,
  busy,
  error,
  onClose,
  onConfirm,
  album = false,
}: {
  count: number;
  busy: boolean;
  error: string;
  onClose: () => void;
  onConfirm: () => void;
  album?: boolean;
}) {
  const t = useTranslations("gallery");
  return (
    <Modal
      label={t(album ? "deleteAlbum" : "deleteImages")}
      className="gallery-dialog"
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <h2>{t(album ? "deleteAlbum" : "deleteImages")}</h2>
      <p>{t(album ? "deleteAlbumHint" : "deleteHint", { count })}</p>
      {error && (
        <p role="alert" className="gallery-error">
          {error}
        </p>
      )}
      <div className="gallery-dialog-actions">
        <button disabled={busy} onClick={onClose}>
          {t("cancel")}
        </button>
        <button className="gallery-danger" disabled={busy} onClick={onConfirm}>
          {t(busy ? "working" : "delete")}
        </button>
      </div>
    </Modal>
  );
}
export function AlbumDialog({
  album,
  model,
  onClose,
}: {
  album?: GalleryAlbum;
  model: GalleryModel;
  onClose: () => void;
}) {
  const t = useTranslations("gallery"),
    [name, setName] = useState(album?.name ?? ""),
    [description, setDescription] = useState(album?.description ?? ""),
    [color, setColor] = useState(album?.color ?? "blue"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <Modal
      label={t(album ? "editAlbum" : "newAlbum")}
      onClose={() => {
        if (!busy) onClose();
      }}
      className="gallery-dialog"
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await model.album({
              kind: album ? "save" : "create",
              ...(album ? { id: album.id } : {}),
              name,
              description,
              color,
            });
            onClose();
          } catch (e) {
            setError(t(`errors.${galleryError(e)}`));
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="gallery-queue-heading">
          <h2>{t(album ? "editAlbum" : "newAlbum")}</h2>
          <button
            type="button"
            className="gallery-icon-button"
            aria-label={t("close")}
            onClick={onClose}
            disabled={busy}
          >
            <GalleryIcon name="close" />
          </button>
        </div>
        <label>
          {t("albumName")}
          <input
            autoFocus
            required
            maxLength={80}
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-describedby="gallery-album-name-limit"
          />
          <span className="gallery-input-count" id="gallery-album-name-limit">
            {name.length} / 80
          </span>
        </label>
        <label>
          {t("description")}
          <textarea
            maxLength={1000}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
          />
        </label>
        <fieldset className="gallery-color-picker">
          <legend>{t("albumColor")}</legend>
          {["gray", "blue", "green", "rose", "amber", "violet"].map((c) => (
            <button
              key={c}
              type="button"
              className={`gallery-color color-${c}`}
              aria-label={t(`colors.${c}`)}
              aria-pressed={color === c}
              onClick={() => setColor(c)}
            >
              {color === c && <GalleryIcon name="check" />}
            </button>
          ))}
        </fieldset>
        {error && (
          <p role="alert" className="gallery-error">
            {error}
          </p>
        )}
        <div className="gallery-dialog-actions">
          <button type="button" onClick={onClose} disabled={busy}>
            {t("cancel")}
          </button>
          <button className="lists-primary" disabled={busy || !name.trim()}>
            {t(busy ? "working" : "save")}
          </button>
        </div>
      </form>
    </Modal>
  );
}
