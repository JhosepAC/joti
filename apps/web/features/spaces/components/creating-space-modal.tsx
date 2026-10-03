"use client";

import * as React from "react";
import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { SpinnerIcon } from "./icons";

interface Props {
  message: string;
}

/**
 * Centred modal shown while the space is being created. Blocks the page so the
 * user cannot re-submit, and narrates the steps so the pause reads as progress
 * rather than as a stall.
 *
 * The dialog takes focus when it mounts: it is modal, so leaving focus on the
 * (now inert-looking) button underneath would have a screen reader narrate a
 * screen the user can no longer act on.
 */
export const CreatingSpaceModal: React.FC<Props> = ({ message }) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const t = useTranslations("spaces.creating");

  useEffect(() => {
    panelRef.current?.focus();
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-primary/40 px-6 backdrop-blur-[2px]"
      onClick={(event) => event.stopPropagation()}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={t("title")}
        className="flex w-full max-w-[340px] flex-col items-center gap-4 rounded-3xl border border-border bg-background px-8 py-9 text-center shadow-xl shadow-black/5 outline-none"
      >
        <SpinnerIcon className="text-2xl text-icon" strokeWidth={2} />
        {/* `status` so each new line is announced without stealing focus. */}
        <p role="status" aria-live="polite" className="text-sm font-light text-text-primary">
          {message}
        </p>
      </div>
    </div>
  );
};
