/**
 * 管理面板头部操作栏
 *
 * 包含标题、App 数量统计、全部刷新按钮、添加按钮和退出登录按钮。
 */

"use client";

import { Button } from "@/ui/shadcn/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/ui/shadcn/tooltip";
import { IconRefresh, IconPlus, IconLogout } from "@tabler/icons-react";
import { useTranslation } from "@/ui/layout/i18n-provider";

interface AdminHeaderProps {
    /** 当前 App 总数 */
    appCount: number;
    /** 是否正在全局刷新中 */
    refreshing: boolean;
    /** 全部刷新回调 */
    onRefreshAll: () => void;
    /** 添加 App 回调 */
    onAdd: () => void;
    /** 退出登录回调 */
    onLogout: () => void;
}

export function AdminHeader({ appCount, refreshing, onRefreshAll, onAdd, onLogout }: AdminHeaderProps) {
    const { t } = useTranslation();

    return (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">{t("admin.title")}</h1>
                <p className="text-sm text-muted-foreground mt-1">
                    {t("admin.subtitle", { count: appCount })}
                </p>
            </div>
            <div className="flex items-center gap-2 self-start sm:self-auto">
                <Tooltip>
                    <TooltipTrigger render={
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={onRefreshAll}
                            disabled={refreshing}
                            className="gap-1.5"
                        >
                            <IconRefresh
                                size={14}
                                className={refreshing ? "animate-spin" : ""}
                            />
                            {refreshing ? t("admin.refreshing") : t("admin.refreshAll")}
                        </Button>
                    } />
                    <TooltipContent>
                        <p>{t("admin.refreshTooltip")}</p>
                    </TooltipContent>
                </Tooltip>
                <Button
                    size="sm"
                    onClick={onAdd}
                    className="gap-1.5"
                >
                    <IconPlus size={14} />
                    {t("admin.addApp")}
                </Button>
                <div className="w-px h-6 bg-border/50 mx-1" />
                <Tooltip>
                    <TooltipTrigger render={
                        <Button variant="ghost" size="icon-sm" onClick={onLogout} className="text-muted-foreground hover:text-destructive">
                            <IconLogout size={16} />
                        </Button>
                    } />
                    <TooltipContent>
                        <p>{t("admin.logout")}</p>
                    </TooltipContent>
                </Tooltip>
            </div>
        </div>
    );
}
