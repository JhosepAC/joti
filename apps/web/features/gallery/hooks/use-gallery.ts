"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  useAction,
  useMutation,
  usePaginatedQuery,
  useQuery,
  useConvexConnectionState,
} from "convex/react";
import { api } from "@/convex/_generated/api";
import { DEFAULT_PREFERENCES } from "@/convex/gallery/model";
export type GalleryFilters = {
  search: string;
  album: string;
  tag: string;
  mime: string;
  from?: number;
  to?: number;
};
export function useGallery(slug: string, filters: GalleryFilters) {
  const [access, setAccess] = useState<{
      ticket: string;
      expiresAt: number;
    } | null>(null),
    [error, setError] = useState("");
  const flight = useRef<Promise<void> | null>(null),
    connection = useConvexConnectionState();
  const renew = useCallback(() => {
    if (flight.current) return flight.current;
    flight.current = (async () => {
      try {
        const r = await fetch(
          `/api/lists/access?slug=${encodeURIComponent(slug)}`,
          {
            method: "POST",
            credentials: "same-origin",
            signal: AbortSignal.timeout(15000),
          },
        );
        const d = await r.json();
        if (!r.ok) throw Error(d.code);
        setAccess(d);
        setError("");
      } catch (e) {
        setError(
          String(e).includes("UNAUTHORIZED") ? "UNAUTHORIZED" : "UNAVAILABLE",
        );
      } finally {
        flight.current = null;
      }
    })();
    return flight.current;
  }, [slug]);
  useEffect(() => {
    void renew();
  }, [renew]);
  useEffect(() => {
    if (!access) return;
    const timer = setTimeout(
      () => void renew(),
      Math.max(1000, access.expiresAt - Date.now() - 60000),
    );
    return () => clearTimeout(timer);
  }, [access, renew]);
  const overview = useQuery(
    api.gallery.data.overview,
    access ? { ticket: access.ticket } : "skip",
  );
  useEffect(() => {
    if (overview?.status === "expired") void renew();
  }, [overview?.status, renew]);
  const p = overview?.preferences ?? DEFAULT_PREFERENCES;
  const catalog = usePaginatedQuery(
    api.gallery.data.browse,
    access && overview?.status === "ready"
      ? {
          ticket: access.ticket,
          sort: p.sort,
          direction: p.direction,
          ...filters,
        }
      : "skip",
    { initialNumItems: 60 },
  );
  // Search over bounded indexed windows, filling the first visible page progressively.
  useEffect(() => {
    if (catalog.status === "CanLoadMore" && catalog.results.length < 30)
      catalog.loadMore(60);
  }, [catalog.status, catalog.results.length, catalog.loadMore]);
  const preferences = useMutation(
      api.gallery.data.preferences,
    ).withOptimisticUpdate((store, args) => {
      const previous = store.getQuery(api.gallery.data.overview, {
        ticket: args.ticket,
      });
      if (previous?.status === "ready")
        store.setQuery(
          api.gallery.data.overview,
          { ticket: args.ticket },
          { ...previous, preferences: args.value },
        );
    }),
    album = useMutation(api.gallery.data.album),
    createTag = useMutation(api.gallery.data.createTag),
    edit = useMutation(api.gallery.data.edit),
    bulk = useMutation(api.gallery.data.bulk),
    move = useMutation(api.gallery.data.move),
    retry = useAction(api.gallery.files.retry);
  const ticket = access?.ticket ?? "";
  const send = async <T>(operation: () => Promise<T>) => {
    if (!ticket) throw Error("UNAUTHORIZED");
    if (!connection.isWebSocketConnected) throw Error("UNAVAILABLE");
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        operation(),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(Error("UNAVAILABLE")), 20000);
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  };
  return {
    ticket,
    overview: overview?.status === "ready" ? overview : undefined,
    images: catalog.results,
    status: catalog.status,
    loadMore: () => catalog.loadMore(60),
    online: connection.isWebSocketConnected,
    error,
    renew,
    preferences: (value: typeof p) =>
      send(() => preferences({ ticket, value })),
    album: (a: Omit<Parameters<typeof album>[0], "ticket">) =>
      send(() => album({ ...a, ticket })),
    createTag: (name: string) => send(() => createTag({ ticket, name })),
    edit: (a: Omit<Parameters<typeof edit>[0], "ticket">) =>
      send(() => edit({ ...a, ticket })),
    bulk: (a: Omit<Parameters<typeof bulk>[0], "ticket">) =>
      send(() => bulk({ ...a, ticket })),
    move: (key: string, beforeKey?: string) =>
      send(() => move({ ticket, key, ...(beforeKey ? { beforeKey } : {}) })),
    retry: (key: string) => send(() => retry({ ticket, key })),
  };
}
export type GalleryModel = ReturnType<typeof useGallery>;
export type GalleryImage = GalleryModel["images"][number];
export type GalleryAlbum = NonNullable<
  GalleryModel["overview"]
>["albums"][number];
export function galleryError(e: unknown) {
  return (
    (e as { data?: { code?: string } })?.data?.code ??
    [
      "UNAUTHORIZED",
      "CONFLICT",
      "NOT_FOUND",
      "STORAGE_LIMIT",
      "INVALID_IMAGE",
      "UNSUPPORTED_FORMAT",
      "UPLOAD_REQUIRED",
      "INTERRUPTED",
      "LIMIT_REACHED",
      "VALIDATION_ERROR",
      "DOWNLOAD_LIMIT",
      "RATE_LIMITED",
    ].find((c) => String(e).includes(c)) ??
    "UNAVAILABLE"
  );
}
