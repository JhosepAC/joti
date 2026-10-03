"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

/** Translated loading placeholder for `Suspense` boundaries. */
export const SuspenseFallback: React.FC<{ className?: string }> = ({ className }) => {
  const t = useTranslations("common.actions");
  return (
    <div className={cn("w-full max-w-[460px] mx-auto py-8 text-sm text-text-secondary", className)}>
      {t("loading")}
    </div>
  );
};
