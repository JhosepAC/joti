"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { DashboardData } from "../types/dashboard.types";

type Draft = { title: string; body: string; baseRevision?: number };
class WorkspaceError extends Error {
  constructor(public code: string) {
    super(code);
  }
}
async function request(
  slug: string,
  method = "GET",
  input?: unknown,
  signal?: AbortSignal,
): Promise<DashboardData> {
  const response = await fetch(
    `/api/workspace?slug=${encodeURIComponent(slug)}`,
    {
      method,
      credentials: "same-origin",
      cache: "no-store",
      headers: input ? { "Content-Type": "application/json" } : undefined,
      body: input ? JSON.stringify(input) : undefined,
      signal: signal
        ? AbortSignal.any([signal, AbortSignal.timeout(20000)])
        : AbortSignal.timeout(20000),
    },
  );
  const data = await response.json();
  if (!response.ok) throw new WorkspaceError(data.code ?? "UNAVAILABLE");
  return data;
}

export function useWorkspaceDashboard(slug: string) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [view, setView] = useState("home");
  useEffect(() => {
    setView(
      ["lists", "calendar"].includes(
        new URLSearchParams(location.search).get("module") ?? "",
      )
        ? new URLSearchParams(location.search).get("module")!
        : (new URLSearchParams(location.search).get("page") ?? "home"),
    );
  }, [slug]);
  useEffect(() => {
    const refreshProfile = () => {
      void request(slug)
        .then((fresh) =>
          setData((previous) =>
            previous ? { ...previous, profile: fresh.profile } : previous,
          ),
        )
        .catch(() => {});
    };
    window.addEventListener("nook-profile-updated", refreshProfile);
    const channel =
      typeof BroadcastChannel !== "undefined"
        ? new BroadcastChannel("nook-account")
        : null;
    if (channel) channel.onmessage = refreshProfile;
    return () => {
      window.removeEventListener("nook-profile-updated", refreshProfile);
      channel?.close();
    };
  }, [slug]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [conflictId, setConflictId] = useState<string>();
  const [recoveryKey, setRecoveryKey] = useState("");
  const sending = useRef(false);
  const load = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError("");
      try {
        const result = await request(slug, "GET", undefined, signal);
        if (signal?.aborted) return;
        const key = `nook:pages-draft:${result.profile.username}:${slug}`;
        const recovered: Record<string, Draft> = {};
        try {
          const saved = JSON.parse(sessionStorage.getItem(key) ?? "{}");
          for (const page of result.pages) {
            const draft = saved?.[page.id];
            if (
              draft &&
              typeof draft.title === "string" &&
              typeof draft.body === "string" &&
              draft.title.length <= 120 &&
              draft.body.length <= 30000
            )
              recovered[page.id] = {
                title: draft.title,
                body: draft.body,
                // Legacy drafts must never silently overwrite a newer server document.
                baseRevision: Number.isSafeInteger(draft.baseRevision)
                  ? draft.baseRevision
                  : -1,
              };
          }
        } catch {
          /* Optional drafts never prevent loading saved pages. */
        }
        setDrafts(recovered);
        setRecoveryKey(key);
        setData(result);
      } catch (cause) {
        if (!signal?.aborted)
          setError(
            cause instanceof WorkspaceError ? cause.code : "UNAVAILABLE",
          );
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [slug],
  );
  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);
  useEffect(() => {
    if (data?.space.slug !== slug || !recoveryKey) return;
    try {
      sessionStorage.setItem(recoveryKey, JSON.stringify(drafts));
    } catch {
      /* Server saving still works without browser storage. */
    }
  }, [data, drafts, recoveryKey, slug]);
  const page = data?.pages.find((item) => item.id === view);
  const draft = page
    ? (drafts[page.id] ?? { title: page.title, body: page.body })
    : null;
  const dirty = Boolean(
    page && draft && (page.title !== draft.title || page.body !== draft.body),
  );
  const select = (next: string) => {
    setView(next);
    setError("");
  };
  const edit = (next: Draft) => {
    if (page)
      setDrafts((previous) => ({
        ...previous,
        [page.id]: {
          ...next,
          baseRevision: previous[page.id]?.baseRevision ?? page.revision,
        },
      }));
  };
  async function createPage() {
    if (sending.current) return;
    sending.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await request(slug, "POST");
      setData(result);
      select(result.selectedPageId ?? "pages");
    } catch (cause) {
      setError(cause instanceof WorkspaceError ? cause.code : "UNAVAILABLE");
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }
  async function savePage(targetId?: string) {
    const page = data?.pages.find((item) => item.id === (targetId ?? view));
    const draft = page ? drafts[page.id] : undefined;
    if (!page || !draft || sending.current || !draft.title.trim()) return;
    const snapshot = { ...draft };
    sending.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await request(slug, "PATCH", {
        pageId: page.id,
        ...snapshot,
        revision: snapshot.baseRevision ?? -1,
      });
      setData(result);
      setDrafts((previous) => {
        const current = previous[page.id];
        if (
          !current ||
          current.title !== snapshot.title ||
          current.body !== snapshot.body
        )
          return current && current.baseRevision === snapshot.baseRevision
            ? {
                ...previous,
                [page.id]: {
                  ...current,
                  baseRevision:
                    result.pages.find((item) => item.id === page.id)
                      ?.revision ?? current.baseRevision,
                },
              }
            : previous;
        const next = { ...previous };
        delete next[page.id];
        return next;
      });
    } catch (cause) {
      if (cause instanceof WorkspaceError && cause.code === "CONFLICT")
        setConflictId(page.id);
      setError(cause instanceof WorkspaceError ? cause.code : "UNAVAILABLE");
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }
  async function useSavedVersion() {
    if (!conflictId || sending.current) return;
    setBusy(true);
    sending.current = true;
    try {
      const fresh = await request(slug);
      setData(fresh);
      setDrafts((previous) => {
        const next = { ...previous };
        delete next[conflictId];
        return next;
      });
      setView(
        fresh.pages.some((p) => p.id === conflictId) ? conflictId : "pages",
      );
      setConflictId(undefined);
      setError("");
      return true;
    } catch (cause) {
      setError(cause instanceof WorkspaceError ? cause.code : "UNAVAILABLE");
      return false;
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }
  async function itemAction(
    pageId: string,
    action: "rename" | "duplicate" | "favorite" | "delete" | "icon",
    input: { title?: string; favorite?: boolean; icon?: string } = {},
  ) {
    if (sending.current) return;
    const target = data?.pages.find((item) => item.id === pageId);
    if (!target) return;
    sending.current = true;
    setBusy(true);
    setError("");
    try {
      const result = await request(slug, "PUT", {
        pageId,
        action,
        ...input,
        ...(["rename", "delete"].includes(action)
          ? { revision: target.revision }
          : {}),
      });
      setData(result);
      if (action === "rename")
        setDrafts((previous) =>
          previous[pageId]
            ? {
                ...previous,
                [pageId]: {
                  ...previous[pageId]!,
                  title: input.title!,
                  baseRevision:
                    previous[pageId]!.baseRevision === target.revision
                      ? target.revision + 1
                      : previous[pageId]!.baseRevision,
                },
              }
            : previous,
        );
      if (action === "delete") {
        setDrafts((previous) => {
          const next = { ...previous };
          delete next[pageId];
          return next;
        });
        if (view === pageId) select("pages");
      }
      if (action === "duplicate" && result.selectedPageId)
        select(result.selectedPageId);
      return true;
    } catch (cause) {
      setError(cause instanceof WorkspaceError ? cause.code : "UNAVAILABLE");
      return false;
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }
  const saveRef = useRef(savePage);
  saveRef.current = savePage;
  const pendingDraft = data?.pages.find((item) => {
    const value = drafts[item.id];
    return (
      value &&
      value.title.trim() &&
      value.body.length <= 30000 &&
      (value.title !== item.title || value.body !== item.body)
    );
  });
  useEffect(() => {
    if (!pendingDraft || busy || error) return;
    const timer = setTimeout(() => void saveRef.current(pendingDraft.id), 1200);
    return () => clearTimeout(timer);
  }, [pendingDraft, drafts, busy, error]);
  useEffect(() => {
    if (!Object.keys(drafts).length) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [drafts]);
  return {
    data,
    view,
    drafts,
    error,
    loading,
    busy,
    page,
    draft,
    dirty,
    select,
    edit,
    createPage,
    savePage,
    load,
    itemAction,
    conflictId,
    useSavedVersion,
  };
}
