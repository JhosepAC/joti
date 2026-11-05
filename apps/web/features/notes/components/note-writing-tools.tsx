"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ClipboardCopy,
  Copy,
  Eraser,
  GripVertical,
  Keyboard,
  Paintbrush,
  Palette,
  Search,
  Underline,
} from "lucide-react";
import { type Editor, useEditorState } from "@tiptap/react";
import { useTranslations } from "next-intl";
import { Modal, Popover } from "@/features/lists/components/overlays";
import {
  writingStyleOptions,
  type WritingStyle,
} from "@/features/pages/components/writing-style";

export function NoteWritingTools({
  editor,
  disabled,
}: {
  editor: Editor;
  disabled: boolean;
}) {
  const t = useTranslations("notes");
  const [panel, setPanel] = useState<"replace" | "shortcuts" | null>(null);
  const [query, setQuery] = useState("");
  const [replacement, setReplacement] = useState("");
  const [status, setStatus] = useState("");
  const [stylesOpen, setStylesOpen] = useState(false);
  const styleButton = useRef<HTMLButtonElement>(null);
  const copiedMarks = useRef<
    Editor["state"]["selection"]["$from"]["marks"] extends () => infer Marks
      ? Marks
      : never
  >([]);
  const [hasCopiedFormat, setHasCopiedFormat] = useState(false);
  const block = useRef<{
    from: number;
    to: number;
    doc: Editor["state"]["doc"];
  } | null>(null);
  const state = useEditorState({
    editor,
    selector: ({ editor }) => ({
      underline: editor.isActive("underline"),
    }),
  });

  const selectedBlock = () => {
    const {
      doc,
      selection: { $from },
    } = editor.state;
    if (!$from.depth) return null;
    return { doc, from: $from.before(1), to: $from.after(1) };
  };

  function moveBlock(
    origin: NonNullable<typeof block.current>,
    destination: number,
  ) {
    if (
      origin.doc !== editor.state.doc ||
      (destination >= origin.from && destination <= origin.to)
    )
      return;
    const node = origin.doc.nodeAt(origin.from);
    if (!node) return;
    const tr = editor.state.tr.delete(origin.from, origin.to);
    const insertion = tr.mapping.map(destination);
    tr.insert(insertion, node);
    editor.view.dispatch(tr);
    editor.commands.focus(insertion + 1);
  }

  function moveAdjacent(direction: -1 | 1) {
    const origin = selectedBlock();
    if (!origin) return;
    const adjacent =
      direction < 0
        ? origin.doc.resolve(origin.from).nodeBefore
        : origin.doc.nodeAt(origin.to);
    if (adjacent)
      moveBlock(
        origin,
        direction < 0
          ? origin.from - adjacent.nodeSize
          : origin.to + adjacent.nodeSize,
      );
  }

  function replaceAll() {
    if (!query || disabled) return;
    const matches: { from: number; to: number }[] = [];
    editor.state.doc.descendants((node, pos) => {
      if (!node.isText || !node.text) return;
      let index = node.text.indexOf(query);
      while (index !== -1) {
        matches.push({ from: pos + index, to: pos + index + query.length });
        index = node.text.indexOf(query, index + query.length);
      }
    });
    if (matches.length) {
      const transaction = editor.state.tr;
      for (const { from, to } of matches.reverse())
        transaction.insertText(replacement, from, to);
      editor.view.dispatch(transaction);
    }
    setStatus(t("replaced", { count: matches.length }));
  }

  async function copyRich() {
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/html": new Blob([editor.getHTML()], { type: "text/html" }),
          "text/plain": new Blob([editor.getText()], { type: "text/plain" }),
        }),
      ]);
      setStatus(t("copiedRich"));
    } catch {
      setStatus(t("copyFailed"));
    }
  }

  return (
    <div
      className="note-tool-group"
      role="group"
      aria-label={t("writingTools")}
    >
      <button
        ref={styleButton}
        type="button"
        title={t("textStyle")}
        aria-label={t("textStyle")}
        aria-expanded={stylesOpen}
        disabled={disabled}
        onClick={() => setStylesOpen(!stylesOpen)}
      >
        <Palette />
      </button>
      {stylesOpen && !disabled && (
        <Popover
          anchor={styleButton}
          label={t("textStyle")}
          onClose={() => setStylesOpen(false)}
        >
          <div className="note-style-panel">
            {(Object.keys(writingStyleOptions) as WritingStyle[]).map((key) => (
              <fieldset key={key}>
                <legend>{t(`styleFields.${key}`)}</legend>
                {writingStyleOptions[key].map((value, index) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={
                      editor.getAttributes("writingStyle")[key] === value
                    }
                    title={t(`styleChoices.${key}.${index}`)}
                    aria-label={t(`styleChoices.${key}.${index}`)}
                    style={
                      key === "backgroundColor"
                        ? { backgroundColor: value }
                        : { [key]: value }
                    }
                    onClick={() => {
                      editor
                        .chain()
                        .focus()
                        .setMark("writingStyle", {
                          ...editor.getAttributes("writingStyle"),
                          [key]: value,
                        })
                        .run();
                      setStylesOpen(false);
                    }}
                  >
                    Aa
                  </button>
                ))}
              </fieldset>
            ))}
          </div>
        </Popover>
      )}
      <button
        type="button"
        title={t("copyFormat")}
        aria-label={t("copyFormat")}
        disabled={disabled}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => {
          copiedMarks.current =
            editor.state.storedMarks ?? editor.state.selection.$from.marks();
          setHasCopiedFormat(true);
        }}
      >
        <Copy />
      </button>
      <button
        type="button"
        title={t("applyFormat")}
        aria-label={t("applyFormat")}
        disabled={disabled || !hasCopiedFormat}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => {
          const chain = editor.chain().focus().unsetAllMarks();
          for (const mark of copiedMarks.current)
            chain.setMark(mark.type.name, mark.attrs);
          chain.run();
        }}
      >
        <Paintbrush />
      </button>
      <button
        type="button"
        title={t("underline")}
        aria-label={t("underline")}
        aria-pressed={state.underline}
        disabled={disabled}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      >
        <Underline />
      </button>
      <button
        type="button"
        title={t("clearFormat")}
        aria-label={t("clearFormat")}
        disabled={disabled}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() =>
          editor.chain().focus().unsetAllMarks().clearNodes().run()
        }
      >
        <Eraser />
      </button>
      <button
        type="button"
        title={t("moveBlock")}
        aria-label={t("moveBlock")}
        disabled={disabled}
        draggable={!disabled}
        onKeyDown={(event) => {
          if (event.key === "ArrowUp" || event.key === "ArrowDown") {
            event.preventDefault();
            moveAdjacent(event.key === "ArrowUp" ? -1 : 1);
          }
        }}
        onDragStart={(event) => {
          block.current = selectedBlock();
          if (!block.current) {
            event.preventDefault();
            return;
          }
          event.dataTransfer.effectAllowed = "move";
          event.dataTransfer.setData("application/x-joti-note-block", "move");
          const dom = editor.view.nodeDOM(block.current.from);
          if (dom instanceof HTMLElement)
            event.dataTransfer.setDragImage(dom, 0, 0);
        }}
        onDragEnd={() => {
          block.current = null;
        }}
      >
        <GripVertical />
      </button>
      <button
        type="button"
        title={t("moveUp")}
        aria-label={t("moveUp")}
        disabled={disabled}
        onClick={() => moveAdjacent(-1)}
      >
        <ArrowUp />
      </button>
      <button
        type="button"
        title={t("moveDown")}
        aria-label={t("moveDown")}
        disabled={disabled}
        onClick={() => moveAdjacent(1)}
      >
        <ArrowDown />
      </button>
      <button
        type="button"
        title={t("replaceText")}
        aria-label={t("replaceText")}
        disabled={disabled}
        onClick={() => {
          setStatus("");
          setPanel("replace");
        }}
      >
        <Search />
      </button>
      <button
        type="button"
        title={t("copyRich")}
        aria-label={t("copyRich")}
        onClick={() => void copyRich()}
      >
        <ClipboardCopy />
      </button>
      <button
        type="button"
        title={t("shortcuts")}
        aria-label={t("shortcuts")}
        onClick={() => setPanel("shortcuts")}
      >
        <Keyboard />
      </button>
      <span className="sr-only" role="status">
        {!panel && status}
      </span>
      {panel && (
        <Modal
          label={t(panel === "replace" ? "replaceText" : "shortcuts")}
          className="note-tool-dialog"
          onClose={() => setPanel(null)}
        >
          <h2>{t(panel === "replace" ? "replaceText" : "shortcuts")}</h2>
          {panel === "replace" ? (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                replaceAll();
              }}
            >
              <label>
                {t("findText")}
                <input
                  autoFocus
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </label>
              <label>
                {t("replacement")}
                <input
                  value={replacement}
                  onChange={(event) => setReplacement(event.target.value)}
                />
              </label>
              <p role="status">{status}</p>
              <button className="lists-primary" disabled={!query || disabled}>
                {t("replaceAll")}
              </button>
            </form>
          ) : (
            <dl className="note-shortcuts">
              <div>
                <dt>{t("saveShortcut")}</dt>
                <dd>
                  <kbd>Ctrl / ⌘ + S</kbd>
                </dd>
              </div>
              <div>
                <dt>{t("insertShortcut")}</dt>
                <dd>
                  <kbd>/</kbd>
                </dd>
              </div>
              <div>
                <dt>{t("boldShortcut")}</dt>
                <dd>
                  <kbd>Ctrl / ⌘ + B</kbd>
                </dd>
              </div>
              <div>
                <dt>{t("moveBlock")}</dt>
                <dd>
                  <kbd>↑ / ↓</kbd>
                </dd>
              </div>
            </dl>
          )}
          <button
            type="button"
            className="lists-secondary"
            onClick={() => setPanel(null)}
          >
            {t("close")}
          </button>
        </Modal>
      )}
      {!disabled && (
        <NoteBlockDropTarget
          editor={editor}
          onDrop={(position) => {
            const origin = block.current;
            if (!origin) return;
            const $pos = editor.state.doc.resolve(position);
            if (!$pos.depth) moveBlock(origin, position);
            else
              moveBlock(
                origin,
                position - $pos.before(1) < $pos.after(1) - position
                  ? $pos.before(1)
                  : $pos.after(1),
              );
          }}
        />
      )}
    </div>
  );
}

function NoteBlockDropTarget({
  editor,
  onDrop,
}: {
  editor: Editor;
  onDrop: (position: number) => void;
}) {
  useEffect(() => {
    const view = editor.view;
    const type = "application/x-joti-note-block";
    const dragOver = (event: DragEvent) => {
      if (!event.dataTransfer?.types.includes(type)) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
    };
    const drop = (event: DragEvent) => {
      if (!event.dataTransfer?.types.includes(type)) return;
      event.preventDefault();
      event.stopPropagation();
      const hit = view.posAtCoords({ left: event.clientX, top: event.clientY });
      if (hit) onDrop(hit.pos);
    };
    view.dom.addEventListener("dragover", dragOver);
    view.dom.addEventListener("drop", drop, true);
    return () => {
      view.dom.removeEventListener("dragover", dragOver);
      view.dom.removeEventListener("drop", drop, true);
    };
  }, [editor, onDrop]);
  return null;
}
