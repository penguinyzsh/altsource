/**
 * 全局错误边界
 *
 * 当页面渲染过程中发生未捕获的错误时显示此组件。
 * 使用 Next.js App Router 的 error 约定（必须为客户端组件）。
 *
 * 提供：
 * - 友好的错误提示 UI
 * - 重试按钮（调用 reset 重新渲染）
 * - 返回首页链接
 */

"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/ui/shadcn/button";
import { IconArrowLeft, IconRefresh, IconAlertTriangle } from "@tabler/icons-react";
import { useTranslation } from "@/ui/layout/i18n-provider";

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    const { t } = useTranslation();

    useEffect(() => {
        console.error("Uncaught error:", error);
    }, [error]);

    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
            <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-destructive/10">
                <IconAlertTriangle size={40} className="text-destructive" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight mb-2">{t("error.title")}</h1>
            <p className="text-muted-foreground mb-8 max-w-sm">
                {t("error.message")}
            </p>
            <div className="flex gap-3">
                <Button variant="outline" onClick={reset} className="gap-1.5">
                    <IconRefresh size={16} />
                    {t("error.retry")}
                </Button>
                <Link href="/">
                    <Button className="gap-1.5">
                        <IconArrowLeft size={16} />
                        {t("error.backHome")}
                    </Button>
                </Link>
            </div>
        </div>
    );
}
