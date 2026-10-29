"use client";
import { useLayoutEffect, useRef, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";

export function Popover({
  anchor,
  label,
  onClose,
  children,
  wide = false,
}: {
  anchor: RefObject<HTMLElement | null>;
  label: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useLayoutEffect(() => {
    const panel = ref.current;
    if (!panel) return;
    panel.showPopover();
    const position = () => {
      const rect = anchor.current?.getBoundingClientRect();
      if (
        rect &&
        (rect.bottom < 0 ||
          rect.top > innerHeight ||
          rect.right < 0 ||
          rect.left > innerWidth)
      ) {
        panel.hidePopover();
        return;
      }
      panel.style.left =
        Math.max(
          12,
          Math.min(rect?.left ?? 20, innerWidth - panel.offsetWidth - 12),
        ) + "px";
      panel.style.top =
        Math.max(
          12,
          Math.min(
            (rect?.bottom ?? 40) + 6,
            innerHeight - panel.offsetHeight - 12,
          ),
        ) + "px";
    };
    position();
    (
      panel.querySelector<HTMLElement>("[data-popover-focus]") ??
      panel.querySelector<HTMLElement>("[autofocus],input,button")
    )?.focus();
    window.addEventListener("resize", position);
    window.addEventListener("scroll", position, true);
    const observer = new ResizeObserver(position);
    observer.observe(panel);
    return () => {
      window.removeEventListener("resize", position);
      window.removeEventListener("scroll", position, true);
      observer.disconnect();
      if (panel.matches(":popover-open")) panel.hidePopover();
    };
  }, [anchor]);
  return createPortal(
    <div
      ref={ref}
      popover="auto"
      role="dialog"
      aria-label={label}
      className={`lists-surface lists-popover ${wide ? "lists-popover-wide" : ""}`}
      onToggle={(event) => {
        if (event.newState === "closed") close.current();
      }}
    >
      {children}
    </div>,
    anchor.current?.closest("dialog, [popover]") ?? document.body,
  );
}
export function Modal({
  label,
  onClose,
  children,
  wide = false,
  className = "",
}: {
  label: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useLayoutEffect(() => {
    const panel = ref.current;
    panel?.showModal();
    return () => panel?.close();
  }, []);
  return createPortal(
    <dialog
      ref={ref}
      closedby="none"
      className={`lists-surface lists-modal ${wide ? "lists-modal-wide" : ""} ${className}`}
      aria-label={label}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          onClose();
        }
      }}
      onCancel={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onClose();
      }}
      onClick={(event) => {
        const bounds = event.currentTarget.getBoundingClientRect();
        if (
          event.target === event.currentTarget &&
          (event.clientX < bounds.left ||
            event.clientX > bounds.right ||
            event.clientY < bounds.top ||
            event.clientY > bounds.bottom)
        )
          onClose();
      }}
    >
      {children}
    </dialog>,
    document.body,
  );
}
