"use client";
import { useTranslations } from "next-intl";
import { SPACE_COLORS, spaceTileStyle } from "../utils/space-colors";
import { ListGlyph } from "@/features/lists/components/list-icon";
import "./space-color-picker.css";
export function SpaceColorPicker({
  value,
  onChange,
  disabled = false,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const t = useTranslations("spaceColors");
  return (
    <div className="space-color-picker" role="group" aria-label={t("label")}>
      <strong>{t("label")}</strong>
      <div>
        {SPACE_COLORS.map((color) => (
          <button
            key={color.key}
            type="button"
            title={t(color.key)}
            aria-label={t(color.key)}
            aria-pressed={value === color.value}
            disabled={disabled}
            style={spaceTileStyle(color.value)}
            onClick={() => onChange(color.value)}
          >
            {value === color.value ? (
              <ListGlyph name="tick" />
            ) : !color.value ? (
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                aria-hidden="true"
              >
                <path d="m5 19 14-14" />
              </svg>
            ) : null}
          </button>
        ))}
      </div>
    </div>
  );
}
