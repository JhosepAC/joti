"use client";
import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ListIcon, ListGlyph } from "@/features/lists/components/list-icon";
import { ListSelect } from "@/features/lists/components/list-select";
import { useNotes, errorCode, type NoteOperation } from "../hooks/use-notes";
import { NoteEditor } from "./note-editor";
import type { Note, NoteSummary } from "@/convex/notes/model";
import "./notes.css";
export function NotesModule({
  slug,
  onPage,
}: {
  slug: string;
  onPage: (id: string) => void;
}) {
  const t = useTranslations("notes"),
    locale = useLocale();
  const [selected, setSelected] = useState<string>(),
    [query, setQuery] = useState(""),
    [filter, setFilter] = useState("all"),
    [tag, setTag] = useState(""),
    [layout, setLayout] = useState("grid"),
    [sort, setSort] = useState("updated"),
    [capture, setCapture] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const model = useNotes(slug, selected),
    search = useRef<HTMLInputElement>(null),
    pending = useRef<{ signature: string; operation: NoteOperation } | null>(
      null,
    ),
    sending = useRef(false),
    trigger = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const key = new URLSearchParams(location.search).get("note");
    if (key) setSelected(key);
  }, []);
  const select = (key?: string) => {
    if (key) trigger.current = document.activeElement as HTMLElement;
    setSelected(key);
    const url = new URL(location.href);
    if (key) url.searchParams.set("note", key);
    else url.searchParams.delete("note");
    history.replaceState(null, "", url);
    if (!key)
      requestAnimationFrame(
        () => trigger.current?.isConnected && trigger.current.focus(),
      );
  };
  const cachedNote = useRef<Note | null>(null);
  if (model.data?.note) cachedNote.current = model.data.note;
  const selectedNote = model.data
    ? (model.data.note ??
      (cachedNote.current?.key === selected ? cachedNote.current : null))
    : null;
  const create = async (kind = "blank") => {
    if (sending.current) return;
    const body =
      capture.trim() ||
      (kind === "checklist"
        ? "- [ ] "
        : kind === "meeting"
          ? `## ${t("agenda")}\n\n\n## ${t("decisions")}\n\n\n## ${t("nextSteps")}\n\n- [ ] `
          : "");
    const title =
      capture.trim().split("\n")[0]?.slice(0, 120) ||
      t(kind === "blank" ? "untitled" : kind);
    const signature = JSON.stringify({ title, body });
    if (pending.current?.signature !== signature)
      pending.current = {
        signature,
        operation: {
          kind: "create",
          key: crypto.randomUUID(),
          opId: crypto.randomUUID(),
          fields: {
            title,
            body,
            icon: kind === "checklist" ? "check" : "book",
            color: "plain",
            tags: [],
            pinned: false,
            archived: false,
            trashed: false,
          },
        },
      };
    sending.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await model.save(pending.current!.operation);
      setCapture("");
      pending.current = null;
      select(result.key);
    } catch (cause) {
      setError(errorCode(cause));
    } finally {
      sending.current = false;
      setBusy(false);
    }
  };
  const createRef = useRef(create);
  createRef.current = create;
  useEffect(() => {
    const keys = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLElement &&
        e.target.closest("input,textarea,[contenteditable=true],dialog")
      )
        return;
      if (
        e.key.toLowerCase() === "n" &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey
      ) {
        e.preventDefault();
        void createRef.current();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        search.current?.focus();
      }
    };
    window.addEventListener("keydown", keys);
    return () => window.removeEventListener("keydown", keys);
  }, []);
  const all = model.data?.notes ?? [];
  const visible = all
    .filter((note) =>
      filter === "trash"
        ? note.trashed
        : filter === "archive"
          ? note.archived && !note.trashed
          : !note.trashed &&
            !note.archived &&
            (filter !== "pinned" || note.pinned),
    )
    .filter(
      (note) =>
        (!tag || note.tags.includes(tag)) &&
        `${note.title} ${note.preview} ${note.tags.join(" ")}`
          .toLocaleLowerCase(locale)
          .includes(query.toLocaleLowerCase(locale)),
    )
    .sort(
      (a, b) =>
        Number(b.pinned) - Number(a.pinned) ||
        (sort === "title"
          ? a.title.localeCompare(b.title)
          : sort === "created"
            ? b.createdAt - a.createdAt
            : b.updatedAt - a.updatedAt),
    );
  const tags = [
    ...new Set(all.filter((n) => !n.trashed).flatMap((n) => n.tags)),
  ].sort((a, b) => a.localeCompare(b));
  const card = (note: NoteSummary) => (
    <article className="notes-card" data-color={note.color} key={note.key}>
      <button
        className="notes-card-open"
        data-note-key={note.key}
        onClick={() => select(note.key)}
      >
        <div className="notes-card-heading">
          <ListIcon name={note.icon} />
          {note.pinned && (
            <span title={t("pinned")}>
              <ListGlyph name="star" />
            </span>
          )}
        </div>
        <h3>{note.title}</h3>
        <p>{note.preview || t("emptyNote")}</p>
        <div className="notes-card-tags">
          {note.tags.slice(0, 3).map((label) => (
            <span key={label}>#{label}</span>
          ))}
        </div>
        <time>
          {new Intl.DateTimeFormat(locale, {
            month: "short",
            day: "numeric",
          }).format(note.updatedAt)}
        </time>
      </button>
    </article>
  );
  return (
    <section className="notes-module lists-surface">
      <header className="notes-heading">
        <div>
          <h1>{t("name")}</h1>
          <p>{t("intro")}</p>
        </div>
        <button
          className="lists-primary"
          disabled={busy || !model.data}
          onClick={() => void create()}
        >
          <ListGlyph name="plus" />
          {t("new")}
        </button>
      </header>
      <form
        className="notes-capture"
        onSubmit={(e) => {
          e.preventDefault();
          void create();
        }}
      >
        <ListIcon name="bolt" />
        <label className="sr-only" htmlFor="quick-note">
          {t("capture")}
        </label>
        <input
          id="quick-note"
          placeholder={t("capture")}
          maxLength={30000}
          value={capture}
          onChange={(e) => setCapture(e.target.value)}
        />
        <button disabled={busy || !capture.trim() || !model.data}>
          {t("captureAction")}
        </button>
      </form>
      <div className="notes-toolbar">
        <div className="notes-tabs" role="group" aria-label={t("filter")}>
          {["all", "pinned", "archive", "trash"].map((value) => (
            <button
              key={value}
              aria-pressed={filter === value}
              onClick={() => setFilter(value)}
            >
              {t(value)}
            </button>
          ))}
        </div>
        <div className="notes-layout" role="group" aria-label={t("layout")}>
          <button
            aria-pressed={layout === "grid"}
            onClick={() => setLayout("grid")}
          >
            {t("grid")}
          </button>
          <button
            aria-pressed={layout === "list"}
            onClick={() => setLayout("list")}
          >
            {t("list")}
          </button>
        </div>
      </div>
      <div className="notes-filters">
        <input
          ref={search}
          type="search"
          aria-label={t("search")}
          placeholder={t("search")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <ListSelect
          label={t("tags")}
          value={tag}
          options={[
            { value: "", label: t("allTags") },
            ...tags.map((value) => ({ value, label: `#${value}` })),
          ]}
          onChange={setTag}
        />
        <ListSelect
          label={t("sort")}
          value={sort}
          options={["updated", "created", "title"].map((value) => ({
            value,
            label: t(`sorts.${value}`),
          }))}
          onChange={setSort}
        />
      </div>
      {(model.error || error) && (
        <div className="notes-error" role="alert">
          <p>
            {t(
              `errors.${["UNAUTHORIZED", "CONFLICT", "LIMIT_REACHED", "VALIDATION_ERROR"].includes(error || model.error) ? error || model.error : "UNAVAILABLE"}`,
            )}
          </p>
          <button
            onClick={() => {
              setError("");
              void model.retry();
            }}
          >
            {t("retry")}
          </button>
        </div>
      )}
      {!model.online && model.data && (
        <p role="status" className="notes-notice">
          {t("offline")}
        </p>
      )}
      {!model.data ? (
        <div className="notes-loading" aria-busy="true">
          {t("loading")}
        </div>
      ) : visible.length ? (
        <>
          <p className="notes-count">{t("count", { count: visible.length })}</p>
          <div className="notes-board" data-layout={layout}>
            {visible.map(card)}
          </div>
        </>
      ) : (
        <div className="notes-empty">
          <ListIcon name="book" />
          <h2>
            {t(
              query || tag
                ? "noMatches"
                : filter === "all"
                  ? "emptyTitle"
                  : "emptyFiltered",
            )}
          </h2>
          <p>{t(query || tag ? "searchHint" : "emptyHint")}</p>
          {filter === "all" && !query && !tag && (
            <div className="notes-starters">
              <button onClick={() => void create("blank")}>{t("blank")}</button>
              <button onClick={() => void create("checklist")}>
                {t("checklist")}
              </button>
              <button onClick={() => void create("meeting")}>
                {t("meeting")}
              </button>
            </div>
          )}
        </div>
      )}
      {model.data && selectedNote && selected === selectedNote.key && (
        <NoteEditor
          key={selected}
          note={selectedNote}
          missing={!model.data.notes.some((item) => item.key === selected)}
          history={model.data.history}
          notes={all}
          storageKey={`joti:note-draft:${model.data.owner}:${slug}:${selected}`}
          slug={slug}
          save={model.save}
          onClose={() => select(undefined)}
          onSelect={(key) => select(key)}
          onPage={onPage}
        />
      )}
    </section>
  );
}
