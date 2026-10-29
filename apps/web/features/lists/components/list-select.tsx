"use client";
import {
  Children,
  isValidElement,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useTranslations } from "next-intl";
import { Popover } from "./overlays";
import { ListGlyph } from "./list-icon";

export interface SelectOption {
  value: string;
  label: string;
  icon?: ReactNode;
  description?: string;
  disabled?: boolean;
}
export function SelectOptionItem(_props: {
  value: string;
  children: ReactNode;
  disabled?: boolean;
  icon?: ReactNode;
}) {
  return null;
}
export function SelectField({
  children,
  value,
  onChange,
  className,
  disabled,
  "aria-label": label,
}: {
  children: ReactNode;
  value: string;
  onChange: (event: { target: { value: string } }) => void;
  className?: string;
  disabled?: boolean;
  "aria-label"?: string;
}) {
  const options: SelectOption[] = [];
  const collect = (nodes: ReactNode) =>
    Children.forEach(nodes, (node) => {
      if (
        !isValidElement<{
          value?: string;
          children?: ReactNode;
          disabled?: boolean;
          icon?: ReactNode;
        }>(node)
      )
        return;
      if (node.type === SelectOptionItem)
        options.push({
          value: node.props.value ?? "",
          label: String(node.props.children ?? ""),
          icon: node.props.icon,
          disabled: node.props.disabled,
        });
      else collect(node.props.children);
    });
  collect(children);
  const t = useTranslations("lists");
  return (
    <ListSelect
      label={label ?? t("chooseValue")}
      value={value}
      options={options.map((option) => ({
        ...option,
        icon:
          option.icon ??
          (className?.includes("lists-color-") ? (
            <span className={`lists-color-dot lists-color-${option.value}`} />
          ) : undefined),
      }))}
      onChange={(value) => onChange({ target: { value } })}
      className={className}
      disabled={disabled}
    />
  );
}
export function ListSelect({
  value,
  options,
  onChange,
  label,
  disabled = false,
  placeholder,
  className = "",
  searchable = true,
  display,
}: {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  label: string;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  searchable?: boolean;
  display?: ReactNode;
}) {
  const t = useTranslations("lists"),
    id = useId(),
    anchor = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false),
    [search, setSearch] = useState(""),
    [active, setActive] = useState(0);
  const selected = options.find((option) => option.value === value);
  const filtered = options.filter((o) =>
    o.label.toLocaleLowerCase().includes(search.toLocaleLowerCase()),
  );
  const choose = (value: string) => {
    onChange(value);
    setOpen(false);
    setSearch("");
    requestAnimationFrame(() => anchor.current?.focus());
  };
  const show = () => {
    setSearch("");
    setActive(
      Math.max(
        0,
        options.findIndex((o) => o.value === value),
      ),
    );
    setOpen(true);
  };
  return (
    <>
      <button
        ref={anchor}
        type="button"
        className={`lists-combobox ${className}`}
        role="combobox"
        aria-label={label}
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        aria-haspopup="listbox"
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : show())}
        onKeyDown={(e) => {
          if (["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) {
            e.preventDefault();
            show();
          }
        }}
      >
        <span>
          {display ?? (
            <>
              {selected?.icon}
              <span>{selected?.label ?? placeholder ?? t("chooseValue")}</span>
            </>
          )}
        </span>
        <ListGlyph name="down" />
      </button>
      {open && (
        <Popover anchor={anchor} label={label} onClose={() => setOpen(false)}>
          <div
            className="lists-select-panel"
            onKeyDown={(event) => {
              if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
                event.preventDefault();
                const direction = event.key === "ArrowUp" ? -1 : 1;
                let next =
                  event.key === "Home"
                    ? 0
                    : event.key === "End"
                      ? filtered.length - 1
                      : (active + direction + filtered.length) %
                        Math.max(1, filtered.length);
                for (
                  let i = 0;
                  i < filtered.length && filtered[next]?.disabled;
                  i++
                )
                  next = (next + direction + filtered.length) % filtered.length;
                setActive(next);
                document
                  .getElementById(id + "-" + next)
                  ?.scrollIntoView({ block: "nearest" });
              } else if (event.key === "Enter") {
                event.preventDefault();
                const option = filtered[active];
                if (option && !option.disabled) choose(option.value);
              } else if (event.key === "Escape") {
                event.preventDefault();
                event.stopPropagation();
                setOpen(false);
                anchor.current?.focus();
              }
            }}
          >
            {searchable && (
              <input
                className="lists-select-search"
                autoFocus
                placeholder={t("searchOptions")}
                aria-label={t("searchOptions")}
                role="combobox"
                aria-expanded="true"
                aria-controls={id}
                aria-activedescendant={
                  filtered[active] ? id + "-" + active : undefined
                }
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setActive(0);
                }}
              />
            )}
            <div
              id={id}
              role="listbox"
              aria-label={label}
              className="lists-select-options"
              data-popover-focus={!searchable ? "" : undefined}
              tabIndex={searchable ? -1 : 0}
              aria-activedescendant={
                filtered[active] ? id + "-" + active : undefined
              }
            >
              {filtered.map((option, index) => (
                <button
                  type="button"
                  role="option"
                  id={id + "-" + index}
                  key={option.value}
                  tabIndex={-1}
                  aria-selected={value === option.value}
                  disabled={option.disabled}
                  data-active={active === index}
                  onPointerMove={() => setActive(index)}
                  onClick={() => choose(option.value)}
                >
                  <span className="lists-option-content">
                    {option.icon}
                    <span>
                      <span>{option.label}</span>
                      {option.description && (
                        <small>{option.description}</small>
                      )}
                    </span>
                  </span>
                  {value === option.value && <ListGlyph name="tick" />}
                </button>
              ))}
              {!filtered.length && (
                <p className="lists-select-empty">{t("noOptionsFound")}</p>
              )}
            </div>
          </div>
        </Popover>
      )}
    </>
  );
}
