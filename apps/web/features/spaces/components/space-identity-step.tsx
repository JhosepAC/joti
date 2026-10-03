"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckIcon } from "./icons";
import { SPACE_NAME_MAX_LENGTH, SPACE_NAME_MIN_LENGTH } from "../validations/space.schema";
import { SPACE_ICON_CHOICES, type SpaceDraft, type SpaceIconChoice } from "../types/space.types";

interface Props {
  draft: SpaceDraft;
  nameError?: string;
  onNameChange: (value: string) => void;
  onIconChange: (icon: SpaceIconChoice) => void;
}

/** Step 1 — identity: name and icon, in two clearly separated sections. */
export const SpaceIdentityStep: React.FC<Props> = ({
  draft,
  nameError,
  onNameChange,
  onIconChange,
}) => {
  return (
    <div>
      <header className="mb-6">
        <h2 className="text-xl font-semibold text-text-primary font-heading">
          Identidad del espacio
        </h2>
        <p className="mt-1 text-sm font-light text-text-secondary">
          Dale un nombre y un ícono para reconocerlo fácilmente.
        </p>
      </header>

      {/* Name section */}
      <div className="rounded-2xl border border-border bg-surface p-5">
        <Label htmlFor="spaceName">Nombre del espacio</Label>
        <Input
          id="spaceName"
          value={draft.name}
          onChange={(event) => onNameChange(event.target.value)}
          hasError={Boolean(nameError)}
          placeholder="Espacio de Fátima"
          maxLength={SPACE_NAME_MAX_LENGTH}
          autoComplete="off"
          aria-invalid={Boolean(nameError)}
          aria-describedby={nameError ? "spaceNameHelp spaceNameError" : "spaceNameHelp"}
          className="mt-2.5 bg-background"
        />
        <div className="mt-2.5 flex items-center justify-between px-1">
          {/* The length hint stays put while the error appears, so the rule the
              user is breaking is still on screen next to the message about it. */}
          <p id="spaceNameHelp" className="text-[11px] text-text-muted">
            Entre {SPACE_NAME_MIN_LENGTH} y {SPACE_NAME_MAX_LENGTH} caracteres.
          </p>
          <p aria-hidden="true" className="text-[11px] tabular-nums text-text-muted">
            {draft.name.trim().length}/{SPACE_NAME_MAX_LENGTH}
          </p>
        </div>
        {nameError && (
          <p id="spaceNameError" role="alert" className="mt-1.5 text-xs text-error">
            {nameError}
          </p>
        )}
      </div>

      <div aria-hidden="true" className="my-6 border-t border-border" />

      {/* Icon section */}
      <div className="rounded-2xl border border-border bg-surface p-5">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-text-primary">Ícono del espacio</p>
            <p className="mt-0.5 text-xs font-light text-text-secondary">
              Elige el que mejor lo represente. Podrás cambiarlo más adelante.
            </p>
          </div>
          <span
            aria-hidden="true"
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-border bg-background text-2xl"
          >
            {draft.icon}
          </span>
        </div>
        <div role="group" aria-label="Íconos disponibles" className="grid grid-cols-9 gap-1.5">
          {SPACE_ICON_CHOICES.map((icon) => {
            const selected = icon === draft.icon;
            return (
              <button
                key={icon}
                type="button"
                aria-pressed={selected}
                aria-label={`Usar el ícono ${icon}`}
                onClick={() => onIconChange(icon)}
                className={`relative flex aspect-square items-center justify-center rounded-xl text-xl transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring ${
                  selected
                    ? "bg-background shadow-sm ring-2 ring-border"
                    : "hover:bg-background hover:shadow-sm"
                }`}
              >
                <span aria-hidden="true">{icon}</span>
                {selected && (
                  <span
                    aria-hidden="true"
                    className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-white"
                  >
                    <CheckIcon className="h-2.5 w-2.5" strokeWidth={3} />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
