"use client";

import { ConvexProvider, ConvexReactClient } from "convex/react";
import { ReactNode, useMemo } from "react";
import { useTranslations } from "next-intl";

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  const t = useTranslations("providers.convex");

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
            {t("title")}
          </h1>
          <p className="mt-2 text-sm font-light text-text-secondary">
            {t.rich("description", {
              code: (chunks) => (
                <code className="rounded bg-background px-1.5 py-0.5 text-xs">{chunks}</code>
              ),
              variable: "NEXT_PUBLIC_CONVEX_URL",
              file: ".env.local",
            })}
          </p>
        </div>
      </div>
    );
  }

  return <ConvexProvider client={client}>{children}</ConvexProvider>;
}
