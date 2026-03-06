/**
 * 首页 — App 列表
 *
 * Server Component 负责数据查询，
 * UI 渲染委托给 HomeContent（Client Component）以支持多语言。
 */

import { prisma } from "@/core/db";
import { HomeContent } from "@/modules/home/home-content";

/** 强制动态渲染（页面直接查询数据库，不适合构建时预渲染） */
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const apps = await prisma.app.findMany({
    include: {
      versions: {
        orderBy: { date: "desc" },
        take: 1,
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  const totalVersions = apps.reduce(
    (sum: number, app: { versions: unknown[] }) => sum + app.versions.length,
    0
  );

  const siteTitle = process.env.SITE_TITLE!;
  const siteDescription = process.env.SITE_DESCRIPTION!;

  return (
    <HomeContent
      apps={JSON.parse(JSON.stringify(apps))}
      totalVersions={totalVersions}
      siteTitle={siteTitle}
      siteDescription={siteDescription}
    />
  );
}
