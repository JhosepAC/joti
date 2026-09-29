import type { Metadata } from "next";
import { SpaceWorkspace } from "@/features/spaces/components/space-workspace";

export const metadata: Metadata = {
  title: "Espacio - Joti",
  description: "Tu espacio de trabajo en Joti",
};

/**
 * `/w/[slug]`
 *
 * A server component that only forwards the slug; the workspace itself is a
 * client component because rendering a space requires a claim grant, which is
 * carried in `sessionStorage` and validated server-side per request. A static
 * shell here would either have to render nothing useful or fetch space data
 * without authorization.
 */
export default async function WorkspacePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <SpaceWorkspace slug={slug} />;
}
