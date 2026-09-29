"use client";

import * as React from "react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { clearGrants, readSpaceGrant, storeSpaceGrant } from "@/features/auth/utils/claim-store";
import { getAuthErrorMessage } from "@/features/auth/utils/get-auth-error-message";
import { purposeTitle } from "../catalog";
import { LayersIcon, LockIcon, SpinnerIcon } from "./icons";
import type { SpaceTool, WorkspaceSpace } from "../types/space.types";

interface Props {
  slug: string;
}

type State =
  | { kind: "loading" }
  | { kind: "ready"; space: WorkspaceSpace; tools: SpaceTool[] }
  | { kind: "denied"; message: string };

/**
 * Workspace shell for `/w/<slug>`.
 *
 * The slug is public — it is in the URL — so it authorizes nothing. A space is
 * only rendered for a caller holding a grant bound to that exact space, which
 * `spaces.actions.getWorkspace` verifies server-side; a guessed slug renders the
 * "not available" state instead of somebody's space.
 */
export const SpaceWorkspace: React.FC<Props> = ({ slug }) => {
  const router = useRouter();
  const [state, setState] = useState<State>({ kind: "loading" });
  const getWorkspace = useAction(api.spaces.actions.getWorkspace);

  useEffect(() => {
    let cancelled = false;

    // Read here rather than during render: the grant lives in `sessionStorage`,
    // which does not exist on the server, so a render-time read would produce a
    // different tree on the server and on the client.
    const grant = readSpaceGrant(slug);

    if (!grant) {
      setState({
        kind: "denied",
        message: "Tu sesión no está activa. Inicia sesión para entrar a este espacio.",
      });
      return;
    }

    void (async () => {
      try {
        const result = await getWorkspace({ slug, grant });
        if (cancelled) return;
        // The grant was rotated server-side; keep the replacement so a reload
        // does not have to sign in again.
        storeSpaceGrant(result.space.slug, result.grant);
        setState({ kind: "ready", space: result.space, tools: result.template.tools });
      } catch (err: unknown) {
        if (cancelled) return;
        setState({
          kind: "denied",
          message: getAuthErrorMessage(err, "No pudimos abrir este espacio."),
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [getWorkspace, slug]);

  if (state.kind === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center" aria-busy="true">
        <SpinnerIcon className="text-2xl text-icon" strokeWidth={2} />
        <span className="sr-only">Cargando espacio</span>
      </div>
    );
  }

  if (state.kind === "denied") {
    return (
      <div className="mx-auto flex min-h-screen w-full max-w-[460px] flex-col items-center justify-center px-6 text-center">
        <h1 className="text-2xl font-semibold text-text-primary font-heading">
          Espacio no disponible
        </h1>
        <p className="mt-2 text-sm font-light text-text-secondary">{state.message}</p>
        <Button
          variant="primary"
          className="mt-6 h-11 rounded-full"
          onClick={() => router.replace("/auth/login")}
        >
          Iniciar sesión
        </Button>
      </div>
    );
  }

  const { space, tools } = state;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex w-full max-w-5xl items-center gap-4 px-6 py-5">
          <span
            aria-hidden="true"
            className="flex h-11 w-11 items-center justify-center rounded-full bg-surface text-2xl ring-1 ring-border"
          >
            {space.icon}
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold text-text-primary font-heading">
              {space.name}
            </h1>
            <p className="text-xs font-light text-text-secondary">
              {purposeTitle(space.purpose)}
              {space.is_private && (
                <span className="ml-2 inline-flex items-center gap-1 align-middle">
                  <LockIcon className="text-[11px]" />
                  Privado
                </span>
              )}
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-6 py-8">
        <section aria-labelledby="toolsHeading" className="mb-8">
          <h2 id="toolsHeading" className="mb-3 flex items-center gap-1.5 text-sm font-medium text-text-primary">
            <LayersIcon className="text-icon" />
            Herramientas de este espacio
          </h2>
          <ul className="flex flex-wrap gap-2">
            {tools.map((tool) => (
              <li
                key={tool.key}
                className="rounded-full border border-border bg-surface px-3 py-1.5 text-xs text-text-secondary"
              >
                {tool.label}
              </li>
            ))}
          </ul>
        </section>

        {/*
          Placeholder on purpose. The onboarding creates the space and records
          its setup; the items inside a space are a separate scope, so this
          states the empty state instead of faking content.
        */}
        <div className="rounded-3xl border border-dashed border-border-strong px-6 py-16 text-center">
          <h2 className="text-lg font-semibold text-text-primary font-heading">
            Tu espacio está listo
          </h2>
          <p className="mx-auto mt-2 max-w-sm text-sm font-light text-text-secondary">
            Aquí aparecerán tus notas, tareas y proyectos. Este espacio se creó
            vacío a propósito: aún no hay nada dentro.
          </p>
        </div>

        <p className="mt-8 text-center text-xs text-text-muted">
          ¿Necesitas otra cosa?{" "}
          <button
            type="button"
            // Drops the space grant so "cambiar de cuenta" cannot leave a live
            // token behind for whoever signs in on this tab next.
            onClick={() => {
              clearGrants();
              router.replace("/auth/login");
            }}
            className="text-text-secondary hover:underline"
          >
            Cambiar de cuenta
          </button>
        </p>
      </main>
    </div>
  );
};
