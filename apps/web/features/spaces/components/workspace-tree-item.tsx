"use client";
import { useRef, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Popover } from "@/features/lists/components/overlays";
import { ListGlyph } from "@/features/lists/components/list-icon";
export type TreeAction = "favorite" | "duplicate" | "rename" | "delete";
export function WorkspaceTreeItem({
  name,
  icon,
  selected,
  favorite = false,
  dirty = false,
  href,
  onSelect,
  onAction,
  disabled = false,
  canDelete = false,
}: {
  name: string;
  icon: ReactNode;
  selected: boolean;
  favorite?: boolean;
  dirty?: boolean;
  href: string;
  onSelect: () => void;
  onAction: (action: TreeAction) => void;
  disabled?: boolean;
  canDelete?: boolean;
}) {
  const t = useTranslations("lists"),
    anchor = useRef<HTMLButtonElement>(null),
    [open, setOpen] = useState(false);
  const action = (value: TreeAction) => {
    setOpen(false);
    onAction(value);
  };
  return (
    <div className="workspace-tree-item" data-current={selected}>
      <button
        type="button"
        className="btn workspace-tree-main"
        aria-current={selected ? "page" : undefined}
        onClick={onSelect}
      >
        {icon}
        <span>{name}</span>
        {favorite && (
          <span className="workspace-tree-star">
            <ListGlyph name="star" />
          </span>
        )}
        {dirty && <span className="workspace-draft-dot" />}
      </button>
      <button
        ref={anchor}
        type="button"
        className="workspace-tree-options"
        aria-label={t("itemOptions", { name })}
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
      >
        <ListGlyph name="more" />
      </button>
      {open && (
        <Popover
          anchor={anchor}
          label={t("itemOptions", { name })}
          onClose={() => setOpen(false)}
        >
          <div
            className="lists-item-menu"
            role="menu"
            aria-label={name}
            onKeyDown={(e) => {
              if (["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) {
                e.preventDefault();
                const items = [
                  ...e.currentTarget.querySelectorAll<HTMLElement>(
                    '[role="menuitem"]',
                  ),
                ];
                const current = items.indexOf(
                  document.activeElement as HTMLElement,
                );
                items[
                  e.key === "Home"
                    ? 0
                    : e.key === "End"
                      ? items.length - 1
                      : (current +
                          (e.key === "ArrowDown" ? 1 : -1) +
                          items.length) %
                        items.length
                ]?.focus();
              } else if (e.key === "Escape") {
                e.preventDefault();
                e.stopPropagation();
                setOpen(false);
                anchor.current?.focus();
              }
            }}
          >
            <button
              type="button"
              role="menuitem"
              onClick={() => action("favorite")}
            >
              <ListGlyph name="star" />
              {t(favorite ? "removeFavorite" : "addFavorite")}
            </button>
            <hr />
            <button
              type="button"
              role="menuitem"
              onClick={() => action("duplicate")}
            >
              <ListGlyph name="copy" />
              {t("duplicate")}
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => action("rename")}
            >
              <ListGlyph name="edit" />
              {t("rename")}
            </button>
            <hr />
            <a
              href={href}
              role="menuitem"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setOpen(false)}
            >
              <ListGlyph name="open" />
              {t("openNewTab")}
            </a>
            {canDelete && (
              <>
                <hr />
                <button
                  type="button"
                  role="menuitem"
                  className="lists-danger"
                  onClick={() => action("delete")}
                >
                  {t("deleteList")}
                </button>
              </>
            )}
          </div>
        </Popover>
      )}
    </div>
  );
}
