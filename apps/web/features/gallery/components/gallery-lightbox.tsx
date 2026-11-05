"use client";
import { GalleryTagPicker } from "./gallery-dialogs";
import { useRef, useState } from "react";
import { useQuery } from "convex/react";
import { useLocale, useTranslations } from "next-intl";
import { api } from "@/convex/_generated/api";
import { Modal } from "@/features/lists/components/overlays";
import { DatePicker } from "@/features/lists/components/date-picker";
import { GalleryIcon } from "./gallery-icon";
import { GalleryPicture, mediaUrl } from "./gallery-image";
import { GalleryConfirm } from "./gallery-dialogs";
import {
  galleryError,
  type GalleryImage,
  type GalleryModel,
} from "../hooks/use-gallery";
export function GalleryLightbox({
  image,
  slug,
  model,
  onClose,
  onNavigate,
  hasPrev,
  hasNext,
}: {
  image: GalleryImage;
  slug: string;
  model: GalleryModel;
  onClose: () => void;
  onNavigate: (offset: number) => void;
  hasPrev: boolean;
  hasNext: boolean;
}) {
  const t = useTranslations("gallery"),
    locale = useLocale(),
    remote = useQuery(
      api.gallery.data.detail,
      model.ticket ? { ticket: model.ticket, key: image.key } : "skip",
    );
  const current = remote ?? image,
    deleted = remote === null;
  const initialDate = image.hasCaptureDate
    ? new Date(image.capturedAt).toISOString().slice(0, 10)
    : "";
  const savedDate = useRef(initialDate);
  const [title, setTitle] = useState(image.title),
    [description, setDescription] = useState(image.description),
    [tags, setTags] = useState(image.tags),
    [albums, setAlbums] = useState(image.albumIds),
    [date, setDate] = useState(initialDate),
    [revision, setRevision] = useState(image.revision),
    [baseline, setBaseline] = useState(
      JSON.stringify([
        image.title,
        image.description,
        image.tags,
        image.albumIds,
        initialDate,
      ]),
    );
  const [zoom, setZoom] = useState(1),
    [pan, setPan] = useState({ x: 0, y: 0 }),
    [details, setDetails] = useState(true),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [confirm, setConfirm] = useState(false),
    [leave, setLeave] = useState<number | "close" | null>(null);
  const gesture = useRef<{
      x: number;
      y: number;
      pan: { x: number; y: number };
      pinched: boolean;
    } | null>(null),
    points = useRef(new Map<number, { x: number; y: number }>()),
    pinch = useRef<{ distance: number; zoom: number } | null>(null);
  const dirty =
    JSON.stringify([title, description, tags, albums, date]) !== baseline;
  const navigate = (offset: number | "close") => {
    if (busy) return;
    if (dirty) {
      setLeave(offset);
      return;
    }
    if (offset === "close") onClose();
    else onNavigate(offset);
  };
  const setScale = (value: number) => {
    setZoom(Math.max(1, Math.min(4, value)));
    setPan({ x: 0, y: 0 });
  };
  return (
    <Modal
      label={title}
      className="gallery-lightbox"
      onClose={() => navigate("close")}
    >
      <div
        className="gallery-viewer"
        onKeyDown={(e) => {
          if (
            e.target instanceof HTMLElement &&
            e.target.closest(
              'input,textarea,[contenteditable], [role="listbox"]',
            )
          )
            return;
          if (e.key === "ArrowLeft" && hasPrev) {
            e.preventDefault();
            navigate(-1);
          }
          if (e.key === "ArrowRight" && hasNext) {
            e.preventDefault();
            navigate(1);
          }
          if (e.key === "+") setScale(zoom + 0.5);
          if (e.key === "-") setScale(zoom - 0.5);
        }}
      >
        <header className="gallery-viewer-header">
          <strong>{current.title}</strong>
          <div>
            <button
              className="gallery-icon-button"
              onClick={() => setDetails(!details)}
              aria-pressed={details}
              aria-label={t("details")}
            >
              <GalleryIcon name="info" />
            </button>
            <a
              className="gallery-icon-button"
              href={`${mediaUrl(slug, image.key, "original")}&download=1`}
              download
              aria-label={t("download")}
            >
              <GalleryIcon name="download" />
            </a>
            <button
              autoFocus
              className="gallery-icon-button"
              onClick={() => navigate("close")}
              aria-label={t("close")}
            >
              <GalleryIcon name="close" />
            </button>
          </div>
        </header>
        <div className={`gallery-viewer-body ${details ? "with-details" : ""}`}>
          <div
            className="gallery-stage"
            onPointerDown={(e) => {
              if ((e.target as HTMLElement).closest("button,a")) return;
              e.currentTarget.setPointerCapture(e.pointerId);
              points.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
              if (points.current.size === 2) {
                const [a, b] = [...points.current.values()];
                pinch.current = {
                  distance: Math.hypot(a!.x - b!.x, a!.y - b!.y),
                  zoom,
                };
                if (gesture.current) gesture.current.pinched = true;
              } else
                gesture.current = {
                  x: e.clientX,
                  y: e.clientY,
                  pan,
                  pinched: false,
                };
            }}
            onPointerMove={(e) => {
              if (!points.current.has(e.pointerId)) return;
              points.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
              if (points.current.size === 2 && pinch.current) {
                const [a, b] = [...points.current.values()];
                setZoom(
                  Math.max(
                    1,
                    Math.min(
                      4,
                      (pinch.current.zoom *
                        Math.hypot(a!.x - b!.x, a!.y - b!.y)) /
                        pinch.current.distance,
                    ),
                  ),
                );
                return;
              }
              if (gesture.current && zoom > 1) {
                const b = e.currentTarget.getBoundingClientRect(),
                  maxX = (b.width * (zoom - 1)) / 2,
                  maxY = (b.height * (zoom - 1)) / 2;
                setPan({
                  x: Math.max(
                    -maxX,
                    Math.min(
                      maxX,
                      gesture.current.pan.x + e.clientX - gesture.current.x,
                    ),
                  ),
                  y: Math.max(
                    -maxY,
                    Math.min(
                      maxY,
                      gesture.current.pan.y + e.clientY - gesture.current.y,
                    ),
                  ),
                });
              }
            }}
            onPointerUp={(e) => {
              points.current.delete(e.pointerId);
              pinch.current = null;
              const g = gesture.current;
              if (
                g &&
                zoom === 1 &&
                !g.pinched &&
                Math.abs(e.clientX - g.x) > 70 &&
                Math.abs(e.clientY - g.y) < 60
              ) {
                if (e.clientX < g.x && hasNext) navigate(1);
                else if (e.clientX > g.x && hasPrev) navigate(-1);
              }
              if (!points.current.size) gesture.current = null;
            }}
            onPointerCancel={() => {
              points.current.clear();
              gesture.current = null;
              pinch.current = null;
            }}
          >
            <div
              className="gallery-zoom-image"
              style={{
                transform: `translate(${pan.x}px,${pan.y}px) scale(${zoom})`,
              }}
            >
              <GalleryPicture
                key={`${image.key}-${current.status}`}
                image={current}
                slug={slug}
                detail
                zoom={zoom}
              />
            </div>
            <button
              className="gallery-prev gallery-icon-button"
              disabled={!hasPrev || busy}
              aria-label={t("previous")}
              onClick={() => navigate(-1)}
            >
              <GalleryIcon name="left" />
            </button>
            <button
              className="gallery-next gallery-icon-button"
              disabled={!hasNext || busy}
              aria-label={t("next")}
              onClick={() => navigate(1)}
            >
              <GalleryIcon name="right" />
            </button>
            <div className="gallery-zoom-controls">
              <button
                className="gallery-icon-button"
                disabled={zoom === 1}
                aria-label={t("zoomOut")}
                onClick={() => setScale(zoom - 0.5)}
              >
                <GalleryIcon name="minus" />
              </button>
              <button aria-label={t("fit")} onClick={() => setScale(1)}>
                {zoom === 1 ? t("fit") : `${Math.round(zoom * 100)}%`}
              </button>
              <button
                className="gallery-icon-button"
                disabled={zoom === 4}
                aria-label={t("zoomIn")}
                onClick={() => setScale(zoom + 0.5)}
              >
                <GalleryIcon name="plus" />
              </button>
            </div>
          </div>
          {details && (
            <form
              className="gallery-inspector"
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                setError("");
                try {
                  await model.edit({
                    key: image.key,
                    revision,
                    title,
                    description,
                    tags,
                    albumIds: albums,
                    ...(date !== savedDate.current
                      ? {
                          capturedAt: date
                            ? new Date(`${date}T12:00:00Z`).getTime()
                            : null,
                        }
                      : {}),
                  });
                  setRevision(revision + 1);
                  setBaseline(
                    JSON.stringify([
                      title.trim(),
                      description.trim(),
                      tags,
                      albums,
                      date,
                    ]),
                  );
                  setTitle(title.trim());
                  setDescription(description.trim());
                  savedDate.current = date;
                } catch (e) {
                  setError(t(`errors.${galleryError(e)}`));
                } finally {
                  setBusy(false);
                }
              }}
            >
              <h2>{t("details")}</h2>
              {deleted && (
                <p className="gallery-error" role="alert">
                  {t("removed")}
                </p>
              )}
              {!deleted && current.revision !== revision && (
                <p className="gallery-error" role="alert">
                  {t("remoteChange")}
                  <button
                    type="button"
                    onClick={() => {
                      setTitle(current.title);
                      setDescription(current.description);
                      setTags(current.tags);
                      setAlbums(current.albumIds);
                      const nextDate = current.hasCaptureDate
                        ? new Date(current.capturedAt)
                            .toISOString()
                            .slice(0, 10)
                        : "";
                      setDate(nextDate);
                      savedDate.current = nextDate;
                      setRevision(current.revision);
                      setBaseline(
                        JSON.stringify([
                          current.title,
                          current.description,
                          current.tags,
                          current.albumIds,
                          nextDate,
                        ]),
                      );
                    }}
                  >
                    {t("reload")}
                  </button>
                </p>
              )}
              <label>
                {t("title")}
                <input
                  value={title}
                  maxLength={160}
                  required
                  onChange={(e) => setTitle(e.target.value)}
                />
              </label>
              <label>
                {t("description")}
                <textarea
                  rows={3}
                  maxLength={3000}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={t("descriptionPlaceholder")}
                />
              </label>
              <GalleryTagPicker
                available={[
                  ...(model.overview?.tags ?? []),
                  ...model.images.flatMap((item) => item.tags),
                  ...current.tags,
                ]}
                selected={tags}
                onChange={setTags}
              />
              <div>
                <span className="gallery-field-label">{t("captureDate")}</span>
                <DatePicker
                  value={date}
                  onChange={(v) => setDate(v ?? "")}
                  label={t("captureDate")}
                />
              </div>
              {!!model.overview?.albums.length && (
                <fieldset className="gallery-album-checks">
                  <legend>{t("albums")}</legend>
                  {model.overview.albums.map((a) => (
                    <label key={a.id}>
                      <input
                        type="checkbox"
                        checked={albums.includes(a.id)}
                        onChange={(e) =>
                          setAlbums(
                            e.target.checked
                              ? [...albums, a.id]
                              : albums.filter((id) => id !== a.id),
                          )
                        }
                      />
                      <span className={`gallery-dot color-${a.color}`} />
                      {a.name}
                    </label>
                  ))}
                </fieldset>
              )}
              <dl>
                <div>
                  <dt>{t("filename")}</dt>
                  <dd>{current.filename}</dd>
                </div>
                <div>
                  <dt>{t("dimensions")}</dt>
                  <dd>
                    {current.width} × {current.height}
                  </dd>
                </div>
                <div>
                  <dt>{t("originalSize")}</dt>
                  <dd>
                    {(current.originalBytes / 1024 / 1024).toFixed(2)} MiB
                  </dd>
                </div>
                <div>
                  <dt>{t("uploadedAt")}</dt>
                  <dd>
                    {new Intl.DateTimeFormat(locale, {
                      dateStyle: "medium",
                    }).format(current.uploadedAt)}
                  </dd>
                </div>
                <div>
                  <dt>{t("captureDate")}</dt>
                  <dd>
                    {current.hasCaptureDate
                      ? new Intl.DateTimeFormat(locale, {
                          dateStyle: "medium",
                          timeZone: "UTC",
                        }).format(current.capturedAt)
                      : t("notAvailable")}
                  </dd>
                </div>
                <div>
                  <dt>{t("format")}</dt>
                  <dd>{current.mime.replace("image/", "").toUpperCase()}</dd>
                </div>
              </dl>
              {current.status === "error" && (
                <div>
                  <p role="alert" className="gallery-error">
                    {t(
                      `errors.${["INVALID_IMAGE", "UNSUPPORTED_FORMAT", "STORAGE_LIMIT", "INTERRUPTED", "UPLOAD_FAILED"].includes(current.error ?? "") ? (current.error === "UPLOAD_FAILED" ? "UPLOAD_REQUIRED" : current.error) : "PROCESSING_FAILED"}`,
                    )}
                  </p>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await model.retry(current.key);
                      } catch (e) {
                        setError(t(`errors.${galleryError(e)}`));
                      }
                    }}
                  >
                    {t("retryProcessing")}
                  </button>
                </div>
              )}
              {error && (
                <p className="gallery-error" role="alert">
                  {error}
                </p>
              )}
              {model.overview?.preferences.sort === "manual" && (
                <div className="gallery-reorder-controls">
                  <span>{t("manualOrder")}</span>
                  <button
                    type="button"
                    disabled={
                      busy ||
                      model.images.findIndex((i) => i.key === image.key) <= 0
                    }
                    onClick={async () => {
                      const index = model.images.findIndex(
                        (i) => i.key === image.key,
                      );
                      setBusy(true);
                      try {
                        await model.move(
                          image.key,
                          model.images[index - 1]?.key,
                        );
                      } catch (e) {
                        setError(t(`errors.${galleryError(e)}`));
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    <GalleryIcon name="left" />
                    {t("moveEarlier")}
                  </button>
                  <button
                    type="button"
                    disabled={
                      busy ||
                      model.images.findIndex((i) => i.key === image.key) >=
                        model.images.length - 1
                    }
                    onClick={async () => {
                      const index = model.images.findIndex(
                        (i) => i.key === image.key,
                      );
                      setBusy(true);
                      try {
                        await model.move(
                          image.key,
                          model.images[index + 2]?.key,
                        );
                      } catch (e) {
                        setError(t(`errors.${galleryError(e)}`));
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    <GalleryIcon name="right" />
                    {t("moveLater")}
                  </button>
                </div>
              )}
              <div className="gallery-inspector-actions">
                <button
                  className="lists-primary"
                  disabled={
                    deleted ||
                    busy ||
                    !dirty ||
                    !title.trim() ||
                    current.revision !== revision
                  }
                >
                  {t(busy ? "working" : "save")}
                </button>
                <button
                  type="button"
                  className="gallery-icon-button gallery-danger-text"
                  disabled={deleted || busy}
                  aria-label={t("delete")}
                  onClick={() => setConfirm(true)}
                >
                  <GalleryIcon name="trash" />
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
      {confirm && (
        <GalleryConfirm
          count={1}
          busy={busy}
          error={error}
          onClose={() => setConfirm(false)}
          onConfirm={() => {
            setBusy(true);
            void model
              .bulk({ kind: "delete", keys: [image.key] })
              .then(onClose)
              .catch((e) => {
                setError(t(`errors.${galleryError(e)}`));
                setBusy(false);
              });
          }}
        />
      )}
      {leave !== null && (
        <Modal
          label={t("unsavedTitle")}
          className="gallery-dialog"
          onClose={() => setLeave(null)}
        >
          <h2>{t("unsavedTitle")}</h2>
          <p>{t("unsavedHint")}</p>
          <div className="gallery-dialog-actions">
            <button onClick={() => setLeave(null)}>{t("keepEditing")}</button>
            <button
              className="lists-primary"
              onClick={() => {
                if (leave === "close") onClose();
                else onNavigate(leave);
              }}
            >
              {t("discard")}
            </button>
          </div>
        </Modal>
      )}
    </Modal>
  );
}
