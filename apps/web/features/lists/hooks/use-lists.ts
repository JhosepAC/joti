"use client";
import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { useMutation, useQuery, useConvexConnectionState } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { ListCommand, ListsSnapshot } from "../types";
import { projectSnapshot, type PendingOperation } from "../lib/optimistic";

function code(error: unknown) {
  const data = (error as { data?: { code?: string } })?.data;
  if (data?.code) return data.code;
  const message = error instanceof Error ? error.message : "";
  return (
    [
      "CONFLICT",
      "UNAUTHORIZED",
      "TYPE_CONVERSION",
      "LIMIT_REACHED",
      "DUPLICATE_NAME",
      "TITLE_REQUIRED",
      "IMPORT_ERROR",
      "VALIDATION_ERROR",
      "NOT_FOUND",
      "ARCHIVED",
    ].find((value) => message.includes(value)) ?? "UNAVAILABLE"
  );
}
export function useLists(slug: string, selectedKey?: string) {
  const [access, setAccess] = useState<{
    ticket: string;
    expiresAt: number;
  } | null>(null);
  const [accessError, setAccessError] = useState("");
  const [error, setError] = useState("");
  const [queue, setQueue] = useState<PendingOperation[]>([]);
  const queueRef = useRef(queue);
  queueRef.current = queue;
  const [hydrated, setHydrated] = useState(false);
  const [last, setLast] = useState<ListsSnapshot | undefined>();
  const refreshing = useRef<Promise<void> | null>(null);
  const sending = useRef<string | null>(null);
  const connection = useConvexConnectionState();
  const mutate = useMutation(api.lists.data.apply);
  const query = useQuery(
    api.lists.data.watch,
    access
      ? { ticket: access.ticket, ...(selectedKey ? { selectedKey } : {}) }
      : "skip",
  );
  const storageKey = `joti:lists:pending:${slug}`;
  const renew = useCallback(() => {
    if (refreshing.current) return refreshing.current;
    refreshing.current = (async () => {
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
        if (!response.ok) throw new Error(value.code ?? "UNAVAILABLE");
        setAccess(value);
        setAccessError("");
      } catch (cause) {
        setAccessError(code(cause));
      } finally {
        refreshing.current = null;
      }
    })();
    return refreshing.current;
  }, [slug]);
  useEffect(() => {
    void renew();
  }, [renew]);
  useEffect(() => {
    if (!access) return;
    const timer = setTimeout(
      () => void renew(),
      Math.max(1000, access.expiresAt - Date.now() - 120000),
    );
    return () => clearTimeout(timer);
  }, [access, renew]);
  useEffect(() => {
    if (query?.status === "expired") void renew();
    else if (query?.status === "ready") setLast(query);
  }, [query, renew]);
  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(storageKey) ?? "[]");
      if (Array.isArray(saved) && saved.length <= 1000)
        setQueue(
          saved.filter(
            (item) =>
              typeof item.opId === "string" &&
              typeof item.command?.kind === "string",
          ),
        );
    } catch {}
    setHydrated(true);
  }, [storageKey]);
  useEffect(() => {
    if (hydrated)
      try {
        sessionStorage.setItem(storageKey, JSON.stringify(queue));
      } catch {}
  }, [queue, storageKey, hydrated]);
  useEffect(() => {
    if (!queue.length) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [queue.length]);
  useEffect(() => {
    if (
      !hydrated ||
      !access ||
      query?.status !== "ready" ||
      !queue.length ||
      sending.current ||
      error ||
      accessError
    )
      return;
    const next = queue[0]!;
    sending.current = next.opId;
    void mutate({
      ticket: access.ticket,
      opId: next.opId,
      command: next.command,
    })
      .then(() =>
        setQueue((previous) =>
          previous.filter((item) => item.opId !== next.opId),
        ),
      )
      .catch((cause) => {
        const value = code(cause);
        setError(value);
        if (value === "UNAUTHORIZED") void renew();
      })
      .finally(() => {
        sending.current = null;
      });
  }, [queue, access, query, hydrated, error, accessError, mutate, renew]);
  const raw = query?.status === "ready" ? query : last;
  const data = useMemo(
    () =>
      raw && query?.status !== "expired" && accessError !== "UNAUTHORIZED"
        ? projectSnapshot(raw, queue, selectedKey)
        : undefined,
    [raw, queue, selectedKey, query?.status, accessError],
  );
  const enqueue = useCallback(
    (command: ListCommand) => {
      const operation = {
        opId: crypto.randomUUID(),
        command,
        createdAt: Date.now(),
      };
      const next = [...queueRef.current, operation];
      queueRef.current = next;
      // Save during the event, before navigation can unmount this space.
      try {
        sessionStorage.setItem(storageKey, JSON.stringify(next));
      } catch {}
      setQueue(next);
      return operation.opId;
    },
    [storageKey],
  );
  const retry = () => {
    let projected = raw;
    const rebased: PendingOperation[] = [];
    for (const operation of queue) {
      const command = structuredClone(operation.command);
      if (
        projected?.list &&
        "listKey" in command &&
        command.listKey === projected.list.key
      ) {
        if ("baseRevision" in command)
          command.baseRevision = projected.list.revision;
        if (command.kind === "setCells")
          for (const change of command.changes)
            change.baseVersion =
              projected.rows.find((row) => row.key === change.rowKey)?.versions[
                change.columnId
              ] ?? 0;
        if (command.kind === "setRow")
          command.baseVersion =
            projected.rows.find((row) => row.key === command.rowKey)
              ?.metaVersion ?? 0;
      }
      const next = { ...operation, command };
      rebased.push(next);
      if (projected)
        projected = projectSnapshot(projected, [next], selectedKey);
    }
    setQueue(rebased);
    setError("");
    void renew();
  };
  return {
    data,
    raw,
    enqueue,
    pending: queue.length,
    error: error || accessError,
    retry,
    discard: () => {
      setQueue([]);
      setError("");
    },
    connected: connection.isWebSocketConnected,
    loading:
      !data ||
      !hydrated ||
      Boolean(
        selectedKey &&
        raw?.status === "ready" &&
        raw.list?.key !== selectedKey &&
        raw.lists.some((item) => item.key === selectedKey),
      ),
    renew,
  };
}
