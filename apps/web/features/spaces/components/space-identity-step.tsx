"use client";

import { useTranslations } from "next-intl";
import { SpaceSymbol } from "./space-symbol";
import {
  SPACE_NAME_MAX_LENGTH,
  SPACE_NAME_MIN_LENGTH,
} from "../validations/space.schema";
import {
  SPACE_ICON_CHOICES,
  type SpaceDraft,
  type SpaceIconChoice,
} from "../types/space.types";

export function SpaceIdentityStep({
  draft,
  nameError,
  onNameChange,
  onIconChange,
}: {
  draft: SpaceDraft;
  nameError?: string;
  onNameChange: (value: string) => void;
  onIconChange: (value: SpaceIconChoice) => void;
}) {
  const t = useTranslations("spaces.identity");
  return (
    <div className="setup-step-content">
      <header className="setup-title">
        <h1 tabIndex={-1}>{t("title")}</h1>
        <p>{t("subtitle")}</p>
      </header>
      <div className="setup-name-field">
        <label htmlFor="spaceName">{t("name")}</label>
        <input
          id="spaceName"
          value={draft.name}
          onChange={(event) => onNameChange(event.target.value)}
          placeholder={t("namePlaceholder")}
          maxLength={SPACE_NAME_MAX_LENGTH}
          autoComplete="off"
          aria-invalid={Boolean(nameError)}
          aria-describedby={
            nameError ? "spaceNameHelp spaceNameError" : "spaceNameHelp"
          }
        />
        <div className="setup-input-help">
          <p id="spaceNameHelp">
            {t("nameHint", {
              min: SPACE_NAME_MIN_LENGTH,
              max: SPACE_NAME_MAX_LENGTH,
            })}
          </p>
          <span aria-hidden="true">
            {t("nameCount", {
              count: draft.name.trim().length,
              max: SPACE_NAME_MAX_LENGTH,
            })}
          </span>
        </div>
        {nameError && (
          <p id="spaceNameError" role="alert" className="setup-field-error">
            {nameError}
          </p>
        )}
      </div>
      <fieldset className="setup-symbol-field">
        <legend>{t("icon")}</legend>
        <p>{t("iconHint")}</p>
        <div className="setup-symbols">
          {SPACE_ICON_CHOICES.map((icon, index) => (
            <label key={icon} data-selected={draft.icon === icon}>
              <input
                type="radio"
                name="spaceIcon"
                value={icon}
                checked={draft.icon === icon}
                onChange={() => onIconChange(icon)}
                aria-label={t(`symbols.${index}`)}
              />
              <SpaceSymbol value={icon} />
            </label>
          ))}
        </div>
      </fieldset>
    </div>
  );
}
