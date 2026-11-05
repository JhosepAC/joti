"use client";
import { X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Modal } from "@/features/lists/components/overlays";
import { ListSelect } from "@/features/lists/components/list-select";
import { PageEditor } from "@/features/pages/components/page-editor";
import { AccountGlyph } from "@/features/settings/components/account-glyph";
import {
  NOTE_COLORS,
  validateNote,
  type Note,
  type NoteSummary,
} from "@/convex/notes/model";
import { errorCode, type NoteOperation } from "../hooks/use-notes";
type Fields = Pick<
  Note,
  | "title"
  | "body"
  | "icon"
  | "color"
  | "tags"
  | "pinned"
  | "archived"
  | "trashed"
>;
const fields = (note: Note): Fields => ({
  title: note.title,
  body: note.body,
  icon: note.icon,
  color: note.color,
  tags: note.tags,
  pinned: note.pinned,
  archived: note.archived,
  trashed: note.trashed,
});
export function NoteEditor({
  note,
  missing = false,
  history,
  notes,
  storageKey,
  slug,
  onClose,
  onSelect,
  save,
  onPage,
}: {
  note: Note;
  missing?: boolean;
  history: { id: string; revision: number; createdAt: number; title: string }[];
  notes: NoteSummary[];
  storageKey: string;
  slug: string;
  onClose: () => void;
  onSelect: (key: string) => void;
  save: (
    op: NoteOperation,
  ) => Promise<{ ok: boolean; key: string; pageId?: string }>;
  onPage: (id: string) => void;
}) {
  const t = useTranslations("notes"),
    locale = useLocale();
  const [draft, setDraft] = useState(() => {
    try {
      const stored = JSON.parse(sessionStorage.getItem(storageKey) ?? "null");
      if (stored && Number.isSafeInteger(stored.baseRevision)) {
        validateNote(stored.fields);
        return stored as { fields: Fields; baseRevision: number };
      }
    } catch {}
    return { fields: fields(note), baseRevision: note.revision };
  });
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [actionBusy, setActionBusy] = useState(false),
    [confirm, setConfirm] = useState<"discard" | "delete" | null>(null),
    [showHistory, setShowHistory] = useState(false),
    [tag, setTag] = useState("");
  const current = useRef(draft),
    lastServer = useRef(fields(note)),
    pending = useRef<{ signature: string; op: NoteOperation } | null>(null),
    sending = useRef(false);
  current.current = draft;
  const dirty = JSON.stringify(draft.fields) !== JSON.stringify(fields(note)),
    readOnly = note.archived || note.trashed || missing;
  useEffect(() => {
    if (
      JSON.stringify(current.current.fields) ===
      JSON.stringify(lastServer.current)
    )
      setDraft({ fields: fields(note), baseRevision: note.revision });
    lastServer.current = fields(note);
  }, [note.revision]);
  useEffect(() => {
    try {
      if (dirty) sessionStorage.setItem(storageKey, JSON.stringify(draft));
      else sessionStorage.removeItem(storageKey);
    } catch {}
  }, [draft, dirty, storageKey]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  const edit = (part: Partial<Fields>) => {
    setDraft((previous) => ({
      ...previous,
      fields: { ...previous.fields, ...part },
    }));
    setError("");
  };
  const saveNow = async () => {
    if (sending.current) return null;
    if (missing) {
      setError("NOT_FOUND");
      return null;
    }
    if (!dirty) return current.current.baseRevision;
    const snapshot = current.current;
    let normalized: Fields;
    try {
      normalized = validateNote(snapshot.fields);
    } catch {
      setError("VALIDATION_ERROR");
      return null;
    }
    const signature = JSON.stringify(snapshot);
    if (pending.current?.signature !== signature)
      pending.current = {
        signature,
        op: {
          kind: "save",
          key: note.key,
          revision: snapshot.baseRevision,
          fields: normalized,
          opId: crypto.randomUUID(),
        },
      };
    sending.current = true;
    setBusy(true);
    try {
      await save(pending.current!.op);
      const revision = snapshot.baseRevision + 1;
      setDraft((previous) =>
        previous.baseRevision === snapshot.baseRevision
          ? {
              fields:
                JSON.stringify(previous.fields) ===
                JSON.stringify(snapshot.fields)
                  ? normalized
                  : previous.fields,
              baseRevision: revision,
            }
          : previous,
      );
      current.current = { ...current.current, baseRevision: revision };
      setError("");
      return revision;
    } catch (cause) {
      setError(errorCode(cause));
      return null;
    } finally {
      sending.current = false;
      setBusy(false);
    }
  };
  const saveRef = useRef(saveNow);
  saveRef.current = saveNow;
  useEffect(() => {
    if (!dirty || busy || actionBusy || error) return;
    const id = setTimeout(() => void saveRef.current(), 1000);
    return () => clearTimeout(id);
  }, [draft, dirty, busy, actionBusy, error]);
  const close = () => {
    if (busy || actionBusy) return;
    if (dirty) setConfirm("discard");
    else onClose();
  };
  const run = async (
    kind: "delete" | "duplicate" | "promote" | "restoreVersion",
    versionId?: string,
  ) => {
    if (sending.current || actionBusy) return;
    setActionBusy(true);
    try {
      const revision = await saveRef.current();
      if (revision === null) return;
      const result = await save({
        kind,
        key: note.key,
        revision,
        opId: crypto.randomUUID(),
        ...(kind === "duplicate" ? { newKey: crypto.randomUUID() } : {}),
        ...(versionId
          ? { versionId: versionId as NoteOperation["versionId"] }
          : {}),
      });
      if (kind === "delete") onClose();
      if (kind === "duplicate") onSelect(result.key);
      if (kind === "promote" && result.pageId) onPage(result.pageId);
      if (kind === "restoreVersion") {
        try {
          sessionStorage.removeItem(storageKey);
        } catch {}
        setShowHistory(false);
        setError("");
      }
    } catch (cause) {
      setError(errorCode(cause));
    } finally {
      setActionBusy(false);
    }
  };
  const exportDraft = () => {
    const url = URL.createObjectURL(
      new Blob([`# ${draft.fields.title}\n\n${draft.fields.body}`], {
        type: "text/markdown;charset=utf-8",
      }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `${draft.fields.title.replace(/[^\p{L}\p{N} _-]/gu, "").slice(0, 80) || "Joti"}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };
  const related = notes
    .filter(
      (n) =>
        n.key !== note.key &&
        !n.trashed &&
        !n.archived &&
        n.tags.some((label) => draft.fields.tags.includes(label)),
    )
    .slice(0, 4);
  return (
    <Modal className="notes-dialog" label={t("edit")} onClose={close}>
      <div
        className="notes-editor"
        data-color={draft.fields.color}
        onKeyDown={(e) => {
          if (e.key === "Escape" && !confirm) {
            e.preventDefault();
            e.stopPropagation();
            close();
          }
        }}
      >
        <header className="notes-editor-bar">
          <span role="status">
            {t(busy ? "saving" : dirty ? "unsaved" : "saved")}
          </span>
          <div>
            <button
              aria-pressed={draft.fields.pinned}
              disabled={busy || actionBusy || readOnly}
              onClick={() => edit({ pinned: !draft.fields.pinned })}
            >
              {t(draft.fields.pinned ? "unpin" : "pin")}
            </button>
            <button
              aria-label={t("close")}
              disabled={busy || actionBusy}
              onClick={close}
            >
              <AccountGlyph name="close" />
            </button>
          </div>
        </header>
        {error && (
          <div role="alert" className="notes-error">
            <p>
              {t(
                `errors.${["CONFLICT", "UNAUTHORIZED", "VALIDATION_ERROR", "LIMIT_REACHED", "NOT_FOUND", "READ_ONLY", "TRASH_REQUIRED"].includes(error) ? error : "UNAVAILABLE"}`,
              )}
            </p>
            <button
              onClick={() => {
                setError("");
                void saveRef.current();
              }}
            >
              {t("retry")}
            </button>
            <button onClick={exportDraft}>{t("export")}</button>
            {error === "CONFLICT" && (
              <button
                onClick={() => {
                  setDraft({
                    fields: fields(note),
                    baseRevision: note.revision,
                  });
                  setError("");
                }}
              >
                {t("useSaved")}
              </button>
            )}
          </div>
        )}
        <div className="notes-editor-scroll">
          {missing && (
            <p className="notes-notice" role="alert">
              {t("errors.NOT_FOUND")}
            </p>
          )}
          {(note.archived || note.trashed) && (
            <p className="notes-notice">
              {t(note.trashed ? "inTrash" : "inArchive")}
            </p>
          )}
          <label className="sr-only" htmlFor="note-title">
            {t("title")}
          </label>
          <input
            id="note-title"
            className="notes-title"
            value={draft.fields.title}
            maxLength={120}
            readOnly={readOnly}
            onChange={(e) => edit({ title: e.target.value })}
          />
          <div className="notes-metadata">
            <ListSelect
              label={t("color")}
              value={draft.fields.color}
              disabled={readOnly || actionBusy}
              options={NOTE_COLORS.map((color) => ({
                value: color,
                label: t(`colors.${color}`),
                icon: <span className="notes-color-dot" data-color={color} />,
              }))}
              onChange={(color) => edit({ color })}
            />
            <span>
              {new Intl.DateTimeFormat(locale, {
                dateStyle: "medium",
                timeStyle: "short",
              }).format(note.updatedAt)}
            </span>
          </div>
          <div className="notes-tag-editor">
            {draft.fields.tags.map((label) => (
              <button
                key={label}
                disabled={readOnly || actionBusy}
                aria-label={t("removeTag", { tag: label })}
                onClick={() =>
                  edit({
                    tags: draft.fields.tags.filter((value) => value !== label),
                  })
                }
              >
                #{label}
                <X size={12} strokeWidth={1.7} aria-hidden="true" />
              </button>
            ))}
            {!readOnly && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const value = tag.trim();
                  if (
                    value &&
                    value.length <= 30 &&
                    draft.fields.tags.length < 12 &&
                    !draft.fields.tags.some(
                      (t) => t.toLowerCase() === value.toLowerCase(),
                    )
                  ) {
                    edit({ tags: [...draft.fields.tags, value] });
                    setTag("");
                  }
                }}
              >
                <input
                  aria-label={t("addTag")}
                  placeholder={t("addTag")}
                  value={tag}
                  maxLength={30}
                  onChange={(e) => setTag(e.target.value)}
                />
              </form>
            )}
          </div>
          <div
            className={readOnly ? "notes-readonly" : ""}
            inert={actionBusy ? true : undefined}
          >
            <PageEditor
              body={draft.fields.body}
              title={draft.fields.title}
              icon={draft.fields.icon}
              readOnly={readOnly}
              onChange={(body) => edit({ body })}
              onIcon={(icon) => edit({ icon })}
              onSave={() => void saveRef.current()}
            />
          </div>
          {related.length > 0 && (
            <section className="notes-related">
              <h3>{t("related")}</h3>
              {related.map((item) => (
                <button
                  key={item.key}
                  disabled={busy || actionBusy || dirty}
                  onClick={() => onSelect(item.key)}
                >
                  {item.title}
                  <span>{item.tags.map((label) => `#${label}`).join(" ")}</span>
                </button>
              ))}
            </section>
          )}
        </div>
        <footer className="notes-editor-actions">
          <button
            disabled={busy || actionBusy || readOnly}
            onClick={() => edit({ archived: true, pinned: false })}
          >
            {t("archive")}
          </button>
          {readOnly && (
            <button
              disabled={busy || actionBusy}
              onClick={() => edit({ archived: false, trashed: false })}
            >
              {t("restore")}
            </button>
          )}
          {note.trashed ? (
            <button
              className="lists-danger"
              disabled={busy || actionBusy}
              onClick={() => setConfirm("delete")}
            >
              {t("delete")}
            </button>
          ) : (
            <button
              disabled={busy || actionBusy}
              onClick={() => edit({ trashed: true, pinned: false })}
            >
              {t("trash")}
            </button>
          )}
          <button
            disabled={busy || actionBusy}
            onClick={() => void run("duplicate")}
          >
            {t("duplicate")}
          </button>
          <button
            disabled={busy || actionBusy || readOnly}
            onClick={() => void run("promote")}
          >
            {t(note.pageId ? "openPage" : "toPage")}
          </button>
          <button
            onClick={() => setShowHistory(!showHistory)}
            aria-expanded={showHistory}
          >
            {t("history")}
          </button>
          <button onClick={exportDraft}>{t("export")}</button>
        </footer>
        {showHistory && (
          <section className="notes-history">
            <h3>{t("history")}</h3>
            {history.length ? (
              history.map((version) => (
                <div key={version.id}>
                  <span>
                    {new Intl.DateTimeFormat(locale, {
                      dateStyle: "short",
                      timeStyle: "short",
                    }).format(version.createdAt)}{" "}
                    · {version.title}
                  </span>
                  <button
                    disabled={busy || actionBusy || readOnly}
                    onClick={() => void run("restoreVersion", version.id)}
                  >
                    {t("restoreVersion")}
                  </button>
                </div>
              ))
            ) : (
              <p>{t("noHistory")}</p>
            )}
          </section>
        )}
        {confirm && (
          <Modal
            label={t(confirm === "delete" ? "delete" : "unsaved")}
            onClose={() => setConfirm(null)}
          >
            <h2>{t(confirm === "delete" ? "delete" : "unsaved")}</h2>
            <p>{t(confirm === "delete" ? "deleteHint" : "discardHint")}</p>
            <div className="lists-modal-actions">
              <button
                className="lists-secondary"
                autoFocus
                onClick={() => setConfirm(null)}
              >
                {t("cancel")}
              </button>
              <button
                className="lists-primary"
                disabled={actionBusy || busy}
                onClick={() => {
                  if (confirm === "delete") void run("delete");
                  else {
                    try {
                      sessionStorage.removeItem(storageKey);
                    } catch {}
                    onClose();
                  }
                }}
              >
                {t(confirm === "delete" ? "delete" : "discard")}
              </button>
            </div>
          </Modal>
        )}
      </div>
    </Modal>
  );
}
