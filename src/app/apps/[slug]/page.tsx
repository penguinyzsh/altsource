/**
 * App 详情页
 *
 * Server Component 负责数据查询，
 * UI 渲染委托给 AppDetailContent（Client Component）以支持多语言。
 */

import { prisma } from "@/core/db";
import { notFound } from "next/navigation";
import { AppDetailContent } from "@/modules/app-detail/app-detail-content";
import { SITE_URL } from "@/core/constants";

/** 强制动态渲染（页面直接查询数据库，不适合构建时预渲染） */
export const dynamic = "force-dynamic";

export default async function AppDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const app = await prisma.app.findUnique({
    where: { slug },
    include: {
      versions: {
        orderBy: { date: "desc" },
      },
    },
  });

  if (!app) {
    notFound();
  }

  const siteUrl = SITE_URL;
  const sourceUrl = `${siteUrl}/api/source/${app.slug}`;
  const altStoreUrl = `altstore://source?url=${encodeURIComponent(sourceUrl)}`;

  return (
    <AppDetailContent
      app={JSON.parse(JSON.stringify(app))}
      sourceUrl={sourceUrl}
      altStoreUrl={altStoreUrl}
    />
  );
}
