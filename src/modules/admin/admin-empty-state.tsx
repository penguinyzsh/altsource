/**
 * 管理面板空状态
 *
 * 当没有收录任何 App 时显示，引导用户添加第一个应用。
 */

"use client";

import { Button } from "@/ui/shadcn/button";
import { Card, CardContent } from "@/ui/shadcn/card";
import { IconApps, IconPlus } from "@tabler/icons-react";
import { useTranslation } from "@/ui/layout/i18n-provider";

interface AdminEmptyStateProps {
    /** 添加 App 回调 */
    onAdd: () => void;
}

export function AdminEmptyState({ onAdd }: AdminEmptyStateProps) {
    const { t } = useTranslation();

    return (
        <Card className="border-dashed">
            <CardContent className="flex flex-col items-center py-16 text-center">
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
                    <IconApps size={24} className="text-primary" />
                </div>
                <h3 className="text-lg font-semibold mb-2">{t("adminEmpty.title")}</h3>
                <p className="text-muted-foreground text-sm mb-6 max-w-sm">
                    {t("adminEmpty.description")}
                </p>
                <Button onClick={onAdd} className="gap-1.5">
                    <IconPlus size={14} />
                    {t("adminEmpty.action")}
                </Button>
            </CardContent>
        </Card>
    );
}
