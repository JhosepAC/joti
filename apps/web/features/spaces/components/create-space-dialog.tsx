"use client";
import { useRef, useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Modal } from "@/features/lists/components/overlays";
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
export function CreateSpaceDialog({ onClose }: { onClose: () => void }) {
  const t = useTranslations("spaces.create"),
    router = useRouter(),
    [name, setName] = useState(""),
    [template, setTemplate] = useState("blank"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const params = useParams(),
    currentSlug = String(params.slug ?? "");
  const [mediaOpen, setMediaOpen] = useState(false);
  const key = useRef(crypto.randomUUID());
  const [icon, setIcon] = useState("🚀"),
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
              body: JSON.stringify({ name, template, icon, key: key.current }),
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
        <section className="space-icon-picker" aria-label={t("icon")}>
          <div className="space-icon-preview">
            {preview ? (
              <img src={preview} alt="" />
            ) : (
              <SpaceSymbol value={icon} />
            )}
          </div>
          <div>
            <strong>{t("icon")}</strong>
            <p>{t("iconHint")}</p>
            <button
              type="button"
              disabled={busy}
              onClick={() => pictureInput.current?.click()}
            >
              {t("uploadIcon")}
            </button>
            {currentSlug && (
              <button
                type="button"
                disabled={busy}
                onClick={() => setMediaOpen(true)}
              >
                {t("chooseMedia")}
              </button>
            )}
            {picture && (
              <button type="button" onClick={() => setPicture(null)}>
                {t("removeIcon")}
              </button>
            )}
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
                  !["image/jpeg", "image/png", "image/webp"].includes(
                    input.type,
                  )
                )
                  throw Error();
                setPicture(await prepareSpaceIcon(input));
                setError("");
              } catch {
                setError(t("iconError"));
              }
            }}
          />
          <div className="space-icon-options">
            {[
              ...SPACE_ICON_CHOICES,
              ...LIST_ICONS.map((v) => "symbol:" + v),
            ].map((v) => (
              <button
                key={v}
                type="button"
                aria-label={t("chooseIcon", { icon: v })}
                aria-pressed={!picture && icon === v}
                disabled={busy}
                onClick={() => {
                  setIcon(v);
                  setPicture(null);
                }}
              >
                <SpaceSymbol value={v} />
              </button>
            ))}
          </div>
        </section>
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
