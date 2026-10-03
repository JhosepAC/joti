"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { storeAccountGrant, storeSpaceGrant, type AccountGrant } from "../utils/claim-store";
import { getAuthErrorMessage } from "../utils/get-auth-error-message";

/**
 * Decides where a freshly authenticated user belongs.
 *
 * Every entry point (sign-in, account activation, profile completion) hands its
 * grant to this hook, which asks the server which stage comes next and routes
 * there. Keeping the rule in one place is the point: the alternative is each
 * screen re-deriving "does this account have a profile, and a space?", which is
 * exactly the kind of check that drifts and lets someone reach a screen they
 * should not.
 *
 * The grant is consumed server-side by `getEntryContext` and replaced with the
 * one the next step needs, which is returned here so the caller can render that
 * step without a second round trip.
 */

export type EntryStage = "loading" | "ready" | "redirecting" | "error";

export interface EntryResult {
  stage: EntryStage;
  error: string | null;
  displayName: string | null;
  /** Fresh grant, present only when `stage` is `ready` (the first-space step). */
  claim: string | null;
}

export function useEntryGate(grant: AccountGrant | null | undefined): EntryResult {
  const router = useRouter();
  const [result, setResult] = useState<EntryResult>({
    stage: "loading",
    error: null,
    displayName: null,
    claim: null,
  });

  const getEntryContext = useAction(api.spaces.actions.getEntryContext);

  useEffect(() => {
    // `undefined` means "not resolved yet" (the caller is still reading
    // sessionStorage); `null` means there is no grant, so there is nothing to
    // authorize with.
    if (grant === undefined) return;

    if (!grant) {
      router.replace("/auth/login");
      return;
    }

    let cancelled = false;
    setResult({ stage: "loading", error: null, displayName: null, claim: null });

    void (async () => {
      try {
        const context = await getEntryContext({
          email: grant.email,
          claim: grant.token,
        });
        if (cancelled) return;

        if (context.stage === "profile" && context.claim) {
          storeAccountGrant(grant.email, context.claim);
          setResult({ stage: "redirecting", error: null, displayName: null, claim: null });
          // No address in the URL: the next screen reads it from the stored
          // grant, so it never lands in history, Referer headers or logs.
          router.replace("/auth/complete-profile");
          return;
        }

        if (context.stage === "workspace" && context.slug && context.spaceGrant) {
          storeSpaceGrant(context.slug, context.spaceGrant);
          setResult({ stage: "redirecting", error: null, displayName: null, claim: null });
          router.replace(`/w/${context.slug}`);
          return;
        }

        if (context.stage === "space" && context.claim) {
          storeAccountGrant(grant.email, context.claim);
          setResult({
            stage: "ready",
            error: null,
            displayName: context.displayName,
            claim: context.claim,
          });
          return;
        }

        // A stage this client does not know about: refuse rather than guess.
        setResult({
          stage: "error",
          error: "No pudimos determinar el siguiente paso. Vuelve a iniciar sesión.",
          displayName: null,
          claim: null,
        });
      } catch (err: unknown) {
        if (cancelled) return;
        setResult({
          stage: "error",
          error: getAuthErrorMessage(err, "Tu sesión no es válida. Inicia sesión de nuevo."),
          displayName: null,
          claim: null,
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [grant, getEntryContext, router]);

  return result;
}
