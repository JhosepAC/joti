"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAction, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { defaultSpaceName } from "../catalog";
import { storeSpaceGrant } from "@/features/auth/utils/claim-store";
import { getAuthErrorMessage } from "@/features/auth/utils/get-auth-error-message";
import {
  FIRST_SPACE_TOTAL_STEPS,
  SPACE_ICON_DEFAULT,
  type FirstSpaceStep,
  type SpaceDraft,
  type SpaceIconChoice,
  type SpacePurposeKey,
  type SpaceTool,
} from "../types/space.types";
import {
  SPACE_NAME_MAX_LENGTH,
  sanitizeSpaceNameInput,
  validateSpaceNameInput,
} from "../validations/space.schema";

/** Narration shown while the space is created, one every `STEP_MESSAGE_MS`. */
const CREATION_MESSAGES = [
  "Creando espacio en Convex...",
  "Inyectando plantilla inicial y notas de bienvenida...",
  "¡Todo listo! Entrando a joti...",
] as const;

const STEP_MESSAGE_MS = 500;
/** The spec asks for a short, deliberate pause so the transition reads as progress. */
const MIN_LOADING_MS = 1500;

export function useFirstSpaceFlow(options: {
  email: string;
  claim: string;
  displayName: string | null;
  onReady: (slug: string) => void;
}) {
  const { email, claim, displayName, onReady } = options;

  const [step, setStep] = useState<FirstSpaceStep>(1);
  const [draft, setDraft] = useState<SpaceDraft>(() => ({
    name: defaultSpaceName(displayName, SPACE_NAME_MAX_LENGTH),
    icon: SPACE_ICON_DEFAULT,
    // Single choice with one option preselected.
    purpose: "personal",
  }));
  const [isCreating, setIsCreating] = useState(false);
  const [showCreating, setShowCreating] = useState(false);
  const [messageIndex, setMessageIndex] = useState(0);
  const [generalError, setGeneralError] = useState<string | null>(null);

  const createFirstSpace = useAction(api.spaces.actions.createFirstSpace);

  // The summary must show what will actually be created, so the tool list is
  // resolved by the server rather than hardcoded here.
  const purposePreview = useQuery(api.spaces.queries.getPurposePreview, { purpose: draft.purpose });

  useEffect(() => {
    // Only prefills while the field is untouched, so it can never overwrite
    // something the user typed.
    setDraft((prev) => {
      const untouched = prev.name === defaultSpaceName(null, SPACE_NAME_MAX_LENGTH);
      if (!untouched && prev.name.trim().length > 0) return prev;
      return { ...prev, name: defaultSpaceName(displayName, SPACE_NAME_MAX_LENGTH) };
    });
  }, [displayName]);

  const nameProblem = useMemo(() => validateSpaceNameInput(draft.name), [draft.name]);

  // Live feedback: nothing is shown for an empty field (the requirement hint is
  // enough), but an out-of-range value is reported as it is typed.
  const nameError = draft.name.length > 0 ? (nameProblem ?? undefined) : undefined;

  // "Next" is only reachable once the current step is actually valid, so an
  // incomplete step cannot be submitted or skipped past.
  const canGoNext = step === 1 ? nameProblem === null : true;

  const setName = useCallback((value: string) => {
    setDraft((prev) => ({
      ...prev,
      // Control characters are stripped rather than merely rejected, and the
      // length is clamped, so an invalid value can never reach the field.
      name: sanitizeSpaceNameInput(value).slice(0, SPACE_NAME_MAX_LENGTH),
    }));
  }, []);

  const setIcon = useCallback((icon: SpaceIconChoice) => {
    setDraft((prev) => ({ ...prev, icon }));
  }, []);

  const setPurpose = useCallback((purpose: SpacePurposeKey) => {
    setDraft((prev) => ({ ...prev, purpose }));
  }, []);

  const goNext = useCallback(() => {
    if (step === 1) {
      if (nameProblem !== null) return;
      setStep(2);
      return;
    }
    if (step === 2) {
      setStep(3);
    }
  }, [nameProblem, step]);

  const goBack = useCallback(() => {
    if (step > 1) setStep((prev) => (prev - 1) as FirstSpaceStep);
  }, [step]);

  const submit = useCallback(async () => {
    // Re-checked here because step 1 can have been edited after advancing.
    if (nameProblem !== null) {
      setStep(1);
      return;
    }
    setIsCreating(true);
    setGeneralError(null);
    setMessageIndex(0);
    setShowCreating(true);

    const startedAt = Date.now();
    // Started before the request so the narration advances while the write is in
    // flight. A fast backend would otherwise show all three lines at once, which
    // reads as a glitch rather than as progress.
    const interval = setInterval(() => {
      setMessageIndex((prev) => Math.min(prev + 1, CREATION_MESSAGES.length - 1));
    }, STEP_MESSAGE_MS);

    try {
      const result = await createFirstSpace({
        email,
        claim,
        name: draft.name.trim(),
        icon: draft.icon,
        purpose: draft.purpose,
      });

      storeSpaceGrant(result.slug, result.spaceGrant);

      const remaining = Math.max(0, MIN_LOADING_MS - (Date.now() - startedAt));
      await new Promise((resolve) => setTimeout(resolve, remaining));

      setMessageIndex(CREATION_MESSAGES.length - 1);
      onReady(result.slug);
    } catch (err: unknown) {
      setShowCreating(false);
      setGeneralError(
        getAuthErrorMessage(err, "No pudimos crear tu espacio. Inténtalo de nuevo."),
      );
    } finally {
      clearInterval(interval);
      setIsCreating(false);
    }
  }, [claim, createFirstSpace, draft.icon, draft.name, draft.purpose, email, nameProblem, onReady]);

  const tools: SpaceTool[] = purposePreview ? purposePreview.tools : [];

  return {
    step,
    totalSteps: FIRST_SPACE_TOTAL_STEPS,
    canGoBack: step > 1,
    canGoNext,
    draft,
    nameError,
    generalError,
    isCreating,
    showCreating,
    message: CREATION_MESSAGES[messageIndex] ?? CREATION_MESSAGES[0],
    tools,
    isLoadingTools: purposePreview === undefined,
    setName,
    setIcon,
    setPurpose,
    goNext,
    goBack,
    submit,
  };
}
