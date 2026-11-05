"use client";

import { useId, useState, type PointerEvent } from "react";
import { useTranslations } from "next-intl";
import { hexToHsv, hsvToHex } from "../utils/hsv";
import { luminance, spaceTileStyle } from "../utils/space-colors";
import "./space-color-picker.css";

const clamp = (value: number) => Math.max(0, Math.min(1, value));

function ColorSpectrum({
  color,
  custom,
  onChange,
  disabled,
  resetLabel,
}: {
  color: string;
  custom: boolean;
  onChange: (color: string) => void;
  disabled: boolean;
  resetLabel: string;
}) {
  const t = useTranslations("spaceColors");
  const hintId = useId();
  const [lastGesture, setLastGesture] = useState<ReturnType<typeof hexToHsv>>();
  const [draft, setDraft] = useState<string | null>(null);
  // Keep the chosen hue while dragging through black, white and gray.
  const hsv =
    custom && lastGesture && hsvToHex(lastGesture) === color
      ? lastGesture
      : hexToHsv(color);

  const update = (next: typeof hsv) => {
    setDraft(null);
    setLastGesture(next);
    onChange(hsvToHex(next));
  };

  const pickPoint = (event: PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    update({
      ...hsv,
      s: clamp((event.clientX - rect.left) / rect.width),
      v: 1 - clamp((event.clientY - rect.top) / rect.height),
    });
  };

  const invalid = draft !== null && !/^#?[0-9a-f]{6}$/i.test(draft.trim());
  return (
    <>
      <div
        className="space-color-plane"
        role="group"
        tabIndex={disabled ? -1 : 0}
        aria-label={t("plane", {
          saturation: Math.round(hsv.s * 100),
          brightness: Math.round(hsv.v * 100),
        })}
        aria-describedby={hintId}
        style={{ backgroundColor: `hsl(${hsv.h} 100% 50%)` }}
        onPointerDown={(event) => {
          if (disabled || event.button !== 0 || !event.isPrimary) return;
          event.currentTarget.focus({ preventScroll: true });
          event.currentTarget.setPointerCapture(event.pointerId);
          pickPoint(event);
        }}
        onPointerMove={(event) => {
          if (
            !disabled &&
            event.currentTarget.hasPointerCapture(event.pointerId)
          )
            pickPoint(event);
        }}
        onKeyDown={(event) => {
          if (disabled) return;
          const step = event.shiftKey ? 0.1 : 0.01;
          const delta = {
            ArrowLeft: [-step, 0],
            ArrowRight: [step, 0],
            ArrowUp: [0, step],
            ArrowDown: [0, -step],
          }[event.key];
          if (!delta) return;
          event.preventDefault();
          update({
            ...hsv,
            s: clamp(hsv.s + delta[0]!),
            v: clamp(hsv.v + delta[1]!),
          });
        }}
      >
        <span
          className="space-color-cursor"
          aria-hidden="true"
          style={{
            left: `${hsv.s * 100}%`,
            top: `${(1 - hsv.v) * 100}%`,
            backgroundColor: color,
          }}
        />
      </div>
      <span id={hintId} className="sr-only">
        {t("planeKeys")}
      </span>
      <input
        className="space-color-hue"
        type="range"
        aria-label={t("hue")}
        min={0}
        max={359}
        value={Math.min(359, Math.round(hsv.h))}
        disabled={disabled}
        onChange={(event) =>
          update({ ...hsv, h: event.currentTarget.valueAsNumber })
        }
      />
      <div className="space-color-controls">
        <label className="space-color-hex">
          <span aria-hidden="true" style={{ backgroundColor: color }} />
          <input
            type="text"
            aria-label={t("hex")}
            aria-invalid={invalid}
            disabled={disabled}
            spellCheck={false}
            autoComplete="off"
            value={draft ?? color.toUpperCase()}
            onChange={(event) => {
              const raw = event.currentTarget.value;
              setDraft(raw);
              const digits = raw.trim().replace(/^#/, "");
              if (/^[0-9a-f]{6}$/i.test(digits)) {
                setLastGesture(undefined);
                onChange(`#${digits.toLowerCase()}`);
              }
            }}
            onBlur={() => setDraft(null)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                if (!invalid) event.currentTarget.blur();
              }
            }}
          />
        </label>
        <button
          type="button"
          className="space-color-reset"
          disabled={disabled || (!custom && draft === null)}
          onClick={() => {
            setDraft(null);
            setLastGesture(undefined);
            onChange("");
          }}
        >
          {resetLabel}
        </button>
      </div>
      {invalid && <small role="status">{t("invalidHex")}</small>}
    </>
  );
}

export function SpaceColorPicker({
  value,
  onChange,
  iconColor,
  onIconColorChange,
  image = false,
  disabled = false,
}: {
  value: string;
  onChange: (value: string) => void;
  iconColor: string;
  onIconColorChange: (value: string) => void;
  image?: boolean;
  disabled?: boolean;
}) {
  const t = useTranslations("spaceColors");
  const [target, setTarget] = useState<"label" | "icon">("label");
  const editingIcon = !image && target === "icon";
  const preview = spaceTileStyle(value, iconColor);
  const levels = [luminance(preview.background), luminance(preview.color)];
  const lowContrast =
    !image && (Math.max(...levels) + 0.05) / (Math.min(...levels) + 0.05) < 3;

  return (
    <div
      className="space-color-picker"
      role="group"
      aria-label={t("appearance")}
    >
      <div className="space-color-targets">
        {(["label", "icon"] as const).map((key) => (
          <button
            key={key}
            type="button"
            aria-pressed={key === (editingIcon ? "icon" : "label")}
            disabled={disabled || (image && key === "icon")}
            title={image && key === "icon" ? t("imageColor") : undefined}
            onClick={() => setTarget(key)}
          >
            {t(key)}
          </button>
        ))}
      </div>
      <ColorSpectrum
        key={editingIcon ? "icon" : "background"}
        color={(editingIcon ? preview.color : preview.background).toLowerCase()}
        custom={Boolean(editingIcon ? iconColor : value)}
        onChange={editingIcon ? onIconColorChange : onChange}
        resetLabel={t(editingIcon ? "automatic" : "default")}
        disabled={disabled}
      />
      {lowContrast && <small role="status">{t("lowContrast")}</small>}
    </div>
  );
}
