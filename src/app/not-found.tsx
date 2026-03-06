/**
 * 全局 404 页面
 *
 * 当用户访问不存在的路由时显示此页面。
 * 使用 Next.js App Router 的 not-found 约定。
 */

"use client";

import Link from "next/link";
import { Button } from "@/ui/shadcn/button";
import { IconArrowLeft, IconMoodSad } from "@tabler/icons-react";
import { useTranslation } from "@/ui/layout/i18n-provider";

export default function NotFound() {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-muted">
        <IconMoodSad size={40} className="text-muted-foreground" />
      </div>
      <h1 className="text-3xl font-bold tracking-tight mb-2">{t("notFound.title")}</h1>
      <p className="text-muted-foreground mb-8 max-w-sm">
        {t("notFound.message")}
      </p>
      <Link href="/">
        <Button variant="outline" className="gap-1.5">
          <IconArrowLeft size={16} />
          {t("notFound.backHome")}
        </Button>
      </Link>
    </div>
  );
}
