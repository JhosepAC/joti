import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { SpaceWorkspace } from "@/features/spaces/components/space-workspace";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("metadata.workspace");
  return {
    title: t("title"),
    description: t("description"),
  };
}

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
