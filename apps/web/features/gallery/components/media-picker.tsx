"use client";
import { ImageUp, X } from "lucide-react";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Modal } from "@/features/lists/components/overlays";
import { useGallery } from "../hooks/use-gallery";
import { GalleryPicture, mediaUrl } from "./gallery-image";
import "./media-picker.css";
export async function uploadMedia(
  slug: string,
  file: File,
  key = crypto.randomUUID(),
) {
  if (!file.size || file.size > 8 * 1024 * 1024) throw Error("INVALID_IMAGE");
  const form = new FormData();
  form.set("file", file);
  form.set("key", key);
  const r = await fetch(
    `/api/gallery/upload?slug=${encodeURIComponent(slug)}`,
    { method: "POST", body: form, signal: AbortSignal.timeout(90000) },
  );
  const d = await r.json();
  if (!r.ok) throw Error(d.code);
  for (let n = 0; n < 45; n++) {
    const ready = await fetch(
      "/api/gallery/media?slug=" +
        encodeURIComponent(slug) +
        "&key=" +
        encodeURIComponent(d.key) +
        "&variant=placeholder",
      { cache: "no-store" },
    );
    if (ready.ok) {
      await ready.arrayBuffer();
      return d.key as string;
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw Error("PROCESSING_FAILED");
}
function Collection({
  slug,
  onSelect,
}: {
  slug: string;
  onSelect: (url: string, alt: string) => void;
}) {
  const t = useTranslations("media"),
    [search, setSearch] = useState(""),
    model = useGallery(slug, { search, album: "", tag: "", mime: "" });
  if (model.error) return <p role="alert">{t("error")}</p>;
  return (
    <>
      <input
        aria-label={t("search")}
        placeholder={t("search")}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <div className="media-picker-grid">
        {model.images
          .filter((i) => i.status === "ready")
          .map((i) => (
            <button
              key={i.key}
              type="button"
              onClick={() => onSelect(mediaUrl(slug, i.key, "medium"), i.title)}
              aria-label={i.title}
            >
              <GalleryPicture image={i} slug={slug} />
              <span>{i.title}</span>
            </button>
          ))}
      </div>
      {!model.images.length && (
        <p role="status">
          {t(model.status === "LoadingFirstPage" ? "loading" : "empty")}
        </p>
      )}
      {model.status === "CanLoadMore" && (
        <button type="button" onClick={model.loadMore}>
          {t("more")}
        </button>
      )}
    </>
  );
}
export function MediaPicker({
  slug,
  onSelect,
  onClose,
}: {
  slug: string;
  onSelect: (url: string, alt: string) => void;
  onClose: () => void;
}) {
  const t = useTranslations("media"),
    [tab, setTab] = useState("gallery"),
    [url, setUrl] = useState(""),
    [alt, setAlt] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <Modal
      label={t("title")}
      className="media-picker"
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <header>
        <h2>{t("title")}</h2>
        <button
          type="button"
          aria-label={t("close")}
          disabled={busy}
          onClick={onClose}
        >
          <X size={16} strokeWidth={1.7} aria-hidden="true" />
        </button>
      </header>
      <nav aria-label={t("source")}>
        {["gallery", "upload", "link"].map((v) => (
          <button
            key={v}
            disabled={busy}
            aria-pressed={tab === v}
            onClick={() => {
              setTab(v);
              setError("");
            }}
          >
            {t(v)}
          </button>
        ))}
      </nav>
      {tab === "gallery" ? (
        <Collection slug={slug} onSelect={onSelect} />
      ) : tab === "upload" ? (
        <label className="media-upload">
          <ImageUp className="media-upload-icon" aria-hidden="true" />
          <strong>{t("chooseFile")}</strong>
          <span>{t("uploadHint")}</span>
          <input
            type="file"
            aria-label={t("chooseFile")}
            accept="image/jpeg,image/png,image/webp,image/avif"
            disabled={busy}
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              e.currentTarget.value = "";
              setBusy(true);
              setError("");
              try {
                const key = await uploadMedia(slug, file);
                onSelect(mediaUrl(slug, key, "medium"), file.name);
              } catch {
                setError(t("error"));
              } finally {
                setBusy(false);
              }
            }}
          />
        </label>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            try {
              if (!["https:", "http:"].includes(new URL(url).protocol))
                throw Error();
              onSelect(url, alt);
            } catch {
              setError(t("invalidUrl"));
            }
          }}
        >
          <label>
            {t("url")}
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              required
            />
          </label>
          <label>
            {t("alt")}
            <input
              value={alt}
              onChange={(e) => setAlt(e.target.value)}
              maxLength={200}
              required
            />
          </label>
          <button className="lists-primary">{t("insert")}</button>
        </form>
      )}
      {busy && <p role="status">{t("saving")}</p>}
      {error && <p role="alert">{error}</p>}
    </Modal>
  );
}
