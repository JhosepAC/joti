"use client";

import * as React from "react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { readAccountGrant, type AccountGrant } from "@/features/auth/utils/claim-store";
import { useEntryGate } from "@/features/auth/hooks/use-entry-gate";
import { FirstSpaceFlow } from "./first-space-flow";
import { SpinnerIcon } from "./icons";

/**
 * Entry point for `/spaces/new`.
 *
 * Two things happen here, in this order:
 *
 *  1. The claim grant is read from `sessionStorage`. It is deliberately not a
 *     query parameter -- a URL lands in history, `Referer` and server logs, and
 *     this token authorises writing to an account.
 *  2. The entry gate asks the server which stage this account is actually on.
 *     Reaching this URL directly is not enough: a missing profile, or a space
 *     that already exists, sends the user back to the right place instead of
 *     showing a wizard they are not eligible for.
 */
export const NewSpaceOnboarding: React.FC = () => {
  const router = useRouter();
  const [grant, setGrant] = useState<AccountGrant | null | undefined>(undefined);
  const gate = useEntryGate(grant);

  useEffect(() => {
    setGrant(readAccountGrant());
  }, []);

  if (grant === undefined || gate.stage === "loading" || gate.stage === "redirecting") {
    return (
      <div className="flex min-h-screen items-center justify-center" aria-busy="true">
        <SpinnerIcon className="text-2xl text-icon" strokeWidth={2} />
        <span className="sr-only">Comprobando tu cuenta</span>
      </div>
    );
  }

  if (gate.stage === "error" || !grant || !gate.claim) {
    return (
      <div className="mx-auto flex min-h-screen w-full max-w-[460px] flex-col items-center justify-center px-6 text-center">
        <h1 className="text-2xl font-semibold text-text-primary font-heading">
          No pudimos abrir esta sección
        </h1>
        <p className="mt-2 text-sm font-light text-text-secondary">
          {gate.error ?? "Tu sesión no es válida. Inicia sesión de nuevo."}
        </p>
        <Button
          variant="primary"
          className="mt-6 h-11 rounded-full"
          onClick={() => router.replace("/auth/login")}
        >
          Ir a iniciar sesión
        </Button>
      </div>
    );
  }

  return (
    <FirstSpaceFlow email={grant.email} claim={gate.claim} displayName={gate.displayName} />
  );
};
