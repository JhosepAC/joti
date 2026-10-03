"use client";

import { ConvexProvider, ConvexReactClient } from "convex/react";
import { ReactNode, useMemo } from "react";

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

  const client = useMemo(() => {
    if (!convexUrl) return null;
    return new ConvexReactClient(convexUrl);
  }, [convexUrl]);

  // Fail closed: without a backend URL every auth call would throw at
  // interaction time with a generic message. Surface the misconfiguration
  // immediately instead of rendering a broken app.
  if (!client) {
    console.error("NEXT_PUBLIC_CONVEX_URL is not defined. ConvexProvider will not be initialized.");
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6">
        <div
          role="alert"
          className="w-full max-w-[420px] rounded-3xl border border-error/20 bg-red-50 p-6 text-center"
        >
          <h1 className="text-lg font-semibold text-text-primary font-heading">
            Configuration error
          </h1>
          <p className="mt-2 text-sm font-light text-text-secondary">
            The app backend is not configured (missing{" "}
            <code className="rounded bg-background px-1.5 py-0.5 text-xs">
              NEXT_PUBLIC_CONVEX_URL
            </code>
            ). Set it in <code className="rounded bg-background px-1.5 py-0.5 text-xs">.env.local</code> and
            restart the dev server.
          </p>
        </div>
      </div>
    );
  }

  return <ConvexProvider client={client}>{children}</ConvexProvider>;
}
