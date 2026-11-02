"use client";
import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Popover } from "@/features/lists/components/overlays";
import { ListIcon, LIST_ICONS } from "@/features/lists/components/list-icon";
export function PageIconPicker({
  icon,
  onChange,
}: {
  icon?: string;
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
            {LIST_ICONS.map((v) => (
              <button
                key={v}
                aria-label={t(`icons.${v}`)}
                onClick={() => {
                  onChange(v);
                  setOpen(false);
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
