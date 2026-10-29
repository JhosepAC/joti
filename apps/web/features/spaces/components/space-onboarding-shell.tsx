"use client";

import { useTransition, type ReactNode } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { SpaceStepIndicator } from "./space-step-indicator";
import { useLocaleSwitcher } from "@/i18n/use-locale-switcher";
import "./space-onboarding.css";

interface Props {
  step: number;
  totalSteps: number;
  preview: ReactNode;
  onStepChange: (step: number) => void;
  isCreating: boolean;
  children: ReactNode;
}

export function SpaceOnboardingShell({
  step,
  totalSteps,
  preview,
  onStepChange,
  isCreating,
  children,
}: Props) {
  const t = useTranslations("spaces.onboarding");
  const settings = useTranslations("common.settings");
  const { locale, switchLocale } = useLocaleSwitcher();
  const [switching, startTransition] = useTransition();
  return (
    <div className="space-setup">
      <header className="setup-header">
        <Link href="/" className="setup-brand" aria-label="Nook">
          nook
        </Link>
        <SpaceStepIndicator
          current={step}
          total={totalSteps}
          onSelect={onStepChange}
          disabled={isCreating}
        />
      </header>
      <div className="setup-grid">
        <main className="setup-form">{children}</main>
        <aside className="setup-visual">{preview}</aside>
      </div>
      <footer className="setup-footer">
        <span>
          Nook <span>· {t("footer")}</span>
        </span>
        <select
          aria-label={settings("language")}
          value={locale}
          disabled={switching || isCreating}
          onChange={(event) =>
            startTransition(() =>
              switchLocale(event.target.value as "es" | "en"),
            )
          }
        >
          <option value="es">Español</option>
          <option value="en">English</option>
        </select>
        <span>
          {t("developedBy")}{" "}
          <a
            href="https://jhosep-ac.pages.dev/"
            target="_blank"
            rel="noopener noreferrer"
          >
            Jhosep Argomedo
          </a>
        </span>
      </footer>
    </div>
  );
}
