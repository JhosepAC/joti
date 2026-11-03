"use client";

import { JotiLogo } from "@/components/ui/joti-logo";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  readAccountGrant,
  type AccountGrant,
} from "@/features/auth/utils/claim-store";
import { resumeSession } from "@/features/auth/utils/session-client";
import { useEntryGate } from "@/features/auth/hooks/use-entry-gate";
import { FirstSpaceFlow } from "./first-space-flow";
import { SpinnerIcon } from "./icons";
import "./space-onboarding.css";

export function NewSpaceOnboarding() {
  const router = useRouter();
  const t = useTranslations("spaces.onboarding");
  const tErrors = useTranslations("errors");
  const [grant, setGrant] = useState<AccountGrant | null | undefined>(
    undefined,
  );
  const [sessionError, setSessionError] = useState(false);
  const gate = useEntryGate(grant);

  useEffect(() => {
    let active = true;
    const stored = readAccountGrant();
    if (stored) setGrant(stored);
    else
      void resumeSession()
        .then((value) => {
          if (active) setGrant(value);
        })
        .catch(() => {
          if (active) setSessionError(true);
        });
    return () => {
      active = false;
    };
  }, []);

  async function retry() {
    setSessionError(false);
    setGrant(undefined);
    try {
      setGrant(await resumeSession());
    } catch {
      setSessionError(true);
    }
  }

  const loading =
    !sessionError &&
    (grant === undefined ||
      gate.stage === "loading" ||
      gate.stage === "redirecting");
  if (
    loading ||
    sessionError ||
    gate.stage === "error" ||
    !grant ||
    !gate.claim
  ) {
    return (
      <div className="space-setup">
        <header className="setup-header">
          <Link href="/" className="setup-brand" aria-label="Joti">
            <JotiLogo />
          </Link>
        </header>
        <main className="setup-gate">
          <div className="setup-gate-panel">
            {loading ? (
              <p role="status">
                <SpinnerIcon />
                {t("checking")}
              </p>
            ) : (
              <>
                <h1>{t("unavailableTitle")}</h1>
                <p role="alert">
                  {sessionError
                    ? tErrors("fallback")
                    : (gate.error ?? tErrors("sessionInvalid"))}
                </p>
                <div className="setup-actions">
                  <button
                    type="button"
                    className="setup-back"
                    onClick={() => router.replace("/auth/login")}
                  >
                    {t("signIn")}
                  </button>
                  <button
                    type="button"
                    className="setup-primary"
                    onClick={() => void retry()}
                  >
                    {t("retry")}
                  </button>
                </div>
              </>
            )}
          </div>
        </main>
      </div>
    );
  }
  return (
    <FirstSpaceFlow
      email={grant.email}
      claim={gate.claim}
      displayName={gate.displayName}
    />
  );
}
