"use client";
import { useEffect, useState, useRef, useCallback } from "react";
export interface Account {
  email: string;
  name: string;
  username: string;
  locale: string;
  avatarUrl: string | null;
  createdAt: number;
  sessions: {
    id: string;
    createdAt: number;
    expiresAt: number;
    current: boolean;
  }[];
}
export function useAccount() {
  const [data, setData] = useState<Account>(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const sending = useRef(false);
  const request = useCallback(
    async (input?: Record<string, unknown> | FormData) => {
      if (sending.current) return;
      setBusy(true);
      sending.current = true;
      setError("");
      try {
        const response = await fetch("/api/account", {
          method: input ? "POST" : "GET",
          headers:
            input && !(input instanceof FormData)
              ? { "Content-Type": "application/json" }
              : undefined,
          body:
            input instanceof FormData
              ? input
              : input
                ? JSON.stringify(input)
                : undefined,
          signal: AbortSignal.timeout(20000),
        });
        const result = await response.json();
        if (!response.ok) throw Error(result.code);
        setData(result);
        if (input) {
          window.dispatchEvent(new Event("joti-profile-updated"));
          if (typeof BroadcastChannel !== "undefined") {
            const channel = new BroadcastChannel("joti-account");
            channel.postMessage("updated");
            channel.close();
          }
        }
        return result as Account;
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "UNAVAILABLE");
        return undefined;
      } finally {
        setBusy(false);
        sending.current = false;
      }
    },
    [],
  );
  useEffect(() => {
    void request();
  }, [request]);
  return { data, busy, error, request };
}
