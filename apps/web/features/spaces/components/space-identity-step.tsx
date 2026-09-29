"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SpaceIconPicker } from "./space-icon-picker";
import { LockIcon } from "./icons";
import { SPACE_NAME_MAX_LENGTH, SPACE_NAME_MIN_LENGTH } from "../validations/space.schema";
import type { SpaceDraft, SpaceIconChoice } from "../types/space.types";

interface Props {
  draft: SpaceDraft;
  nameError?: string;
  onNameChange: (value: string) => void;
  onIconChange: (icon: SpaceIconChoice) => void;
}

/** Step 1 — identity: name and icon. */
export const SpaceIdentityStep: React.FC<Props> = ({
  draft,
  nameError,
  onNameChange,
  onIconChange,
}) => {
  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-2xl font-semibold text-text-primary font-heading">
          Identidad del espacio
        </h2>
        <p className="text-sm font-light text-text-secondary mt-1.5">
          Dale un nombre y un ícono para reconocerlo.
        </p>
      </header>

      <div className="space-y-2">
        <Label htmlFor="spaceName">Nombre del espacio</Label>
        <Input
          id="spaceName"
          value={draft.name}
          onChange={(event) => onNameChange(event.target.value)}
          hasError={Boolean(nameError)}
          placeholder="Espacio de Ana"
          maxLength={SPACE_NAME_MAX_LENGTH}
          autoComplete="off"
          aria-invalid={Boolean(nameError)}
          aria-describedby={nameError ? "spaceNameHelp spaceNameError" : "spaceNameHelp"}
        />
        {/* The length hint stays put while the error appears, so the rule the
            user is breaking is still on screen next to the message about it. */}
        <p id="spaceNameHelp" className="text-[11px] text-text-muted pl-1">
          Entre {SPACE_NAME_MIN_LENGTH} y {SPACE_NAME_MAX_LENGTH} caracteres.
          <span className="ml-2 tabular-nums">
            {draft.name.trim().length}/{SPACE_NAME_MAX_LENGTH}
          </span>
        </p>
        {nameError && (
          <p id="spaceNameError" role="alert" className="text-xs text-error pl-2">
            {nameError}
          </p>
        )}
      </div>

      <div className="space-y-2.5">
        <Label>Ícono del espacio</Label>
        <SpaceIconPicker value={draft.icon} onChange={onIconChange} />
      </div>

      {/*
        Informational, not an input: the spec has the space start private and
        offers no control here. It is rendered as a disabled-looking badge so it
        cannot be mistaken for something to set.
      */}
      <div className="flex items-start gap-3 rounded-2xl border border-border bg-surface p-4">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-background text-icon">
          <LockIcon className="text-base" />
        </span>
        <div>
          <p className="text-sm font-medium text-text-primary">Espacio Privado</p>
          <p className="mt-0.5 text-xs font-light leading-relaxed text-text-secondary">
            Este espacio iniciará siendo privado. Podrás invitar colaboradores más
            adelante.
          </p>
        </div>
      </div>
    </div>
  );
};
