"use client";
import { Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { useLists } from "../hooks/use-lists";
import type { ListColumn, ListCommand, ListSummary, ListView } from "../types";
import { visibleRows, exportCsv, parseCsv } from "../lib/table";
import { ListIcon, ListGlyph } from "./list-icon";
import { Popover } from "./overlays";
import { EditableText } from "./editable-text";
import {
  IconPicker,
  InlineTitle,
  NewListDialog,
  RowDetail,
  RenameDialog,
} from "./list-dialogs";
import { ColumnEditor, PropertyVisibility } from "./column-editor";
import { ViewEditor } from "./view-editor";
import { ListTable } from "./list-table";
import "./lists.css";
import "./list-controls.css";
import { DeleteDialog } from "./delete-dialog";

export function ListsModule({
  slug,
  selectedKey,
  onSelect,
  onCatalog,
  newListSignal = 0,
  treeAction,
}: {
  slug: string;
  selectedKey?: string;
  onSelect: (key: string) => void;
  onCatalog: (lists: ListSummary[]) => void;
  newListSignal?: number;
  treeAction?: {
    sequence: number;
    key: string;
    action: "favorite" | "duplicate" | "rename" | "delete";
  };
}) {
  const t = useTranslations("lists");
  const locale = useLocale();
  const model = useLists(slug, selectedKey);
  const [search, setSearch] = useState("");
  const [viewId, setViewId] = useState("");
  const [trash, setTrash] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [creation, setCreation] = useState<{
    template?: "blank" | "tasks" | "shopping" | "packing";
    imported?: { headers: string[]; rows: string[][] };
    name?: string;
  } | null>(null);
  const [columnEditor, setColumnEditor] = useState<{
    column?: ListColumn;
  } | null>(null);
  const [viewEditor, setViewEditor] = useState<{
    mode: "view" | "filter" | "sort";
    view?: ListView;
  } | null>(null);
  const [popover, setPopover] = useState<
    "properties" | "lists" | "more" | null
  >(null);
  const [rowKey, setRowKey] = useState<string | null>(null);
  const [localError, setLocalError] = useState("");
  const [undo, setUndo] = useState<ListCommand | null>(null);
  const [renameTarget, setRenameTarget] = useState<ListSummary | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ListSummary | null>(null);
  const duplicateTarget = useRef<string | null>(null),
    seenTreeAction = useRef(0);
  const propertiesRef = useRef<HTMLButtonElement>(null),
    listsRef = useRef<HTMLButtonElement>(null),
    moreRef = useRef<HTMLButtonElement>(null),
    importRef = useRef<HTMLInputElement>(null);
  const seenCreateSignal = useRef(newListSignal);
  const list = model.data?.list;
  const summaries = model.data?.lists;
  const rows = model.data?.rows ?? [];
  useEffect(() => {
    if (
      !treeAction ||
      treeAction.sequence === seenTreeAction.current ||
      !summaries
    )
      return;
    const item = summaries.find((item) => item.key === treeAction.key);
    if (!item) return;
    seenTreeAction.current = treeAction.sequence;
    if (treeAction.action === "rename") setRenameTarget(item);
    else if (treeAction.action === "delete") setDeleteTarget(item);
    else if (treeAction.action === "favorite")
      model.enqueue({
        kind: "updateList",
        listKey: item.key,
        baseRevision: item.revision,
        favorite: !item.favorite,
      });
    else {
      const key = crypto.randomUUID();
      duplicateTarget.current = key;
      model.enqueue({
        kind: "duplicateList",
        listKey: item.key,
        key,
        name: t("copyName", { name: item.name }).slice(0, 100),
        baseRevision: item.revision,
      });
    }
  }, [treeAction, summaries, model.enqueue, t]);
  useEffect(() => {
    const key = duplicateTarget.current;
    if (key && model.raw?.lists.some((item) => item.key === key)) {
      duplicateTarget.current = null;
      onSelect(key);
    }
  }, [model.raw, onSelect]);
  useEffect(() => {
    if (summaries) onCatalog(summaries);
  }, [summaries, onCatalog]);
  useEffect(() => {
    if (newListSignal !== seenCreateSignal.current) {
      seenCreateSignal.current = newListSignal;
      setCreation({});
    }
  }, [newListSignal]);
  useEffect(() => {
    if (!selectedKey && list) onSelect(list.key);
  }, [list, selectedKey, onSelect]);
  useEffect(() => {
    if (
      selectedKey &&
      model.raw?.status === "ready" &&
      !model.pending &&
      !model.raw.lists.some((item) => item.key === selectedKey)
    ) {
      const next = model.raw.lists.find((item) => !item.archived);
      if (next) onSelect(next.key);
    }
  }, [selectedKey, model.raw, model.pending, onSelect]);
  useEffect(() => {
    setSearch("");
    setTrash(false);
    setRowKey(null);
    if (!list) return;
    let saved = "";
    try {
      saved = sessionStorage.getItem(`joti:list-view:${list.key}`) ?? "";
    } catch {}
    setViewId(
      list.views.some((view) => view.id === saved) ? saved : list.views[0]!.id,
    );
  }, [list?.key]);
  const view = list?.views.find((view) => view.id === viewId) ?? list?.views[0];
  const filtered = useMemo(
    () =>
      list && view ? visibleRows(rows, list.columns, view, search, locale) : [],
    [rows, list, view, search, locale],
  );
  const displayRows = trash ? rows.filter((row) => row.archived) : filtered;
  const chooseView = (id: string) => {
    setViewId(id);
    if (list)
      try {
        sessionStorage.setItem(`joti:list-view:${list.key}`, id);
      } catch {}
  };
  const send = (command: ListCommand) => {
    setLocalError("");
    return model.enqueue(command);
  };
  const create = (command: Extract<ListCommand, { kind: "createList" }>) => {
    send(command);
    onSelect(command.key);
  };
  const addRow = () => {
    if (!list || !view) return;
    const cells: Record<string, import("../types").CellValue> = {};
    for (const filter of view.filters)
      if (filter.operator === "equals" && filter.value !== null)
        cells[filter.columnId] = filter.value;
    const key = crypto.randomUUID();
    send({ kind: "addRows", listKey: list.key, rows: [{ key, cells }] });
    setRowKey(key);
  };
  const archive = (keys: string[], archived: boolean) => {
    if (!list) return;
    send({ kind: "archiveRows", listKey: list.key, rowKeys: keys, archived });
    setUndo({
      kind: "archiveRows",
      listKey: list.key,
      rowKeys: keys,
      archived: !archived,
    });
  };
  const exportFile = () => {
    if (!list || !view) return;
    const columns = list.columns.filter(
      (column) => !column.archived && !view.hidden.includes(column.id),
    );
    const csv = exportCsv(filtered, columns, locale);
    const link = document.createElement("a");
    link.href = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8;" }),
    );
    link.download =
      list.name.replace(/[^\p{L}\p{N}_-]/gu, "_").slice(0, 100) + ".csv";
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    setPopover(null);
  };
  const error = model.error || localError;
  const errorText = (code: string) =>
    t(
      `errors.${["UNAUTHORIZED", "UNAVAILABLE", "CONFLICT", "TYPE_CONVERSION", "LIMIT_REACHED", "DUPLICATE_NAME", "TITLE_REQUIRED", "IMPORT_ERROR", "VALIDATION_ERROR", "NOT_FOUND", "ARCHIVED", "PASTE_BOUNDS", "PASTE_INVALID"].includes(code) ? code : "UNAVAILABLE"}`,
    );
  const activeRow = rows.find((row) => row.key === rowKey);
  return (
    <div className="lists-surface lists-module">
      <input
        ref={importRef}
        type="file"
        accept=".csv,text/csv"
        hidden
        onChange={async (event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          try {
            if (file.size > 2_000_000) throw Error();
            setCreation({
              imported: parseCsv(await file.text()),
              name: file.name.replace(/\.csv$/i, ""),
            });
          } catch {
            setLocalError("IMPORT_ERROR");
          }
          event.target.value = "";
        }}
      />
      <header className="lists-module-header">
        <div className="lists-module-identity">
          <span className="lists-module-name">{t("moduleName")}</span>
          <button
            ref={listsRef}
            className="lists-list-switcher"
            type="button"
            aria-label={t("switchList")}
            onClick={() =>
              setPopover((value) => (value === "lists" ? null : "lists"))
            }
          >
            {list?.name ?? t("allLists")}
            <ListGlyph name="down" />
          </button>
        </div>
        <div
          className="lists-sync-status"
          role="status"
          data-pending={model.pending > 0}
          data-error={!!model.error}
        >
          <span aria-hidden="true" />
          {model.error
            ? t("needsAttention")
            : !model.connected
              ? t(model.pending ? "offlinePending" : "offline")
              : model.pending
                ? t("savingCount", { count: model.pending })
                : t("saved")}
        </div>
        <button className="lists-secondary" onClick={() => setCreation({})}>
          <ListGlyph name="plus" />
          {t("newList")}
        </button>
      </header>
      {error && (
        <div className="lists-error" role="alert">
          <span>{errorText(error)}</span>
          {model.error && (
            <>
              <button onClick={model.retry}>
                {t(error === "CONFLICT" ? "retryMine" : "retry")}
              </button>
              {error !== "UNAUTHORIZED" && (
                <button onClick={model.discard}>{t("discardPending")}</button>
              )}
            </>
          )}
          {error === "UNAUTHORIZED" && (
            <Link href="/auth/login">{t("signIn")}</Link>
          )}
          {localError && (
            <button onClick={() => setLocalError("")}>{t("close")}</button>
          )}
        </div>
      )}
      {!model.data || (model.loading && !list) ? (
        <div className="lists-loading" aria-busy={!error}>
          <h1>{t("moduleName")}</h1>
          {!error && (
            <>
              <div />
              <div />
              <div />
            </>
          )}
        </div>
      ) : !list ? (
        <section className="lists-welcome">
          <h1>{t("moduleName")}</h1>
          <p>{t("welcome")}</p>
          <div className="lists-starting-points">
            {(["tasks", "shopping", "packing", "blank"] as const).map(
              (template) => (
                <button
                  key={template}
                  onClick={() => setCreation({ template })}
                >
                  <ListIcon
                    name={
                      template === "shopping"
                        ? "basket"
                        : template === "packing"
                          ? "plane"
                          : "table"
                    }
                  />
                  <span>
                    <strong>{t(`templates.${template}.name`)}</strong>
                    <span>{t(`templates.${template}.description`)}</span>
                  </span>
                  <ListGlyph name="plus" />
                </button>
              ),
            )}
          </div>
          <button
            className="lists-text-button"
            onClick={() => importRef.current?.click()}
          >
            {t("importCsv")}
          </button>
        </section>
      ) : (
        view && (
          <>
            <div className="lists-heading-area">
              <div className="lists-title-line">
                <IconPicker
                  value={list.icon}
                  label={t("changeIcon")}
                  onChange={(icon) => {
                    if (!list.archived)
                      send({
                        kind: "updateList",
                        listKey: list.key,
                        baseRevision: list.revision,
                        icon,
                      });
                  }}
                />
                <InlineTitle
                  value={list.name}
                  version={list.revision}
                  label={t("renameList")}
                  onChange={(name, baseRevision) => {
                    if (!list.archived)
                      send({
                        kind: "updateList",
                        listKey: list.key,
                        baseRevision,
                        name,
                      });
                  }}
                />
              </div>
              <EditableText
                multiline
                version={list.revision}
                maxLength={1000}
                value={list.description}
                disabled={list.archived}
                label={t("description")}
                placeholder={t("descriptionPlaceholder")}
                className="lists-description"
                onCommit={(description, baseRevision) =>
                  send({
                    kind: "updateList",
                    listKey: list.key,
                    baseRevision,
                    description,
                  })
                }
              />
            </div>
            {list.archived && (
              <div className="lists-notice">
                {t("archivedList")}
                <button
                  onClick={() =>
                    send({
                      kind: "archiveList",
                      listKey: list.key,
                      baseRevision: list.revision,
                      archived: false,
                    })
                  }
                >
                  {t("restoreList")}
                </button>
              </div>
            )}
            <div className="lists-table-toolbar">
              <div
                role="tablist"
                aria-label={t("views")}
                className="lists-view-tabs"
              >
                {list.views.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    role="tab"
                    aria-selected={item.id === view.id}
                    onClick={() => chooseView(item.id)}
                    onDoubleClick={() => {
                      if (!list.archived)
                        setViewEditor({ mode: "view", view: item });
                    }}
                  >
                    <ListIcon name="table" />
                    {item.name}
                  </button>
                ))}
                <button
                  type="button"
                  className="lists-add-view"
                  aria-label={t("addView")}
                  disabled={list.archived}
                  onClick={() => setViewEditor({ mode: "view" })}
                >
                  <ListGlyph name="plus" />
                </button>
              </div>
              <div className="lists-view-tools">
                <button
                  aria-pressed={view.filters.length > 0}
                  disabled={list.archived}
                  onClick={() => setViewEditor({ mode: "filter", view })}
                >
                  {t("filter")}
                  {view.filters.length > 0 && (
                    <span>{view.filters.length}</span>
                  )}
                </button>
                <button
                  aria-pressed={view.sorts.length > 0}
                  disabled={list.archived}
                  onClick={() => setViewEditor({ mode: "sort", view })}
                >
                  {t("sort")}
                  {view.sorts.length > 0 && <span>{view.sorts.length}</span>}
                </button>
                <button
                  ref={propertiesRef}
                  disabled={list.archived}
                  onClick={() =>
                    setPopover((value) =>
                      value === "properties" ? null : "properties",
                    )
                  }
                >
                  {t("properties")}
                </button>
                <button
                  ref={moreRef}
                  aria-label={t("listSettings")}
                  onClick={() =>
                    setPopover((value) => (value === "more" ? null : "more"))
                  }
                >
                  <ListGlyph name="more" />
                </button>
                <button
                  className="lists-primary"
                  onClick={addRow}
                  disabled={list.archived}
                >
                  <ListGlyph name="plus" />
                  {t("newRow")}
                </button>
              </div>
            </div>
            <div className="lists-search-row">
              <label>
                <Search size="16" strokeWidth={1.7} aria-hidden="true" />
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={t("searchRows")}
                  aria-label={t("searchRows")}
                />
              </label>
              {view.filters.length > 0 && (
                <button
                  className="lists-text-button"
                  onClick={() =>
                    send({
                      kind: "setViews",
                      listKey: list.key,
                      baseRevision: list.revision,
                      views: list.views.map((item) =>
                        item.id === view.id ? { ...item, filters: [] } : item,
                      ),
                    })
                  }
                  disabled={list.archived}
                >
                  {t("clearFilters")}
                </button>
              )}
              <button
                className="lists-text-button"
                aria-pressed={trash}
                onClick={() => setTrash((value) => !value)}
              >
                {t("trashCount", {
                  count: rows.filter((row) => row.archived).length,
                })}
              </button>
            </div>
            <ListTable
              key={list.key}
              list={list}
              rows={displayRows}
              allRows={rows}
              view={view}
              send={send}
              onEditColumn={(column) => setColumnEditor({ column })}
              onOpenRow={setRowKey}
              onAddRow={addRow}
              onArchive={archive}
              readOnly={list.archived}
              trash={trash}
              onError={setLocalError}
            />
          </>
        )
      )}
      {deleteTarget && (
        <DeleteDialog
          name={deleteTarget.name}
          isList
          onClose={() => setDeleteTarget(null)}
          onDelete={() => {
            setUndo(null);
            send({
              kind: "deleteList",
              listKey: deleteTarget.key,
              baseRevision: deleteTarget.revision,
            });
          }}
        />
      )}
      {undo && (
        <div className="lists-undo" role="status">
          <span>{t("changeSaved")}</span>
          <button
            onClick={() => {
              send(undo);
              setUndo(null);
            }}
          >
            {t("undo")}
          </button>
          <button aria-label={t("close")} onClick={() => setUndo(null)}>
            <ListGlyph name="close" />
          </button>
        </div>
      )}
      {popover === "lists" && (
        <Popover
          anchor={listsRef}
          label={t("switchList")}
          onClose={() =>
            setPopover((value) => (value === "lists" ? null : value))
          }
        >
          <h3>{t("yourLists")}</h3>
          <label className="lists-check-label">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(event) => setShowArchived(event.target.checked)}
            />
            {t("showArchivedLists")}
          </label>
          <div className="lists-catalog-menu">
            {(summaries ?? [])
              .filter((item) => showArchived || !item.archived)
              .map((item) => (
                <button
                  key={item.key}
                  className="lists-menu-button"
                  aria-pressed={list?.key === item.key}
                  onClick={() => {
                    onSelect(item.key);
                    setPopover(null);
                  }}
                >
                  <ListIcon name={item.icon} />
                  <span>{item.name}</span>
                  {item.archived && <small>{t("archived")}</small>}
                </button>
              ))}
          </div>
          <button
            className="lists-menu-button"
            onClick={() => {
              setCreation({});
              setPopover(null);
            }}
          >
            <ListGlyph name="plus" />
            {t("newList")}
          </button>
        </Popover>
      )}
      {popover === "properties" && list && view && (
        <Popover
          anchor={propertiesRef}
          label={t("properties")}
          wide
          onClose={() =>
            setPopover((value) => (value === "properties" ? null : value))
          }
        >
          <PropertyVisibility
            list={list}
            viewId={view.id}
            send={send}
            onEdit={(column) => {
              setColumnEditor({ column });
              setPopover(null);
            }}
          />
        </Popover>
      )}
      {popover === "more" && list && view && (
        <Popover
          anchor={moreRef}
          label={t("listSettings")}
          onClose={() =>
            setPopover((value) => (value === "more" ? null : value))
          }
        >
          <button
            className="lists-menu-button"
            disabled={list.archived}
            onClick={() => {
              send({
                kind: "updateList",
                listKey: list.key,
                baseRevision: list.revision,
                favorite: !list.favorite,
              });
              setPopover(null);
            }}
          >
            <ListGlyph name="star" />
            {t(list.favorite ? "removeFavorite" : "addFavorite")}
          </button>
          <button
            className="lists-menu-button"
            disabled={list.archived}
            onClick={() => {
              const key = crypto.randomUUID();
              duplicateTarget.current = key;
              send({
                kind: "duplicateList",
                listKey: list.key,
                key,
                name: t("copyName", { name: list.name }).slice(0, 100),
                baseRevision: list.revision,
              });
              setPopover(null);
            }}
          >
            <ListGlyph name="copy" />
            {t("duplicateList")}
          </button>
          <button
            className="lists-menu-button"
            disabled={list.archived}
            onClick={() => {
              setRenameTarget(list);
              setPopover(null);
            }}
          >
            <ListGlyph name="edit" />
            {t("rename")}
          </button>
          <a
            className="lists-menu-button"
            href={`/w/${slug}?module=lists&list=${encodeURIComponent(list.key)}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <ListGlyph name="open" />
            {t("openNewTab")}
          </a>
          <button
            className="lists-menu-button"
            disabled={list.archived}
            onClick={() => {
              setViewEditor({ mode: "view", view });
              setPopover(null);
            }}
          >
            {t("editView")}
          </button>
          <button
            className="lists-menu-button"
            disabled={list.archived}
            onClick={() => {
              setColumnEditor({});
              setPopover(null);
            }}
          >
            {t("addProperty")}
          </button>
          <button className="lists-menu-button" onClick={exportFile}>
            {t("exportCsv")}
          </button>
          <button
            className="lists-menu-button"
            onClick={() => {
              importRef.current?.click();
              setPopover(null);
            }}
          >
            {t("importCsv")}
          </button>
          <button
            className="lists-menu-button lists-danger"
            onClick={() => {
              send({
                kind: "archiveList",
                listKey: list.key,
                baseRevision: list.revision,
                archived: !list.archived,
              });
              setPopover(null);
            }}
          >
            {t(list.archived ? "restoreList" : "archiveList")}
          </button>
          <button
            className="lists-menu-button lists-danger"
            onClick={() => {
              setDeleteTarget(list);
              setPopover(null);
            }}
          >
            {t("deleteList")}
          </button>
        </Popover>
      )}
      {renameTarget && (
        <RenameDialog
          name={renameTarget.name}
          onClose={() => setRenameTarget(null)}
          onSave={(name) => {
            send({
              kind: "updateList",
              listKey: renameTarget.key,
              baseRevision: renameTarget.revision,
              name,
            });
          }}
        />
      )}
      {creation && (
        <NewListDialog
          onClose={() => setCreation(null)}
          initialTemplate={creation.template}
          imported={creation.imported}
          importName={creation.name}
          onCreate={create}
        />
      )}
      {columnEditor && list && (
        <ColumnEditor
          list={list}
          column={columnEditor.column}
          send={send}
          onClose={() => setColumnEditor(null)}
        />
      )}
      {viewEditor && list && (
        <ViewEditor
          list={list}
          view={viewEditor.view}
          mode={viewEditor.mode}
          onClose={() => setViewEditor(null)}
          send={send}
          onSelect={chooseView}
        />
      )}
      {activeRow && list && (
        <RowDetail
          list={list}
          row={activeRow}
          send={send}
          onClose={() => setRowKey(null)}
        />
      )}
    </div>
  );
}
