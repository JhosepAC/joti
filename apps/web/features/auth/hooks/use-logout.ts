"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
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
  const logoutAction = useAction(api.auth.actions.logout);

  const signOut = useCallback(
    async (slug?: string) => {
      if (inFlight.current) return;
      inFlight.current = true;
      setSigningOut(true);
      try {
        const account = readAccountGrant();
        const spaceToken = slug ? readSpaceGrant(slug) : undefined;
        // Local first: never leave live tokens in storage.
        clearGrants();
        await logoutAction({
          email: account?.email,
          claim: account?.token,
          slug,
          grant: spaceToken,
        }).catch(() => undefined);
      } finally {
        inFlight.current = false;
        setSigningOut(false);
        router.replace("/auth/login");
      }
    },
    [logoutAction, router],
  );

  return { signOut, signingOut };
}
