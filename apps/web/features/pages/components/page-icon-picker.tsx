"use client";
import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Popover } from "@/features/lists/components/overlays";
import { ListIcon, LIST_ICONS } from "@/features/lists/components/list-icon";
export function PageIconPicker({
  icon,
  onChange,
  options = LIST_ICONS,
}: {
  icon?: string;
  options?: readonly string[];
  onChange: (v: string) => void;
}) {
  const t = useTranslations("pages"),
    [open, setOpen] = useState(false),
    ref = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button
        className="page-title-icon"
        ref={ref}
        title={t("icon")}
        aria-label={t("icon")}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <ListIcon name={icon ?? "book"} />
      </button>
      {open && (
        <Popover anchor={ref} label={t("icon")} onClose={() => setOpen(false)}>
          <div className="page-icon-grid">
            {options.map((v) => (
              <button
                key={v}
                aria-pressed={v === icon}
                aria-label={t(`icons.${v}`)}
                onClick={() => {
                  onChange(v);
                  setOpen(false);
                  ref.current?.focus();
                }}
              >
                <ListIcon name={v} />
              </button>
            ))}
          </div>
        </Popover>
      )}
    </>
  );
}
