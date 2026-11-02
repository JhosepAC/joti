"use client";
import { useDeferredValue, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { Popover, Modal } from "@/features/lists/components/overlays";
import { ListSelect } from "@/features/lists/components/list-select";
import { DatePicker } from "@/features/lists/components/date-picker";
import {
  useGallery,
  galleryError,
  type GalleryImage,
  type GalleryAlbum,
} from "../hooks/use-gallery";
import { GalleryIcon } from "./gallery-icon";
import { GalleryPicture } from "./gallery-image";
import { GalleryLightbox } from "./gallery-lightbox";
import { AlbumDialog, GalleryConfirm } from "./gallery-dialogs";
import { UploadQueue } from "./upload-queue";
import { GalleryMasonry } from "./gallery-masonry";
import "./gallery.css";
const VIEWS = ["grid", "masonry", "compact", "list", "timeline"];
export function GalleryModule({ slug }: { slug: string }) {
  const t = useTranslations("gallery"),
    locale = useLocale();
  const [search, setSearch] = useState(""),
    [album, setAlbum] = useState(""),
    [tag, setTag] = useState(""),
    [mime, setMime] = useState(""),
    [from, setFrom] = useState(""),
    [to, setTo] = useState("");
  const deferred = useDeferredValue(search),
    filters = useMemo(
      () => ({
        search: deferred,
        album,
        tag,
        mime,
        ...(from ? { from: new Date(`${from}T00:00:00`).getTime() } : {}),
        ...(to ? { to: new Date(`${to}T00:00:00`).getTime() + 86400000 } : {}),
      }),
      [deferred, album, tag, mime, from, to],
    );
  const model = useGallery(slug, filters),
    overview = model.overview,
    p = overview?.preferences;
  const [selected, setSelected] = useState<string[]>([]),
    [opened, setOpened] = useState<GalleryImage | null>(null),
    [files, setFiles] = useState<File[]>([]),
    [queueKey, setQueueKey] = useState(0),
    [dragging, setDragging] = useState(false);
  const [settings, setSettings] = useState(false),
    [filterOpen, setFilterOpen] = useState(false),
    [albumMenu, setAlbumMenu] = useState(false),
    [albumDialog, setAlbumDialog] = useState<GalleryAlbum | "new" | null>(null),
    [deleteAlbum, setDeleteAlbum] = useState<GalleryAlbum | null>(null),
    [deleteImages, setDeleteImages] = useState(false),
    [bulkDialog, setBulkDialog] = useState<"album" | "tags" | null>(null),
    [targetAlbum, setTargetAlbum] = useState(""),
    [bulkTags, setBulkTags] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const settingsRef = useRef<HTMLButtonElement>(null),
    filterRef = useRef<HTMLButtonElement>(null),
    albumRef = useRef<HTMLButtonElement>(null),
    fileInput = useRef<HTMLInputElement>(null),
    opener = useRef<HTMLElement | null>(null),
    dragKey = useRef("");
  const activeAlbum = overview?.albums.find((a) => a.id === album),
    images = model.images;
  const message = (e: unknown) => t(`errors.${galleryError(e)}`);
  const run = async (action: () => Promise<unknown>, success?: () => void) => {
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await action();
      success?.();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  };
  const preferences = (value: Partial<NonNullable<typeof p>>) => {
    if (!p || !model.online) return;
    void model
      .preferences({ ...p, ...value })
      .catch((e) => setError(message(e)));
  };
  const pickFiles = (picked: File[]) => {
    if (!picked.length) return;
    if (files.length) {
      setError(t("finishQueue"));
      return;
    }
    setFiles(picked);
    setQueueKey((k) => k + 1);
    setDragging(false);
    setError("");
  };
  const clearFilters = () => {
    setSearch("");
    setTag("");
    setMime("");
    setFrom("");
    setTo("");
    setSelected([]);
  };
  const open = (image: GalleryImage, target: HTMLElement) => {
    opener.current = target;
    setOpened(image);
  };
  const close = () => {
    setOpened(null);
    requestAnimationFrame(() => opener.current?.focus());
  };
  const toggle = (key: string) => {
    setSelected((old) =>
      old.includes(key)
        ? old.filter((k) => k !== key)
        : old.length < 100
          ? [...old, key]
          : old,
    );
  };
  const filtered = !!(search || tag || mime || from || to);
  const changeAlbum = (id: string) => {
    setAlbum(id);
    setSelected([]);
  };
  const download = () =>
    void run(async () => {
      const r = await fetch(
        `/api/gallery/download?slug=${encodeURIComponent(slug)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ keys: selected }),
          signal: AbortSignal.timeout(120000),
        },
      );
      if (!r.ok) {
        const d = await r.json();
        throw Error(d.code);
      }
      const url = URL.createObjectURL(await r.blob()),
        a = document.createElement("a");
      a.href = url;
      a.download = "nook-gallery.zip";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    });
  const item = (image: GalleryImage) => (
    <article
      key={image.key}
      className={`gallery-item ${selected.includes(image.key) ? "is-selected" : ""}`}
      draggable={p?.sort === "manual"}
      onDragStart={(e) => {
        dragKey.current = image.key;
        e.dataTransfer.setData("text/plain", image.key);
      }}
      onDragOver={(e) => {
        if (dragKey.current) e.preventDefault();
      }}
      onDrop={(e) => {
        if (dragKey.current) {
          e.preventDefault();
          e.stopPropagation();
          const key = dragKey.current;
          dragKey.current = "";
          void run(() => model.move(key, image.key));
        }
      }}
      onDragEnd={() => {
        dragKey.current = "";
      }}
    >
      <button
        className="gallery-open-image"
        onClick={(e) => open(image, e.currentTarget)}
        aria-label={t("openImage", { name: image.title })}
      >
        <GalleryPicture image={image} slug={slug} />
      </button>
      <button
        className="gallery-select"
        aria-label={t("selectImage", { name: image.title })}
        aria-pressed={selected.includes(image.key)}
        onClick={() => toggle(image.key)}
        disabled={!selected.includes(image.key) && selected.length >= 100}
      >
        {selected.includes(image.key) && <GalleryIcon name="check" />}
      </button>
      {((p?.info && p?.view !== "compact") || p?.view === "list") && (
        <div className="gallery-item-info">
          <button onClick={(e) => open(image, e.currentTarget)}>
            {image.title}
          </button>
          <span>
            {new Intl.DateTimeFormat(locale, {
              day: "numeric",
              month: "short",
              year: "numeric",
            }).format(image.uploadedAt)}
          </span>
          {p?.view === "list" && (
            <>
              <p>{image.description || image.filename}</p>
              <div className="gallery-tags">
                {image.tags.map((tag) => (
                  <button key={tag} onClick={() => setTag(tag)}>
                    {tag}
                  </button>
                ))}
              </div>
              <span className="gallery-list-format">
                {image.mime.replace("image/", "").toUpperCase()}
                <br />
                {(image.originalBytes / 1024 / 1024).toFixed(1)} MiB
              </span>
              <span>
                {image.albumIds
                  .map((id) => overview?.albums.find((a) => a.id === id)?.name)
                  .filter(Boolean)
                  .join(", ")}
              </span>
            </>
          )}
        </div>
      )}
    </article>
  );
  const groups = useMemo(() => {
    if (p?.view !== "timeline") return [];
    const grouped = new Map<string, GalleryImage[]>();
    const format = new Intl.DateTimeFormat(
      locale,
      p.group === "year"
        ? { year: "numeric" }
        : p.group === "day"
          ? { day: "numeric", month: "long", year: "numeric" }
          : { month: "long", year: "numeric" },
    );
    for (const image of images) {
      const label = format.format(
        p.sort === "uploaded" ? image.uploadedAt : image.capturedAt,
      );
      grouped.set(label, [...(grouped.get(label) ?? []), image]);
    }
    return [...grouped];
  }, [images, p, locale]);
  if (!overview)
    return (
      <section className="gallery-module lists-surface">
        <h1>{t("name")}</h1>
        {model.error ? (
          <div className="gallery-error" role="alert">
            <p>{message(model.error)}</p>
            {model.error === "UNAUTHORIZED" ? (
              <Link href="/auth/login">{t("signIn")}</Link>
            ) : (
              <button onClick={() => void model.renew()}>{t("retry")}</button>
            )}
          </div>
        ) : (
          <div className="gallery-loading" role="status">
            {t("loading")}
          </div>
        )}
      </section>
    );
  return (
    <section
      className={`gallery-module lists-surface view-${p?.view} size-${p?.size} density-${p?.density} ${dragging ? "is-dragging" : ""}`}
      aria-label={t("name")}
      onDragEnter={(e) => {
        if (e.dataTransfer.types.includes("Files")) {
          e.preventDefault();
          setDragging(true);
        }
      }}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes("Files")) e.preventDefault();
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node))
          setDragging(false);
      }}
      onDrop={(e) => {
        if (e.dataTransfer.files.length) {
          e.preventDefault();
          pickFiles([...e.dataTransfer.files]);
        }
      }}
    >
      <header className="gallery-heading">
        <div>
          <h1>
            {t("name")}
            <span>{overview.count}</span>
          </h1>
          <p>{activeAlbum?.description || t("intro")}</p>
        </div>
        <button
          className="lists-primary"
          disabled={!!files.length || !model.online}
          onClick={() => fileInput.current?.click()}
        >
          <GalleryIcon name="upload" />
          {t("upload")}
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/avif"
          multiple
          hidden
          onChange={(e) => {
            pickFiles([...(e.target.files ?? [])]);
            e.target.value = "";
          }}
        />
      </header>
      <div className="gallery-albums">
        <div className="gallery-album-tabs" aria-label={t("albums")}>
          <button aria-pressed={!album} onClick={() => changeAlbum("")}>
            <GalleryIcon name="image" />
            {t("allImages")}
          </button>
          {overview.albums.map((a) => (
            <button
              key={a.id}
              aria-pressed={album === a.id}
              onClick={() => changeAlbum(a.id)}
            >
              <span className={`gallery-dot color-${a.color}`} />
              {a.name}
            </button>
          ))}
          <button
            className="gallery-new-album"
            onClick={() => setAlbumDialog("new")}
          >
            <GalleryIcon name="plus" />
            {t("newAlbum")}
          </button>
        </div>
        {activeAlbum && (
          <button
            ref={albumRef}
            className="gallery-icon-button"
            aria-label={t("albumOptions")}
            onClick={() => setAlbumMenu(!albumMenu)}
          >
            <GalleryIcon name="more" />
          </button>
        )}
      </div>
      {albumMenu && activeAlbum && (
        <Popover
          anchor={albumRef}
          onClose={() => setAlbumMenu(false)}
          label={t("albumOptions")}
        >
          <div className="gallery-menu">
            <button
              onClick={() => {
                setAlbumDialog(activeAlbum);
                setAlbumMenu(false);
              }}
            >
              {t("editAlbum")}
            </button>
            <button
              className="gallery-danger-text"
              onClick={() => {
                setDeleteAlbum(activeAlbum);
                setAlbumMenu(false);
              }}
            >
              {t("deleteAlbum")}
            </button>
          </div>
        </Popover>
      )}
      <div className="gallery-toolbar">
        <div className="gallery-views" role="group" aria-label={t("view")}>
          {VIEWS.map((v) => (
            <button
              key={v}
              title={t(`views.${v}`)}
              aria-label={t(`views.${v}`)}
              aria-pressed={p?.view === v}
              onClick={() =>
                preferences({
                  view: v,
                  ...(v === "timeline" &&
                  !["uploaded", "captured"].includes(p?.sort ?? "")
                    ? { sort: "captured" }
                    : {}),
                })
              }
            >
              <GalleryIcon name={v} />
              <span>{t(`views.${v}`)}</span>
            </button>
          ))}
        </div>
        <div className="gallery-tools">
          <label className="gallery-search">
            <GalleryIcon name="search" />
            <input
              type="search"
              value={search}
              maxLength={120}
              placeholder={t("search")}
              aria-label={t("search")}
              onChange={(e) => {
                setSearch(e.target.value);
                setSelected([]);
              }}
            />
          </label>
          <button
            ref={filterRef}
            className="gallery-icon-button"
            aria-label={t("filters")}
            aria-pressed={filtered}
            onClick={() => setFilterOpen(!filterOpen)}
          >
            <GalleryIcon name="tag" />
            {filtered && <span className="gallery-filter-dot" />}
          </button>
          <button
            ref={settingsRef}
            className="gallery-icon-button"
            aria-label={t("displayOptions")}
            onClick={() => setSettings(!settings)}
          >
            <GalleryIcon name="tune" />
          </button>
        </div>
      </div>
      {settings && p && (
        <Popover
          anchor={settingsRef}
          onClose={() => setSettings(false)}
          label={t("displayOptions")}
        >
          <div className="gallery-options">
            <h2>{t("displayOptions")}</h2>
            {["grid", "masonry", "timeline"].includes(p.view) && (
              <>
                <label>
                  {t("thumbnailSize")}
                  <ListSelect
                    label={t("thumbnailSize")}
                    value={p.size}
                    onChange={(size) => preferences({ size })}
                    options={["small", "medium", "large"].map((value) => ({
                      value,
                      label: t(`sizes.${value}`),
                    }))}
                  />
                </label>
                <label>
                  {t("density")}
                  <ListSelect
                    label={t("density")}
                    value={p.density}
                    onChange={(density) => preferences({ density })}
                    options={["comfortable", "compact"].map((value) => ({
                      value,
                      label: t(`densities.${value}`),
                    }))}
                  />
                </label>
              </>
            )}
            <label>
              {t("sort")}
              <ListSelect
                label={t("sort")}
                value={p.sort}
                onChange={(sort) =>
                  preferences({
                    sort,
                    ...(sort === "manual" ? { direction: "asc" } : {}),
                  })
                }
                options={(p.view === "timeline"
                  ? ["uploaded", "captured"]
                  : ["uploaded", "captured", "name", "manual"]
                ).map((value) => ({ value, label: t(`sorts.${value}`) }))}
              />
            </label>
            {p.sort !== "manual" && (
              <label>
                {t("direction")}
                <ListSelect
                  label={t("direction")}
                  value={p.direction}
                  onChange={(direction) => preferences({ direction })}
                  options={["desc", "asc"].map((value) => ({
                    value,
                    label: t(`directions.${value}`),
                  }))}
                />
              </label>
            )}
            {p.view === "timeline" && (
              <label>
                {t("group")}
                <ListSelect
                  label={t("group")}
                  value={p.group}
                  onChange={(group) => preferences({ group })}
                  options={["day", "month", "year"].map((value) => ({
                    value,
                    label: t(`groups.${value}`),
                  }))}
                />
              </label>
            )}
            {p.view !== "list" && p.view !== "compact" && (
              <label className="gallery-check">
                <input
                  type="checkbox"
                  checked={p.info}
                  onChange={(e) => preferences({ info: e.target.checked })}
                />
                {t("showInfo")}
              </label>
            )}
            {p.sort === "manual" && <p>{t("manualHint")}</p>}
          </div>
        </Popover>
      )}
      {filterOpen && (
        <Popover
          anchor={filterRef}
          onClose={() => setFilterOpen(false)}
          label={t("filters")}
        >
          <div className="gallery-options">
            <h2>{t("filters")}</h2>
            <label>
              {t("tagFilter")}
              <input
                value={tag}
                maxLength={30}
                onChange={(e) => {
                  setTag(e.target.value.toLocaleLowerCase());
                  setSelected([]);
                }}
                placeholder={t("tagPlaceholder")}
              />
            </label>
            <label>
              {t("format")}
              <ListSelect
                label={t("format")}
                value={mime}
                options={[
                  { value: "", label: t("allFormats") },
                  ...["jpeg", "png", "webp", "avif"].map((m) => ({
                    value: `image/${m}`,
                    label: m.toUpperCase(),
                  })),
                ]}
                onChange={(v) => {
                  setMime(v);
                  setSelected([]);
                }}
              />
            </label>
            <div>
              <span className="gallery-field-label">{t("from")}</span>
              <DatePicker
                label={t("from")}
                value={from}
                onChange={(v) => {
                  setFrom(v ?? "");
                  setSelected([]);
                }}
              />
            </div>
            <div>
              <span className="gallery-field-label">{t("to")}</span>
              <DatePicker
                label={t("to")}
                value={to}
                onChange={(v) => {
                  setTo(v ?? "");
                  setSelected([]);
                }}
              />
            </div>
            <button onClick={clearFilters}>{t("clearFilters")}</button>
          </div>
        </Popover>
      )}
      {!model.online && (
        <p className="gallery-error" role="status">
          {t("offline")}
        </p>
      )}
      {error && (
        <div className="gallery-error" role="alert">
          <span>{error}</span>
          <button
            className="gallery-icon-button"
            aria-label={t("close")}
            onClick={() => setError("")}
          >
            <GalleryIcon name="close" />
          </button>
        </div>
      )}
      {notice && <p role="status">{notice}</p>}
      {filtered && (
        <div className="gallery-active-filters">
          <span>{t("filtered")}</span>
          {tag && <span>{tag}</span>}
          {mime && <span>{mime.replace("image/", "")}</span>}
          {(from || to) && (
            <span>
              {from} / {to}
            </span>
          )}
          <button onClick={clearFilters}>{t("clearFilters")}</button>
        </div>
      )}
      {!!files.length && (
        <UploadQueue
          key={queueKey}
          files={files}
          slug={slug}
          albumId={album || undefined}
          onClear={() => setFiles([])}
        />
      )}
      {!!selected.length && (
        <div
          className="gallery-selection-bar"
          aria-label={t("selectionActions")}
        >
          <button
            className="gallery-icon-button"
            onClick={() => setSelected([])}
            aria-label={t("clearSelection")}
          >
            <GalleryIcon name="close" />
          </button>
          <strong>{t("selected", { count: selected.length })}</strong>
          <button
            disabled={busy}
            onClick={() => setSelected(images.slice(0, 100).map((i) => i.key))}
          >
            {t("selectLoaded")}
          </button>
          <div className="gallery-selection-actions">
            <button
              disabled={busy}
              onClick={() => {
                setTargetAlbum(album || overview.albums[0]?.id || "");
                setBulkDialog("album");
              }}
            >
              <GalleryIcon name="album" />
              {t("albums")}
            </button>
            <button disabled={busy} onClick={() => setBulkDialog("tags")}>
              <GalleryIcon name="tag" />
              {t("tags")}
            </button>
            <button disabled={busy} onClick={download}>
              <GalleryIcon name="download" />
              <span>{t(busy ? "working" : "download")}</span>
            </button>
            <button
              className="gallery-danger-text"
              disabled={busy}
              onClick={() => setDeleteImages(true)}
            >
              <GalleryIcon name="trash" />
              <span>{t("delete")}</span>
            </button>
          </div>
        </div>
      )}
      {model.status === "LoadingFirstPage" ? (
        <div className="gallery-loading" role="status">
          {t("loading")}
        </div>
      ) : !images.length && model.status === "Exhausted" ? (
        <div className="gallery-empty">
          <GalleryIcon name={album ? "album" : "image"} />
          <h2>
            {t(filtered ? "noResults" : album ? "emptyAlbum" : "emptyTitle")}
          </h2>
          <p>
            {t(
              filtered
                ? "noResultsHint"
                : album
                  ? "emptyAlbumHint"
                  : "emptyHint",
            )}
          </p>
          <button
            className="lists-primary"
            onClick={() =>
              filtered ? clearFilters() : fileInput.current?.click()
            }
            disabled={!filtered && (!!files.length || !model.online)}
          >
            {t(filtered ? "clearFilters" : "upload")}
          </button>
        </div>
      ) : p?.view === "timeline" ? (
        <div className="gallery-timeline">
          {groups.length > 1 && (
            <nav aria-label={t("periods")}>
              {groups.map(([label], index) => (
                <a key={label} href={`#gallery-period-${index}`}>
                  {label}
                </a>
              ))}
            </nav>
          )}
          {groups.map(([label, items], index) => (
            <section key={label} id={`gallery-period-${index}`}>
              <h2>
                {label}
                <span>{items.length}</span>
              </h2>
              <div className="gallery-grid">{items.map(item)}</div>
            </section>
          ))}
        </div>
      ) : p?.view === "masonry" ? (
        <GalleryMasonry
          images={images}
          render={item}
          size={p.size}
          density={p.density}
          info={p.info}
        />
      ) : (
        <div
          className={
            p?.view === "masonry"
              ? "gallery-masonry"
              : p?.view === "list"
                ? "gallery-list"
                : "gallery-grid"
          }
        >
          {images.map(item)}
        </div>
      )}
      {model.status !== "Exhausted" && model.status !== "LoadingFirstPage" && (
        <div className="gallery-load-more">
          <button
            disabled={model.status === "LoadingMore"}
            onClick={model.loadMore}
          >
            {t(model.status === "LoadingMore" ? "loading" : "loadMore")}
          </button>
          <span>
            {t("loaded", { count: images.length, total: overview.count })}
          </span>
        </div>
      )}
      {dragging && (
        <div className="gallery-drop-overlay">
          <GalleryIcon name="upload" />
          <strong>{t("dropHere")}</strong>
          <span>{t("uploadHint")}</span>
        </div>
      )}
      {opened && (
        <GalleryLightbox
          key={opened.key}
          image={opened}
          slug={slug}
          model={model}
          onClose={close}
          hasPrev={images.findIndex((i) => i.key === opened.key) > 0}
          hasNext={
            images.findIndex((i) => i.key === opened.key) < images.length - 1
          }
          onNavigate={(offset) => {
            const index = images.findIndex((i) => i.key === opened.key),
              next = images[index + offset];
            if (next) setOpened(next);
          }}
        />
      )}
      {albumDialog && (
        <AlbumDialog
          album={albumDialog === "new" ? undefined : albumDialog}
          model={model}
          onClose={() => setAlbumDialog(null)}
        />
      )}
      {deleteAlbum && (
        <GalleryConfirm
          album
          count={0}
          busy={busy}
          error={error}
          onClose={() => setDeleteAlbum(null)}
          onConfirm={() =>
            void run(
              () => model.album({ kind: "delete", id: deleteAlbum.id }),
              () => {
                setDeleteAlbum(null);
                changeAlbum("");
              },
            )
          }
        />
      )}
      {deleteImages && (
        <GalleryConfirm
          count={selected.length}
          busy={busy}
          error={error}
          onClose={() => setDeleteImages(false)}
          onConfirm={() =>
            void run(
              () => model.bulk({ kind: "delete", keys: selected }),
              () => {
                setSelected([]);
                setDeleteImages(false);
                setNotice(t("deleted"));
              },
            )
          }
        />
      )}
      {bulkDialog && (
        <Modal
          label={t(bulkDialog === "tags" ? "assignTags" : "organize")}
          className="gallery-dialog"
          onClose={() => {
            if (!busy) setBulkDialog(null);
          }}
        >
          <h2>{t(bulkDialog === "tags" ? "assignTags" : "organize")}</h2>
          <p>{t("selected", { count: selected.length })}</p>
          {bulkDialog === "tags" ? (
            <label>
              {t("tags")}
              <input
                autoFocus
                value={bulkTags}
                maxLength={380}
                onChange={(e) => setBulkTags(e.target.value)}
                placeholder={t("tagsPlaceholder")}
              />
            </label>
          ) : (
            <label>
              {t("album")}
              <ListSelect
                label={t("album")}
                value={targetAlbum}
                options={overview.albums.map((a) => ({
                  value: a.id,
                  label: a.name,
                }))}
                onChange={setTargetAlbum}
              />
            </label>
          )}
          {!overview.albums.length && bulkDialog === "album" && (
            <button onClick={() => setAlbumDialog("new")}>
              {t("newAlbum")}
            </button>
          )}
          {error && (
            <p className="gallery-error" role="alert">
              {error}
            </p>
          )}
          <div className="gallery-dialog-actions">
            <button disabled={busy} onClick={() => setBulkDialog(null)}>
              {t("cancel")}
            </button>
            {bulkDialog === "album" && (
              <>
                <button
                  disabled={busy || !targetAlbum}
                  onClick={() =>
                    void run(
                      () =>
                        model.bulk({
                          kind: "removeAlbum",
                          keys: selected,
                          albumId: targetAlbum as GalleryAlbum["id"],
                        }),
                      () => setBulkDialog(null),
                    )
                  }
                >
                  {t("removeFromAlbum")}
                </button>
                <button
                  disabled={busy || !targetAlbum}
                  onClick={() =>
                    void run(
                      () =>
                        model.bulk({
                          kind: "moveAlbum",
                          keys: selected,
                          albumId: targetAlbum as GalleryAlbum["id"],
                        }),
                      () => setBulkDialog(null),
                    )
                  }
                >
                  {t("moveToAlbum")}
                </button>
              </>
            )}
            <button
              className="lists-primary"
              disabled={
                busy ||
                (bulkDialog === "album" ? !targetAlbum : !bulkTags.trim())
              }
              onClick={() =>
                void run(
                  () =>
                    model.bulk({
                      kind: bulkDialog === "tags" ? "tags" : "addAlbum",
                      keys: selected,
                      ...(bulkDialog === "tags"
                        ? {
                            tags: bulkTags
                              .split(",")
                              .map((v) => v.trim())
                              .filter(Boolean),
                          }
                        : { albumId: targetAlbum as GalleryAlbum["id"] }),
                    }),
                  () => {
                    setBulkDialog(null);
                    setBulkTags("");
                  },
                )
              }
            >
              {t(bulkDialog === "tags" ? "assignTags" : "addToAlbum")}
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}
