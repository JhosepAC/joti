"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useConvexConnectionState } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { EventInput } from "@/convex/calendar/time";
export type EventOperation = {
  opId: string;
  key: string;
  kind: "create" | "update" | "delete";
  revision?: number;
  event?: EventInput;
};
export function errorCode(error: unknown) {
  const code = (error as { data?: { code?: string } })?.data?.code;
  return (
    code ??
    [
      "UNAUTHORIZED",
      "CONFLICT",
      "NOT_FOUND",
      "VALIDATION_ERROR",
      "DST_GAP",
      "TIMEZONE_ERROR",
      "TIMEZONE_AMBIGUOUS",
      "END_BEFORE_START",
      "LIMIT_REACHED",
    ].find((c) => String(error).includes(c)) ??
    "UNAVAILABLE"
  );
}
export function useCalendar(slug: string, from: string, to: string) {
  const [access, setAccess] = useState<{
      ticket: string;
      expiresAt: number;
    } | null>(null),
    [error, setError] = useState("");
  const refresh = useRef<Promise<void> | null>(null),
    connection = useConvexConnectionState();
  const renew = useCallback(() => {
    if (refresh.current) return refresh.current;
    refresh.current = (async () => {
      try {
        const response = await fetch(
          `/api/lists/access?slug=${encodeURIComponent(slug)}`,
          {
            method: "POST",
            credentials: "same-origin",
            signal: AbortSignal.timeout(15000),
          },
        );
        const value = await response.json();
        if (!response.ok) throw new Error(value.code);
        setAccess(value);
        setError("");
      } catch (e) {
        setError(errorCode(e));
      } finally {
        refresh.current = null;
      }
    })();
    return refresh.current;
  }, [slug]);
  useEffect(() => {
    void renew();
  }, [renew]);
  useEffect(() => {
    if (!access) return;
    const id = setTimeout(
      () => void renew(),
      Math.max(1000, access.expiresAt - Date.now() - 60000),
    );
    return () => clearTimeout(id);
  }, [access, renew]);
  const data = useQuery(
    api.calendar.events.watch,
    access ? { ticket: access.ticket, from, to } : "skip",
  );
  useEffect(() => {
    if (data?.status === "expired") void renew();
  }, [data?.status, renew]);
  const mutate = useMutation(api.calendar.events.apply);
  return {
    events: data?.status === "ready" ? data.events : undefined,
    error,
    online: connection.isWebSocketConnected,
    retry: renew,
    save: async (operation: EventOperation) => {
      if (!access) throw new Error("UNAUTHORIZED");
      if (!connection.isWebSocketConnected) throw new Error("UNAVAILABLE");
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        return await Promise.race([
          mutate({ ticket: access.ticket, ...operation }),
          new Promise<never>((_, reject) => {
            timer = setTimeout(() => reject(new Error("UNAVAILABLE")), 15000);
          }),
        ]);
      } finally {
        if (timer) clearTimeout(timer);
      }
    },
  };
}
