"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Modal } from "@/features/lists/components/overlays";
import { ListIcon, ListGlyph } from "@/features/lists/components/list-icon";
export function CreateSpaceDialog({ onClose }: { onClose: () => void }) {
  const t = useTranslations("spaces.create"),
    router = useRouter(),
    [name, setName] = useState(""),
    [template, setTemplate] = useState("blank"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const key = useRef(crypto.randomUUID());
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
              body: JSON.stringify({ name, template, key: key.current }),
              signal: AbortSignal.timeout(25000),
            });
            const d = await r.json();
            if (!r.ok) throw Error(d.code);
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
    </Modal>
  );
}
