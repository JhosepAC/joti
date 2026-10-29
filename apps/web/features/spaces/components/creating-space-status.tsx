"use client";

import { useTranslations } from "next-intl";
import { SpinnerIcon } from "./icons";

export function CreatingSpaceStatus() {
  const t = useTranslations("spaces.creating");
  return (
    <p className="setup-creating" role="status">
      <SpinnerIcon />
      {t("title")}
    </p>
  );
}
