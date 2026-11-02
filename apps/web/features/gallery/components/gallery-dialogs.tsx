"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Modal } from "@/features/lists/components/overlays";
import { GalleryIcon } from "./gallery-icon";
import type { GalleryAlbum, GalleryModel } from "../hooks/use-gallery";
import { galleryError } from "../hooks/use-gallery";
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
          />
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
