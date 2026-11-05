"use client";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { GalleryIcon } from "./gallery-icon";
import { MAX_FILE_BYTES } from "@/convex/gallery/model";
type Item = {
  id: string;
  file: File;
  preview: string;
  state: "pending" | "uploading" | "done" | "error" | "cancelled";
  progress: number;
  error?: string;
  duplicate?: boolean;
};
export function UploadQueue({
  files,
  slug,
  albumId,
  onClear,
}: {
  files: File[];
  slug: string;
  albumId?: string;
  onClear: () => void;
}) {
  const t = useTranslations("gallery"),
    [items, setItems] = useState<Item[]>(() =>
      files.slice(0, 20).map((file) => ({
        id: crypto.randomUUID(),
        file,
        preview: URL.createObjectURL(file),
        state: file.size > MAX_FILE_BYTES ? "error" : "pending",
        progress: 0,
        ...(file.size > MAX_FILE_BYTES ? { error: "INVALID_IMAGE" } : {}),
      })),
    ),
    [running, setRunning] = useState(false);
  const current = useRef(items),
    requests = useRef(new Map<string, XMLHttpRequest>()),
    active = useRef(true);
  current.current = items;
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      for (const x of requests.current.values()) x.abort();
      for (const i of current.current) URL.revokeObjectURL(i.preview);
    };
  }, []);
  const patch = (id: string, value: Partial<Item>) => {
    if (active.current)
      setItems((old) => old.map((i) => (i.id === id ? { ...i, ...value } : i)));
  };
  const upload = (item: Item) =>
    new Promise<void>((resolve) => {
      const xhr = new XMLHttpRequest();
      requests.current.set(item.id, xhr);
      patch(item.id, { state: "uploading", progress: 0, error: undefined });
      xhr.open("POST", `/api/gallery/upload?slug=${encodeURIComponent(slug)}`);
      xhr.timeout = 90000;
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable)
          patch(item.id, { progress: Math.round((e.loaded / e.total) * 100) });
      };
      const finish = () => {
        requests.current.delete(item.id);
        resolve();
      };
      xhr.onload = () => {
        let data: { code?: string; duplicate?: boolean } = {};
        try {
          data = JSON.parse(xhr.responseText);
        } catch {}
        patch(
          item.id,
          xhr.status >= 200 && xhr.status < 300
            ? { state: "done", progress: 100, duplicate: data.duplicate }
            : { state: "error", error: data.code ?? "UNAVAILABLE" },
        );
        finish();
      };
      xhr.onerror = xhr.ontimeout = () => {
        patch(item.id, { state: "error", error: "UNAVAILABLE" });
        finish();
      };
      xhr.onabort = () => {
        patch(item.id, { state: "cancelled" });
        finish();
      };
      const form = new FormData();
      form.set("file", item.file);
      form.set("key", item.id);
      if (albumId) form.set("albumId", albumId);
      xhr.send(form);
    });
  const start = async () => {
    if (running) return;
    setRunning(true);
    const pending = current.current.filter((i) => i.state === "pending");
    let cursor = 0;
    const worker = async () => {
      while (active.current && cursor < pending.length) {
        const i = pending[cursor++];
        if (
          i &&
          current.current.find((v) => v.id === i.id)?.state === "pending"
        )
          await upload(i);
      }
    };
    await Promise.all([worker(), worker()]);
    if (active.current) setRunning(false);
  };
  const completed = items.filter((i) => i.state === "done").length;
  const batchComplete = !running && completed > 0 && completed === items.length;
  useEffect(() => {
    if (batchComplete) onClear();
  }, [batchComplete, onClear]);

  const progress = Math.round(
    items.reduce(
      (n, i) =>
        n +
        (i.state === "done" ? 100 : i.state === "uploading" ? i.progress : 0),
      0,
    ) / Math.max(1, items.length),
  );
  return (
    <aside className="gallery-upload-queue" aria-label={t("uploads")}>
      <div className="gallery-queue-heading">
        <div>
          <strong>{t("uploadCount", { count: items.length })}</strong>
          <p>{t("uploadHint")}</p>
        </div>
        <button
          className="gallery-icon-button"
          aria-label={t("close")}
          onClick={onClear}
          disabled={running}
        >
          <GalleryIcon name="close" />
        </button>
      </div>
      {files.length > 20 && <p role="alert">{t("batchLimit")}</p>}
      <div className="gallery-queue-items">
        {items.map((i) => (
          <div key={i.id} className="gallery-upload-item">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={i.preview}
              alt=""
              onError={(e) => {
                e.currentTarget.style.visibility = "hidden";
              }}
            />
            <div>
              <strong>{i.file.name}</strong>
              <span role="status">
                {i.error
                  ? t(
                      `errors.${["INVALID_IMAGE", "UNSUPPORTED_FORMAT", "STORAGE_LIMIT", "UNAUTHORIZED"].includes(i.error) ? i.error : "UNAVAILABLE"}`,
                    )
                  : t(
                      i.duplicate
                        ? "duplicate"
                        : i.state === "done"
                          ? "uploaded"
                          : i.state === "uploading" && i.progress === 100
                            ? "receiving"
                            : i.state,
                      { progress: i.progress },
                    )}
              </span>
              {i.state === "uploading" && (
                <progress
                  max={100}
                  value={i.progress}
                  aria-label={t("uploadProgress", { name: i.file.name })}
                />
              )}
            </div>
            {i.state === "uploading" ? (
              <button
                className="gallery-icon-button"
                onClick={() => requests.current.get(i.id)?.abort()}
                aria-label={t("cancel")}
              >
                <GalleryIcon name="close" />
              </button>
            ) : i.state === "error" || i.state === "cancelled" ? (
              <button
                disabled={i.file.size > MAX_FILE_BYTES || running}
                onClick={() =>
                  patch(i.id, { state: "pending", error: undefined })
                }
              >
                {t("retry")}
              </button>
            ) : i.state === "pending" ? (
              <button
                className="gallery-icon-button"
                aria-label={t("removeFile")}
                onClick={() => patch(i.id, { state: "cancelled" })}
              >
                <GalleryIcon name="close" />
              </button>
            ) : (
              <GalleryIcon name="check" />
            )}
          </div>
        ))}
      </div>
      <div className="gallery-queue-bottom">
        <span role="status">
          {t("uploadOverall", { done: completed, total: items.length })}
        </span>
        {running && (
          <progress
            max={100}
            value={progress}
            aria-label={t("overallProgress")}
          />
        )}
        <button
          className="lists-primary"
          disabled={running || !items.some((i) => i.state === "pending")}
          onClick={() => void start()}
        >
          {t(running ? "uploadingBatch" : "confirmUpload")}
        </button>
      </div>
    </aside>
  );
}
