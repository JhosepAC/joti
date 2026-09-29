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
import { SpinnerIcon } from "./icons";
import type { SpaceTool, WorkspaceSpace } from "../types/space.types";
import { SpaceSidebar } from "./space-sidebar";
import { SpaceContent } from "./space-content";

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
 *
 * Layout: Fixed left sidebar (collapsible) + main content area.
 * Sidebar shows the space's tools (derived from its purpose).
 * Content area shows the selected tool's view.
 */
export const SpaceWorkspace: React.FC<Props> = ({ slug }) => {
  const router = useRouter();
  const [state, setState] = useState<State>({ kind: "loading" });
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
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
        // Auto-select first tool
        if (result.template.tools.length > 0 && !activeTool) {
          setActiveTool(result.template.tools[0].key);
        }
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
  const activeToolData = tools.find((t) => t.key === activeTool) || null;

  const handleToolClick = (toolKey: string) => {
    setActiveTool(toolKey);
  };

  const handleCreateNew = (toolKey: string) => {
    // TODO: Open create modal for the specific tool
    console.log(`Create new ${toolKey}`);
    // For now, just select the tool
    setActiveTool(toolKey);
  };

  const handleSidebarToggle = () => {
    setSidebarCollapsed((prev) => !prev);
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <SpaceSidebar
        tools={tools}
        activeTool={activeTool}
        onToolClick={handleToolClick}
        onCreateNew={handleCreateNew}
        collapsed={sidebarCollapsed}
        onToggleCollapse={handleSidebarToggle}
        spaceName={space.name}
        spaceIcon={space.icon}
      />

      {/* Main Content */}
      <main
        className={`flex-1 flex flex-col min-w-0 transition-all duration-200 ${
          sidebarCollapsed ? "ml-16" : "ml-64"
        }`}
        style={{ minHeight: "100vh" }}
      >
        <SpaceContent
          activeTool={activeToolData}
          tools={tools}
          onCreateNew={handleCreateNew}
        />
      </main>
    </div>
  );
};