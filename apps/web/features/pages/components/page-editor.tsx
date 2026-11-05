"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";
import {
  type Editor,
  EditorContent,
  useEditor,
  useEditorState,
} from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Image from "@tiptap/extension-image";
import { TableKit } from "@tiptap/extension-table";
import { Markdown } from "@tiptap/markdown";
import { useTranslations } from "next-intl";
import { Modal, Popover } from "@/features/lists/components/overlays";
import { LIST_ICONS, ListIcon } from "@/features/lists/components/list-icon";
import "./pages.css";
import { useParams } from "next/navigation";
import { MediaPicker } from "@/features/gallery/components/media-picker";
import { EditorGlyph } from "./editor-glyph";
import { WritingStyleMark } from "./writing-style";

export function PageConflictDialog({
  busy,
  body,
  onClose,
  onResolve,
}: {
  busy: boolean;
  body: string;
  onClose: () => void;
  onResolve: () => Promise<void>;
}) {
  const t = useTranslations("pages");
  return (
    <Modal label={t("resolve")} onClose={onClose}>
      <h2>{t("resolve")}</h2>
      <p>{t("resolveWarning")}</p>
      <div className="lists-modal-actions">
        <button
          className="lists-secondary"
          autoFocus
          disabled={busy}
          onClick={onClose}
        >
          {t("cancel")}
        </button>
        <button
          className="lists-secondary"
          onClick={() => {
            const url = URL.createObjectURL(
              new Blob([body], { type: "text/markdown" }),
            );
            const a = document.createElement("a");
            a.href = url;
            a.download = "Joti-draft.md";
            a.click();
            URL.revokeObjectURL(url);
          }}
        >
          {t("exportDraft")}
        </button>
        <button
          className="lists-primary"
          disabled={busy}
          onClick={() => void onResolve()}
        >
          {t("useSaved")}
        </button>
      </div>
    </Modal>
  );
}

export function PageDeleteDialog({
  name,
  busy,
  error,
  onClose,
  onDelete,
}: {
  name: string;
  busy: boolean;
  error?: string;
  onClose: () => void;
  onDelete: () => Promise<void>;
}) {
  const t = useTranslations("pages");
  return (
    <Modal label={t("delete")} onClose={onClose}>
      <h2>{t("delete")}</h2>
      <p>{t("deleteWarning", { name })}</p>
      {error && <p role="alert">{error}</p>}
      <div className="lists-modal-actions">
        <button
          className="lists-secondary"
          autoFocus
          disabled={busy}
          onClick={onClose}
        >
          {t("cancel")}
        </button>
        <button
          className="lists-primary lists-delete-confirm"
          disabled={busy}
          onClick={() => void onDelete()}
        >
          {t("delete")}
        </button>
      </div>
    </Modal>
  );
}

export function PageEditor({
  body,
  title,
  icon,
  onChange,
  onIcon,
  onSave,
  readOnly = false,
  iconOnly = false,
  showIcon = true,
  writingTools,
}: {
  body: string;
  title: string;
  icon?: string;
  onChange: (value: string) => void;
  onIcon: (value: string) => void;
  onSave: () => void;
  readOnly?: boolean;
  iconOnly?: boolean;
  showIcon?: boolean;
  writingTools?: (editor: Editor, disabled: boolean) => ReactNode;
}) {
  const params = useParams(),
    slug = String(params.slug ?? "");
  const t = useTranslations("pages");
  const tn = useTranslations("notes");
  const [blockQuery, setBlockQuery] = useState("");
  const [activeBlock, setActiveBlock] = useState(0);
  const [source, setSource] = useState(false);
  const [menu, setMenu] = useState<"insert" | "icon" | null>(null);
  const [dialog, setDialog] = useState<"link" | "image" | null>(null);
  const [url, setUrl] = useState("");
  const [alt, setAlt] = useState("");
  const [error, setError] = useState("");
  const [outline, setOutline] = useState(false);
  const anchor = useRef<HTMLButtonElement>(null);
  const iconAnchor = useRef<HTMLButtonElement>(null);
  const file = useRef<HTMLInputElement>(null);
  const change = useRef(onChange);
  change.current = onChange;
  const editor = useEditor({
    editable: !readOnly,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        link: { openOnClick: false, protocols: ["https", "http", "mailto"] },
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Image.configure({ allowBase64: false }),
      TableKit,
      WritingStyleMark,
      Markdown,
    ],
    content: body,
    contentType: "markdown",
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: "page-prose",
        role: "textbox",
        "aria-multiline": "true",
        "aria-label": t("content"),
      },
    },
    onUpdate: ({ editor }) => {
      const markdown = editor.getMarkdown();
      change.current(markdown);
    },
  });
  useEffect(() => {
    editor?.setEditable(!readOnly, false);
  }, [editor, readOnly]);
  const state = useEditorState({
    editor,
    selector: ({ editor }) =>
      editor
        ? {
            bold: editor.isActive("bold"),
            italic: editor.isActive("italic"),
            strike: editor.isActive("strike"),
            code: editor.isActive("code"),
            undo: editor.can().undo(),
            redo: editor.can().redo(),
            table: editor.isActive("table"),
            content: editor.getText(),
            headings: (() => {
              const result: string[] = [];
              editor.state.doc.descendants((node) => {
                if (node.type.name === "heading") result.push(node.textContent);
              });
              return result;
            })(),
          }
        : null,
  });
  // Local typing stays in ProseMirror. Only externally changed content is applied.
  useEffect(() => {
    if (editor && !source && body !== editor.getMarkdown())
      editor.commands.setContent(body, {
        contentType: "markdown",
        emitUpdate: false,
      });
  }, [body, editor, source]);
  const blocks = [
    "paragraph",
    "h1",
    "h2",
    "h3",
    "bullet",
    "numbered",
    "task",
    "quote",
    "codeBlock",
    "divider",
    "table",
    "link",
    "image",
  ] as const;
  const visibleBlocks = blocks.filter(
    (kind) =>
      !blockQuery ||
      `${t(kind)} ${tn(`blockHints.${kind}`)}`
        .toLocaleLowerCase()
        .includes(blockQuery.toLocaleLowerCase().trim()),
  );
  const openInsert = () => {
    setBlockQuery("");
    setActiveBlock(0);
    setMenu("insert");
  };
  const insert = (kind: string) => {
    if (!editor || readOnly) return;
    const chain = editor.chain().focus();
    if (kind === "paragraph") chain.setParagraph().run();
    if (kind === "h1" || kind === "h2" || kind === "h3")
      chain.toggleHeading({ level: Number(kind[1]) as 1 | 2 | 3 }).run();
    if (kind === "bullet") chain.toggleBulletList().run();
    if (kind === "numbered") chain.toggleOrderedList().run();
    if (kind === "task") chain.toggleTaskList().run();
    if (kind === "quote") chain.toggleBlockquote().run();
    if (kind === "codeBlock") chain.toggleCodeBlock().run();
    if (kind === "divider") chain.setHorizontalRule().run();
    if (kind === "table")
      chain.insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
    if (kind === "link" || kind === "image") {
      setUrl(
        kind === "link" ? String(editor.getAttributes("link").href ?? "") : "",
      );
      setDialog(kind);
      setError("");
    }
    setMenu(null);
  };
  const exportFile = () => {
    const href = URL.createObjectURL(
      new Blob([`# ${title}\n\n${body}`], {
        type: "text/markdown;charset=utf-8",
      }),
    );
    const a = document.createElement("a");
    a.href = href;
    a.download = `${title.replace(/[^\p{L}\p{N} _-]/gu, "").slice(0, 80) || "Joti"}.md`;
    a.click();
    URL.revokeObjectURL(href);
  };
  return (
    <div
      className={`page-editor ${iconOnly ? "page-icon-only" : ""}`}
      onKeyDown={(e) => {
        if ((e.metaKey || e.ctrlKey) && e.key === "s") {
          e.preventDefault();
          onSave();
        }
        if (
          e.key === "/" &&
          editor?.state.selection.$from.parent.isTextblock &&
          !editor.state.selection.$from.parent.textContent &&
          !source &&
          !readOnly &&
          !e.nativeEvent.isComposing &&
          e.target instanceof HTMLElement &&
          e.target.closest(".page-prose")
        ) {
          e.preventDefault();
          openInsert();
        }
      }}
    >
      <div className="page-tools" aria-label={t("tools")}>
        {showIcon && (
          <button
            ref={iconAnchor}
            title={t("icon")}
            aria-label={t("icon")}
            aria-expanded={menu === "icon"}
            onClick={() => setMenu(menu === "icon" ? null : "icon")}
          >
            <ListIcon name={icon ?? "book"} />
          </button>
        )}
        <button
          title={t("insert")}
          aria-label={t("insert")}
          ref={anchor}
          disabled={source}
          aria-expanded={menu === "insert"}
          onClick={() => (menu === "insert" ? setMenu(null) : openInsert())}
        >
          <EditorGlyph name="insert" />
        </button>
        {(
          [
            ["bold", "B"],
            ["italic", "I"],
            ["strike", "S"],
            ["code", "</>"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            className={`page-format-${key}`}
            disabled={source}
            title={t(key)}
            aria-label={t(key)}
            aria-pressed={state?.[key] ?? false}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              const chain = editor?.chain().focus();
              if (key === "bold") chain?.toggleBold().run();
              if (key === "italic") chain?.toggleItalic().run();
              if (key === "strike") chain?.toggleStrike().run();
              if (key === "code") chain?.toggleCode().run();
            }}
          >
            {label}
          </button>
        ))}
        {writingTools && editor && writingTools(editor, source || readOnly)}
        <button
          title={t("undo")}
          aria-label={t("undo")}
          disabled={!state?.undo || source}
          onClick={() => editor?.chain().focus().undo().run()}
        >
          <EditorGlyph name="undo" />
        </button>
        <button
          title={t("redo")}
          aria-label={t("redo")}
          disabled={!state?.redo || source}
          onClick={() => editor?.chain().focus().redo().run()}
        >
          <EditorGlyph name="redo" />
        </button>
        <button
          title="Markdown"
          aria-label="Markdown"
          aria-pressed={source}
          onClick={() => setSource(!source)}
        >
          <EditorGlyph name="markdown" />
        </button>
        <button
          title={t("outline")}
          aria-label={t("outline")}
          aria-pressed={outline}
          onClick={() => setOutline(!outline)}
        >
          <EditorGlyph name="outline" />
        </button>
        <button
          title={t("import")}
          aria-label={t("import")}
          disabled={source}
          onClick={() => file.current?.click()}
        >
          <EditorGlyph name="import" />
        </button>
        <button
          title={t("export")}
          aria-label={t("export")}
          onClick={exportFile}
        >
          <EditorGlyph name="export" />
        </button>
        <button
          title={t("print")}
          aria-label={t("print")}
          onClick={() => window.print()}
        >
          <EditorGlyph name="print" />
        </button>
      </div>
      {menu && (
        <Popover
          anchor={menu === "icon" ? iconAnchor : anchor}
          label={t(menu)}
          onClose={() => setMenu(null)}
        >
          {menu === "icon" ? (
            <div className="page-icon-grid">
              {LIST_ICONS.map((name) => (
                <button
                  key={name}
                  aria-label={t(`icons.${name}`)}
                  aria-pressed={name === icon}
                  onClick={() => {
                    onIcon(name);
                    setMenu(null);
                  }}
                >
                  <ListIcon name={name} />
                </button>
              ))}
            </div>
          ) : (
            <div
              className={`page-insert-menu${writingTools ? " note-insert-menu" : ""}`}
            >
              {writingTools && (
                <input
                  data-popover-focus
                  value={blockQuery}
                  aria-label={tn("findBlock")}
                  placeholder={tn("findBlock")}
                  onChange={(event) => {
                    setBlockQuery(event.target.value);
                    setActiveBlock(0);
                  }}
                  onKeyDown={(event) => {
                    if (!visibleBlocks.length || event.nativeEvent.isComposing)
                      return;
                    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                      event.preventDefault();
                      const step = event.key === "ArrowDown" ? 1 : -1;
                      const next =
                        (activeBlock + step + visibleBlocks.length) %
                        visibleBlocks.length;
                      setActiveBlock(next);
                      event.currentTarget.parentElement
                        ?.querySelectorAll("button")
                        [next]?.scrollIntoView({ block: "nearest" });
                    }
                    if (event.key === "Enter") {
                      event.preventDefault();
                      insert(visibleBlocks[activeBlock]!);
                    }
                  }}
                />
              )}
              {visibleBlocks.map((kind, index) => (
                <button
                  type="button"
                  key={kind}
                  data-highlighted={writingTools && index === activeBlock}
                  onClick={() => insert(kind)}
                >
                  <EditorGlyph name={kind} />
                  <span>
                    {t(kind)}
                    {writingTools && <small>{tn(`blockHints.${kind}`)}</small>}
                  </span>
                </button>
              ))}
              {!visibleBlocks.length && <p>{tn("noBlocks")}</p>}
            </div>
          )}
        </Popover>
      )}
      {outline && (
        <nav className="page-outline" aria-label={t("outline")}>
          {state?.headings.length ? (
            state.headings.map((text, i) => (
              <button
                key={i}
                onClick={() =>
                  document
                    .querySelectorAll(
                      ".page-prose h1,.page-prose h2,.page-prose h3",
                    )
                    [i]?.scrollIntoView({ block: "center" })
                }
              >
                {text}
              </button>
            ))
          ) : (
            <p>{t("noHeadings")}</p>
          )}
        </nav>
      )}
      {state?.table && !source && (
        <div className="page-table-tools">
          <button onClick={() => editor?.chain().focus().addRowAfter().run()}>
            {t("addRow")}
          </button>
          <button
            onClick={() => editor?.chain().focus().addColumnAfter().run()}
          >
            {t("addColumn")}
          </button>
          <button onClick={() => editor?.chain().focus().deleteRow().run()}>
            {t("deleteRow")}
          </button>
          <button onClick={() => editor?.chain().focus().deleteColumn().run()}>
            {t("deleteColumn")}
          </button>
          <button onClick={() => editor?.chain().focus().deleteTable().run()}>
            {t("deleteTable")}
          </button>
        </div>
      )}
      {source ? (
        <textarea
          className="page-markdown"
          aria-label={t("markdownSource")}
          value={body}
          onChange={(e) => onChange(e.target.value)}
          ref={(node) => {
            if (node) {
              node.style.height = "auto";
              node.style.height = `${node.scrollHeight}px`;
            }
          }}
        />
      ) : (
        <div className="page-writing">
          <EditorContent editor={editor} />
          {editor?.isEmpty && (
            <p className="page-placeholder">{t("placeholder")}</p>
          )}
        </div>
      )}
      {writingTools && (
        <div className="note-writing-stats">
          {(() => {
            const content = (source ? body : (state?.content ?? "")).trim();
            const words = content ? content.split(/\s+/).length : 0;
            return tn("writingStats", {
              words,
              characters: content.length,
              minutes: Math.ceil(words / 220),
            });
          })()}
        </div>
      )}
      {body.length > 30000 && (
        <p role="alert" className="workspace-field-error">
          {t("tooLong")}
        </p>
      )}
      {error && !dialog && (
        <p role="alert" className="workspace-field-error">
          {error}
        </p>
      )}
      <input
        ref={file}
        type="file"
        accept=".md,.markdown,.txt,text/plain,text/markdown"
        hidden
        onChange={async (e) => {
          const selected = e.target.files?.[0];
          e.target.value = "";
          if (!selected) return;
          if (selected.size > 120000) {
            setError(t("tooLong"));
            return;
          }
          try {
            const text = await selected.text();
            if (text.length > 30000) {
              setError(t("tooLong"));
              return;
            }
            editor
              ?.chain()
              .focus()
              .insertContent(text, { contentType: "markdown" })
              .run();
            setError("");
          } catch {
            setError(t("importError"));
          }
        }}
      />
      {dialog === "image" && slug ? (
        <MediaPicker
          slug={slug}
          onClose={() => setDialog(null)}
          onSelect={(src, alt) => {
            editor?.chain().focus().setImage({ src, alt }).run();
            setDialog(null);
          }}
        />
      ) : (
        dialog && (
          <Modal label={t(dialog)} onClose={() => setDialog(null)}>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                let valid = false;
                try {
                  valid = [
                    "https:",
                    "http:",
                    ...(dialog === "link" ? ["mailto:"] : []),
                  ].includes(new URL(url).protocol);
                } catch {
                  /* validation below */
                }
                if (!valid) {
                  setError(t("invalidUrl"));
                  return;
                }
                if (dialog === "image")
                  editor?.chain().focus().setImage({ src: url, alt }).run();
                else
                  editor
                    ?.chain()
                    .focus()
                    .extendMarkRange("link")
                    .setLink({ href: url })
                    .run();
                setDialog(null);
                setError("");
                setAlt("");
              }}
            >
              <h2>{t(dialog)}</h2>
              <label className="page-dialog-field">
                {t("url")}
                <input
                  autoFocus
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  required
                />
              </label>
              {dialog === "image" && (
                <label className="page-dialog-field">
                  {t("alt")}
                  <input
                    value={alt}
                    onChange={(e) => setAlt(e.target.value)}
                    required
                  />
                </label>
              )}
              {error && <p role="alert">{error}</p>}
              <div className="lists-modal-actions">
                <button
                  type="button"
                  className="lists-secondary"
                  onClick={() => setDialog(null)}
                >
                  {t("cancel")}
                </button>
                {dialog === "link" && (
                  <button
                    type="button"
                    className="lists-secondary"
                    onClick={() => {
                      editor?.chain().focus().unsetLink().run();
                      setDialog(null);
                    }}
                  >
                    {t("unlink")}
                  </button>
                )}
                <button className="lists-primary">{t("insert")}</button>
              </div>
            </form>
          </Modal>
        )
      )}
    </div>
  );
}
