"use client";
import { useState } from "react";
import type { GalleryImage } from "../hooks/use-gallery";
import { GalleryIcon } from "./gallery-icon";
import { useTranslations } from "next-intl";
export const mediaUrl = (slug: string, key: string, variant = "thumb") =>
  `/api/gallery/media?slug=${encodeURIComponent(slug)}&key=${encodeURIComponent(key)}&variant=${variant}`;
export function GalleryPicture({
  image,
  slug,
  detail = false,
  zoom = 1,
}: {
  image: GalleryImage;
  slug: string;
  detail?: boolean;
  zoom?: number;
}) {
  const t = useTranslations("gallery"),
    [failed, setFailed] = useState(false),
    [fallback, setFallback] = useState(false),
    [loaded, setLoaded] = useState(false);
  const width = (edge: number) =>
    Math.min(
      image.width,
      Math.round((image.width * edge) / Math.max(image.width, image.height)),
    );
  const thumbWidth = image.thumbWidth ?? width(480),
    mediumWidth = image.mediumWidth ?? width(1600),
    highWidth = image.highWidth ?? width(3840);
  if (image.status !== "ready" || failed)
    return (
      <span className="gallery-image-state">
        <GalleryIcon />
        <span>
          {t(image.status === "error" || failed ? "imageError" : "processing")}
        </span>
      </span>
    );
  return (
    <span className={`gallery-picture ${loaded ? "is-loaded" : ""}`}>
      {/* Authenticated media deliberately bypasses Next's public image optimizer/cache. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {!loaded && (
        <img
          className="gallery-placeholder"
          src={mediaUrl(slug, image.key, "placeholder")}
          alt=""
          aria-hidden="true"
          onError={(e) => {
            e.currentTarget.style.visibility = "hidden";
          }}
        />
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={mediaUrl(
          slug,
          image.key,
          fallback ? "thumb" : detail ? "high" : "thumb",
        )}
        srcSet={
          !fallback &&
          (detail ? highWidth !== mediumWidth : mediumWidth !== thumbWidth)
            ? detail
              ? `${mediaUrl(slug, image.key, "medium")} ${mediumWidth}w, ${mediaUrl(slug, image.key, "high")} ${highWidth}w`
              : `${mediaUrl(slug, image.key, "thumb")} ${thumbWidth}w, ${mediaUrl(slug, image.key, "medium")} ${mediumWidth}w`
            : undefined
        }
        sizes={
          detail
            ? `(max-width: 700px) ${Math.round(100 * zoom)}vw, ${Math.round(75 * zoom)}vw`
            : "(max-width: 600px) 45vw, (max-width: 1100px) 30vw, 300px"
        }
        alt={image.title}
        width={image.width}
        height={image.height}
        loading={detail ? "eager" : "lazy"}
        decoding="async"
        onLoad={() => setLoaded(true)}
        onError={() => {
          if (!fallback) {
            setFallback(true);
          } else {
            setFailed(true);
            console.error("Gallery media unavailable", { key: image.key });
          }
        }}
      />
    </span>
  );
}
