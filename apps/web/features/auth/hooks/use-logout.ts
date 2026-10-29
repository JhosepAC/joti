"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useTranslations } from "next-intl";
import {
  clearGrants,
  readAccountGrant,
  readSpaceGrant,
} from "../utils/claim-store";

/**
 * Sign-out: burns whatever grants the client still holds, clears local
 * storage, and lands back on the login page.
 *
 * Local storage is cleared FIRST so no live token survives a failed or
 * offline server call; the server burn is best-effort (the action answers
 * identically either way) and leftovers expire server-side within 15 minutes.
 */
export function useLogout() {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);
  const inFlight = useRef(false);
  const t = useTranslations("errors");
  const [logoutError, setLogoutError] = useState("");
  const logoutAction = useAction(api.auth.actions.logout);

  const signOut = useCallback(
    async (slug?: string) => {
      if (inFlight.current) return;
      inFlight.current = true;
      setSigningOut(true);
      setLogoutError("");
      let cookieCleared = false;
      try {
        const account = readAccountGrant();
        const spaceToken = slug ? readSpaceGrant(slug) : undefined;
        // Local first: never leave live tokens in storage.
        clearGrants();
        await fetch("/api/auth/session", {
          method: "DELETE",
          credentials: "same-origin",
          signal: AbortSignal.timeout(15000),
        });
        cookieCleared = true;
        await logoutAction({
          email: account?.email,
          claim: account?.token,
          slug,
          grant: spaceToken,
        }).catch(() => undefined);
      } catch {
        setLogoutError(t("fallback"));
      } finally {
        inFlight.current = false;
        setSigningOut(false);
        if (cookieCleared) router.replace("/auth/login");
      }
    },
    [logoutAction, router, t],
  );

  return { signOut, signingOut, logoutError };
}
